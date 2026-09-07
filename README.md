<div align="center">

# Privacy Lens

**AI-powered privacy policy analyzer** — turns legalese, Terms of Service, and
privacy contracts into plain English, a trust score, red flags, and targeted
recommendations. Inference runs **100% locally** via [Ollama](https://ollama.ai).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)
![Next.js](https://img.shields.io/badge/frontend-Next.js-000000)
![Tailwind CSS](https://img.shields.io/badge/styling-Tailwind%20CSS-38b2ac)
![Browser](https://img.shields.io/badge/extension-Chrome%20%7C%20Edge%20MV3-4285F4)

</div>

---

## What it does

Paste a privacy policy or point it at a URL, and Privacy Lens returns:

- **Trust score** (1–10) with a visual gauge
- **2-sentence executive summary** in plain English
- **Data collected** vs. **data shared / sold**
- **Rights you forfeit** (arbitration, class-action waivers, unilateral changes…)
- **Red flags** ranked by severity — High / Medium / Low

Two front-ends consume the same API: a **Next.js dashboard** and a
**Manifest V3 browser extension**.

> **Instant by default.** The analysis engine is a lightweight regex/rule
> matcher that returns structured results in under **50 ms** with no LLM and no
> network calls. An optional Ollama LLM path (`ANALYSIS_MODE=hybrid|llm`)
> produces richer summaries when you want them.

## Architecture

```
┌────────────────────────┐        ┌──────────────────────────────┐
│  Browser Extension      │        │  Next.js Dashboard (:3000)   │
│  (Manifest V3, popup)   │        │  App Router + Tailwind CSS   │
└────────────┬───────────┘        └───────────────┬──────────────┘
             │  text / URL                        │  text / URL
             ▼                                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                FastAPI Backend (:8000)                             │
│                                                                   │
│   POST /api/v1/analyze                                            │
│     ├─ URL?  ──► requests + BeautifulSoup4 (safe scraping)        │
│     └─ Analysis engine:                                           │
│          ├─ [DEFAULT] Regex/rule matcher (instant, <50ms)         │
│          └─ [optional] Ollama LLM  (llama3.1:8b ─► qwen2.5:7b)    │
│     └─ Pydantic strict JSON validation (AnalysisCore)             │
└───────┬─────────────────────────────────────────────┬─────────────┘
        │  /api/chat (hybrid/llm modes only)          │  (scaled out later)
        ▼                                             ▼
┌─────────────────────┐                    ┌────────────────────────┐
│  Ollama (localhost) │                    │  PostgreSQL + pgvector │
│  :11434, local LLMs │   (optional)       │  (:5432)               │
└─────────────────────┘                    └────────────────────────┘
```

> Privacy Lens ships **instant by default**: a pure-Python regex/rule engine
> analyzes policy text in well under 50 ms with no model and no network. The
> local Ollama LLM is optional — enable it for deeper, LLM-generated summaries
> via `ANALYSIS_MODE=hybrid` (fallback) or `ANALYSIS_MODE=llm` (always).

---

## Repository layout

```
privacy-lens/
├── backend/          FastAPI service (analysis API, regex rule engine + Ollama, scraper)
├── frontend/         Next.js 15 + Tailwind CSS 4 dashboard
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

> The backend detects which configured models are actually installed and picks
> the first available one (falling back to *any* installed model if your exact
> tags are missing). You can use any model you like via `OLLAMA_MODEL` /
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

> Note: inside Docker the backend reaches your host Ollama via
> `http://host.docker.internal:11434` (configured automatically in
> `docker-compose.yml`).

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

## API

### `POST /api/v1/analyze`

Request (either `text` or `url`):

```json
{
  "text": "We may collect… and share your data with advertisers…",
  "url": "https://example.com/privacy-policy"
}
```

Response — every field is **validated by Pydantic**, and the LLM output itself
is constrained to the same schema (strict mode, unknown keys rejected):

```json
{
  "trust_score": 3,
  "platform_name": "Example Corp",
  "summary": "The policy collects broad behavioral data and reserves the right to share it with advertisers. You should be wary of the arbitration clause and unilateral change rights.",
  "data_collected": ["Email", "IP address", "Browsing behavior"],
  "data_shared_or_sold": ["Advertising identifiers", "Purchasing history"],
  "rights_forfeited": ["Class-action waiver", "Jury trial", "Prior notice of policy changes"],
  "red_flags": [
    {
      "clause": "Any disputes shall be resolved by binding arbitration.",
      "severity": "High",
      "explanation": "You give up the right to sue in court or join a class action."
    }
  ],
  "analyzed_at": "2026-09-07T10:00:00Z",
  "source": "https://example.com/privacy-policy",
  "model_used": "llama3.1:8b"
}
```

Interactive docs: <http://localhost:8000/docs>.

### Loading the browser extension

1. Open `chrome://extensions` (or `edge://extensions`), toggle **Developer mode**.
2. Click **Load unpacked** → select the `extension/` folder.

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
| `DATABASE_URL` | `postgresql+psycopg://…` | Postgres DSN (pgvector provisioned) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API base used by the dashboard |

---

## Testing

```bash
cd backend
pip install -r requirements.txt
pytest                      # unit & integration tests for the rule engine + API
```

The test suite needs no running services. It covers the regex rule engine
(category detection, trust-score/severity logic, strict Pydantic contract), the
`/analyze` endpoint (including a **< 50 ms** latency assertion and a
`503`-without-Ollama case), plus JSON parsing and URL guards.

---

## Roadmap

- [ ] Persist analysis history in Postgres (+ pgvector embeddings for policy similarity)
- [ ] Multi-document comparison ("which of these two policies is worse?")
- [ ] Batch analysis of installed apps / services
- [ ] Firefox MV3 support

## License

[MIT](LICENSE) © Privacy Lens contributors.