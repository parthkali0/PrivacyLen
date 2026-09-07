// Privacy Lens — popup controller (Manifest V3).
// Builds an analysis payload from the current tab URL, selected text, or pasted
// text, then POSTs it to the local FastAPI backend.

const API_BASE = "http://localhost:8000";

const $ = (id) => document.getElementById(id);

const useSelectedBtn = $("use-selected");
const useUrlBtn = $("use-current-url");
const customText = $("custom-text");
const analyzeBtn = $("analyze");
const statusEl = $("status");
const resultEl = $("result");
const scoreEl = $("score");
const scoreLabelEl = $("score-label");
const platformEl = $("platform-name");
const summaryEl = $("summary");
const flagsEl = $("flags");

/** @type {{ mode: "url"|"text", text?: string, url?: string } | null} */
let payload = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("status--error", Boolean(isError));
}

function refreshButton() {
  analyzeBtn.disabled = !payload;
}

function setActive(mode) {
  useSelectedBtn.classList.toggle("chip--active", mode === "selection");
  useUrlBtn.classList.toggle("chip--active", mode === "url");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function getSelectedText() {
  const tab = await getActiveTab();
  if (!tab || tab.id == null) return "";
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
    return response && response.selection ? response.selection.trim() : "";
  } catch (_err) {
    // No content script on this page (e.g. chrome:// or PDF viewer).
    return "";
  }
}

async function handleUseSelected() {
  setActive("selection");
  const selection = await getSelectedText();
  const typed = customText.value.trim();
  const text = (selection || typed).trim();

  if (!text) {
    payload = null;
    setStatus("No text found — select text on the page or paste it above.", true);
  } else {
    payload = { mode: "text", text: text.slice(0, 400000) };
    setStatus(`Ready to analyze ${text.length.toLocaleString()} characters.`);
  }
  refreshButton();
}

async function handleUseUrl() {
  setActive("url");
  const tab = await getActiveTab();

  if (!tab || !tab.url || /^(chrome|edge|about|devtools|view-source|chrome-extension|moz-extension):/i.test(tab.url)) {
    payload = null;
    setStatus("Cannot read this page’s URL.", true);
  } else {
    payload = { mode: "url", url: tab.url };
    setStatus(`Ready to analyze ${tab.url}`);
  }
  refreshButton();
}

customText.addEventListener("input", () => {
  const typed = customText.value.trim();
  payload = typed ? { mode: "text", text: typed.slice(0, 400000) } : null;
  setStatus("");
  refreshButton();
});

useSelectedBtn.addEventListener("click", handleUseSelected);
useUrlBtn.addEventListener("click", handleUseUrl);

analyzeBtn.addEventListener("click", async () => {
  if (!payload) return;

  analyzeBtn.disabled = true;
  resultEl.classList.add("hidden");
  setStatus("Analyzing…");

  try {
    const response = await fetch(`${API_BASE}/api/v1/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: payload.text, url: payload.url }),
    });

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        detail = body.detail || detail;
      } catch (_err) {
        // non-JSON body; keep default detail
      }
      throw new Error(detail);
    }

    render(await response.json());
    setStatus("");
  } catch (err) {
    setStatus(err.message || "Analysis failed.", true);
  } finally {
    refreshButton();
  }
});

const SEVERITY_STYLES = { High: "flag--high", Medium: "flag--medium", Low: "flag--low" };

function severityRank(severity) {
  return severity === "High" ? 0 : severity === "Medium" ? 1 : 2;
}

function labelForScore(score) {
  if (score <= 3) return "Very low trust";
  if (score <= 5) return "Low trust";
  if (score <= 7) return "Moderate trust";
  return "High trust";
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]),
  );
}

function render(data) {
  scoreEl.textContent = data.trust_score;
  scoreLabelEl.textContent = `Trust score /10 · ${labelForScore(data.trust_score)}`;
  platformEl.textContent = data.platform_name;
  summaryEl.textContent = data.summary;

  flagsEl.innerHTML = "";
  const flags = [...(data.red_flags || [])].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );
  for (const flag of flags) {
    const li = document.createElement("li");
    li.className = `flag ${SEVERITY_STYLES[flag.severity] || "flag--low"}`;
    li.innerHTML =
      `<strong>${escapeHtml(flag.severity)}</strong> — ${escapeHtml(flag.clause)}<br/>` +
      `<span>${escapeHtml(flag.explanation)}</span>`;
    flagsEl.appendChild(li);
  }
  resultEl.classList.remove("hidden");
}

// Default to analyzing the page the user opened the popup on.
handleUseUrl();