"use client";

import { useMemo, useState } from "react";
import { DEALBREAKERS } from "@/lib/dealbreakers";

export default function SettingsPanel({
  dealbreakers,
  onChange,
}: {
  dealbreakers: string[];
  onChange: (keys: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(dealbreakers);

  const counts = useMemo(() => {
    return new Map(DEALBREAKERS.map((d) => [d.key, d.key === "selling" || d.key === "brokers" ? 3 : d.key === "arbitration" || d.key === "class_action" ? 1 : 0]));
  }, []);

  const toggle = (key: string) => {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const dirty = draft.length !== dealbreakers.length || draft.some((k) => !dealbreakers.includes(k));

  return (
    <div className="mx-auto max-w-[820px] space-y-4 px-6 py-5">
      <nav className="mono flex items-center gap-2 text-[11px] text-[#64748b]">
        <span>Sentinel Audit Suite</span>
        <span className="text-[#334155]">/</span>
        <span>Settings & Rules</span>
      </nav>

      <div className="flex items-center gap-2.5 border-b border-[var(--edge)] pb-4">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-50">Settings & Rules</h1>
        <span className="tag tag-cyan mono">Detection Rule Profile</span>
      </div>

      <div className="panel p-5">
        <p className="hud text-[#94a3b8]">Dealbreaker detection rules</p>
        <p className="mt-1 text-[13px] text-[#94a3b8]">
          Clauses that match an enabled dealbreaker are pinned to the top of the red-flag queue and
          marked clearly in reports.
        </p>

        <div className="mt-4 space-y-1.5">
          {DEALBREAKERS.map((d) => {
            const checked = draft.includes(d.key);
            const hit = counts.get(d.key) ?? 0;
            return (
              <label
                key={d.key}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition ${
                  checked
                    ? "border-[rgba(59,130,246,0.5)] bg-[rgba(59,130,246,0.08)]"
                    : "border-[var(--edge)] bg-transparent hover:border-[var(--edge-2)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(d.key)}
                    className="h-4 w-4 cursor-pointer accent-[#3b82f6]"
                  />
                  <span className="text-[13px] font-medium text-slate-200">{d.label}</span>
                  {hit > 0 && checked && (
                    <span className="mono rounded bg-[#ef4444]/15 px-1.5 text-[10px] text-[#fca5a5]">
                      {hit} active rule
                    </span>
                  )}
                </div>
                <span className="mono text-[11px] text-[#64748b]">{checked ? "● enabled" : "○ disabled"}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2 border-t border-[var(--edge)] pt-4">
          <button
            type="button"
            onClick={() => onChange(draft)}
            disabled={!dirty}
            className="btn-cta mono justify-center"
          >
            Save rules
          </button>
          <span className="mono ml-auto self-center text-[11px] text-[#64748b]">
            Slug · pl-rules-v2.4 · {draft.length}/{DEALBREAKERS.length} enabled
          </span>
        </div>
      </div>
    </div>
  );
}