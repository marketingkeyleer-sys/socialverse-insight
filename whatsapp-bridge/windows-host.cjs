'use strict';
// Local supervisor: no credentials, QR payloads or child output reach its log.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runDir = path.join(__dirname, '.runtime');
fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
const stopFile = path.join(runDir, 'stop');
const lock = path.join(runDir, 'host.lock');
fs.rmSync(stopFile, { force: true });
const config = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '.env')));
// All helpers are private to this checkout; do not change Windows' global PATH.
process.env.PATH = [path.dirname(process.execPath), path.join(root, '.local-tools', 'zstd', 'zstd-v1.5.7-win64'), process.env.PATH || ''].join(path.delimiter);
if (!config.BRIDGE_API_KEY || config.BRIDGE_API_KEY.length < 24) throw new Error('Bridge key is missing.');
const executable = config.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(executable)) throw new Error('Chrome executable was not found.');
const port = Number(config.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 }); }
catch { throw new Error('A host lock already exists. Check the existing host before restarting.'); }
let stopping = false;
let bridge;
let tunnel;
let tunnelRetry;
let syncing = Promise.resolve();
const statusFile = path.join(runDir, 'status.json');
function status(state, url) {
  fs.writeFileSync(statusFile, JSON.stringify({ pid: process.pid, state, url: url || null, updatedAt: new Date().toISOString() }), { mode: 0o600 });
  console.log(`${new Date().toISOString()} ${state}`);
}
async function syncSecret(url) {
  const secretFile = path.join(runDir, `secrets-${process.pid}.env`);
  try {
    fs.writeFileSync(secretFile, `WHATSAPP_BRIDGE_URL=${url}\nWHATSAPP_BRIDGE_KEY=${config.BRIDGE_API_KEY}\n`, { mode: 0o600 });
    const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, 'secrets', 'set', '--project-ref', 'igdbgaroizwqaphdhimd', '--env-file', secretFile], {
        cwd: root, windowsHide: true, stdio: 'ignore', timeout: 60000,
        env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}` },
      });
      child.once('error', reject);
      child.once('exit', resolve);
    });
    if (code !== 0) throw new Error('Supabase secret update failed. Check CLI login.');
    if (!stopping) status('online', url);
  } finally { fs.rmSync(secretFile, { force: true }); }
}
function startTunnel() {
  if (stopping) return;
  status('starting-tunnel');
  tunnel = spawn(path.join(root, '.local-tools', 'cloudflared.exe'), ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], {
    cwd: __dirname, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buffer = '';
  let seen = false;
  function inspect(chunk) {
    buffer = (buffer + chunk.toString()).slice(-12000);
    const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
    if (!seen && match) {
      seen = true;
      const url = match[0];
      status('configuring', url);
      syncing = syncing.then(async () => {
        // Verify the tunnel reaches our authenticated API before storing its URL.
        let verified = false;
        for (let attempt = 0; attempt < 12 && !stopping; attempt++) {
          try {
            const response = await fetch(`${url}/api/info`, { headers: { Authorization: `Bearer ${config.BRIDGE_API_KEY}` }, redirect: 'error', signal: AbortSignal.timeout(8000) });
            verified = response.ok && (await response.json()).service === 'socialverse-whatsapp';
          } catch { /* DNS propagation can take a few seconds. */ }
          if (verified) break;
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        if (!verified) throw new Error('Tunnel health check failed.');
        if (!stopping) await syncSecret(url);
      }).catch(() => { if (!stopping) status('configuration-failed', url); });
    }
  }
  tunnel.stdout.on('data', inspect);
  tunnel.stderr.on('data', inspect);
  tunnel.once('error', () => { if (!stopping) status('tunnel-launch-failed'); });
  tunnel.once('exit', () => {
    if (!stopping) { status('reconnecting'); tunnelRetry = setTimeout(startTunnel, 10000); }
  });
}
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearTimeout(tunnelRetry);
  clearInterval(stopPoll);
  status('stopping');
  tunnel?.kill();
  if (bridge?.connected) bridge.send('shutdown');
  await Promise.race([new Promise(resolve => !bridge || bridge.exitCode !== null ? resolve() : bridge.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 15000))]);
  if (bridge?.exitCode === null) bridge.kill();
  await syncing;
  status('offline');
  fs.rmSync(lock, { force: true });
  process.exit(0);
}
const stopPoll = setInterval(() => { if (fs.existsSync(stopFile)) void shutdown(); }, 1000);
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
status('starting-bridge');
bridge = spawn(process.execPath, ['server.js'], {
  cwd: __dirname, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  env: { ...process.env, ...config, HOST: '127.0.0.1', PORT: String(port), PUPPETEER_EXECUTABLE_PATH: executable },
});
bridge.once('error', () => { status('bridge-launch-failed'); void shutdown(); });
bridge.once('exit', () => { if (!stopping) { status('bridge-stopped'); void shutdown(); } });
(async () => {
  for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/info`, { headers: { Authorization: `Bearer ${config.BRIDGE_API_KEY}` }, signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.json()).service === 'socialverse-whatsapp') { startTunnel(); return; }
    } catch { /* Wait for the local process to bind. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!stopping) { status('bridge-health-failed'); await shutdown(); }
})();
