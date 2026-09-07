# Privacy Lens — Browser Extension (Manifest V3) · v2.0.0

Real-time privacy overlays on any page you visit. Requires the Privacy Lens
FastAPI backend running locally on `http://localhost:8000`.

## Features

- **Trust-score badge** — floating overlay pinned to the page after analysis.
- **Red-flag highlighting** — risky legal terms (biometric, class-action,
  arbitration, silent modification…) are marked directly in the page text.
- **Sign-up / registration detection** — spots sign-up forms and legal-agreement
  links and flags them in the analysis context.
- **Dealbreaker preferences** — toggle detection rules (AI training, GPS,
  microphone, data-selling, etc.); preferences are persisted in
  `chrome.storage.local` and honored by the popup sort order and highlighting.
- Read the **current page URL** (backend scrapes + analyzes its policy), capture
  **selected text**, or paste policy text directly into the popup.
- Displays the trust score, plain-English summary, and color-coded red flags.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.

## Configure backend URL

The popup calls `http://localhost:8000`. To point at another host, change
`API_BASE` at the top of `popup.js` and add the host to `host_permissions` in
`manifest.json`, then reload the extension.

## Permissions

- `tabs` / `activeTab` / `scripting` — drive the overlay on the active tab.
- `storage` — persist dealbreaker preferences locally.
- `host_permissions` — restricted to the local backend base URL.