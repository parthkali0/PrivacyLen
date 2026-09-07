"use client";

import type { RedFlag, Severity } from "@/types";

const SEVERITY_ORDER: Severity[] = ["High", "Medium", "Low"];

const SEVERITY_STYLES: Record<Severity, string> = {
  High: "border-red-200 bg-red-50",
  Medium: "border-amber-200 bg-amber-50",
  Low: "border-blue-200 bg-blue-50",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  High: "bg-red-600",
  Medium: "bg-amber-500",
  Low: "bg-blue-500",
};

export default function RedFlags({ flags }: { flags: RedFlag[] }) {
  const sorted = [...flags].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Red Flags</h2>
      <ul className="mt-3 space-y-3">
        {sorted.map((flag, index) => (
          <li key={index} className={`rounded-lg border p-4 ${SEVERITY_STYLES[flag.severity]}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-slate-900">{flag.clause}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${SEVERITY_BADGE[flag.severity]}`}
              >
                {flag.severity}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-600">{flag.explanation}</p>
          </li>
        ))}
        {flags.length === 0 && (
          <li className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No concerning clauses identified.
          </li>
        )}
      </ul>
    </section>
  );
}