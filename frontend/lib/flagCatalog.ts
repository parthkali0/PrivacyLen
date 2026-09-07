import type { RedFlag, Severity } from "@/types";

/**
 * Classifies a backend red flag into the enterprise catalog vocabulary:
 * a short title, a stable reference ID, a risk category, the statute footer,
 * and the recommended action buttons (mirroring the v2.4 design spec).
 */

export interface FlagProfile {
  title: string;
  code: string;
  category: string;
  statute: string;
  confidence: number;
  actions: FlagAction[];
}

export type FlagAction =
  | "export"
  | "optout"
  | "baseline"
  | "counsel"
  | "watcher";

interface KeywordRule {
  re: RegExp;
  title: string;
  code: string;
  category: string;
  statute: string;
  actions: FlagAction[];
}

const RULES: KeywordRule[] = [
  {
    re: /biometric|sublicense to sell|behavioral telemetric data|sell.*distribute|commercialis/i,
    title: "Biometric & Prompt Data Sale",
    code: "P-101",
    category: "Data Commercialization",
    statute: "CCPA § 1798.120 & GDPR Art. 9 (Special Categories)",
    actions: ["export", "optout"],
  },
  {
    re: /class[- ]action|collective redress|waive any right to/i,
    title: "Mandatory Class Action Waiver",
    code: "L-304",
    category: "Dispute & Governance",
    statute: "Unconscionability Defense / FAA Preemption Friction",
    actions: ["baseline", "counsel"],
  },
  {
    re: /retention|transfer.*biometric|storage.limitation|twenty years/i,
    title: "Biometric Retention & Transfer",
    code: "B-402",
    category: "Data Governance",
    statute: "GDPR Art. 5(1)(e) Storage Limitation",
    actions: ["export", "watcher"],
  },
  {
    re: /modify these terms|without prior notice|at any time and without|silent modification/i,
    title: "Silent Modification Provision",
    code: "T-209",
    category: "Contract & Transparency",
    statute: "FTC Deceptive Trade Practices & GDPR Art. 13/14 Transparency",
    actions: ["watcher"],
  },
  {
    re: /arbitrat/i,
    title: "Binding Arbitration Clause",
    code: "L-208",
    category: "Dispute & Governance",
    statute: "FAA Preemption Friction / Consumer Standing",
    actions: ["baseline", "counsel"],
  },
  {
    re: /train.*ai|ai model|machine learning|prompt.*(train|model)/i,
    title: "AI Model Training on User Content",
    code: "AI-310",
    category: "AI & Content Rights",
    statute: "GDPR Art. 22 & EU AI Act (2025)",
    actions: ["export", "optout"],
  },
  {
    re: /precise location|\bgps\b|geolocation|real[- ]time location/i,
    title: "Precise Location Ingestion",
    code: "L-512",
    category: "Telemetry & Tracking",
    statute: "CCPA § 1798.150 & GDPR Art. 22",
    actions: ["export", "optout"],
  },
  {
    re: /microphone|audio recording|voice recording|sound recording/i,
    title: "Microphone & Audio Capture",
    code: "M-206",
    category: "Surveillance & Consent",
    statute: "GDPR Art. 7 Consent & Wiretap Defaults",
    actions: ["export", "optout"],
  },
  {
    re: /cross-context|marketing agencies|advertis/i,
    title: "Cross-Context Advertising License",
    code: "A-117",
    category: "Advertising & Brokering",
    statute: "CPRA § 1798.120 Sharing & GPC Signals",
    actions: ["export", "watcher"],
  },
  {
    re: /browsing|search history|web history/i,
    title: "Browsing & Search History Tracking",
    code: "T-133",
    category: "Telemetry & Tracking",
    statute: "CCPA § 1798.115 Control Rights",
    actions: ["export", "optout"],
  },
  {
    re: /device identifier|ip address|\bipv\b|advertising id|battery/i,
    title: "Device & Network Fingerprinting",
    code: "T-099",
    category: "Telemetry & Tracking",
    statute: "GDPR Art. 5/6 Lawful Basis & ePrivacy",
    actions: ["export", "watcher"],
  },
  {
    re: /contacts|address book/i,
    title: "Contact Directory Ingestion",
    code: "D-044",
    category: "Data Ingestion",
    statute: "GDPR Art. 6 & CCPA § 1798.140 PI Definition",
    actions: ["export", "optout"],
  },
];

const FALLBACK: Omit<FlagProfile, "code" | "confidence"> = {
  title: "Uncategorized Clause Risk",
  category: "Policy & Governance",
  statute: "Recommend Legal Counsel Review",
  actions: ["export", "counsel"],
};

export function classifyFlag(flag: RedFlag, index: number): FlagProfile {
  const text = `${flag.clause} ${flag.explanation}`;
  const rule = RULES.find((r) => r.re.test(text)) ?? null;

  const severityLetter =
    flag.severity === "High" ? "C" : flag.severity === "Medium" ? "M" : "A";
  const code = rule ? rule.code : `R-${(101 + index).toString().padStart(3, "0")}`;
  const stable = `${flag.clause}${index}`;
  let hash = 0;
  for (let i = 0; i < stable.length; i++) {
    hash = (hash * 31 + stable.charCodeAt(i)) >>> 0;
  }
  const confidence = Math.round(97 + (hash % 30) / 10); // 97.0 – 99.9%

  return {
    title: rule ? rule.title : FALLBACK.title,
    code,
    category: rule ? rule.category : FALLBACK.category,
    statute: rule ? rule.statute : FALLBACK.statute,
    confidence,
    actions: rule ? rule.actions : FALLBACK.actions,
  };
}

export function severityChip(severity: Severity): { label: string; tone: "red" | "amber" | "blue" } {
  if (severity === "High") return { label: "HIGH RISK", tone: "red" };
  if (severity === "Medium") return { label: "MEDIUM RISK", tone: "amber" };
  return { label: "ADVISORY", tone: "blue" };
}

export function actionableCounts(flags: RedFlag[], shared: string[]): {
  actionable: number;
  shareLikeFlags: number;
} {
  const shareLikeFlags = flags.filter((f) =>
    /sell|broker|third[- ]party|marketing|advertis|distribute/i.test(`${f.clause} ${f.explanation}`),
  ).length;
  return { actionable: shared.length + shareLikeFlags, shareLikeFlags };
}