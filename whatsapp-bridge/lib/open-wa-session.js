'use strict';
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizePhone, isGroupId } = require('./phone');
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function createClient(options) {
  const { createClient: createCore, Client } = require('@open-wa/wa-automate');
  const { PuppeteerDriver } = await import('@open-wa/driver-puppeteer');
  // Construct before starting so stop/restart can cancel an unscanned QR.
  // Per-client events prevent QR credentials crossing account boundaries.
  const core = await createCore({ ...options, driver: new PuppeteerDriver() });
  return { client: new Client({ client: core, transport: core.getTransport() }), core };
}

class OpenWaSession extends EventEmitter {
  constructor({ dataDir, clientId, clientFactory = createClient, encodeQR } = {}) {
    super();
    if (!UUID.test(clientId || '')) throw new Error('Invalid account id.');
    this.clientId = clientId.toLowerCase();
    this.directory = path.resolve(dataDir, 'open-wa', this.clientId);
    this.clientFactory = clientFactory;
    this.encodeQR = encodeQR || (qr => require('qrcode').toDataURL(qr, { width: 300, margin: 3 }));
    this.state = 'disconnected';
    this.qr = null;
    this.account = null;
    this.error = '';
    this.run = null;
    this.stopping = null;
  }
  status() {
    return { state: this.state, qr: this.qr, account: this.account, error: this.error,
      engine: 'open-wa', capabilities: { pairingCode: false, remoteLogout: false } };
  }
  isReady() { return this.state === 'ready' && this.run?.client?.getState() === 'READY'; }
  setState(state, error = '') {
    this.state = state;
    this.error = error;
    if (state !== 'qr') this.qr = null;
    if (state !== 'ready') this.account = null;
    this.emit('status', this.status());
  }
  async start() {
    if (this.stopping) await this.stopping;
    if (this.run && ['disconnected', 'error'].includes(this.state)) await this.stop();
    if (this.run) return this.status();
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const keyFile = path.join(this.directory, 'encryption.key');
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('base64'), { flag: 'wx', mode: 0o600 });
    const run = { client: null, listeners: [], qrVersion: 0, phase: 'launch.create.start' };
    this.run = run;
    const current = () => this.run === run;
    this.setState('starting');
    run.task = (async () => {
      // Let the HTTP start response flush before the SDK's first module load.
      await new Promise(resolve => setImmediate(resolve));
      try {
        const { client, core } = await this.clientFactory({
          sessionId: this.clientId, userDataDir: path.join(this.directory, 'profile'),
          sessionDataPath: path.join(this.directory, 'session.data.json'), skipSessionSave: false,
          sessionDataEncryptionKeyFile: keyFile,
          headless: true, ephemeral: false, qrTimeoutMs: 600000, authTimeoutMs: 120000,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
          browser: { download: 'never' }, eventMode: false, debug: false,
          browserArgs: process.env.CHROME_NO_SANDBOX === 'true' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : [],
          allowDangerousBrowserArgs: false,
          logConsole: false, logConsoleErrors: false,
        });
        run.client = client;
        if (!current()) { await client.stop('cancelled'); return; }
        function listen(event, handler) {
          core.events.on(event, handler);
          run.listeners.push(() => core.events.off(event, handler));
        }
        for (const phase of ['launch.browser.init.before', 'launch.browser.init.after', 'launch.navigation.gotoWaWeb.before',
          'launch.navigation.gotoWaWeb.after', 'launch.auth.check.before', 'launch.auth.check.after', 'launch.auth.qr.generated',
          'launch.auth.qr.scanned', 'launch.auth.syncing', 'launch.auth.timeout', 'launch.wapi.inject.before', 'launch.wapi.inject.after',
          'launch.session.validityCheck.before', 'launch.session.validityCheck.after', 'launch.license.check.before', 'launch.license.check.after',
          'launch.patch.init.before', 'launch.patch.init.after', 'launch.client.finalize.before', 'launch.client.finalize.after']) {
          listen(phase, () => { run.phase = phase; });
        }
        listen('launch.auth.qr.generated', async event => {
          if (!current() || !event.details?.qr) return;
          const version = ++run.qrVersion;
          try {
            const image = await this.encodeQR(event.details.qr);
            if (!current() || version !== run.qrVersion || this.state === 'ready' || this.state === 'authenticating') return;
            this.qr = image;
            this.setState('qr');
          } catch { if (current()) this.setState('error', 'Could not prepare the QR code. Restart the connection.'); }
        });
        listen('launch.auth.qr.scanned', () => { if (current()) { run.qrVersion++; this.setState('authenticating'); } });
        listen('session.logout', () => {
          if (current()) { fs.rmSync(path.join(this.directory, 'linked'), { force: true }); this.setState('disconnected'); }
        });
        await client.start();
        if (!current()) return;
        if (client.getState() !== 'READY' || !core.getReadiness().exposureSafe) throw new Error('Not ready');
        const [me, phone] = await Promise.all([client.getMe(), client.getHostNumber()]);
        if (!current()) return;
        this.setState('ready');
        this.account = { name: String(me.pushname || me.name || ''), phone: String(phone || '').replace(/@.*$/, '').replace(/\D/g, '') };
        run.account = this.account;
        fs.writeFileSync(path.join(this.directory, 'linked'), 'linked', { mode: 0o600 });
        this.emit('status', this.status());
        const incoming = client.onMessage(message => {
          if (!current() || message.fromMe || message.type !== 'chat' || !message.body || !/@c\.us$/.test(String(message.from))) return;
          this.emit('incoming', { phone: message.from.replace(/@c\.us$/, ''), text: String(message.body).slice(0, 500) });
        });
        run.listeners.push(() => incoming.off());
        const changed = client.onStateChanged(state => {
          if (!current()) return;
          if (state === 'READY' || state === 'CONNECTED') {
            if (this.state !== 'ready') { this.setState('ready'); this.account = run.account; this.emit('status', this.status()); }
          } else if (['UNPAIRED', 'UNPAIRED_IDLE', 'DISCONNECTED', 'STOPPED', 'ERROR'].includes(state)) {
            this.setState('disconnected', 'WhatsApp disconnected. Restart to reconnect.');
          }
        });
        run.listeners.push(() => changed.off());
      } catch (error) {
        if (current()) {
          this.run = null;
          const message = String(error?.message || '');
          const code = message.match(/\b(?:PORTABLE_[A-Z_]+|SESSION_[A-Z_]+|[A-Z_]+_TIMEOUT)\b/)?.[0];
          const qrTimeout = /(?:qr.*(?:timeout|timed? out)|(?:timeout|timed? out).*qr)/i.test(message);
          // Only fixed categories and our event names are retained, never raw SDK errors.
          try { fs.writeFileSync(path.join(this.directory, 'startup-diagnostic.json'), JSON.stringify({ at: new Date().toISOString(), phase: run.phase, code: code || null, category: qrTimeout ? 'qr-timeout' : 'startup-failure' }), { mode: 0o600 }); } catch { /* Diagnostics must not prevent cleanup. */ }
          this.setState('error', qrTimeout ? 'The QR pairing window expired. Get a fresh code and scan it from WhatsApp Linked devices.'
            : `WhatsApp could not start${code ? ` (${code})` : ''}. Check this computer’s connection and restart to get a fresh QR code.`);
        }
        run.listeners.splice(0).forEach(off => off());
        await run.client?.stop('startup-failed').catch(() => {});
      }
    })();
    return this.status();
  }
  async stop({ logout = false } = {}) {
    if (this.stopping) return this.stopping;
    const run = this.run;
    this.run = null;
    this.setState('disconnected');
    this.stopping = (async () => {
      run?.listeners.splice(0).forEach(off => off());
      await run?.client?.stop('socialverse-stop');
      await run?.task;
      if (logout && fs.existsSync(this.directory)) {
        // Only this validated UUID's app-managed directory may be removed.
        const root = fs.realpathSync(path.dirname(this.directory));
        const target = fs.realpathSync(this.directory);
        if (path.dirname(target) !== root || path.basename(target) !== this.clientId) throw new Error('Unsafe session path.');
        fs.rmSync(target, { recursive: true, force: true });
      }
      return this.status();
    })();
    try { return await this.stopping; } finally { this.stopping = null; }
  }
  async restart() { await this.stop(); return this.start(); }
  async pairingCode() { throw new Error('This connection uses a QR code. Scan it from WhatsApp Linked devices.'); }
  async groups() {
    if (!this.isReady()) throw new Error('WhatsApp is not connected. Scan the QR code first.');
    const chats = await this.run.client.getAllChats();
    return chats.filter(chat => chat.isGroup && isGroupId(typeof chat.id === 'string' ? chat.id : chat.id?._serialized))
      .map(chat => ({ id: typeof chat.id === 'string' ? chat.id : chat.id._serialized, name: chat.name || chat.formattedTitle || '', size: chat.groupMetadata?.participants?.length ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async send(to, text, media) {
    if (!this.isReady()) throw new Error('WhatsApp is not connected. Scan the QR code first.');
    const target = isGroupId(to) ? to : `${normalizePhone(to)}@c.us`;
    const result = media
      ? await this.run.client.sendFile(target, `data:${media.mimetype};base64,${media.data}`, media.filename, {
          caption: text || undefined, type: media.asDocument ? 'document' : media.mimetype.startsWith('image/') ? 'image' : media.mimetype.startsWith('video/') ? 'video' : 'document',
        })
      : await this.run.client.sendText(target, text);
    if (typeof result !== 'string' || !result) throw new Error('WhatsApp did not return a message ID. Check the chat before retrying.');
    return { id: result };
  }
}
module.exports = { OpenWaSession };
