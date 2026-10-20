'use strict';
const express = require('express');
const { safeEqual } = require('./signing');
const { PACES } = require('./jobs');
const { validateCallbackUrl } = require('./callback');
const { normalizePhone, isGroupId } = require('./phone');

const MAX_TARGETS = 2000;
const MAX_TEXT = 4096;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseJob(body, callbackOptions) {
  const fail = (message) => {
    throw new HttpError(400, message);
  };
  if (!body || typeof body !== 'object') fail('Send a JSON body.');
  if (!/^[0-9a-f-]{36}$/i.test(String(body.jobId ?? ''))) fail('jobId must be a UUID.');
  const accountId = String(body.accountId ?? '');
  if (!accountId || accountId.length > 64) fail('accountId is required.');
  let callbackUrl;
  try {
    callbackUrl = validateCallbackUrl(body.callbackUrl, callbackOptions);
  } catch (error) {
    fail(error.message);
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) fail('text is required.');
  if (text.length > MAX_TEXT) fail(`text is longer than ${MAX_TEXT} characters.`);
  const pace = String(body.pace ?? 'balanced');
  if (!PACES[pace]) fail(`pace must be one of: ${Object.keys(PACES).join(', ')}.`);
  let mediaUrl = null;
  if (body.mediaUrl) {
    try {
      const url = new URL(String(body.mediaUrl));
      if (url.protocol !== 'https:') throw new Error('not https');
      mediaUrl = url.href;
    } catch {
      fail('mediaUrl must be an https URL.');
    }
  }
  if (!Array.isArray(body.targets) || body.targets.length === 0) fail('targets must be a non-empty array.');
  if (body.targets.length > MAX_TARGETS) fail(`A job can have at most ${MAX_TARGETS} targets.`);
  const seen = new Set();
  const targets = body.targets.map((t, i) => {
    const id = String(t?.id ?? '');
    if (!id || id.length > 64 || seen.has(id)) fail(`targets[${i}].id must be unique and at most 64 characters.`);
    seen.add(id);
    let to;
    try {
      to = isGroupId(t.to) ? t.to : normalizePhone(t.to);
    } catch (error) {
      fail(`targets[${i}]: ${error.message}`);
    }
    return { id, to, name: typeof t.name === 'string' ? t.name.slice(0, 100) : '' };
  });
  return { id: body.jobId.toLowerCase(), accountId, callbackUrl, text, pace, mediaUrl, targets };
}

// Every /api route needs `Authorization: Bearer <BRIDGE_API_KEY>`. Only
// /health is open (for the host's health check) and it reveals nothing but
// the session state name.
function createApp({ apiKey, sessions, jobs, callbackOptions = {} }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, sessions: sessions.sessions.size }));

  app.use("/api", (req, res, next) => {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || !safeEqual(token, apiKey)) return res.status(401).json({ error: "Invalid API key." });
    next();
  });

  const route = (handler) => async (req, res) => {
    try {
      res.json(await handler(req, res));
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || "Unexpected error." });
    }
  };

  const accountId = (req) => {
    if (!sessions.constructor.isValidId(req.params.id)) throw new HttpError(400, "Invalid account id.");
    return req.params.id.toLowerCase();
  };
  const ensure = (id) => {
    try {
      return sessions.ensure(id);
    } catch (error) {
      throw new HttpError(503, error.message);
    }
  };

  app.get("/api/sessions/:id/status", route((req) => sessions.status(accountId(req))));

  app.post("/api/sessions/:id/start", route((req) => ensure(accountId(req)).start()));
  app.post("/api/sessions/:id/restart", route((req) => ensure(accountId(req)).restart()));
  app.post("/api/sessions/:id/logout", route((req) => sessions.logout(accountId(req))));

  app.post("/api/sessions/:id/pairing-code", route(async (req) => {
    const session = sessions.get(accountId(req));
    if (!session) throw new HttpError(409, "Start the WhatsApp session first.");
    try {
      return { code: await session.pairingCode(req.body?.phone) };
    } catch (error) {
      throw new HttpError(400, error.message);
    }
  }));

  app.get("/api/sessions/:id/groups", route(async (req) => {
    const session = sessions.get(accountId(req));
    if (!session) throw new HttpError(409, "WhatsApp is not connected. Scan the QR code first.");
    try {
      return { groups: await session.groups() };
    } catch (error) {
      throw new HttpError(409, error.message);
    }
  }));

  app.post("/api/jobs", route((req, res) => {
    const input = parseJob(req.body, callbackOptions);
    if (!sessions.constructor.isValidId(input.accountId)) throw new HttpError(400, "accountId must be a UUID.");
    res.status(202);
    return jobs.create(input);
  }));

  app.get("/api/jobs/:id", route((req) => {
    const job = jobs.read(req.params.id);
    if (!job) throw new HttpError(404, "Job not found.");
    return jobs.summary(job);
  }));

  app.post("/api/jobs/:id/cancel", route((req) => {
    const summary = jobs.cancel(req.params.id);
    if (!summary) throw new HttpError(404, "Job not found.");
    return summary;
  }));

  return app;
}

module.exports = { createApp, parseJob, HttpError };
