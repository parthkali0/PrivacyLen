"use client";

import { useMemo, useState } from "react";
import type { AnalysisResult, RedFlag } from "@/types";
import type { FlagAction, FlagProfile } from "@/lib/flagCatalog";
import { actionableCounts, classifyFlag } from "@/lib/flagCatalog";
import RedFlagCard from "@/components/RedFlagCard";

type ViewTab = "flags" | "data" | "shared" | "rights" | "actions";
type SeverityFilter = "all" | RedFlag["severity"];

const SEVERITY_WEIGHT: Record<RedFlag["severity"], number> = { High: 3, Medium: 2, Low: 1 };

export default function DetailedTabs({
  result,
  searchQuery,
  flaggedKeys,
  onFlagAction,
}: {
  result: AnalysisResult;
  searchQuery: string;
  flaggedKeys: Set<string>;
  onFlagAction: (action: FlagAction, flag: RedFlag, profile: FlagProfile) => void;
}) {
  const [viewTab, setViewTab] = useState<ViewTab>("flags");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [sort, setSort] = useState<"risk" | "confidence">("risk");

  const { actionable } = useMemo(() => actionableCounts(result.red_flags, result.data_shared_or_sold), [result]);

  const profiles = useMemo(
    () => result.red_flags.map((flag, i) => classifyFlag(flag, i)),
    [result.red_flags],
  );

  const filteredFlags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = result.red_flags.filter(
      (f) =>
        severity === "all" || f.severity === severity,
    );
    if (q) {
      list = list.filter((f) =>
        `${f.clause} ${f.explanation}`.toLowerCase().includes(q),
      );
    }
    const withProfiles = list.map((f) => ({ f, p: classifyFlag(f, result.red_flags.indexOf(f)) }));
    withProfiles.sort((a, b) =>
      sort === "risk"
        ? SEVERITY_WEIGHT[b.f.severity] - SEVERITY_WEIGHT[a.f.severity]
        : b.p.confidence - a.p.confidence,
    );
    return withProfiles.map((e) => e.f);
  }, [result.red_flags, severity, searchQuery, sort]);

  const saleLike = useMemo(
    () =>
      result.red_flags
        .map((flag, i) => ({ flag, profile: profiles[i] }))
        .filter(({ flag }) =>
          /sell|broker|third[- ]party|marketing|advertis|distribute/i.test(
            `${flag.clause} ${flag.explanation}`,
          ),
        ),
    [result.red_flags, profiles],
  );

  const tabs: { key: ViewTab; label: string; count: number }[] = [
    { key: "flags", label: "Red Flags & Liabilities", count: result.red_flags.length },
    { key: "data", label: "Data Ingestion", count: result.data_collected.length },
    { key: "shared", label: "Shared & Sold Data", count: result.data_shared_or_sold.length },
    { key: "rights", label: "Rights Surrendered", count: result.rights_forfeited.length },
    { key: "actions", label: "Actionable Opt-Outs", count: actionable },
  ];

  const severityChips: { key: SeverityFilter; label: string; tone: string }[] = [
    { key: "all", label: "All Features", tone: "text-slate-200" },
    { key: "High", label: "High", tone: "text-[#ef4444]" },
    { key: "Medium", label: "Medium", tone: "text-[#f59e0b]" },
    { key: "Low", label: "Low", tone: "text-[#38bdf8]" },
  ];

  const listItem = (text: string, index: number, accent?: string) => (
    <div key={index} className="panel-inset flex items-start gap-3 px-4 py-2.5">
      <span className="mono mt-px text-[11px] text-[#38bdf8]">[{String(index + 1).padStart(2, "0")}]</span>
      <span className={`mono flex-1 text-[12.5px] leading-relaxed ${accent ?? "text-[#9fb0c8]"}`}>{text}</span>
    </div>
  );

  return (
    <div className="panel">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--edge)] bg-[#0d1420] px-3 pt-2">
        {tabs.map((t) => {
          const active = viewTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setViewTab(t.key)}
              className={`mono flex items-center gap-2 rounded-t border-x border-t border-b-0 px-3 py-2 text-[12px] transition ${
                active
                  ? "border-[var(--edge)] bg-transparent text-slate-100"
                  : "border-transparent text-[#64748b] hover:text-[#94a3b8]"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-[#ef4444] text-white" : "bg-[#1e293b] text-[#94a3b8]"}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--edge)] px-4 py-2.5">
        {viewTab === "flags" ? (
          <>
            {severityChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setSeverity(chip.key)}
                className={`mono rounded-full border px-3 py-1 text-[11px] transition ${
                  severity === chip.key
                    ? "border-[var(--accent-cyan)] bg-[rgba(56,189,248,0.1)] text-slate-100"
                    : "border-[var(--edge-2)] bg-transparent text-[#64748b] hover:text-[#94a3b8]"
                } ${chip.key === "all" ? "text-slate-200" : chip.tone}`}
              >
                {chip.label}
                {chip.key !== "all" && (
                  <span className="ml-1 opacity-80">
                    {result.red_flags.filter((f) => f.severity === chip.key).length}
                  </span>
                )}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2">
              <span className="hud">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "risk" | "confidence")}
                className="input mono h-7 pr-7 text-[11px]"
              >
                <option value="risk">Risk Level</option>
                <option value="confidence">Confidence</option>
              </select>
            </label>
          </>
        ) : (
          <span className="hud flex items-center gap-2">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#10b981]" />
            Extracted from {result.platform_name}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {viewTab === "flags" &&
          (filteredFlags.length === 0 ? (
            <p className="mono py-6 text-center text-[12px] text-[#64748b]">
              No matching clauses detected for query.
            </p>
          ) : (
            filteredFlags.map((flag, i) => {
              const profile = profiles[result.red_flags.indexOf(flag)];
              return (
                <RedFlagCard
                  key={profile.code}
                  flag={flag}
                  index={i}
                  profile={profile}
                  flagged={flaggedKeys.has(profile.code)}
                  onAction={onFlagAction}
                />
              );
            })
          ))}

        {viewTab === "data" &&
          (result.data_collected.length ? (
            result.data_collected.map((item, i) => listItem(item, i))
          ) : (
            <p className="mono py-6 text-center text-[12px] text-[#64748b]">No data collection declared.</p>
          ))}

        {viewTab === "shared" &&
          (result.data_shared_or_sold.length ? (
            result.data_shared_or_sold.map((item, i) => listItem(item, i, "text-[#fca5a5]"))
          ) : (
            <p className="mono py-6 text-center text-[12px] text-[#64748b]">No sharing/sale declared.</p>
          ))}

        {viewTab === "rights" &&
          (result.rights_forfeited.length ? (
            result.rights_forfeited.map((item, i) => listItem(item, i, "text-[#fbbf24]"))
          ) : (
            <p className="mono py-6 text-center text-[12px] text-[#64748b]">No rights surrendered.</p>
          ))}

        {viewTab === "actions" &&
          (actionable === 0 ? (
            <p className="mono py-6 text-center text-[12px] text-[#64748b]">No actionable opt-out surfaces found.</p>
          ) : (
            <>
              {saleLike.map(({ flag, profile }) => (
                <div key={profile.code} className="panel-inset flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="mono text-[12px] font-semibold text-[#fca5a5]">✉ {profile.title}</span>
                  <span className="tag mono">{flag.severity}</span>
                  <button
                    type="button"
                    onClick={() => onFlagAction("optout", flag, profile)}
                    className="btn-cta mono ml-auto h-8 px-3 text-[11px]"
                  >
                    Generate CCPA Opt-Out Email
                  </button>
                </div>
              ))}
              {result.data_shared_or_sold.map((item, i) => (
                <div key={`s-${i}`} className="panel-inset flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="mono flex-1 text-[12px] text-[#fca5a5]">{item}</span>
                  <span className="tag mono text-[#64748b]">Shared/Sold</span>
                  <button type="button" className="btn-ghost mono h-8 px-3 text-[11px]">
                    ✉ Generate Email
                  </button>
                </div>
              ))}
            </>
          ))}
      </div>
    </div>
  );
}