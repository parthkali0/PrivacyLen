# Privacy Lens — Browser Extension (Manifest V3)

Quick privacy check on any page you visit. Requires the Privacy Lens FastAPI
backend running locally on `http://localhost:8000`.

## Features

- Read the **current page URL** and have the backend scrape + analyze its policy.
- Capture **selected text** on the page (`content.js` supplies it to the popup).
- Paste policy text directly into the popup.
- Displays the trust score, plain-English summary, and color-coded red flags.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.

## Configure backend URL

The popup calls `http://localhost:8000`. To point at another host, change
`API_BASE` at the top of `popup.js` and add the host to `host_permissions` in
`manifest.json`, then reload the extension.