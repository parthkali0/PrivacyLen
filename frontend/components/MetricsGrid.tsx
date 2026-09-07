"use client";

import TrustScoreGauge from "@/components/TrustScoreGauge";
import VulnerabilityProfile from "@/components/VulnerabilityProfile";
import DataPrivacySovereignty from "@/components/DataPrivacySovereignty";

export default function MetricsGrid({
  trustScore,
  high,
  medium,
  advisory,
  gdprViolations,
  ccpaFailures,
}: {
  trustScore: number;
  high: number;
  medium: number;
  advisory: number;
  gdprViolations: number;
  ccpaFailures: number;
}) {
  const detected = high + medium + advisory;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="panel p-5">
        <TrustScoreGauge score={trustScore} />
      </div>
      <div className="panel p-5">
        <VulnerabilityProfile high={high} medium={medium} advisory={advisory} detected={detected} />
      </div>
      <div className="panel p-5">
        <DataPrivacySovereignty gdprViolations={gdprViolations} ccpaFailures={ccpaFailures} />
      </div>
    </div>
  );
}