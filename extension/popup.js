// Privacy Lens v2 — popup controller (Manifest V3).
// Orchestrates analysis and drives the real-time overlay on the active tab:
// trust-score badge + red-flag term highlighting, honouring the user's
// dealbreaker preferences persisted in chrome.storage.local.

const API_BASE = "http://localhost:8000";

const $ = (id) => document.getElementById(id);

const useSelectedBtn = $("use-selected");
const useUrlBtn = $("use-current-url");
const customText = $("custom-text");
const analyzeBtn = $("analyze");
const statusEl = $("status");
const detectedEl = $("detected");
const resultEl = $("result");
const scoreEl = $("score");
const scoreLabelEl = $("score-label");
const platformEl = $("platform-name");
const summaryEl = $("summary");
const flagsEl = $("flags");
const settingsEl = $("settings");
const reBadgeBtn = $("re-badge");
const clearHighlightsBtn = $("clear-highlights");

const STORAGE_KEY = "pl_dealbreakers";

// Must mirror the TERM_GROUPS keys in content.js.
const DEALBREAKERS = [
  { key: "ai_training", label: "AI Training" },
  { key: "location", label: "Location / GPS" },
  { key: "microphone", label: "Microphone / Audio" },
  { key: "contacts", label: "Contacts" },
  { key: "browsing", label: "Browsing History" },
  { key: "device", label: "Device / IP" },
  { key: "selling", label: "Selling Data" },
  { key: "brokers", label: "Data Brokers" },
  { key: "arbitration", label: "Binding Arbitration" },
  { key: "class_action", label: "Class-Action Waiver" },
  { key: "unilateral", label: "Unilateral Changes" },
];
const DEFAULT_DEALBREAKERS = DEALBREAKERS.map((d) => d.key);

let payload = null;
let lastAnalysis = null;

// ------------------------------------------------------------------ //
// Settings: dealbreaker preferences.
// ------------------------------------------------------------------ //
async function loadDealbreakers() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const keys = stored[STORAGE_KEY];
  if (!Array.isArray(keys)) return DEFAULT_DEALBREAKERS;
  const valid = keys.filter((k) => DEALBREAKERS.some((d) => d.key === k));
  return valid.length ? valid : DEFAULT_DEALBREAKERS;
}

async function saveDealbreakers(keys) {
  await chrome.storage.local.set({ [STORAGE_KEY]: keys });
}

async function clearHighlightsOnTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_HIGHLIGHTS" });
  } catch (_err) {
    // No content script on this page.
  }
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
    return "";
  }
}

async function detectContextHint() {
  const tab = await getActiveTab();
  if (!tab || tab.id == null) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_CONTEXT" });
    const ctx = response && response.context;
    if (ctx) {
      const parts = [];
      if (ctx.isSignUp) parts.push("sign-up/registration detected");
      if (ctx.isPolicyPage) parts.push("policy page detected");
      if (ctx.legalLinks && ctx.legalLinks.length) parts.push(`${ctx.legalLinks.length} legal link(s) found`);
      detectedEl.textContent = parts.length
        ? "On this page: " + parts.join(" · ")
        : parts;
      if (ctx.isSignUp) detectedEl.classList.add("detected--warn");
      else detectedEl.classList.remove("detected--warn");
    }
  } catch (_err) {
    // Content script unavailable on chrome:// pages etc.
  }
}

function refreshButton() {
  analyzeBtn.disabled = !payload;
}

function setActive(mode) {
  useSelectedBtn.classList.toggle("chip--active", mode === "selection");
  useUrlBtn.classList.toggle("chip--active", mode === "url");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("status--error", Boolean(isError));
}

async function sendOverlay(analysis) {
  const tab = await getActiveTab();
  if (!tab || tab.id == null) return;
  const dealbreakers = await loadDealbreakers();
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_BADGE",
      score: analysis.trust_score,
      flags: (analysis.red_flags || []).length,
      company: analysis.platform_name,
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: "HIGHLIGHT_TERMS",
      dealbreakers,
      max: 200,
    });
  } catch (_err) {
    // Content script not present (e.g. chrome:// or PDF) — skip overlay.
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
    setStatus("Cannot read this page's URL.", true);
  } else {
    payload = { mode: "url", url: tab.url };
    setStatus(`Ready to analyze ${tab.url}`);
  }
  detectContextHint();
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

    const data = await response.json();
    lastAnalysis = data;
    render(data);
    setStatus("Analysis ready — overlay applied to the page.");
    sendOverlay(data);
  } catch (err) {
    setStatus(err.message || "Analysis failed.", true);
  } finally {
    refreshButton();
  }
});

// Re-apply the badge without re-analyzing.
reBadgeBtn.addEventListener("click", () => {
  if (lastAnalysis) sendOverlay(lastAnalysis);
});

clearHighlightsBtn.addEventListener("click", clearHighlightsOnTab);

// ------------------------------------------------------------------ //
// Render.
// ------------------------------------------------------------------ //
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

const DEALBREAKER_PATTERN = [
  { key: "ai_training", re: /ai model|machine learning|train/i },
  { key: "location", re: /location|gps|geo/i },
  { key: "microphone", re: /microphone|audio|voice record/i },
  { key: "contacts", re: /contacts|address book/i },
  { key: "browsing", re: /browsing|search history/i },
  { key: "device", re: /device identifier|ip address|battery/i },
  { key: "selling", re: /sold|sell/i },
  { key: "brokers", re: /data broker|marketing agenc/i },
  { key: "arbitration", re: /arbitrat/i },
  { key: "class_action", re: /class[- ]action/i },
  { key: "unilateral", re: /change.*(without notice|at any time)|reserve the right/i },
];

function flagMatches(flag, enabledKeys) {
  if (!enabledKeys || !enabledKeys.length) return false;
  const text = (flag.clause + " " + flag.explanation).toLowerCase();
  return DEALBREAKER_PATTERN.some(
    (p) => enabledKeys.includes(p.key) && p.re.test(text),
  );
}

function render(data) {
  scoreEl.textContent = data.trust_score;
  scoreLabelEl.textContent = `Trust score /10 · ${labelForScore(data.trust_score)}`;
  scoreEl.style.color = data.trust_score >= 7 ? "#16a34a" : data.trust_score >= 4 ? "#d97706" : "#dc2626";
  platformEl.textContent = data.platform_name;
  summaryEl.textContent = data.summary;

  (async () => {
    const dealbreakers = await loadDealbreakers();
    const flags = [...(data.red_flags || [])].sort((a, b) => {
      const am = flagMatches(a, dealbreakers) ? 0 : 1;
      const bm = flagMatches(b, dealbreakers) ? 0 : 1;
      if (am !== bm) return am - bm;
      return severityRank(a.severity) - severityRank(b.severity);
    });

    flagsEl.innerHTML = "";
    for (const flag of flags) {
      const matches = flagMatches(flag, dealbreakers);
      const li = document.createElement("li");
      li.className = `flag ${SEVERITY_STYLES[flag.severity] || "flag--low"}${matches ? " flag--dealbreaker" : ""}`;
      li.innerHTML =
        (matches ? "<span class='dealbreak-tag'>DEALBREAKER</span>" : "") +
        `<strong>${escapeHtml(flag.severity)}</strong> — ${escapeHtml(flag.clause)}<br/>` +
        `<span>${escapeHtml(flag.explanation)}</span>`;
      flagsEl.appendChild(li);
    }
  })();
  resultEl.classList.remove("hidden");
}

// ------------------------------------------------------------------ //
// Settings UI.
// ------------------------------------------------------------------ //
async function renderSettings() {
  const enabled = await loadDealbreakers();
  settingsEl.innerHTML = "";
  for (const item of DEALBREAKERS) {
    const label = document.createElement("label");
    label.className = "setting";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = enabled.includes(item.key);
    input.addEventListener("change", async () => {
      const next = await loadDealbreakers();
      const set = new Set(next);
      if (input.checked) set.add(item.key);
      else set.delete(item.key);
      await saveDealbreakers(Array.from(set));
      renderSettings();
      if (lastAnalysis) render(lastAnalysis);
    });
    const span = document.createElement("span");
    span.textContent = item.label;
    label.appendChild(input);
    label.appendChild(span);
    settingsEl.appendChild(label);
  }
}

// ------------------------------------------------------------------ //
// Init.
// ------------------------------------------------------------------ //
handleUseUrl();
renderSettings();