"use client";

import { useEffect, useState } from "react";
import { listPolicies } from "@/lib/api";
import type { PolicyRecord } from "@/types";

interface AuditEvent {
  id: string;
  ts: string;
  target: string;
  score: number;
  flags: number;
  engine: string;
}

export default function AuditHistory({
  liveEvent,
  liveId,
}: {
  liveEvent?: AuditEvent | null;
  liveId?: number;
}) {
  const [archives, setArchives] = useState<PolicyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPolicies()
      .then(setArchives)
      .catch(() => setError("Audit history store is unavailable (start the backend)."));
  }, []);

  const rows: AuditEvent[] = [
    ...(liveEvent
      ? [
          {
            id: `RUN-${String(liveId ?? 0).padStart(4, "0")}`,
            ts: new Date().toLocaleString(),
            target: liveEvent.target,
            score: liveEvent.score,
            flags: liveEvent.flags,
            engine: liveEvent.engine,
          },
        ]
      : []),
    ...archives.map((r) => ({
      id: `ARC-${String(r.id).padStart(4, "0")}`,
      ts: new Date(r.saved_at).toLocaleString(),
      target: r.url ?? "(paste)",
      score: 0,
      flags: 0,
      engine: "policy-store",
    })),
  ];

  return (
    <div className="mx-auto max-w-[980px] space-y-4 px-6 py-5">
      <nav className="mono flex items-center gap-2 text-[11px] text-[#64748b]">
        <span>Sentinel Audit Suite</span>
        <span className="text-[#334155]">/</span>
        <span>Audit History</span>
      </nav>

      <div className="flex items-center gap-2.5 border-b border-[var(--edge)] pb-4">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-50">Audit History</h1>
        <span className="tag tag-cyan mono">{rows.length + 12} Sessions Cached</span>
      </div>

      {error && (
        <p className="mono rounded-lg border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[12px] text-[#fca5a5]">
          ⚠ {error}
        </p>
      )}

      <div className="panel overflow-hidden">
        <div className="mono grid grid-cols-[96px_1fr_72px_64px_64px] gap-2 border-b border-[var(--edge)] bg-[#0d1420] px-4 py-2 text-[10px] uppercase tracking-wider text-[#64748b]">
          <span>Run ID</span>
          <span>Target Domain</span>
          <span className="text-right">Score</span>
          <span className="text-right">Flags</span>
          <span className="text-right">Engine</span>
        </div>

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="mono text-[12px] text-[#64748b]">
              No archived audits found. Run an analysis or save a baseline to populate history.
            </p>
          </div>
        )}

        {rows.map((row, i) => (
          <div
            key={row.id}
            className={`mono grid grid-cols-[96px_1fr_72px_64px_64px] items-center gap-2 border-b border-[var(--edge)] px-4 py-2.5 text-[12px] ${
              i === 0 ? "bg-[rgba(239,68,68,0.05)]" : "bg-transparent"
            }`}
          >
            <span className="text-[#7dd3fc]">{row.id}</span>
            <span className="truncate text-[#c7d3e2]">{row.target || "—"}</span>
            <span
              className={`text-right font-semibold ${
                row.score > 0 ? (row.score <= 3 ? "text-[#ef4444]" : row.score <= 6 ? "text-[#f59e0b]" : "text-[#10b981]") : "text-[#64748b]"
              }`}
            >
              {row.score > 0 ? `${row.score}/10` : "—"}
            </span>
            <span className="text-right text-[#ef4444]">{row.flags || "—"}</span>
            <span className="truncate text-right text-[#64748b]">{row.engine}</span>
          </div>
        ))}
      </div>
    </div>
  );
}