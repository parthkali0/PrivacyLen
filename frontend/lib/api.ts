import type { AnalysisResult } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AnalyzeInput {
  text?: string;
  url?: string;
}

export async function analyzePolicy(input: AnalyzeInput): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      message = body.detail ?? message;
    } catch {
      // non-JSON error body; keep the default message
    }
    throw new Error(message);
  }

  return (await response.json()) as AnalysisResult;
}