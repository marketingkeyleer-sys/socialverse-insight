// AES-256-GCM token encryption using Web Crypto (works in Cloudflare Workers + Node).
// Key is derived from OAUTH_ENCRYPTION_KEY (any string, hashed to 256 bits).

function b64encode(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey: Promise<CryptoKey> | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = process.env.OAUTH_ENCRYPTION_KEY;
  if (!raw) throw new Error("OAUTH_ENCRYPTION_KEY is not configured");
  cachedKey = (async () => {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  })();
  return cachedKey;
}

export async function encryptToken(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: b64encode(ct), iv: b64encode(iv) };
}

export async function decryptToken(ciphertext: string, iv: string): Promise<string> {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) },
    key,
    b64decode(ciphertext),
  );
  return new TextDecoder().decode(pt);
}

// PKCE helpers
export function randomString(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return b64url(a);
}
function b64url(bytes: Uint8Array) {
  return b64encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function pkceChallenge(verifier: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(hash));
}
