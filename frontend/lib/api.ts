import type { AnalysisResult, DiffInput, DiffResult, OptOutResult, PolicyRecord } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AnalyzeInput {
  text?: string;
  url?: string;
}

export interface OptOutInput {
  company_name: string;
  flagged_items: string[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      message = payload.detail ?? message;
    } catch {
      // non-JSON error body; keep the default message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function analyzePolicy(input: AnalyzeInput): Promise<AnalysisResult> {
  return post<AnalysisResult>("/api/v1/analyze", input);
}

export async function generateOptOut(input: OptOutInput): Promise<OptOutResult> {
  return post<OptOutResult>("/api/v1/optout", input);
}

export async function diffPolicies(input: DiffInput): Promise<DiffResult> {
  return post<DiffResult>("/api/v1/diff", input);
}

export async function trackPolicy(input: { url?: string; text: string }): Promise<PolicyRecord> {
  return post<PolicyRecord>("/api/v1/policies", input);
}

export async function listPolicies(): Promise<PolicyRecord[]> {
  const response = await fetch(`${API_BASE}/api/v1/policies`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as PolicyRecord[];
}