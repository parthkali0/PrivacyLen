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

export interface OptOutResult {
  subject: string;
  body: string;
  references: string[];
}

export interface PolicyRecord {
  id: number;
  url: string | null;
  text_hash: string;
  text_preview: string;
  char_count: number;
  saved_at: string;
}

export interface DiffInput {
  base_text?: string;
  base_id?: number;
  url?: string;
  new_text: string;
}

export interface DiffResult {
  base_identifier: string;
  base_text_hash: string;
  new_text_hash: string;
  added_clauses: string[];
  removed_clauses: string[];
  unchanged_clause_count: number;
  change_percent: number;
}