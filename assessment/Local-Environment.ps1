$taskRepository = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path (Split-Path -Parent $taskRepository) '.runtime'
$taskRubyBin = Join-Path $taskRuntime 'rubyinstaller-3.3.2-1-x64\bin'
if (-not (Test-Path -LiteralPath (Join-Path $taskRubyBin 'ruby.exe'))) { throw 'Workspace runtime not found. Follow RUNBOOK.md for a standard Ruby/PostgreSQL setup.' }
$env:GEM_HOME = Join-Path $taskRuntime 'gems'
$env:GEM_PATH = $env:GEM_HOME + ';' + (Join-Path $taskRuntime 'rubyinstaller-3.3.2-1-x64\lib\ruby\gems\3.3.0')
$env:BUNDLE_CACHE_PATH = (Join-Path $taskRuntime 'gems\cache').Replace('\', '/')
$env:PATH = (Join-Path $env:GEM_HOME 'bin') + ';' + $taskRubyBin + ';' + $env:PATH
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '55432'
$env:DB_USERNAME = 'case_study'
$env:DB_PASSWORD = ''
$env:ALLOWED_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174'
$env:WEB_CONCURRENCY = '0'
$env:RAILS_MAX_THREADS = '5'
$env:RAILS_ENV = 'development'
$taskPrivate = Join-Path $PSScriptRoot 'private'
New-Item -ItemType Directory -Force -Path $taskPrivate | Out-Null
$taskSecretFile = Join-Path $taskPrivate 'development-secret.txt'
if (-not (Test-Path -LiteralPath $taskSecretFile)) {
  $taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
  $taskBytes = New-Object byte[] 64
  $taskRandom.GetBytes($taskBytes)
  $taskSecret = -join ($taskBytes | ForEach-Object { $_.ToString('x2') })
  [IO.File]::WriteAllText($taskSecretFile, $taskSecret)
  $taskRandom.Dispose()
}
$env:SECRET_KEY_BASE = [IO.File]::ReadAllText($taskSecretFile)
