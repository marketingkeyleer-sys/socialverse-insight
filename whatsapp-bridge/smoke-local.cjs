'use strict';
// Generates and discards an unpaired QR. Never sends a message or logs the QR.
const fs = require('node:fs');
const path = require('node:path');
const config = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '.env')));
const id = require('node:crypto').randomUUID();
const endpoint = `http://127.0.0.1:${config.PORT || 3000}/api/sessions/${id}`;
const resultFile = path.join(__dirname, '.runtime', 'engine-smoke.json');
const headers = { Authorization: `Bearer ${config.BRIDGE_API_KEY}` };
async function request(op, method = 'GET') {
  const response = await fetch(`${endpoint}/${op}`, { method, headers: { ...headers, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, body: method === 'POST' ? '{}' : undefined, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Bridge returned HTTP ${response.status}`);
  return response.json();
}
(async () => {
  let result = { state: 'starting', qrGenerated: false };
  try {
    await request('start', 'POST');
    for (let attempt = 0; attempt < 90; attempt++) {
      const status = await request('status');
      result = { state: status.state, qrGenerated: Boolean(status.qr), engine: status.engine };
      fs.writeFileSync(resultFile, JSON.stringify(result));
      if (result.qrGenerated || status.state === 'error') break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    result = { state: 'test-error', qrGenerated: false, error: error.message, code: error.cause?.code };
  } finally {
    await request('logout', 'POST').catch(() => {});
    fs.writeFileSync(resultFile, JSON.stringify(result));
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.qrGenerated ? 0 : 1;
})();
