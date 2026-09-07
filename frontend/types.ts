export type Severity = "High" | "Medium" | "Low";

export interface RedFlag {
  clause: string;
  severity: Severity;
  explanation: string;
}

export interface AnalysisResult {
  trust_score: number;
  platform_name: string;
  summary: string;
  data_collected: string[];
  data_shared_or_sold: string[];
  rights_forfeited: string[];
  red_flags: RedFlag[];
  analyzed_at: string;
  source: string | null;
  model_used: string;
}

export type AnalysisStage = "idle" | "analyzing" | "done" | "error";