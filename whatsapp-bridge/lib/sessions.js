'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { WhatsAppSession } = require('./session');
const { OpenWaSession } = require('./open-wa-session');

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One WhatsApp session per SocialVerse account, so many users can each scan
// their own QR against this one hosted bridge. Each session is its own
// Chromium, which is what limits how many fit (MAX_SESSIONS).
class SessionManager {
  constructor({ dataDir, max = 10, factory, onIncoming, engine = process.env.WHATSAPP_ENGINE || 'whatsapp-web.js' }) {
    this.dataDir = dataDir;
    this.max = max;
    this.onIncoming = onIncoming;
    if (!['open-wa', 'whatsapp-web.js'].includes(engine)) throw new Error('Unknown WhatsApp engine.');
    this.engine = engine;
    this.factory = factory || ((id) => new (engine === 'open-wa' ? OpenWaSession : WhatsAppSession)({ dataDir, clientId: id }));
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
    return session ? session.status() : { state: 'disconnected', qr: null, account: null, error: '', engine: this.engine, capabilities: { pairingCode: this.engine !== 'open-wa', remoteLogout: this.engine !== 'open-wa' } };
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
    if (this.engine === 'open-wa') {
      const root = path.join(this.dataDir, 'open-wa');
      if (!fs.existsSync(root)) return [];
      return fs.readdirSync(root).filter(id => SessionManager.isValidId(id) && fs.existsSync(path.join(root, id, 'linked')));
    }
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
