export interface ProviderHealth {
  provider: string;
  events: number;
  parser_version: number;
  live_version: number;
  registered_versions: number[];
  last_ingest: string;
  last_occurred: string;
  missing_cost: number;
}

export interface Alert {
  id: number;
  provider: string;
  type: "STRUCTURAL" | "SILENT_NULL";
  severity: "warn" | "critical";
  field: string | null;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface FieldVital {
  field: string;
  series: number[];
  rate: number;
  state: "alive" | "warn" | "dark";
}

export interface ProviderVitals {
  provider: string;
  fields: FieldVital[];
}

export interface ReplayCell {
  provider: string;
  version: number;
  total: number;
  ok: number;
  drift: number;
  throw: number;
  status: "green" | "amber" | "red";
  throwReasons: string[];
}

export interface ReplayResult {
  cells: ReplayCell[];
  corpus_size: number;
  ran_at: string;
}

export interface Metrics {
  weekly: { provider: string; week: string; cost_usd: number; events: number }[];
  missing_cost: { provider: string; missing_cost: number }[];
}

export type EventStatus = "Healthy" | "Drift" | "Silent Null" | "Replay Failed";

export interface Inspection {
  status: EventStatus;
  event: Record<string, unknown> & { event_id: string; provider: string; parser_version: number; occurred_at: string };
  raw_payload: unknown;
  raw_payload_id: string;
  received_at: string;
  parser: { provider: string; version: number; expects: string[]; populated: string[]; missing: string[] };
  canonical: Record<string, unknown>;
  null_paths: string[];
  structural_diff: {
    changed: boolean;
    baseline_paths: string[];
    current_paths: string[];
    added: string[];
    removed: string[];
  };
  silent_null: {
    field: string;
    historical_rate: number;
    recent_rate: number;
    threshold: number;
    status: "CRITICAL" | "WARN";
    series: number[];
  } | null;
  replay: {
    status: "passed" | "failed";
    historical: number;
    regressions: number;
    failures: { payload: number; version: number; expected: unknown; actual: unknown; reason: string }[];
  };
  timeline: { stage: string; status: "ok" | "warn" | "fail"; detail: string; at: string | null }[];
  notes: { root_cause: string; impact: string; suggested_fix: string; replay: string };
  related_alerts: Alert[];
}
