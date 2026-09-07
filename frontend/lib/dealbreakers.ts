import type { RedFlag } from "@/types";

export interface Dealbreaker {
  key: string;
  label: string;
  pattern: RegExp;
}

export const DEALBREAKERS: Dealbreaker[] = [
  { key: "ai_training", label: "AI Training", pattern: /ai model|machine learning|train/i },
  { key: "location", label: "Location / GPS", pattern: /location|gps|geo/i },
  { key: "microphone", label: "Microphone / Audio", pattern: /microphone|audio|voice record/i },
  { key: "contacts", label: "Contacts / Address Book", pattern: /contacts|address book/i },
  { key: "browsing", label: "Browsing History", pattern: /browsing|search history/i },
  { key: "device", label: "Device IDs / IP", pattern: /device identifier|ip address|battery/i },
  { key: "selling", label: "Selling Personal Data", pattern: /sold|sell/i },
  { key: "brokers", label: "Data Brokers", pattern: /data broker|marketing agenc/i },
  { key: "arbitration", label: "Binding Arbitration", pattern: /arbitrat/i },
  { key: "class_action", label: "Class-Action Waiver", pattern: /class[- ]action/i },
  { key: "unilateral", label: "Unilateral Changes", pattern: /change.*(without notice|at any time)|reserve the right/i },
];

export const DEFAULT_DEALBREAKERS: string[] = DEALBREAKERS.map((d) => d.key);

const STORAGE_KEY = "pl_dealbreakers";

export function readDealbreakers(): string[] {
  if (typeof window === "undefined") return DEFAULT_DEALBREAKERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return DEFAULT_DEALBREAKERS;
    const valid = parsed.filter((k) => DEALBREAKERS.some((d) => d.key === k));
    return valid.length ? valid : DEFAULT_DEALBREAKERS;
  } catch {
    return DEFAULT_DEALBREAKERS;
  }
}

export function writeDealbreakers(keys: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/** Keys of dealbreakers that match this red flag (based on clause + explanation). */
export function matchDealbreakers(flag: RedFlag, enabledKeys: string[]): string[] {
  if (!enabledKeys.length) return [];
  const text = `${flag.clause} ${flag.explanation}`.toLowerCase();
  return DEALBREAKERS.filter((d) => enabledKeys.includes(d.key) && d.pattern.test(text)).map((d) => d.key);
}