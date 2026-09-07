#!/usr/bin/env bash
#
# Privacy Lens v2.4 — one-command setup & launcher (macOS / Linux / WSL).
#
# Automates the entire local setup:
#   1. Verifies Python >= 3.11 and Node.js >= 20 are installed.
#   2. Creates backend/.venv if missing and installs backend/requirements.txt.
#   3. Installs frontend/ dependencies (npm ci / npm install) if node_modules is missing.
#   4. Starts the FastAPI backend  (http://localhost:8000)  and the Next.js
#      dashboard (http://localhost:3000) concurrently.
#   5. Verifies the backend /health endpoint returns 200 before the ready banner.
#
# Usage:  ./start.sh            (PORT=4000 ./start.sh to override the dashboard port)
#         ./start.sh --skip-ollama

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv"
PORT="${PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
LOGS="$ROOT"
SKIP_OLLAMA=0
[[ "${1:-}" == "--skip-ollama" ]] && SKIP_OLLAMA=1

info() { printf '\033[0;32m%s\033[0m\n' "$*"; }
step() { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33mWARN: %s\033[0m\n' "$*"; }
fail() { printf '\033[0;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

http_ok() {
  # Real HTTP check: 200 OK only.
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$1" 2>/dev/null || true)"
  [[ "$code" == "200" ]]
}

wait_http() {
  local url="$1" name="$2" i
  for i in $(seq 1 90); do
    if http_ok "$url"; then info "$name responded with 200 OK at $url"; return 0; fi
    sleep 1
  done
  warn "$name did not respond at $url within 90s"
  return 1
}

assert_python() {
  step "Checking Python 3.11+..."
  local py=""
  local ver=""
  for cmd in python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ver="$($cmd --version 2>&1 | sed -E 's/.*Python ([0-9]+)\.([0-9]+).*/\1.\2/')"
      if awk "BEGIN{exit !($ver >= 3.11)}"; then py="$cmd"; break; fi
    fi
  done
  [[ -z "$py" ]] && fail "Python 3.11+ not found. Install from https://www.python.org/downloads/"
  info "Found $($py --version 2>&1) at $(command -v "$py")"
  PY="$py"
}

assert_node() {
  step "Checking Node.js 20+..."
  command -v node >/dev/null 2>&1 || fail "Node.js 20+ not found. Install from https://nodejs.org/"
  local major
  major="$(node --version | tr -d 'v' | cut -d. -f1)"
  [[ "$major" -lt 20 ]] && fail "Node.js $(node --version) detected — version 20+ required (https://nodejs.org/)."
  info "Found Node.js $(node --version) (npm $(npm --version 2>/dev/null || echo '?'))"
}

ensure_venv() {
  step "Preparing Python virtual environment..."
  if [[ ! -x "$VENV/bin/python" ]]; then
    warn "Creating $VENV ..."
    "$PY" -m venv "$VENV"
  fi
  warn "Installing backend dependencies from backend/requirements.txt ..."
  "$VENV/bin/python" -m pip install -q --disable-pip-version-check -r "$BACKEND/requirements.txt"
  info "Backend environment ready."
}

ensure_node_modules() {
  step "Preparing frontend dependencies..."
  if [[ ! -d "$FRONTEND/node_modules" ]]; then
    warn "Installing frontend dependencies (first run — takes a minute)..."
    if [[ -f "$FRONTEND/package-lock.json" ]]; then
      (cd "$FRONTEND" && npm ci --no-fund --no-audit)
    else
      (cd "$FRONTEND" && npm install --no-fund --no-audit)
    fi
  fi
  info "Frontend dependencies present."
}

ensure_ollama() {
  [[ "$SKIP_OLLAMA" -eq 1 ]] && { warn "Skipping Ollama (flag set) — regex engine mode."; return; }
  if ! command -v ollama >/dev/null 2>&1; then
    warn "Ollama not installed — the ultra-fast regex engine will be used (no LLM needed)."
    return
  fi
  if ! http_ok "http://localhost:11434/api/tags"; then
    warn "Starting Ollama..."
    (nohup ollama serve >"$LOGS/ollama.log" 2>&1 &)
    wait_http "http://localhost:11434/api/tags" "Ollama" 30 || { warn "Ollama did not start — regex engine mode."; return; }
  fi

  local selected=""
  selected="$("$VENV/bin/python" - <<'PY'
import json, urllib.request
try:
    with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=3) as resp:
        tags = json.load(resp)
except Exception:
    raise SystemExit(2)
names = [m.get("name", "") for m in tags.get("models", [])]
for pick in ("llama3.1:8b", "qwen2.5:7b"):
    if pick in names:
        print(pick); break
else:
    for pick in ("llama3.1:8b", "qwen2.5:7b"):
        for n in names:
            if n.split(":")[0] == pick.split(":")[0]:
                print(n); break
        else:
            continue
        break
    else:
        print("")
PY
  )" || true

  if [[ -z "$selected" ]]; then
    warn "No preferred Ollama model found — pulling llama3.1:8b (~4.9 GB, may take a while)..."
    ollama pull llama3.1:8b
    selected="llama3.1:8b"
  fi
  info "Ollama model in use: $selected"
}

start_backend() {
  step "Starting backend..."
  if http_ok "http://localhost:$BACKEND_PORT/health"; then
    info "Backend already running at http://localhost:$BACKEND_PORT/health"
    return
  fi
  warn "Launching FastAPI backend on http://localhost:$BACKEND_PORT ..."
  (cd "$BACKEND" && exec "$VENV/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" \
    >"$LOGS/backend.log" 2>&1) &
  wait_http "http://localhost:$BACKEND_PORT/health" "Backend" || {
    [[ -f "$LOGS/backend.log" ]] && { tail -n 20 "$LOGS/backend.log" >&2; }
    fail "Backend failed to become healthy — see backend.log"
  }
}

start_frontend() {
  step "Starting frontend..."
  if http_ok "http://localhost:$PORT"; then
    info "Frontend already running at http://localhost:$PORT"
    return
  fi
  warn "Launching Next.js dashboard on http://localhost:$PORT ..."
  (cd "$FRONTEND" && exec npx next dev -p "$PORT" >"$LOGS/frontend.log" 2>&1) &
  wait_http "http://localhost:$PORT" "Frontend" || {
    [[ -f "$LOGS/frontend.log" ]] && { tail -n 20 "$LOGS/frontend.log" >&2; }
    warn "Frontend did not become ready — see frontend.log"
  }
}

cleanup() { kill 0 2>/dev/null || true; }
trap 'cleanup' INT TERM EXIT

echo ""
echo "  ================================================="
echo "   Privacy Lens v2.4 Enterprise — one-command setup"
echo "   FastAPI :$BACKEND_PORT  |  Next.js :$PORT  |  100% local"
echo "  ================================================="

assert_python
assert_node
ensure_venv
ensure_node_modules
ensure_ollama
start_backend
start_frontend

echo ""
echo "  System ready."
info "Dashboard:    http://localhost:$PORT"
info "API docs:     http://localhost:$BACKEND_PORT/docs"
info "Health check: http://localhost:$BACKEND_PORT/health → 200 OK"
echo "Logs: backend.log / frontend.log in the project root."
echo "Press Ctrl+C to stop both servers."
wait