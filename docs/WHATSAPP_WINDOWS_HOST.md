# WhatsApp on this Windows computer

SocialVerse's QR bridge runs locally using open-wa 5.6.7. Supabase calls its authenticated API through a Cloudflare Quick Tunnel. The browser receives only its owner's QR via the authenticated WhatsApp function, never the bridge key.

## Start and stop

From the project directory in PowerShell:

```powershell
& .\whatsapp-bridge\Start-Local.ps1
& .\whatsapp-bridge\Stop-Local.ps1
```

Both the bridge and tunnel run in hidden background processes. Check `whatsapp-bridge/.runtime/status.json`: `online` means the public authenticated health check passed and the current URL/key were saved to Supabase. `configuration-failed` means the tunnel could not be verified or the existing Supabase CLI login could not save secrets. Sign in to the management CLI privately and restart; do not paste administrative keys into the application.

Installed private tools are under `.local-tools/`: Node 22.23.4, cloudflared 2026.10.3 and Zstandard 1.5.7, downloaded from official releases. Node and cloudflared downloads were checked against vendor SHA-256 values. Chrome uses an isolated automation browser, not your signed-in browser profile. Global Node and Windows PATH are unchanged.

This host does not automatically start at Windows login. Run Start-Local after restarting the computer. Keep the computer awake and connected. A Quick Tunnel's hostname changes on restart; the launcher updates Supabase automatically. Quick Tunnels have no uptime guarantee; use a stable named tunnel/server for dependable public service. See [Cloudflare's documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Link a phone

1. In SocialVerse choose the correct brand, Accounts → WhatsApp → Scan QR code.
2. Continue to the WhatsApp page.
3. On your phone open WhatsApp → Linked devices → Link a device and scan privately.
4. Wait for Linked and the real phone number to appear.

QR pairing stays available while the session and host run, until scanned or explicitly stopped. Browser startup and post-scan loading still have a two-minute watchdog, so a stalled browser can be restarted. A session error displays its explanation and a Restart control instead of being mislabeled as a network outage.

open-wa is an unofficial linked-device integration. The official Cloud API remains available. This open-wa integration currently supports QR pairing; unsupported phone-code pairing is hidden. Some open-wa features may require its own license; no license or subscription was purchased.

The connection is marked active only after authentication succeeds. Unfinished connections can be resumed without consuming another account slot. Brand ownership and account ownership are checked by the server. Local capacity is limited by MAX_SESSIONS and available RAM, not unlimited.

## Private storage and unlinking

`whatsapp-bridge/.env` contains the bridge key. `data/open-wa/<account-uuid>/` contains the encrypted session file and its local encryption key; protect this entire directory and backups as credentials. Both directories, runtime files and local tools are excluded from Git. No QR payload or session key is printed by the launcher.

Restart preserves linked sessions. Unlink stops the runtime and removes only that validated account's local session directory. Also remove the device in your phone's Linked devices to revoke it remotely; open-wa v5 does not provide an embedded remote logout API.

No messages are sent by setup or the QR smoke test. Actual publishing requires a linked phone, selected recipients and a submitted message/broadcast. Existing queue pacing, signed callbacks and STOP opt-outs remain in place. A returned message ID means submission, not delivery/read confirmation.

## Checks

```powershell
& .\.local-tools\node-v22.23.4-win-x64\node.exe --test whatsapp-bridge/test/*.test.js
& .\.local-tools\node-v22.23.4-win-x64\node.exe whatsapp-bridge/smoke-local.cjs
```

The smoke test creates a disposable unpaired session, checks that a QR is generated, then removes that test session. It never displays the QR or connects a phone.
