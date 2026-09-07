#!/usr/bin/env bash
#
# Privacy Lens - one-command launcher (macOS / Linux).
# Starts the FastAPI backend (:8000) and Next.js dashboard (:3000).
# On first run it creates the venv, installs deps, and pulls the Ollama model.
#
# Usage:  ./start.sh   (add PORT=4000 to override the dashboard port)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PORT="${PORT:-3000}"
LOGS="$ROOT"

info() { printf '\033[0;32m%s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m%s\033[0m\n' "$*"; }

http_ok() { curl -fsS -o /dev/null --max-time 3 "$1" >/dev/null 2>&1; }

wait_http() {
  local url="$1" name="$2" i
  for i in $(seq 1 90); do
    if http_ok "$url"; then info "$name is up at $url"; return 0; fi
    sleep 1
  done
  warn "$name did not respond at $url within 90s"
  return 1
}

ensure_python() {
  if [[ ! -x "$BACKEND/.venv/bin/python" ]]; then
    local py
    py="$(command -v python3 || command -v python || true)"
    if [[ -z "$py" ]]; then
      echo "Python 3.11+ not found. Install it first." >&2
      exit 1
    fi
    warn "Creating Python virtual environment..."
    "$py" -m venv "$BACKEND/.venv"
  fi
  warn "Ensuring backend dependencies..."
  "$BACKEND/.venv/bin/python" -m pip install -q -r "$BACKEND/requirements.txt"
}

ensure_node() {
  if [[ ! -d "$FRONTEND/node_modules" ]]; then
    warn "Installing frontend dependencies (first run)..."
    (cd "$FRONTEND" && npm install --no-fund --no-audit)
  fi
}

ensure_ollama() {
  if ! command -v ollama >/dev/null 2>&1; then
    warn "Ollama is not installed. The fast regex engine will be used (no LLM needed)."
    warn "To enable LLM mode, install Ollama: https://ollama.ai"
    return 0
  fi
  if ! http_ok "http://localhost:11434/api/tags"; then
    warn "Starting Ollama..."
    (nohup ollama serve >"$LOGS/ollama.log" 2>&1 &)
    if ! wait_http "http://localhost:11434/api/tags" "Ollama" 30; then
      warn "Ollama did not start. The fast regex engine will be used (no LLM needed)."
      return 0
    fi
  fi

  local selected
  selected="$("$BACKEND/.venv/bin/python" - <<'PY'
import json, urllib.request
try:
    with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=3) as resp:
        tags = json.load(resp)
except Exception:
    exit(2)
names = [m.get("name", "") for m in tags.get("models", [])]
preferred = ["llama3.1:8b", "qwen2.5:7b"]
for p in preferred:
    if p in names:
        print(p)
        break
else:
    for p in preferred:
        fam = p.split(":")[0]
        for n in names:
            if n.split(":")[0] == fam:
                print(n)
                break
        else:
            continue
        break
    else:
        print("")
PY
  )" || true

  if [[ -z "$selected" ]]; then
    warn "No preferred model found. Pulling llama3.1:8b (~4.9 GB)..."
    ollama pull llama3.1:8b
    selected="llama3.1:8b"
  fi
  info "Ollama model in use: $selected"
}

start_backend() {
  if http_ok "http://localhost:8000/health"; then info "Backend already running at :8000"; return; fi
  warn "Starting backend on :8000..."
  (cd "$BACKEND" && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 \
    >"$LOGS/backend.log" 2>&1) &
  wait_http "http://localhost:8000/health" "Backend"
}

start_frontend() {
  if http_ok "http://localhost:$PORT"; then info "Frontend already running at :$PORT"; return; fi
  warn "Starting frontend on :$PORT..."
  (cd "$FRONTEND" && exec npx next dev -p "$PORT" >"$LOGS/frontend.log" 2>&1) &
  wait_http "http://localhost:$PORT" "Frontend"
}

trap 'kill 0' INT TERM EXIT

echo "=== Privacy Lens ==="
ensure_python
ensure_node
ensure_ollama
start_backend
start_frontend

echo ""
info "Dashboard:   http://localhost:$PORT"
info "API docs:    http://localhost:8000/docs"
echo "Logs: backend.log / frontend.log in the project root."
echo "Press Ctrl+C to stop both servers."
wait