<#
.SYNOPSIS
    Privacy Lens v2.4 - one-command setup & launcher (Windows / PowerShell 5.1+).

.DESCRIPTION
    Automates the entire local setup:
      1. Verifies Python >= 3.11 and Node.js >= 20 are installed.
      2. Creates backend/.venv if missing and installs backend/requirements.txt.
      3. Installs frontend/ dependencies (npm ci / npm install) if node_modules is missing.
      4. Starts the FastAPI backend  (http://localhost:8000)  and the Next.js
         dashboard (http://localhost:3000) concurrently.
      5. Verifies the backend /health endpoint returns 200 OK before printing the
         ready banner and exiting 0 (or 1 on failure).

.EXAMPLE
    .\start.ps1
    .\start.ps1 -Port 3000
    .\start.ps1 -SkipOllama
#>
param(
    [int]$Port = 3000,
    [switch]$SkipOllama
)

$ErrorActionPreference = "Stop"

$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$VenvDir  = Join-Path $Backend ".venv"
$VenvPy   = Join-Path $VenvDir "Scripts\python.exe"
$BackendPort = 8000

function Say  ($msg) { Write-Host $msg }
function Step ($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Warn ($msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }
function Ok   ($msg) { Write-Host "OK:   $msg" -ForegroundColor Green }
function Fail ($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red }

function Test-Http($url) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | ForEach-Object { $_.StatusCode -eq 200 } }
    catch { return $false }
}

function Wait-Http($url, $name, $maxSeconds = 90) {
    for ($i = 0; $i -lt $maxSeconds; $i++) {
        if (Test-Http $url) { Ok "$name responded with 200 OK at $url"; return $true }
        Start-Sleep 1
    }
    Warn "$name did not respond at $url within ${maxSeconds}s"
    return $false
}

function Assert-Python {
    Step "Checking Python 3.11+..."
    $py = $null
    $candidates = @()
    $cmdPy = Get-Command python -ErrorAction SilentlyContinue
    if ($cmdPy) { $candidates += $cmdPy.Source }
    $cmdPy2 = Get-Command py -ErrorAction SilentlyContinue
    if ($cmdPy2) { $candidates += $cmdPy2.Source }
    if (-not $candidates) {
        $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python"
        Get-ChildItem -Path $candidate -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | ForEach-Object { $candidates += $_.FullName }
    }
    foreach ($c in $candidates) {
        try {
            $ver = & $c --version 2>&1
            if ($ver -match "Python (\d+)\.(\d+)") {
                $verNum = [int]$Matches[1] * 100 + [int]$Matches[2]
                if ($verNum -ge 311) { $py = $c; break }
            }
        } catch { }
    }
    if (-not $py) {
        Fail "Python 3.11+ was not found. Install it from https://www.python.org/downloads/ (enable 'Add to PATH')."
        exit 1
    }
    $pyVer = & $py --version 2>&1
    Ok "Found $pyVer at $py"
    $script:Py = $py
}

function Assert-Node {
    Step "Checking Node.js 20+..."
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Fail "Node.js 20+ was not found. Install it from https://nodejs.org/"
        exit 1
    }
    $nodeVer = (node --version).TrimStart('v')
    $major = [int]($nodeVer -split '\.')[0]
    if ($major -lt 20) {
        Fail "Node.js $nodeVer detected - version 20 or higher is required (https://nodejs.org/)."
        exit 1
    }
    Ok "Found Node.js v$nodeVer (npm $(npm --version))"
}

function Ensure-Venv {
    Step "Preparing Python virtual environment..."
    if (-not (Test-Path $VenvPy)) {
        Warn "Creating $VenvDir ..."
        & $script:Py -m venv $VenvDir
        if ($LASTEXITCODE -ne 0) { Fail "Failed to create the virtual environment."; exit 1 }
    }
    Warn "Installing backend dependencies from backend/requirements.txt ..."
    & $VenvPy -m pip install --quiet --disable-pip-version-check -r (Join-Path $Backend "requirements.txt")
    if ($LASTEXITCODE -ne 0) { Fail "Failed to install backend dependencies."; exit 1 }
    Ok "Backend environment ready."
}

function Ensure-NodeModules {
    Step "Preparing frontend dependencies..."
    $lockfile = Join-Path $Frontend "package-lock.json"
    if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
        Warn "Installing frontend dependencies (first run - takes a minute)..."
        Push-Location $Frontend
        try {
            if (Test-Path $lockfile) { npm ci --no-fund --no-audit }
            else { npm install --no-fund --no-audit }
        } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { Fail "Failed to install frontend dependencies."; exit 1 }
    }
    Ok "Frontend dependencies present."
}

function Ensure-Ollama {
    if ($SkipOllama) { Warn "Skipping Ollama (flag set) - regex engine mode."; return }
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Warn "Ollama not installed - the ultra-fast regex engine will be used (no LLM needed)."
        return
    }
    if (-not (Get-Process ollama -ErrorAction SilentlyContinue)) {
        Warn "Starting Ollama..."
        Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    }
    if (-not (Wait-Http "http://localhost:11434/api/tags" "Ollama" 30)) {
        Warn "Ollama did not start - regex engine mode (no LLM needed)."
        return
    }
    $tags = Invoke-RestMethod "http://localhost:11434/api/tags"
    $names = @($tags.models | ForEach-Object { $_.name })
    $pick = $names | Where-Object { $_ -in @("llama3.1:8b", "qwen2.5:7b") } | Select-Object -First 1
    if (-not $pick) { $pick = $names | Where-Object { $_ -match "^(llama3|llama2|qwen)" } | Select-Object -First 1 }
    if (-not $pick) {
        Warn "No preferred Ollama model found - pulling llama3.1:8b (~4.9 GB, may take a while)..."
        & ollama pull llama3.1:8b
        $pick = "llama3.1:8b"
    }
    Ok "Ollama model in use: $pick"
}

function Start-Backend {
    Step "Starting backend..." 
    if (Test-Http "http://localhost:$BackendPort/health") {
        Ok "Backend already running at http://localhost:$BackendPort/health"
        return
    }
    Warn "Launching FastAPI backend on http://localhost:$BackendPort ..."
    $log = Join-Path $Root "backend.log"
    Start-Process -FilePath $VenvPy `
        -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$BackendPort") `
        -WorkingDirectory $Backend `
        -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden | Out-Null
    if (-not (Wait-Http "http://localhost:$BackendPort/health" "Backend")) {
        if (Test-Path "$log.err") { Fail "Backend failed to become healthy:`n"; Get-Content "$log.err" -Tail 20 | ForEach-Object { Write-Host $_ -ForegroundColor Red } }
        exit 1
    }
}

function Start-Frontend {
    Step "Starting frontend..."
    if (Test-Http "http://localhost:$Port") {
        Ok "Frontend already running at http://localhost:$Port"
        return
    }
    Warn "Launching Next.js dashboard on http://localhost:$Port ..."
    $log = Join-Path $Root "frontend.log"
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/c", "npx next dev -p $Port") `
        -WorkingDirectory $Frontend `
        -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden | Out-Null
    if (-not (Wait-Http "http://localhost:$Port" "Frontend")) {
        if (Test-Path "$log.err") { Warn "Frontend log tail:"; Get-Content "$log.err" -Tail 20 }
    }
}

Say "`n  ================================================="
Say "   Privacy Lens v2.4 Enterprise - one-command setup"
Say "   FastAPI :8000  |  Next.js :$Port  |  100% local"
Say "  ================================================="

Assert-Python
Assert-Node
Ensure-Venv
Ensure-NodeModules
Ensure-Ollama
Start-Backend
Start-Frontend

Say "`n  System ready."
Ok "Dashboard:   http://localhost:$Port"
Ok "API docs:    http://localhost:$BackendPort/docs"
Ok "Health check:http://localhost:$BackendPort/health -> 200 OK"
Say "Logs: $Root\backend.log / $Root\frontend.log"
Say "Stop the dev servers by closing their windows (Ctrl+C if run in a terminal)."
exit 0