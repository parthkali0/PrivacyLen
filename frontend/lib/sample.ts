import type { AnalysisResult } from "@/types";

/** Mock terms document preloaded into the editor so the audit surface renders immediately. */
export const SAMPLE_TEXT = `ACQUIRED INCORPORATED — TERMS OF SERVICE AGREEMENT — v4.2

1. ACCEPTANCE
By accessing or using the Service you agree to be bound by this Agreement and all future modifications. If you do not agree, you must stop using the Service immediately.

2. DATA COLLECTION
We collect device identifiers, IP address, battery and hardware telemetry, browsing and search history, precise location, contacts and address book, voice and audio recordings, and biometric signatures. Advertising identifiers (IDFA/GAID) are collected and combined across surfaces.

4. LICENSE TO USER DATA
You grant a perpetual, worldwide, sublicensable license to sell, and distribute aggregated behavioral telemetric data, biometric signatures, and contextual prompts to third parties, including marketing agencies for cross-context behavioral advertising.

5. SHARING
Aggregated user data is licensed to marketing agencies and third-party data brokers. Sale of personal data may occur in connection with these arrangements.

7. LOCATION
Precise GPS and real-time location is continuously collected and retained for the full term of this agreement plus twenty years.

9. DISPUTES
You agree to waive any right to participate in class-action litigation. All disputes shall be resolved through binding individual arbitration.

11. RETENTION
We may transfer, retain, and sublicense biometric and health data for the full term of this agreement plus twenty years.

12. MODIFICATION
We may modify these terms, or the agreement, at any time and without prior notice, effective upon posting. Continued use constitutes acceptance.
`;

/**
 * Built-in sample audit used to render the enterprise panel instantly before a
 * real backend analysis runs. Numbers mirror the v2.4 design spec.
 */
export const SAMPLE_AUDIT: AnalysisResult = {
  trust_score: 2,
  platform_name: "Acquired S-Corp Terms (v4.2)",
  summary:
    "This agreement licenses, sells, and distributes behavioral telemetric data and biometric signatures, bans collective redress, and permits silent unilateral modification of its terms.",
  data_collected: [
    "Biometric signatures (facial recognition)",
    "Voice & audio recordings",
    "Precise GPS / real-time location",
    "Contacts & address book",
    "Browsing & search history",
    "Device identifiers & IP address",
    "Advertising identifiers (IDFA / GAID)",
    "Battery & hardware telemetry",
    "Purchase & in-app transaction history",
    "Messaging & prompt input content",
  ],
  data_shared_or_sold: [
    "Selling personal data",
    "Third-party data brokers",
    "Biometric & behavioral telemetric data",
  ],
  rights_forfeited: ["Mandatory binding arbitration", "Class-action waiver", "Unilateral changes to terms"],
  red_flags: [
    {
      clause:
        "§ 4.2 ... grant a worldwide, sublicensable license to sell, and distribute aggregated behavioral telemetric data, biometric signatures, and contextual prompts to third parties",
      severity: "High",
      explanation:
        "The agreement commercialises special-category biometric data. Under GDPR Art. 9 this requires explicit consent; under CCPA § 1798.120 the opt-out of sale is effectively waived, exposing users to uncapped liability transfer.",
    },
    {
      clause:
        "§ 9.6 ... you agree to waive any right to participate in or bring class-action litigation and resolve all disputes through binding individual arbitration",
      severity: "High",
      explanation:
        "A mandatory class-action waiver funnels all disputes into individual arbitration, raising unconscionability defenses and FAA preemption friction for consumer claims.",
    },
    {
      clause:
        "§ 11.1 ... we may transfer, retain, and sublicense biometric and health data for the full term of this agreement plus twenty years",
      severity: "High",
      explanation:
        "Unbounded retention windows for biometric and health records exceed reasonable data-minimisation duties and contradict GDPR storage-limitation principles.",
    },
    {
      clause:
        "§ 12.4 ... we may modify these terms, or the agreement, at any time and without prior notice, effective upon posting",
      severity: "Medium",
      explanation:
        "Silent modification allows material terms to change without consent or notice, conflicting with FTC deceptive-trade-practice guidance and GDPR Art. 13/14 transparency duties.",
    },
    {
      clause:
        "§ 5.1 ... aggregated user data is licensed to marketing agencies for cross-context behavioral advertising",
      severity: "Low",
      explanation:
        "Cross-context advertising with marketing agencies warrants monitoring under CPRA sharing rules and may require a global opt-out signal to be honoured.",
    },
  ],
  analyzed_at: new Date().toISOString(),
  source: "https://acquired.example/terms-v4.2",
  model_used: "regex-rule-engine",
};