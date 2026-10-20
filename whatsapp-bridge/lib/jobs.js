'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// How long to wait between two sends. WhatsApp restricts numbers that blast
// messages at machine speed, so every job is paced like a person typing.
// Random within the range, never a fixed beat.
const PACES = {
  safe: [30_000, 90_000],
  balanced: [8_000, 25_000],
  fast: [2_000, 6_000],
};

const NOT_READY_RETRY_MS = 30_000;
const OUTBOX_RETRY_MS = 15_000;

function delayFor(paces, pace, random) {
  const [min, max] = paces[pace];
  return min + Math.floor(random() * (max - min + 1));
}

// A single sequential sender: jobs run one after another, one message at a
// time, state saved to disk after every step so a restart picks up where it
// stopped. Each result is queued in the job's outbox and delivered to
// SocialVerse by `notify`; an event stays in the outbox until that succeeds,
// so a SocialVerse outage delays reports instead of losing them.
class JobQueue {
  constructor({ dir, isReady, sendOne, notify, random = Math.random, paces = PACES }) {
    this.dir = path.join(dir, 'jobs');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.isReady = isReady;
    this.sendOne = sendOne;
    this.notify = notify;
    this.random = random;
    this.paces = paces;
    this.timer = null;
    this.running = false;
    this.stopped = false;
    this.nextSendAt = 0;
  }

  file(id) {
    return path.join(this.dir, `${id}.json`);
  }

  read(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.file(id), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  write(job) {
    job.updatedAt = new Date().toISOString();
    const temp = `${this.file(job.id)}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify(job), { mode: 0o600 });
      fs.renameSync(temp, this.file(job.id));
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }

  list() {
    return fs
      .readdirSync(this.dir)
      .filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name))
      .map((name) => this.read(name.slice(0, -5)))
      .filter(Boolean)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  summary(job) {
    const count = (status) => job.targets.filter((t) => t.status === status).length;
    return {
      id: job.id,
      state: job.state,
      total: job.targets.length,
      sent: count('sent'),
      failed: count('failed'),
      pending: count('pending') + count('sending'),
      cancelled: count('cancelled'),
      undelivered: job.outbox.length,
    };
  }

  // Called once on boot: a message that was mid-send when the process died
  // may or may not have gone out, so it's reported failed rather than retried
  // (a duplicate message to a customer is worse than a manual re-send).
  start() {
    for (const job of this.list()) {
      let changed = false;
      for (const target of job.targets) {
        if (target.status === 'sending') {
          target.status = 'failed';
          target.error = 'The bridge restarted while sending this message, so it was not retried to avoid a duplicate.';
          job.outbox.push({ recipientId: target.id, status: 'failed', error: target.error });
          changed = true;
        }
      }
      if (changed) this.write(job);
    }
    this.schedule(0);
  }

  create(input) {
    if (!this.paces[input.pace]) throw new Error('Unknown pace.');
    const existing = this.read(input.id);
    if (existing) return this.summary(existing);
    const job = {
      id: input.id,
      accountId: input.accountId,
      callbackUrl: input.callbackUrl,
      text: input.text,
      mediaUrl: input.mediaUrl || null,
      pace: input.pace,
      createdAt: new Date().toISOString(),
      state: 'running',
      mediaError: null,
      targets: input.targets.map((t) => ({ id: t.id, to: t.to, name: t.name || '', status: 'pending' })),
      outbox: [],
    };
    this.write(job);
    this.schedule(0);
    return this.summary(job);
  }

  cancel(id) {
    const job = this.read(id);
    if (!job) return null;
    if (job.state === 'running') {
      for (const target of job.targets) if (target.status === 'pending') target.status = 'cancelled';
      if (!job.targets.some((t) => t.status === 'sending')) job.state = 'cancelled';
      this.write(job);
    }
    return this.summary(job);
  }

  schedule(delay) {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), Math.max(0, delay));
    this.timer.unref?.();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  async flushOutbox(job) {
    if (job.outbox.length === 0) return true;
    try {
      await this.notify(job, job.outbox);
    } catch {
      return false;
    }
    job.outbox = [];
    this.write(job);
    return true;
  }

  async tick() {
    if (this.running || this.stopped) return;
    this.running = true;
    let next = null;
    try {
      next = await this.step();
    } catch (error) {
      console.error('Job queue error:', error.message);
      next = OUTBOX_RETRY_MS;
    } finally {
      this.running = false;
    }
    if (next !== null) this.schedule(next);
  }

  // Does at most one unit of work and returns how long to wait before the
  // next one (null = nothing left to do).
  async step() {
    const jobs = this.list();

    // Reports first: finished or not, an undelivered result must get out.
    for (const job of jobs) {
      if (job.outbox.length && !(await this.flushOutbox(job))) return OUTBOX_RETRY_MS;
    }

    const job = jobs.find((j) => j.state === 'running' && j.targets.some((t) => t.status === 'pending'));
    if (!job) {
      for (const done of jobs) {
        if (done.state === 'running' && !done.targets.some((t) => ['pending', 'sending'].includes(t.status))) {
          done.state = 'completed';
          this.write(done);
        }
      }
      return null;
    }

    if (!this.isReady(job)) return NOT_READY_RETRY_MS;
    const wait = this.nextSendAt - Date.now();
    if (wait > 0) return wait;

    const picked = job.targets.find((t) => t.status === 'pending');
    picked.status = 'sending';
    this.write(job);

    let outcome;
    try {
      const { id } = await this.sendOne(job, picked);
      outcome = { status: 'sent', messageId: id };
    } catch (error) {
      outcome = {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        // A media download that failed once will fail for everyone — stop the
        // whole job instead of attempting (and reporting) it per contact.
        fatal: Boolean(error && error.fatalForJob),
      };
    }

    // The send took a while; a cancel may have been written meanwhile, so
    // the result is applied to the latest saved copy, not the one read above.
    const latest = this.read(job.id) || job;
    const target = latest.targets.find((t) => t.id === picked.id);
    target.status = outcome.status;
    if (outcome.status === 'sent') target.messageId = outcome.messageId;
    else target.error = outcome.error;
    latest.outbox.push({
      recipientId: target.id,
      status: outcome.status,
      ...(outcome.status === 'sent' ? { messageId: outcome.messageId } : { error: outcome.error }),
    });
    if (outcome.fatal) {
      latest.mediaError = outcome.error;
      for (const other of latest.targets) {
        if (other.status === 'pending') {
          other.status = 'failed';
          other.error = outcome.error;
          latest.outbox.push({ recipientId: other.id, status: 'failed', error: outcome.error });
        }
      }
    }
    if (!latest.targets.some((t) => ['pending', 'sending'].includes(t.status))) {
      latest.state = latest.targets.some((t) => t.status === 'cancelled') ? 'cancelled' : 'completed';
    }
    this.write(latest);

    const morePending = latest.targets.some((t) => t.status === 'pending');
    this.nextSendAt = Date.now() + (morePending ? delayFor(this.paces, latest.pace, this.random) : 0);
    return 0;
  }
}

module.exports = { JobQueue, PACES, delayFor };
