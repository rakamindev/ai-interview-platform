$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Local-Environment.ps1')

function Test-TaskPort([int]$Port) {
  $taskClient = New-Object Net.Sockets.TcpClient
  try { return $taskClient.ConnectAsync('127.0.0.1', $Port).Wait(500) -and $taskClient.Connected }
  catch { return $false }
  finally { $taskClient.Dispose() }
}

if (-not (Test-TaskPort 55432)) {
  $taskPostgres = Join-Path $taskRuntime 'node\node_modules\@embedded-postgres\windows-x64\native\bin\postgres.exe'
  $taskData = Join-Path $taskRuntime 'pgdata'
  Start-Process -FilePath $taskPostgres -ArgumentList @('-D', ('"' + $taskData + '"'), '-p', '55432', '-h', '127.0.0.1') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskPrivate 'postgres.stdout.log') -RedirectStandardError (Join-Path $taskPrivate 'postgres.stderr.log') | Out-Null
}

Push-Location (Join-Path $taskRepository 'api')
try {
  & (Join-Path $taskRubyBin 'ruby.exe') bin/rails runner '../assessment/seed_demo.rb'
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic seed failed; inspect the API setup before starting the demo.' }
} finally { Pop-Location }

if (-not (Test-TaskPort 3001)) {
  Start-Process -FilePath (Join-Path $taskRubyBin 'ruby.exe') -ArgumentList @('bin/rails', 'server', '-b', '127.0.0.1', '-p', '3001') -WorkingDirectory (Join-Path $taskRepository 'api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskPrivate 'api.stdout.log') -RedirectStandardError (Join-Path $taskPrivate 'api.stderr.log') | Out-Null
}
if (-not (Test-TaskPort 5173)) {
  $taskNode = (Get-Command node.exe).Source
  Start-Process -FilePath $taskNode -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1') -WorkingDirectory (Join-Path $taskRepository 'web') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskPrivate 'web.stdout.log') -RedirectStandardError (Join-Path $taskPrivate 'web.stderr.log') | Out-Null
}
Write-Output 'Synthetic demo started: http://127.0.0.1:5173. Allow Rails to finish loading; startup logs are in assessment/private.'
