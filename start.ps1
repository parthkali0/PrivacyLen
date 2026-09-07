<#
.SYNOPSIS
    Privacy Lens - one-command launcher (Windows / PowerShell 5.1+).

.DESCRIPTION
    Starts the FastAPI backend (port 8000) and the Next.js dashboard (port 3000).
    On first run it creates the Python venv, installs dependencies, installs
    frontend packages, ensures Ollama is running, and pulls a model if needed.

.EXAMPLE
    .\start.ps1
    .\start.ps1 -Port 3000
#>
param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend   = Join-Path $Root "backend"
$Frontend  = Join-Path $Root "frontend"
$VenvPy    = Join-Path $Backend ".venv\Scripts\python.exe"

function Say  ($msg) { Write-Host $msg }
function Warn ($msg) { Write-Host $msg -ForegroundColor Yellow }
function Ok   ($msg) { Write-Host $msg -ForegroundColor Green }

function Test-Http($url) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null; return $true }
    catch { return $false }
}

function Wait-Http($url, $name, $maxSeconds = 90) {
    for ($i = 0; $i -lt $maxSeconds; $i++) {
        if (Test-Http $url) { Ok "$name is up at $url"; return $true }
        Start-Sleep 1
    }
    Warn "$name did not respond at $url within ${maxSeconds}s"
    return $false
}

function Ensure-Python {
    if (-not (Test-Path $VenvPy)) {
        $py = $null
        $pyCmd = Get-Command python -ErrorAction SilentlyContinue
        if ($pyCmd) { $py = $pyCmd.Source }
        if (-not $py) {
            $pyCmd = Get-Command py -ErrorAction SilentlyContinue
            if ($pyCmd) { $py = $pyCmd.Source }
        }
        if (-not $py) {
            # winget-installed Python (user scope) that may not be on PATH yet
            $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python"
            $found = Get-ChildItem -Path $candidate -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | Select-Object -First 1
            if ($found) { $py = $found.FullName }
        }
        if (-not $py) { throw "Python 3.11+ not found. Install it from https://www.python.org/downloads/" }

        Warn "Creating Python virtual environment..."
        & $py -m venv (Join-Path $Backend ".venv")
        if ($LASTEXITCODE -ne 0) { throw "Failed to create the virtual environment." }
    }
    Warn "Ensuring backend dependencies..."
    & $VenvPy -m pip install --quiet -r (Join-Path $Backend "requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "Failed to install backend dependencies." }
}

function Ensure-Node {
    if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
        Warn "Installing frontend dependencies (first run - takes a minute)..."
        Push-Location $Frontend
        try { npm install --no-fund --no-audit }
        finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { throw "Failed to install frontend dependencies." }
    }
}

function Ensure-Ollama {
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Warn "Ollama is not installed. The fast regex engine will be used (no LLM needed)."
        Warn "To enable LLM mode, install Ollama: https://ollama.ai"
        return
    }
    if (-not (Get-Process ollama -ErrorAction SilentlyContinue)) {
        Warn "Starting Ollama..."
        Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    }
    if (-not (Wait-Http "http://localhost:11434/api/tags" "Ollama" 30)) {
        Warn "Ollama did not start. The fast regex engine will be used (no LLM needed)."
        return
    }

    $tags = Invoke-RestMethod "http://localhost:11434/api/tags"
    $names = @($tags.models | ForEach-Object { $_.name })

    $pick = $names | Where-Object { $_ -in @("llama3.1:8b", "qwen2.5:7b") } | Select-Object -First 1
    if (-not $pick) {
        $pick = $names | Where-Object { $_ -match "^(llama3|llama2|qwen)" } | Select-Object -First 1
    }
    if (-not $pick) {
        Warn "No preferred model found. Pulling llama3.1:8b (~4.9 GB) - this may take a while..."
        & ollama pull llama3.1:8b
        $pick = "llama3.1:8b"
    }
    Ok "Ollama model in use: $pick"
}

function Start-Backend {
    if (Test-Http "http://localhost:8000/health") { Ok "Backend already running at http://localhost:8000"; return }
    Warn "Starting backend on http://localhost:8000 ..."
    $log = Join-Path $Root "backend.log"
    Start-Process -FilePath $VenvPy `
        -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
        -WorkingDirectory $Backend `
        -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden | Out-Null
    if (-not (Wait-Http "http://localhost:8000/health" "Backend")) {
        if (Test-Path "$log.err") { Warn "Backend log tail:"; Get-Content "$log.err" -Tail 20 }
    }
}

function Start-Frontend {
    if (Test-Http "http://localhost:$Port") { Ok "Frontend already running at http://localhost:$Port"; return }
    Warn "Starting frontend on http://localhost:$Port ..."
    $log = Join-Path $Root "frontend.log"
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/c", "npx next dev -p $Port") `
        -WorkingDirectory $Frontend `
        -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden | Out-Null
    Start-Sleep 1
    if (-not (Wait-Http "http://localhost:$Port" "Frontend")) {
        if (Test-Path "$log.err") { Warn "Frontend log tail:"; Get-Content "$log.err" -Tail 20 }
    }
}

Say "=== Privacy Lens ==="
Ensure-Python
Ensure-Node
Ensure-Ollama
Start-Backend
Start-Frontend

Say ""
Ok "Dashboard:   http://localhost:$Port"
Ok "API docs:    http://localhost:8000/docs"
Say "Logs: $Root\backend.log and $Root\frontend.log"
Say "Stop the servers by closing their windows (Ctrl+C if run in a terminal)."