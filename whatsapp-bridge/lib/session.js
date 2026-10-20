'use strict';
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { normalizePhone, isGroupId } = require('./phone');

// Opening WhatsApp Web in Chromium and waiting for it to sync can hang
// forever on a bad connection; surface that as an error the user can act on.
const LOADING_TIMEOUT_MS = 120_000;

// A thin state machine over a whatsapp-web.js client:
//   disconnected -> starting -> qr -> authenticating -> ready
// The QR is re-emitted by WhatsApp every ~20s until scanned; the latest one
// is always what status() returns. clientFactory/encodeQR are injectable so
// the API and job code can be tested without launching a browser.
class WhatsAppSession extends EventEmitter {
  constructor({ dataDir, clientId = "socialverse", clientFactory, encodeQR } = {}) {
    super();
    this.dataDir = dataDir;
    this.clientId = clientId;
    this.clientFactory = clientFactory || (() => {
      const { Client, LocalAuth } = require('whatsapp-web.js');
      return new Client({
        authStrategy: new LocalAuth({ clientId, dataPath: path.join(dataDir, 'whatsapp-session') }),
        puppeteer: {
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: process.env.CHROME_NO_SANDBOX === 'true' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : [],
        },
      });
    });
    this.encodeQR = encodeQR || ((qr) => require('qrcode').toDataURL(qr, { width: 300, margin: 3 }));
    this.state = 'disconnected';
    this.qr = null;
    this.error = '';
    this.account = null;
    this.client = null;
  }

  status() {
    return { state: this.state, qr: this.qr, account: this.account, error: this.error };
  }

  isReady() {
    return this.state === 'ready';
  }

  setState(state, error = '') {
    this.state = state;
    this.error = error;
    if (state !== 'qr') this.qr = null;
    if (state !== 'ready') this.account = null;
    clearTimeout(this.loadingTimer);
    if (state === 'starting' || state === 'authenticating') {
      this.loadingTimer = setTimeout(() => {
        this.setState('error', 'WhatsApp is taking too long to load. Restart the session and check the server\'s internet connection.');
      }, LOADING_TIMEOUT_MS);
      this.loadingTimer.unref();
    }
    this.emit('status', this.status());
  }

  async start() {
    if (this.client) return this.status();
    this.setState('starting');
    let client;
    try {
      client = this.clientFactory();
    } catch (error) {
      this.setState('error', error.message);
      return this.status();
    }
    this.client = client;
    // Events from a client that has since been replaced must not touch state.
    const current = () => this.client === client;

    client.on('qr', async (qr) => {
      if (!current() || this.state === 'authenticating' || this.state === 'ready') return;
      try {
        const image = await this.encodeQR(qr);
        if (!current()) return;
        this.qr = image;
        this.setState('qr');
      } catch (error) {
        if (current()) this.setState('error', error.message);
      }
    });
    client.on('authenticated', () => current() && this.setState('authenticating'));
    client.on('ready', () => {
      if (!current()) return;
      this.setState('ready');
      this.account = { name: client.info?.pushname || '', phone: client.info?.wid?.user || '' };
      this.emit('status', this.status());
    });
    client.on('auth_failure', () => current() && this.setState('error', 'WhatsApp authentication failed. Start the session again.'));
    client.on('disconnected', (reason) => {
      if (!current()) return;
      this.client = null;
      this.setState('disconnected', String(reason || 'WhatsApp disconnected.'));
    });
    client.on('message', (message) => {
      if (!current() || message.fromMe || message.type !== 'chat' || !message.body) return;
      // Only one-to-one chats from a real phone number: groups, channels and
      // status updates aren't customers replying to a broadcast.
      if (!/@c\.us$/.test(message.from)) return;
      this.emit('incoming', { phone: message.from.replace(/@c\.us$/, ''), text: String(message.body).slice(0, 500) });
    });

    Promise.resolve()
      .then(() => client.initialize())
      .catch((error) => {
        if (!current()) return;
        this.client = null;
        this.setState('error', error.message || 'Could not start WhatsApp.');
      });
    return this.status();
  }

  async stop({ logout = false } = {}) {
    const client = this.client;
    this.client = null;
    try {
      if (client) {
        if (logout) await client.logout();
        else await client.destroy();
      }
    } finally {
      this.setState('disconnected');
    }
    return this.status();
  }

  async restart() {
    await this.stop().catch(() => {});
    return this.start();
  }

  // Alternative to scanning: WhatsApp shows an 8-character code on the phone
  // linked by number instead. Only valid while the session is waiting to be
  // linked (the QR stage).
  async pairingCode(phone) {
    if (!this.client || this.state !== 'qr') {
      throw new Error('Wait for the QR code to appear, then ask for a code.');
    }
    return this.client.requestPairingCode(normalizePhone(phone));
  }

  async groups() {
    if (!this.isReady()) throw new Error('WhatsApp is not connected. Scan the QR code first.');
    const client = this.client;
    let chats;
    try {
      chats = await client.getChats();
    } catch (error) {
      throw new Error(`Could not load your WhatsApp groups (${error.message}). Try again in a moment.`);
    }
    return chats
      .filter((chat) => chat.isGroup && isGroupId(chat.id?._serialized))
      .map((chat) => ({ id: chat.id._serialized, name: chat.name || '', size: chat.participants?.length ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // `to` is a phone number or a group id. `media` is { mimetype, data (base64), filename, asDocument }.
  async send(to, text, media) {
    if (!this.isReady()) throw new Error('WhatsApp is not connected. Scan the QR code first.');
    const client = this.client;
    let target;
    if (isGroupId(to)) {
      target = to;
    } else {
      const registered = await client.getNumberId(normalizePhone(to));
      if (!registered) throw new Error('This number is not on WhatsApp.');
      target = registered._serialized;
    }
    let result;
    if (media) {
      const { MessageMedia } = require('whatsapp-web.js');
      const file = new MessageMedia(media.mimetype, media.data, media.filename);
      result = await client.sendMessage(target, file, { caption: text || undefined, sendMediaAsDocument: Boolean(media.asDocument) });
    } else {
      result = await client.sendMessage(target, text);
    }
    return { id: result?.id?._serialized || '' };
  }
}

module.exports = { WhatsAppSession };
