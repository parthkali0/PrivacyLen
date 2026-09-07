"use client";

import { useCallback, useState } from "react";
import { diffPolicies, listPolicies, trackPolicy } from "@/lib/api";
import type { DiffResult, PolicyRecord } from "@/types";

export default function DiffTracker({
  seededBase,
}: {
  seededBase?: { id: number; text: string; url: string | null };
}) {
  const [basePicker, setBasePicker] = useState("latest");
  const [archive, setArchive] = useState<PolicyRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newText, setNewText] = useState("");
  const [result, setResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadArchive = useCallback(async () => {
    try {
      setArchive(await listPolicies());
    } catch {
      setArchive([]);
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    void loadArchive();
  }

  const runDiff = async () => {
    if (!newText.trim()) {
      setError("Provide the new policy text to diff against.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const useSeeded = !!seededBase && basePicker === "seeded";
      const archiveBase = !useSeeded
        ? basePicker === "latest"
          ? archive[0]
          : archive.find((r) => r.id === Number(basePicker))
        : undefined;

      if (!useSeeded && !archiveBase) {
        setError("No baseline revision available — save the current text as a baseline first.");
        return;
      }

      const data = await diffPolicies({
        base_text: useSeeded ? seededBase!.text : undefined,
        base_id: !useSeeded && archiveBase ? archiveBase.id : undefined,
        url: (useSeeded ? seededBase!.url : archiveBase?.url) || undefined,
        new_text: newText,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[980px] space-y-4 px-6 py-5">
      <nav className="mono flex items-center gap-2 text-[11px] text-[#64748b]">
        <span>Sentinel Audit Suite</span>
        <span className="text-[#334155]">/</span>
        <span>Diff Tracker</span>
      </nav>

      <div className="flex items-center gap-2.5 border-b border-[var(--edge)] pb-4">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-50">Diff Tracker</h1>
        <span className="tag tag-cyan mono">Clause-Level Drift Monitor</span>
      </div>
      <p className="text-[13px] text-[#94a3b8]">
        Detect silently added or removed legal clauses between policy revisions.
      </p>

      <div className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="hud" htmlFor="diff-base">Baseline revision</label>
            <select
              id="diff-base"
              value={basePicker}
              onChange={(e) => setBasePicker(e.target.value)}
              className="input mono mt-1.5 w-full text-[12px]"
            >
              {seededBase && <option value="seeded">Latest analyzed audit ({seededBase.url ?? "clipboard"})</option>}
              {!archive.length && !seededBase && <option value="latest">No saved archives yet</option>}
              {archive.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  #{r.id} · {(r.url ?? "paste").slice(0, 40)} · {new Date(r.saved_at).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void runDiff()}
              disabled={busy}
              className="btn-cta mono w-full justify-center h-9"
            >
              {busy ? "Computing drift…" : "⟲ Run Diff"}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="hud" htmlFor="diff-new">New revision text</label>
            <button
              type="button"
              className="btn-ghost mono h-7 px-2.5 text-[10px]"
              disabled={busy}
              onClick={async () => {
                try {
                  const rec = seededBase
                    ? await trackPolicy({ url: seededBase.url ?? undefined, text: newText })
                    : await trackPolicy({ text: newText });
                  setError(null);
                  window.alert(`Baseline stored #${rec.id} — it can now be diffed as a baseline revision.`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not store baseline.");
                }
              }}
            >
              Save as baseline
            </button>
          </div>
          <textarea
            id="diff-new"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={6}
            placeholder="Paste the newest revision here — added/removed clauses will be isolated and scored."
            className="code-view mono mt-1.5 w-full resize-y px-3 py-2 leading-relaxed"
          />
        </div>

        {error && (
          <p className="mono mt-3 rounded-lg border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[12px] text-[#fca5a5]">
            ⚠ {error}
          </p>
        )}

        {result && (
          <div className="mt-5 space-y-4">
            <div className="mono flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-[var(--edge)] bg-[#0d1420] px-4 py-2 text-[11px] text-[#94a3b8]">
              <span>Base <span className="text-[#38bdf8]">0x{result.base_text_hash.slice(0, 8)}</span></span>
              <span>New <span className="text-[#38bdf8]">0x{result.new_text_hash.slice(0, 8)}</span></span>
              <span>Unchanged <span className="text-[#10b981]">{result.unchanged_clause_count}</span></span>
              <span className="ml-auto">
                Drift <span className={result.change_percent > 15 ? "text-[#ef4444]" : "text-[#f59e0b]"}>{result.change_percent}%</span>
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="hud flex items-center gap-2 text-[#fca5a5]">
                  <span className="rounded bg-[#ef4444]/20 px-1.5 text-[10px]">+{result.added_clauses.length}</span> Added Clauses
                </p>
                <div className="code-view mt-2 max-h-72 space-y-2 overflow-auto px-3 py-3">
                  {result.added_clauses.length === 0 && (
                    <p className="mono text-[11px] text-[#64748b]">No added clauses detected.</p>
                  )}
                  {result.added_clauses.map((c, i) => (
                    <div key={i} className="border-l-2 border-[#10b981] py-0.5 pl-3">
                      <p className="mono text-[12px] text-[#9fb0c8]">{c}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="hud flex items-center gap-2 text-[#fca5a5]">
                  <span className="rounded bg-[#ef4444]/20 px-1.5 text-[10px]">−{result.removed_clauses.length}</span> Removed Clauses
                </p>
                <div className="code-view mt-2 max-h-72 space-y-2 overflow-auto px-3 py-3">
                  {result.removed_clauses.length === 0 && (
                    <p className="mono text-[11px] text-[#64748b]">No removed clauses detected.</p>
                  )}
                  {result.removed_clauses.map((c, i) => (
                    <div key={i} className="border-l-2 border-[#ef4444] py-0.5 pl-3">
                      <p className="mono text-[12px] line-through decoration-[#ef4444]/70 text-[#94a3b8]">{c}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}