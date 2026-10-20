'use strict';
const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');

const MAX_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

// Anything that isn't a routable public address. The media URL comes from an
// API caller, so without this a request could be pointed at the bridge's own
// network (cloud metadata, internal services) and read back through WhatsApp.
const blocked = new net.BlockList();
for (const [addr, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(addr, bits, 'ipv4');
for (const [addr, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) {
  blocked.addSubnet(addr, bits, 'ipv6');
}

function isPublicAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  const ip = mapped ? mapped[1] : address;
  const family = net.isIPv4(ip) ? 'ipv4' : net.isIPv6(ip) ? 'ipv6' : null;
  return family !== null && !blocked.check(ip, family);
}

async function resolvePublic(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Media URLs must be public HTTPS addresses on port 443 without credentials.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
    throw new Error('Media URLs may not point at local, private or reserved network addresses.');
  }
  return { url, address: addresses[0].address };
}

async function fetchPublic(input, redirects = MAX_REDIRECTS) {
  const { url, address } = await resolvePublic(input);
  const result = await new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { 'User-Agent': 'SocialVerseWhatsAppBridge/1.0', 'Accept-Encoding': 'identity' },
        // Pin the address that was just validated so a second DNS answer
        // can't swap in a private one between the check and the connection.
        lookup: (_host, options, callback) => {
          const family = net.isIPv6(address) ? 6 : 4;
          if (options && options.all) callback(null, [{ address, family }]);
          else callback(null, address, family);
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) request.destroy(new Error('Media file is larger than 16 MB.'));
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, buffer: Buffer.concat(chunks), url }));
      },
    );
    const deadline = setTimeout(() => request.destroy(new Error('Media download timed out.')), TIMEOUT_MS);
    request.on('close', () => clearTimeout(deadline));
    request.on('error', reject);
  });

  if ([301, 302, 303, 307, 308].includes(result.status)) {
    if (!redirects || !result.headers.location) throw new Error('Too many redirects while downloading media.');
    return fetchPublic(new URL(result.headers.location, result.url).href, redirects - 1);
  }
  if (result.status !== 200) throw new Error(`Media download failed (HTTP ${result.status}).`);
  return result;
}

const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};

// Downloads a media URL and returns what the session needs to send it.
// Images and mp4 go out inline; a PDF goes out as a document.
async function fetchMedia(mediaUrl) {
  const result = await fetchPublic(mediaUrl);
  const ext = (/\.[a-z0-9]+$/i.exec(new URL(mediaUrl).pathname) || [''])[0].toLowerCase();
  const headerType = String(result.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const mimetype = Object.values(TYPES).includes(headerType) ? headerType : TYPES[ext];
  if (!mimetype) throw new Error('Unsupported media type. Use JPG, PNG, MP4 or PDF.');
  const filename = decodeURIComponent(new URL(mediaUrl).pathname.split('/').pop() || 'attachment') || 'attachment';
  return {
    mimetype,
    data: result.buffer.toString('base64'),
    filename,
    asDocument: mimetype === 'application/pdf',
  };
}

module.exports = { fetchMedia, isPublicAddress, resolvePublic };
