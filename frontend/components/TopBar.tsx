"use client";

import { useEffect, useRef } from "react";

export default function TopBar({
  searchQuery,
  onSearchChange,
  exportTarget,
  onNewAudit,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  exportTarget: () => void;
  onNewAudit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-[var(--edge)] bg-[#0d1420] px-4">
      {/* Search */}
      <div className="relative w-[340px] max-w-full">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search scanned policies, domains, clauses..."
          className="input h-9 w-full pl-9 pr-12"
        />
        <kbd className="mono absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[var(--edge-2)] bg-[#111827] px-1.5 py-px text-[10px] text-[#64748b]">
          Ctrl K
        </kbd>
      </div>

      {/* Mode badge */}
      <span className="tag tag-cyan mono ml-1 hidden lg:inline-flex">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#10b981]" />
        Hybrid Engine · Regex + SLM
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={exportTarget} className="btn-ghost">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>
        <button type="button" onClick={onNewAudit} className="btn-cta">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Audit
        </button>
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--edge-2)] bg-[#1e3a5f] text-[12px] font-bold text-[#7dd3fc]" title="Gordon Clark">
          GC
        </div>
      </div>
    </header>
  );
}