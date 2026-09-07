"use client";

const CHECKLIST = [
  "Data-minimization honored in collection surfaces",
  "Lawful basis documented for processing",
  "User control surfaces exposed (access / delete)",
  "Cross-border transfer safeguards present",
];

export default function DataPrivacySovereignty({
  gdprViolations,
  ccpaFailures,
}: {
  gdprViolations: number;
  ccpaFailures: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="hud text-[#94a3b8]">Data Privacy Sovereignty</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="panel-inset px-3 py-2">
          <p className="hud text-[#64748b]">GDPR</p>
          <p className="mono mt-1 text-xl font-bold text-[#ef4444]">{gdprViolations}</p>
          <p className="mono text-[10px] text-[#94a3b8]">Violations</p>
        </div>
        <div className="panel-inset px-3 py-2">
          <p className="hud text-[#64748b]">CCPA</p>
          <p className="mono mt-1 text-xl font-bold text-[#f59e0b]">{ccpaFailures}</p>
          <p className="mono text-[10px] text-[#94a3b8]">Provisions Failed</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {CHECKLIST.map((item) => (
          <div key={item} className="flex items-start gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-[12px] text-slate-300">{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-[var(--edge)] pt-2">
        <span className="mono text-[10px] uppercase tracking-wider text-[#10b981]">▲ Crypto State: Sealed</span>
        <span className="mono text-[10px] text-[#64748b]">ISO 42001</span>
      </div>
    </div>
  );
}