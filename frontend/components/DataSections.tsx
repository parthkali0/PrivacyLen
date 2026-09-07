"use client";

import { useState } from "react";

interface DataSectionsProps {
  dataCollected: string[];
  dataShared: string[];
  rightsForfeited: string[];
}

type SectionKey = "collected" | "shared" | "rights";

const SECTIONS: { key: SectionKey; title: string; subtitle: string }[] = [
  { key: "collected", title: "Data Collected", subtitle: "What this service collects about you" },
  { key: "shared", title: "Data Shared / Sold", subtitle: "What is passed to third parties" },
  { key: "rights", title: "Rights You Surrender", subtitle: "Legal rights or guarantees you give up" },
];

export default function DataSections({ dataCollected, dataShared, rightsForfeited }: DataSectionsProps) {
  const [visible, setVisible] = useState<Record<SectionKey, boolean>>({
    collected: true,
    shared: true,
    rights: true,
  });

  const sources: Record<SectionKey, string[]> = {
    collected: dataCollected,
    shared: dataShared,
    rights: rightsForfeited,
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Policy Breakdown</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {SECTIONS.map(({ key, title }) => (
          <label
            key={key}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            <input
              type="checkbox"
              checked={visible[key]}
              onChange={(event) =>
                setVisible((prev) => ({ ...prev, [key]: event.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            {title}
            <span className="rounded-full bg-slate-200 px-1.5 text-xs text-slate-600">
              {sources[key].length}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {SECTIONS.filter(({ key }) => visible[key]).map(({ key, title, subtitle }) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
            <ul className="mt-3 space-y-1.5">
              {sources[key].map((item, index) => (
                <li key={index} className="rounded bg-white px-2.5 py-1.5 text-sm text-slate-700">
                  {item}
                </li>
              ))}
              {sources[key].length === 0 && (
                <li className="text-sm text-slate-400">None specified.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}