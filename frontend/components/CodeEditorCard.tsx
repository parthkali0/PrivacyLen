"use client";

import { useMemo } from "react";

const HIGHLIGHT = /\b(sublicense|sell|broker|third[- ]part[ye]s?|biometric|waive|class[- ]action|arbitrat|modify these terms|without prior notice|precise location|\bgps\b|advertis|train(?:ing)? (?:ai|models?|on)|retention|recording|signature)\b/gi;

function renderHighlighted(text: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(HIGHLIGHT.source, HIGHLIGHT.flags);
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    parts.push(
      <span key={key++} className="text-[#fca5a5] underline decoration-[#ef4444]/80 decoration-wavy underline-offset-2">
        {text.slice(m.index, m.index + m[0].length)}
      </span>,
    );
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts;
}

export default function CodeEditorCard({
  value,
  onChange,
  onRun,
  analyzing,
  elapsedMs,
  modelUsed,
  highlightedCount,
  source,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  analyzing: boolean;
  elapsedMs: number | null;
  modelUsed: string;
  highlightedCount: number;
  source: string;
}) {
  const lines = useMemo(() => value.split("\n"), [value]);
  const tokenCount = useMemo(() => Math.round(value.split(/\s+/).filter(Boolean).length * 1.32), [value]);
  const entropy = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of value) counts[c] = (counts[c] ?? 0) + 1;
    let h = 0;
    const n = value.length || 1;
    for (const k in counts) {
      const p = counts[k] / n;
      h -= p * Math.log2(p);
    }
    return h.toFixed(2);
  }, [value]);

  return (
    <div className="panel overflow-hidden">
      {/* Card header — editor tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--edge)] bg-[#0d1420] px-3 py-2">
        <span className="flex gap-1.5 pr-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]/80" />
        </span>
        <span className="mono flex items-center gap-1.5 rounded-t border-x border-t border-b-0 border-[var(--edge)] bg-[#111827] px-3 py-1.5 text-[12px] text-slate-200">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          document.terms
        </span>
        <span className="mono rounded px-2 py-1.5 text-[12px] text-[#475569]">+</span>

        <div className="ml-auto flex items-center gap-2">
          <select
            className="input mono h-8 pr-7 text-[11px]"
            defaultValue="v4.1"
            aria-label="Compare against baseline"
          >
            <option value="v4.1">Baseline: v4.1</option>
            <option value="v4.2">Baseline: v4.2</option>
            <option value="none">No baseline</option>
          </select>
          <button
            type="button"
            onClick={onRun}
            disabled={analyzing}
            className="btn-cta mono h-8 px-3 text-[12px]"
          >
            {analyzing ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            {analyzing ? "Scanning" : "Run Analysis"}
          </button>
        </div>
      </div>

      {/* Editor body — single scroll container: gutter, highlight and input
          all live in normal flow so every line scrolls together. */}
      <div className="editor-scroll bg-[#0b1020]">
        <div className="flex min-w-0">
          {/* Line numbers */}
          <div
            className="editor-surface w-12 shrink-0 select-none overflow-hidden border-r border-[var(--edge)] pr-3 pl-0 text-right text-[#3d4c63]"
            aria-hidden="true"
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Highlight surface + invisible-text textarea (same box metrics) */}
          <div className="relative flex min-h-full min-w-0 flex-1">
            <pre
              className="editor-surface pointer-events-none m-0 w-full flex-1 whitespace-pre-wrap break-words text-[#9fb0c8]"
              aria-hidden="true"
            >
              {value.length === 0 && <span className="text-[#475569]">— paste legal text above to begin audit —</span>}
              {renderHighlighted(value)}
            </pre>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              className="editor-surface absolute inset-0 h-full w-full resize-none overflow-hidden text-transparent caret-[#7dd3fc] focus:outline-none"
              placeholder=""
              aria-label="Policy document editor"
            />
          </div>
        </div>
      </div>

      {/* Footer telemetry */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--edge)] bg-[#0d1420] px-4 py-2">
        <span className="mono text-[11px] text-[#64748b]">Lines <span className="text-[#38bdf8]">{lines.length}</span></span>
        <span className="mono text-[11px] text-[#64748b]">Tokens <span className="text-[#38bdf8]">~{tokenCount.toLocaleString()}</span></span>
        <span className="mono text-[11px] text-[#64748b]">Entropy <span className="text-[#38bdf8]">{entropy}</span></span>
        <span className="mono text-[11px] text-[#64748b]">
          Highlighted clauses <span className="text-[#ef4444]">{highlightedCount}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="mono hidden text-[11px] text-[#64748b] md:inline">Model: <span className="text-[#7dd3fc]">{modelUsed}</span></span>
          <span className="mono text-[11px] text-[#10b981]">{elapsedMs !== null ? `⚡ ${elapsedMs} ms` : "● Standby"}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--edge)] bg-[#0a0e17] px-4 py-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span className="mono truncate text-[11px] text-[#94a3b8]">
          Target <span className="text-[#38bdf8]">{source || "No source registered"}</span> · SHA-256 <span className="text-[#64748b]">• • • •</span>
        </span>
      </div>
    </div>
  );
}