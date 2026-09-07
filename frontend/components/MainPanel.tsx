"use client";

import { useMemo } from "react";
import type { AnalysisResult, RedFlag } from "@/types";
import type { FlagAction, FlagProfile } from "@/lib/flagCatalog";
import { actionableCounts } from "@/lib/flagCatalog";
import CodeEditorCard from "@/components/CodeEditorCard";
import MetricsGrid from "@/components/MetricsGrid";
import DetailedTabs from "@/components/DetailedTabs";

function policyHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "7f9a8b".concat(h.toString(16).padStart(8, "0")).slice(0, 8);
}

function countStatuteViolations(flags: RedFlag[]): { gdpr: number; ccpa: number } {
  let gdpr = 0;
  let ccpa = 0;
  for (const f of flags) {
    const text = `${f.clause} ${f.explanation}`;
    if (/\bgdpr\b|art\. \d+|special-?category|storage.?limitation|data subject|lawful basis|ePrivacy/i.test(text)) gdpr++;
    if (/\bccpa\b|\bccpra\b|california|consumer/.test(text)) ccpa++;
  }
  return { gdpr, ccpa };
}

export default function MainPanel({
  value,
  onValueChange,
  result,
  analyzing,
  elapsedMs,
  error,
  onRun,
  searchQuery,
  flaggedKeys,
  onFlagAction,
}: {
  value: string;
  onValueChange: (v: string) => void;
  result: AnalysisResult;
  analyzing: boolean;
  elapsedMs: number | null;
  error: string | null;
  onRun: () => void;
  searchQuery: string;
  flaggedKeys: Set<string>;
  onFlagAction: (action: FlagAction, flag: RedFlag, profile: FlagProfile) => void;
}) {
  const high = result.red_flags.filter((f) => f.severity === "High").length;
  const medium = result.red_flags.filter((f) => f.severity === "Medium").length;
  const low = result.red_flags.filter((f) => f.severity === "Low").length;
  const { gdpr, ccpa } = useMemo(() => countStatuteViolations(result.red_flags), [result]);
  const { actionable } = useMemo(() => actionableCounts(result.red_flags, result.data_shared_or_sold), [result]);
  const hash = useMemo(() => policyHash(value), [value]);
  const stamp = useMemo(
    () =>
      new Date(result.analyzed_at ?? Date.now()).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [result.analyzed_at],
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-4 px-6 py-5">
      {/* Breadcrumbs */}
      <nav className="mono flex items-center gap-2 text-[11px] text-[#64748b]">
        <span>Sentinel Audit Suite</span>
        <span className="text-[#334155]">/</span>
        <span>Privacy Lens v2.4</span>
        <span className="text-[#334155]">/</span>
        <span className="text-[#38bdf8]">Policy Analyzer</span>
        <span className="hud ml-auto text-[#334155]">Welcome back · Gordon Clark</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--edge)] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-50">
              Policy Analyzer — {result.platform_name}
            </h1>
            <span className="tag tag-cyan mono">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Live Runtime
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[#94a3b8]">{result.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="tag mono">Retention · −∞ → v4.2.0</span>
          <button type="button" className="btn-cta mono h-9" onClick={onRun} disabled={analyzing}>
            {analyzing ? "Scanning…" : "⚡ Run Audit"}
          </button>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="mono flex flex-wrap items-center gap-y-1.5 rounded-lg border border-[var(--edge)] bg-[#0d1420] px-5 py-2.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="text-[#94a3b8]">
            Target <span className="text-[#38bdf8]">{result.source || "paste / URL input"}</span>
          </span>
          <span className="text-[#64748b]">|</span>
          <span className="text-[#94a3b8]">
            Hash <span className="text-[#f59e0b]">0x{hash}…</span>
          </span>
          <span className="text-[#64748b]">|</span>
          <span className="text-[#94a3b8]">
            Timestamp <span className="text-[#38bdf8]">{stamp}</span>
          </span>
          <span className="text-[#64748b]">|</span>
          <span className="text-[#94a3b8]">
            Model <span className="text-[#7dd3fc]">{result.model_used}</span>
          </span>
        </div>
        <span className="ml-auto text-[#10b981]">
          ● {result.red_flags.length} clauses flagged · {actionable} actionable opt-outs
        </span>
      </div>

      {/* Editor */}
      <CodeEditorCard
        value={value}
        onChange={onValueChange}
        onRun={onRun}
        analyzing={analyzing}
        elapsedMs={elapsedMs}
        modelUsed={result.model_used}
        highlightedCount={result.red_flags.length}
        source={result.source ?? ""}
      />

      {error && (
        <div className="panel border-l-2 border-l-[#ef4444] px-4 py-3 text-[13px] text-[#fca5a5]">
          ⚠ {error}
        </div>
      )}

      {/* Metrics */}
      <MetricsGrid
        trustScore={result.trust_score}
        high={high}
        medium={medium}
        advisory={low}
        gdprViolations={gdpr}
        ccpaFailures={ccpa}
      />

      {/* Detailed analysis */}
      <DetailedTabs result={result} searchQuery={searchQuery} flaggedKeys={flaggedKeys} onFlagAction={onFlagAction} />
    </div>
  );
}