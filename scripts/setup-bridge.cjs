// Creates whatsapp-bridge/.env on first run (with a fresh random API key) and
// installs the bridge's dependencies, so `npm run dev:all` works from a clean
// checkout. Never overwrites an existing .env.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execSync } = require("node:child_process");

const dir = path.join(__dirname, "..", "whatsapp-bridge");
const envFile = path.join(dir, ".env");

if (!fs.existsSync(path.join(dir, "node_modules"))) {
  console.log("Installing WhatsApp bridge dependencies (first run only)...");
  execSync("npm install --no-audit --no-fund", { cwd: dir, stdio: "inherit", env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: process.env.PUPPETEER_SKIP_DOWNLOAD ?? "" } });
}

if (!fs.existsSync(envFile)) {
  const projectUrl = (fs.existsSync(path.join(__dirname, "..", ".env.local"))
    ? fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]
    : "")?.trim();
  const key = crypto.randomBytes(32).toString("hex");
  const callback = projectUrl ? `${projectUrl.replace(/\/$/, "")}/functions/v1/whatsapp-webhook` : "";
  fs.writeFileSync(envFile, `BRIDGE_API_KEY=${key}\nCALLBACK_URL=${callback}\nMAX_SESSIONS=10\nDATA_DIR=./data\nPORT=3000\n`, { mode: 0o600 });
  console.log(`Created whatsapp-bridge/.env. Your bridge key (needed once for the Supabase secret):\n  ${key}`);
}
