'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { WhatsAppSession } = require('./session');

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One WhatsApp session per SocialVerse account, so many users can each scan
// their own QR against this one hosted bridge. Each session is its own
// Chromium, which is what limits how many fit (MAX_SESSIONS).
class SessionManager {
  constructor({ dataDir, max = 10, factory, onIncoming }) {
    this.dataDir = dataDir;
    this.max = max;
    this.onIncoming = onIncoming;
    this.factory = factory || ((id) => new WhatsAppSession({ dataDir, clientId: id }));
    this.sessions = new Map();
  }

  static isValidId(id) {
    return ID.test(String(id ?? ''));
  }

  get(id) {
    return this.sessions.get(String(id).toLowerCase()) || null;
  }

  // The id becomes part of a directory name, so only real UUIDs are accepted.
  ensure(id) {
    const key = String(id).toLowerCase();
    if (!SessionManager.isValidId(key)) throw new Error('Invalid account id.');
    let session = this.sessions.get(key);
    if (!session) {
      if (this.sessions.size >= this.max) {
        throw new Error('This WhatsApp service is at capacity. Please try again later.');
      }
      session = this.factory(key);
      session.on('incoming', (message) => this.onIncoming?.(key, message));
      this.sessions.set(key, session);
    }
    return session;
  }

  status(id) {
    const session = this.get(id);
    return session ? session.status() : { state: 'disconnected', qr: null, account: null, error: '' };
  }

  async logout(id) {
    const session = this.get(id);
    if (!session) return this.status(id);
    const status = await session.stop({ logout: true });
    this.sessions.delete(String(id).toLowerCase());
    return status;
  }

  // Accounts whose phone was linked before a restart: their login is still on
  // disk, so they reconnect without anyone scanning again.
  savedIds() {
    const dir = path.join(this.dataDir, 'whatsapp-session');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => name.startsWith('session-') && SessionManager.isValidId(name.slice(8)))
      .map((name) => name.slice(8));
  }

  async stopAll() {
    await Promise.all([...this.sessions.values()].map((s) => s.stop().catch(() => {})));
  }
}

module.exports = { SessionManager };
