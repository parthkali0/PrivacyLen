"use client";

interface TrustScoreGaugeProps {
  score: number;
}

const PALETTE: Record<number, { color: string; label: string }> = {
  0: { color: "#ef4444", label: "ZERO TRUST" },
  1: { color: "#ef4444", label: "CRITICAL RISK" },
  2: { color: "#ef4444", label: "CRITICAL RISK" },
  3: { color: "#ef4444", label: "CRITICAL RISK" },
  4: { color: "#f59e0b", label: "ELEVATED RISK" },
  5: { color: "#f59e0b", label: "ELEVATED RISK" },
  6: { color: "#f59e0b", label: "MODERATE RISK" },
  7: { color: "#38bdf8", label: "MODERATE TRUST" },
  8: { color: "#10b981", label: "CONTROLLED" },
  9: { color: "#10b981", label: "GOOD TRUST" },
  10: { color: "#10b981", label: "EXCELLENT" },
};

export default function TrustScoreGauge({ score }: TrustScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(10, Math.round(score)));
  const { color, label } = PALETTE[clamped] ?? PALETTE[0];

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 10) * circumference;

  const ticks = Array.from({ length: 10 }, (_, i) => {
    const angle = (-90 + i * 36) * (Math.PI / 180);
    const r1 = 72;
    const r2 = 77;
    return {
      x1: 100 + r1 * Math.cos(angle),
      y1: 100 + r1 * Math.sin(angle),
      x2: 100 + r2 * Math.cos(angle),
      y2: 100 + r2 * Math.sin(angle),
    };
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[130px] w-[130px] shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle cx="100" cy="100" r={radius} fill="#0b1020" stroke="#1f2937" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#182338"
            strokeWidth="10"
            strokeDasharray={`${circumference}`}
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            className="transition-all duration-700"
          />
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={i < clamped ? color : "#334155"}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="mono text-[34px] leading-none font-bold" style={{ color }}>
            {clamped}
          </span>
          <span className="mono text-[11px] text-[#64748b]">/ 10</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="hud text-[#94a3b8]">Trust Score</p>
        <p className="mono text-sm font-semibold text-slate-100">Score {clamped}/10</p>
        <span className="tag" style={{ borderColor: `${color}55`, color, background: `${color}1a` }}>
          <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <p className="hud pt-1 text-[#334155]">Thresholds: ≤3 Block · 4–6 Caution · ≥7 Pass</p>
      </div>
    </div>
  );
}