"use client";

interface TrustScoreGaugeProps {
  score: number;
}

const COLOR_STOPS = [
  { max: 3, color: "#dc2626", label: "Very Low Trust" },
  { max: 5, color: "#ea580c", label: "Low Trust" },
  { max: 7, color: "#eab308", label: "Moderate Trust" },
  { max: 10, color: "#16a34a", label: "High Trust" },
];

export default function TrustScoreGauge({ score }: TrustScoreGaugeProps) {
  const clamped = Math.max(1, Math.min(10, Math.round(score)));
  const stop = COLOR_STOPS.find((s) => clamped <= s.max) ?? COLOR_STOPS[COLOR_STOPS.length - 1];

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 10) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={stop.color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold" style={{ color: stop.color }}>
            {clamped}
          </span>
          <span className="text-xs uppercase tracking-wide text-slate-500">/ 10</span>
        </div>
      </div>
      <span
        className="rounded-full px-3 py-1 text-sm font-semibold"
        style={{ backgroundColor: `${stop.color}1a`, color: stop.color }}
      >
        {stop.label}
      </span>
    </div>
  );
}