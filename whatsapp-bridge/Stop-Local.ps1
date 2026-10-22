$runDir = Join-Path $PSScriptRoot '.runtime'
if (!(Test-Path -LiteralPath $runDir)) { Write-Output 'Local host is not running.'; exit }
Set-Content -LiteralPath (Join-Path $runDir 'stop') -Value 'stop'
Write-Output 'Local host shutdown requested.'
