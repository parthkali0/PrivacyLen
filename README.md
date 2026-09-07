<div align="center">

# Privacy Lens v2.4 Enterprise

**AI-powered privacy policy analyzer** — turns legalese, Terms of Service, and
privacy contracts into plain English, a trust score, red flags, actionable
opt-outs, and clause-level change tracking — all wrapped in a dark-mode
cybersecurity / SOC-style operations panel.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-v2.0.0-009688)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2015-000000)
![Tailwind CSS](https://img.shields.io/badge/styling-Tailwind%20CSS%204-38b2ac)
![Browser](https://img.shields.io/badge/extension-Chrome%20%7C%20Edge%20MV3-4285F4)

</div>

---

## What it does

Paste a privacy policy, point it at a URL, or let the browser extension grab the
page — and Privacy Lens returns:

- **Trust score (0–10)** with an enterprise donut gauge and risk thresholds (≤3 block · 4–6 caution · ≥7 pass)
- **Plain-English executive summary** of the agreement
- **Data collected** vs. **data shared / sold** (+ category counts)
- **Rights you forfeit** (arbitration, class-action waivers, unilateral changes…)
- **Red flags** ranked by severity — High / Medium / Low — with clause quotes, statutory citations, and confidence scores
- **Actionable CCPA / CPRA / GDPR opt-out emails** generated from flagged clauses
- **Clause-level diff tracking** between policy revisions (silent terms changes caught)

> **Instant by default.** The core engine is a lightweight regex/rule matcher
> that returns structured results in under **50 ms** with no LLM and no network
> calls. An optional Ollama LLM path (`ANALYSIS_MODE=hybrid|llm`) produces
> richer summaries when you want them.

Two clients consume the same API: the **Privacy Lens v2.4 Enterprise dashboard**
(Next.js, SOC-style dark panel) and a **Manifest V3 browser extension** that
overlays a trust badge, highlights risky terms, and detects sign-up forms in
real time.

## Architecture

```
┌────────────────────────┐        ┌──────────────────────────────┐
│  Browser Extension      │        │  Next.js 15 Dashboard (:3000) │
│  MV3 · overlay badge   │        │  v2.4 Enterprise SOC panel    │
│  highlight on page     │        │  Analyst / Action / Diff tabs │
└────────────┬───────────┘        └───────────────┬──────────────┘
             │  text / URL                        │  text / URL
             ▼                                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                FastAPI Backend (:8000)   v2.0.0                  │
│                                                                   │
│   POST /api/v1/analyze  — trust score, summary, red flags         │
│   POST /api/v1/optout   — CCPA/CPRA/GDPR opt-out email            │
│   POST /api/v1/policies — save a tracked policy (SQLite)          │
│   GET  /api/v1/policies — list tracked policies                   │
│   POST /api/v1/diff     — clause-level drift between revisions    │
│                                                                   │
│   Analysis engine:                                                │
│     ├─ [DEFAULT] Regex/rule matcher (instant, <50ms)              │
│     └─ [optional] Ollama LLM  (llama3.1:8b ─► qwen2.5:7b)        │
│   Policy store: SQLite (stdlib) + schema-validated Pydantic models│
└───────┬──────────────────────────────────────┬────────────────────┘
        │  (optional)                          │  (provisioned)
        ▼                                      ▼
┌─────────────────────┐              ┌──────────────────────────┐
│ Ollama (localhost)  │              │ PostgreSQL + pgvector    │
│ :11434              │              │ (Docker sidecar, ready   │
└─────────────────────┘              │  for history persistence)│
                                     └──────────────────────────┘
```

> The policy tracker + diff engine run on plain **SQLite**
> (`backend/privacy_lens.db`, stdlib only, git-ignored). The optional
> Docker Compose stack still provisions Postgres/pgvector for future analysis
> history and similarity features.

---

## Repository layout

```
privacy-lens/
├── backend/          FastAPI service (analysis API, regex engine + Ollama, opt-out, policy store/diff)
├── frontend/         Next.js 15 + Tailwind CSS 4 — v2.4 Enterprise dashboard
├── extension/        Chrome/Edge Manifest V3 extension
├── docker-compose.yml  Full-stack orchestration (backend + frontend + Postgres/pgvector)
├── start.ps1         One-command launcher (Windows)
├── start.sh          One-command launcher (macOS / Linux)
└── .env.example      All tunable environment variables
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+** (for the dashboard)
- **Docker + Docker Compose** (optional, for the full stack)
- **Ollama** *(optional)* — only needed for the `hybrid`/`llm` analysis modes. Install from <https://ollama.ai/> and pull a model:

```bash
ollama pull llama3.1:8b   # primary model
ollama pull qwen2.5:7b    # automatic fallback (pick any model you have instead)
```

> The default `fast` mode uses a regex engine and needs **no Ollama at all**.
> The backend detects which configured models are actually installed and falls
> back to any available one. Choose your own via `OLLAMA_MODEL` /
> `OLLAMA_FALLBACK_MODEL`.

---

## Quick start (recommended: one command)

> **Note:** `start.ps1` / `start.sh` are the quickest path. They handle
> everything: Python venv, `pip install`, `npm install`, starting Ollama,
> pulling a default model if none is present, then launching backend + frontend.

**Windows (PowerShell):**

```powershell
.\start.ps1
```

**macOS / Linux:**

```bash
chmod +x start.sh
./start.sh
```

That's it. Open the dashboard at <http://localhost:3000>, API docs at
<http://localhost:8000/docs>. Logs land in `backend.log` / `frontend.log`.

### Alternative: full stack with Docker

1. Install Ollama and pull the models (see above).
2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Start the stack:

   ```bash
   docker compose up --build
   ```

4. Open the dashboard at <http://localhost:3000>, the API at
   <http://localhost:8000/docs>, and the DB at `localhost:5432`.

> Inside Docker the backend reaches your host Ollama via
> `http://host.docker.internal:11434` (configured automatically).

### Run without Docker

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload      # http://localhost:8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev                        # http://localhost:3000
```

---

## The v2.4 Enterprise dashboard

A dark-mode security-operations panel with:

- **Collapsible sidebar** — Policy Analyzer, Action Center (live badge), Diff
  Tracker, Audit History, Settings & Rules, plus a local SLM telemetry box.
- **Top utility bar** — global search (`Ctrl+K`), engine-mode badge, one-click
  audit export, and “New Audit”.
- **Code editor surface** — a `document.terms` code view with line numbers,
  red wavy-underlined legal terms, and live telemetry (lines, tokens, entropy).
- **Threat-matrix metrics** — trust-score gauge, vulnerability profile, and
  GDPR/CCPA sovereignty breakdown bound to the real `/api/v1/analyze` result.
- **Tabbed findings** — Red Flags & Liabilities, Data Ingestion, Shared & Sold
  Data, Rights Surrendered, and Actionable Opt-Outs with severity filters,
  sorting, evidence export, and legal-counsel flagging.
- Offline-friendly: a built-in sample audit renders the panel instantly if the
  backend isn’t running.

## API

### `POST /api/v1/analyze`

Analyze policy text or URL:

```json
{
  "text": "We may collect… and share your data with advertisers…",
  "url": "https://example.com/privacy-policy"
}
```

Response — every field validated by Pydantic:

```json
{
  "trust_score": 3,
  "platform_name": "Example Corp",
  "summary": "The policy collects broad behavioral data and reserves the right to share it with advertisers.",
  "data_collected": ["Email", "IP address", "Browsing behavior"],
  "data_shared_or_sold": ["Advertising identifiers", "Purchasing history"],
  "rights_forfeited": ["Class-action waiver", "Jury trial"],
  "red_flags": [
    {
      "clause": "Any disputes shall be resolved by binding arbitration.",
      "severity": "High",
      "explanation": "You give up the right to sue in court or join a class action."
    }
  ],
  "analyzed_at": "2026-09-07T10:00:00Z",
  "source": "https://example.com/privacy-policy",
  "model_used": "regex-rule-engine"
}
```

### `POST /api/v1/optout`

Generate a CCPA/CPRA/GDPR opt-out email:

```json
{
  "company_name": "Acme Corp",
  "flagged_items": ["Biometric data sale", "Class-action waiver"]
}
```

Returns `subject`, `body`, and `references` (cited statutes).

### `POST /api/v1/policies` · `GET /api/v1/policies`

Save a tracked policy (idempotent by normalized text hash) and list saved
archives. Saves persist in local SQLite.

### `POST /api/v1/diff`

Detect clause-level drift between two revisions — exactly one base source is
required alongside `new_text`:

```json
{ "base_id": 3, "new_text": "…new revision text…" }
```

`base_text` (inline) or `url` (latest saved version) can be used instead of
`base_id`. Response includes added/removed clauses, unchanged counts, and a
`change_percent` drift score.

Interactive docs: <http://localhost:8000/docs>.

---

## Browser extension

Load the unpacked extension:

1. Open `chrome://extensions` (or `edge://extensions`), toggle **Developer mode**.
2. Click **Load unpacked** → select the `extension/` folder.

v2 features: a floating trust-score badge overlaid on any page, red-flag term
highlighting, sign-up/registration form detection, and dealbreaker preferences
(shared with the dashboard) persisted in `chrome.storage.local`.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ANALYSIS_MODE` | `fast` | `fast` = regex engine (instant, default); `hybrid` = regex + LLM fallback; `llm` = always LLM |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama host (only used in `hybrid`/`llm` modes) |
| `OLLAMA_MODEL` | `llama3.1:8b` | Primary LLM |
| `OLLAMA_FALLBACK_MODEL` | `qwen2.5:7b` | Fallback LLM if the primary is missing |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | Per-request LLM timeout |
| `CORS_ORIGINS` | `*` | Comma-separated allow-list (use `*` locally) |
| `DATABASE_URL` | `postgresql+psycopg://…` | Postgres DSN (provisioned via Compose; not yet used by the SQLite store) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API base used by the dashboard |

---

## Testing

```bash
cd backend
pip install -r requirements.txt
pytest                      # 34 unit & integration tests
```

The suite needs no running services. It covers the regex rule engine (category
detection, trust-score/severity logic, strict Pydantic contract), the `/analyze`
endpoint (including a **< 50 ms** latency assertion and a `503`-without-Ollama
case), plus opt-out generation, policy tracking, and the clause-diff API.

Frontend: `npx tsc --noEmit` and `npm run build` must stay clean.

---

## Roadmap

- [x] Actionable opt-out generation (CCPA/CPRA/GDPR)
- [x] Policy tracking + clause-level diff monitoring
- [x] Enterprise dark-mode SOC dashboard (v2.4)
- [ ] Persist analysis history in Postgres (+ pgvector embeddings for policy similarity)
- [ ] Diff-watcher bot alerts for silent terms changes
- [ ] Firefox MV3 support

## License

[MIT](LICENSE) © Privacy Lens contributors.