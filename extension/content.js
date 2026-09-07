// Privacy Lens v2 — real-time content overlay.
//
// Responsibilities:
//   1. Detect sign-up/registration forms and legal-agreement links on the page.
//   2. Inject a floating Trust Score Badge (green/yellow/red) via shadow DOM.
//   3. Highlight matched red-flag terms directly on the webpage DOM.
//
// The content script is passive: the popup drives analysis and then tells this
// script to show/highlight via chrome.runtime messages.

(() => {
  "use strict";

  const NS = "pl-";
  let activeHighlights = [];
  let badgeHost = null;
  let legalTagged = [];

  // ------------------------------------------------------------------ //
  // Dealbreaker term groups → colour mapping for page highlighting.
  // ------------------------------------------------------------------ //
  const TERM_GROUPS = {
    ai_training: { label: "AI Training", re: /\b(?:ai model|machine learning|llm|\btrain(?:ing)?\s+ai)\b/i, color: "#7c3aed", bg: "#ede9fe" },
    location: { label: "Location / GPS", re: /\b(?:precise location|gps|geolocation|location data|real[- ]time location)\b/i, color: "#ea580c", bg: "#fff7ed" },
    microphone: { label: "Microphone / Audio", re: /\b(?:microphone|audio recording|voice recording|sound recording)\b/i, color: "#dc2626", bg: "#fef2f2" },
    contacts: { label: "Contacts", re: /\b(?:contacts list|address book|contact list|phone contacts)\b/i, color: "#dc2626", bg: "#fef2f2" },
    browsing: { label: "Browsing History", re: /\b(?:browsing history|search history|web history|browser history)\b/i, color: "#dc2626", bg: "#fef2f2" },
    device: { label: "Device / IP", re: /\b(?:device identifier|ip address|ipv4|ipv6|advertising id|battery level|hardware id)\b/i, color: "#d97706", bg: "#fffbeb" },
    selling: { label: "Selling Data", re: /\b(?:sell(?:s|ing)?\s+(?:your\s+)?(?:personal|private)\s+data|sale of\s+your\s+personal data)\b/i, color: "#b91c1c", bg: "#fee2e2" },
    brokers: { label: "Data Brokers", re: /\b(?:data broker|marketing agenc|third[- ]party\s+(?:companies|brokers)|affiliate)\b/i, color: "#dc2626", bg: "#fef2f2" },
    arbitration: { label: "Arbitration", re: /\bbinding arbitration\b|\barbitrat/i, color: "#b91c1c", bg: "#fee2e2" },
    class_action: { label: "Class-Action Waiver", re: /\bclass[- ]action\b/i, color: "#b91c1c", bg: "#fee2e2" },
    unilateral: { label: "Unilateral Changes", re: /\b(?:change.*terms.*(?:at any time|without notice)|without prior notice|reserve the right to change)\b/i, color: "#d97706", bg: "#fffbeb" },
  };

  function enabledGroups(prefs) {
    const keys = Array.isArray(prefs) && prefs.length ? prefs : Object.keys(TERM_GROUPS);
    return keys
      .filter((key) => TERM_GROUPS[key])
      .map((key) => TERM_GROUPS[key]);
  }

  // ------------------------------------------------------------------ //
  // Context detection: sign-up forms + legal agreement links.
  // ------------------------------------------------------------------ //
  function detectPageContext() {
    const extraLegalLinks = [];
    const pageText = (document.body && document.body.innerText ? document.body.innerText : "")
      .slice(0, 8000)
      .toLowerCase();

    const signUpPatterns = [
      /\bsign\s*up\b/, /\bregister\b/, /\bcreate\s+(?:a\s+)?(?:free\s+)?account\b/,
      /\bjoin\s+now\b/, /\bget\s+started\b/, /\bsign\s+in\s+or\s+up\b/,
    ];
    const hasSignUpKeywords = signUpPatterns.some((re) => re.test(pageText));

    const forms = Array.from(document.querySelectorAll("form"));
    const authInput = (form) =>
      form.querySelector('input[type="email"], input[type="password"], input[name*="password" i], input[name*="user" i], input[name*="reg" i], input[autocomplete="username"], input[autocomplete="new-password"]');
    const hasSignUpForm = (hasSignUpKeywords && forms.length > 0) ||
      forms.some((form) => !!authInput(form));

    const legalPattern = /\b(?:terms?\s+of\s+(?:service|use)|privacy\s+policy|cookie\s+policy|end\s+user\s+license|eula|user\s+agreement|consent|data\s+protection)\b/i;
    let legalLinks = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const label = (a.textContent || "").trim();
      const href = a.getAttribute("href") || "";
      if (label && legalPattern.test(label)) {
        let abs = href;
        try { abs = new URL(href, location.href).href; } catch (_) { /* keep raw */ }
        legalLinks.push({ text: label.slice(0, 80), href: abs });
      }
    });
    legalLinks = legalLinks.slice(0, 25);

    const hasLegalContent = extraLegalLinks.concat(legalLinks).length > 0 ||
      /\b(?:privacy policy|terms of service|terms and conditions)\b/i.test(pageText);
    const isPolicyPage = /^\/(?:privacy|terms|legal)\b|\bprivacy-policy\b|privacy\./i.test(location.pathname) ||
      hasLegalContent && pageText.split(/\bprivacy\b/).length > 1;

    return {
      url: location.href,
      title: document.title,
      isSignUp: hasSignUpKeywords || hasSignUpForm,
      hasSignUpForm,
      isPolicyPage,
      legalLinks,
    };
  }

  // ------------------------------------------------------------------ //
  // Injected styles + auto-emphasis on legal links.
  // ------------------------------------------------------------------ //
  function injectStyles() {
    if (document.getElementById(NS + "styles")) return;
    const style = document.createElement("style");
    style.id = NS + "styles";
    style.textContent = `
      .${NS}highlight { padding: 0 1px; border-radius: 3px; cursor: help; box-shadow: inset 0 -2px 0 rgba(0,0,0,.08); }
      .${NS}badge-banner { position: fixed; left: 16px; bottom: 16px; z-index: 2147483640; }
      a[data-${NS}legal] { outline: 2px solid #f59e0b !important; outline-offset: 1px; border-radius: 2px; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function emphasizeLegalLinks(links) {
    if (!Array.isArray(links)) return;
    links.forEach((link) => {
      if (!link || link._plTagged) return;
      link._plTagged = true;
      link.setAttribute("data-" + NS + "legal", "1");
      link.setAttribute("title", "Privacy Lens: legal agreement link — review before accepting.");
      link.style.boxShadow = "0 0 0 2px rgba(245,158,11,.55), 0 0 0 4px rgba(245,158,11,.18)";
      link.style.textDecoration = "underline";
      legalTagged.push(link);
    });
  }

  // ------------------------------------------------------------------ //
  // Trust score badge.
  // ------------------------------------------------------------------ //
  function scoreVisual(score) {
    const s = Number(score) || 0;
    if (s >= 7) return { color: "#16a34a", label: "High trust", tone: "green" };
    if (s >= 4) return { color: "#d97706", label: "Caution", tone: "amber" };
    return { color: "#dc2626", label: "High risk", tone: "red" };
  }

  function showBadge(opts) {
    opts = opts || {};
    const { color, label, tone } = scoreVisual(opts.score);
    hideBadge();

    badgeHost = document.createElement("div");
    badgeHost.setAttribute("data-" + NS + "badge", "1");
    const shadow = badgeHost.attachShadow({ mode: "open" });

    const css = document.createElement("style");
    css.textContent = `
      :host { all: initial; }
      .badge { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
        display: flex; align-items: center; gap: 10px; font-family: ui-sans-serif, system-ui, Arial, sans-serif;
        background: #0f172a; color: #fff; padding: 10px 14px; border-radius: 14px;
        box-shadow: 0 8px 30px rgba(0,0,0,.35); cursor: default;
        border-left: 5px solid ${color};
        transform: translateY(12px); opacity: 0; animation: ${NS}in .3s ease forwards; }
      .score { font-size: 26px; font-weight: 800; line-height: 1; color: ${color}; }
      .score small { font-size: 11px; font-weight: 500; color: #94a3b8; }
      .meta { display: flex; flex-direction: column; line-height: 1.3; }
      .meta strong { font-size: 12px; }
      .meta small { color: ${color}; font-weight: 600; font-size: 11px; }
      .close { margin-left: 4px; border: 0; background: transparent; color: #94a3b8;
        cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 6px; }
      .close:hover { color: #fff; background: rgba(255,255,255,.12); }
      @keyframes ${NS}in { to { transform: translateY(0); opacity: 1; } }
    `;
    shadow.appendChild(css);

    const el = document.createElement("div");
    el.className = "badge";
    el.innerHTML = `
      <div class="score">${Math.max(0, Math.min(10, Math.round(opts.score || 0))) || "–"}<small>/10</small></div>
      <div class="meta">
        <strong>Privacy Lens</strong>
        <small>${label}${opts.flags ? ` · ${opts.flags} flag${opts.flags === 1 ? "" : "s"}` : ""}</small>
      </div>
    `;
    if (opts.company) {
      const sub = document.createElement("small");
      sub.textContent = opts.company;
      sub.style.color = "#cbd5e1";
      el.querySelector(".meta").appendChild(sub);
    }
    const close = document.createElement("button");
    close.className = "close";
    close.textContent = "✕";
    close.addEventListener("click", hideBadge);
    el.appendChild(close);
    shadow.appendChild(el);
    document.documentElement.appendChild(badgeHost);
  }

  function hideBadge() {
    if (badgeHost) {
      badgeHost.remove();
      badgeHost = null;
    }
  }

  // ------------------------------------------------------------------ //
  // DOM red-flag term highlighting.
  // ------------------------------------------------------------------ //
  function clearHighlights() {
    const marks = document.querySelectorAll("mark[data-" + NS + "highlight]");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
    });
    activeHighlights = [];
  }

  function highlightTerms(opts) {
    opts = opts || {};
    clearHighlights();

    const groups = enabledGroups(opts.dealbreakers && opts.dealbreakers.length ? opts.dealbreakers : null);
    // Fall back to all groups if nothing configured in the message.
    const effective = groups.length ? groups : enabledGroups([]);

    const patterns = [];
    effective.forEach((g) => patterns.push("(?:" + g.re.source + ")"));
    if (!patterns.length) return;
    const combined = new RegExp(patterns.join("|"), "gi");
    const maxMatches = opts.max || 150;

    injectStyles();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest("mark, ." + NS + "badge")) return NodeFilter.FILTER_REJECT;
          if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
          return node.textContent.trim().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      },
      false,
    );

    const nodes = [];
    let node = walker.nextNode();
    while (node && nodes.length < 400) {
      nodes.push(node);
      node = walker.nextNode();
    }

    let matchCount = 0;
    for (const textNode of nodes) {
      if (matchCount >= maxMatches) break;
      const text = textNode.textContent;
      combined.lastIndex = 0;
      const segments = [];
      let cursor = 0;
      let m;
      while ((m = combined.exec(text)) !== null && matchCount < maxMatches) {
        if (m.index === combined.lastIndex) { combined.lastIndex++; continue; }
        if (!m[0] || m[0].length === 0) { combined.lastIndex++; continue; }
        segments.push([m.index, m.index + m[0].length]);
        matchCount++;
      }
      if (!segments.length) continue;

      const frag = document.createDocumentFragment();
      for (const [start, end] of segments) {
        if (start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, start)));
        const mark = document.createElement("mark");
        mark.setAttribute("data-" + NS + "highlight", "1");
        const which = matchedGroup(text.slice(start, end), effective);
        const style = which || { color: "#b91c1c", bg: "#fee2e2" };
        mark.style.backgroundColor = style.bg;
        mark.style.color = "#0f172a";
        mark.title = "Privacy Lens: " + (which && which.label ? which.label : "flagged term");
        mark.textContent = text.slice(start, end);
        frag.appendChild(mark);
        cursor = end;
      }
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      textNode.parentNode.replaceChild(frag, textNode);
      activeHighlights.push(frag);
    }
  }

  function matchedGroup(sample, groups) {
    const lower = sample.toLowerCase();
    for (const g of groups) {
      g.re.lastIndex = 0;
      if (g.re.test(sample)) return g;
      g.re.lastIndex = 0;
    }
    return null;
  }

  // ------------------------------------------------------------------ //
  // Auto-run on load: detect context and emphasize legal links.
  // ------------------------------------------------------------------ //
  function autoInit() {
    injectStyles();
    try {
      const context = detectPageContext();
      if (context.isSignUp && context.legalLinks.length) {
        document.querySelectorAll("a[href]").forEach((a) => {
          const label = (a.textContent || "").trim();
          if ((/terms|privacy|agreement|consent|data/i.test(label))) emphasizeLegalLinks([a]);
        });
      }
      chrome.runtime.sendMessage({ type: "PL_CONTEXT", context }).catch(() => {});
    } catch (_) { /* host page may block; overlay still works from popup */ }
  }

  // ------------------------------------------------------------------ //
  // Message handling.
  // ------------------------------------------------------------------ //
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    switch (message.type) {
      case "GET_SELECTION": {
        const selection = window.getSelection() ? window.getSelection().toString().trim() : "";
        sendResponse({ selection });
        return false;
      }
      case "DETECT_CONTEXT": {
        sendResponse({ context: detectPageContext() });
        return false;
      }
      case "SHOW_BADGE": {
        showBadge(message);
        sendResponse({ ok: true });
        return false;
      }
      case "HIDE_BADGE": {
        hideBadge();
        sendResponse({ ok: true });
        return false;
      }
      case "HIGHLIGHT_TERMS": {
        highlightTerms(message);
        sendResponse({ ok: true, highlighted: activeHighlights.length });
        return false;
      }
      case "CLEAR_HIGHLIGHTS": {
        clearHighlights();
        sendResponse({ ok: true });
        return false;
      }
      default:
        return false;
    }
  });

  autoInit();
})();