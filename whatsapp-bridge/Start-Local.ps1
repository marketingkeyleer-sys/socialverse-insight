$ErrorActionPreference = 'Stop'
$bridgeDir = $PSScriptRoot
$toolsDir = Join-Path (Split-Path $bridgeDir -Parent) '.local-tools'
$runtime = Get-ChildItem -LiteralPath $toolsDir -Directory -Filter 'node-v22.*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1
if (!$runtime) { throw 'The private Node.js runtime has not been installed.' }
if (!(Test-Path (Join-Path $toolsDir 'cloudflared.exe'))) { throw 'The local tunnel program has not been installed.' }
if (!(Test-Path (Join-Path $toolsDir 'zstd/zstd-v1.5.7-win64/zstd.exe'))) { throw 'Zstandard has not been installed.' }
$node = Join-Path $runtime.FullName 'node.exe'
$runDir = Join-Path $bridgeDir '.runtime'
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$lockFile = Join-Path $runDir 'host.lock'
if (Test-Path -LiteralPath $lockFile) {
  $previousHostId = 0
  if (![int]::TryParse((Get-Content -LiteralPath $lockFile -Raw).Trim(), [ref]$previousHostId)) { throw 'Invalid host lock. Inspect it before restarting.' }
  if (Get-Process -Id $previousHostId -ErrorAction SilentlyContinue) { throw 'The local host is already running.' }
  Remove-Item -LiteralPath $lockFile
}
Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $bridgeDir 'windows-host.cjs') + '"') -WorkingDirectory $bridgeDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDir 'host.log') -RedirectStandardError (Join-Path $runDir 'host-error.log') | Out-Null
Write-Output 'Local WhatsApp host starting. Status: whatsapp-bridge/.runtime/status.json'
