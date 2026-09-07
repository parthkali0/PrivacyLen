"use client";

import type { RedFlag } from "@/types";
import type { FlagAction, FlagProfile } from "@/lib/flagCatalog";
import { severityChip } from "@/lib/flagCatalog";

const ACTION_META: Record<FlagAction, { label: string; icon: string }> = {
  export: { label: "Export Evidence", icon: "📄" },
  optout: { label: "Generate CCPA Opt-Out Email", icon: "✉" },
  baseline: { label: "Compare with Baseline", icon: "📊" },
  counsel: { label: "Flag to Legal Counsel", icon: "🚩" },
  watcher: { label: "Deploy Diff Watcher Bot", icon: "🤖" },
};

export const ACTION_ORDER: FlagAction[] = ["export", "optout", "baseline", "counsel", "watcher"];

export default function RedFlagCard({
  flag,
  index,
  profile,
  flagged,
  onAction,
}: {
  flag: RedFlag;
  index: number;
  profile: FlagProfile;
  flagged: boolean;
  onAction: (action: FlagAction, flag: RedFlag, profile: FlagProfile) => void;
}) {
  const chip = severityChip(flag.severity);
  const toneClass =
    chip.tone === "red" ? "tag-red" : chip.tone === "amber" ? "tag-amber" : "tag-cyan";

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--edge)] bg-[#0d1420] px-4 py-2.5">
        <span className="mono text-[13px] font-bold text-slate-100">
          ⚠ {profile.code} · {profile.title}
        </span>
        <span className={`tag ${toneClass} mono`}>{chip.label}</span>
        <span className="tag mono">{profile.category}</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="hud text-[#475569]">
            Confidence <span className="text-[#38bdf8]">{profile.confidence}%</span>
          </span>
          <span className={`mono text-[10px] uppercase tracking-wider ${flagged ? "text-[#f59e0b]" : "text-[#64748b]"}`}>
            {flagged ? "● Flagged" : "○ Open"}
          </span>
        </span>
      </div>

      {/* Suspected clause quote */}
      <div className="px-4 pt-3">
        <p className="hud mb-1.5 text-[#94a3b8]">Suspected Infringing Clause</p>
        <div className="relative rounded-lg border-l-2 border-[#ef4444] bg-[#0b1020] px-4 py-3">
          <p className="mono text-[12.5px] leading-relaxed text-[#9fb0c8]">
            <span className="text-[#ef4444]">[[ </span>
            {flag.clause}
            <span className="text-[#ef4444]"> ]]</span>
          </p>
        </div>
      </div>

      {/* Assessment */}
      <div className="mt-3 px-4">
        <p className="hud mb-1.5 text-[#94a3b8]">Assessment / Threat Intel Grounding</p>
        <p className="text-[13px] leading-relaxed text-slate-300">{flag.explanation}</p>
      </div>

      {/* Footer actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--edge)] bg-[#0a0e17] px-4 py-2.5">
        <span className="tag mono text-[10px] text-[#94a3b8]">
          Statutory Violation · <span className="text-[#7dd3fc]">{profile.statute}</span>
        </span>
        <span className="mono ml-auto text-[10px] text-[#475569]">
          CID · {String(101 + index).padStart(3, "0")}
        </span>
        <span className="ml-2 flex gap-2">
          {ACTION_ORDER.filter((a) => profile.actions.includes(a)).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action, flag, profile)}
              className={
                action === "optout" || action === "counsel" ? "btn-cta mono h-8 px-3 text-[11px]" : "btn-ghost mono h-8 px-3 text-[11px]"
              }
            >
              <span>{ACTION_META[action].icon}</span>
              {ACTION_META[action].label}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}