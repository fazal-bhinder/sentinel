import { fingerprint, fingerprintPaths } from "./fingerprint";

/**
 * Contract 4 — drift detection, two modes. Both are pure: the DB layer gathers
 * the rolling stats and calls these. Mode 2 (silent-null) is the differentiator.
 */
export type DriftType = "STRUCTURAL" | "SILENT_NULL";
export type Severity = "warn" | "critical";

export interface DriftAlert {
  provider: string;
  type: DriftType;
  severity: Severity;
  field: string | null;
  message: string;
  details: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Mode 1 — structural                                                 */
/* ------------------------------------------------------------------ */

export interface StructuralInput {
  provider: string;
  current: unknown;
  /** Fingerprints already seen for this provider (excluding `current`). */
  knownFingerprints: Set<string>;
  /** Union of every leaf path seen historically for this provider. */
  knownPaths: Set<string>;
}

/**
 * Emit a `warn` if the raw payload's shape has never been seen for this
 * provider, listing the paths that were added / removed versus history.
 * Returns null on the very first payload (nothing to compare against).
 */
export function structuralDrift(input: StructuralInput): DriftAlert | null {
  if (input.knownFingerprints.size === 0) return null;
  const fp = fingerprint(input.current);
  if (input.knownFingerprints.has(fp)) return null;

  const curPaths = fingerprintPaths(input.current);
  const added = [...curPaths].filter((p) => !input.knownPaths.has(p)).sort();
  const removed = [...input.knownPaths].filter((p) => !curPaths.has(p)).sort();

  return {
    provider: input.provider,
    type: "STRUCTURAL",
    severity: "warn",
    field: null,
    message: `New raw shape for ${input.provider}: ${added.length} path(s) added, ${removed.length} removed.`,
    details: { added, removed, fingerprint: fp },
  };
}

/* ------------------------------------------------------------------ */
/* Mode 2 — silent-null (the point)                                    */
/* ------------------------------------------------------------------ */

export interface FieldStat {
  field: string;
  /** Baseline window (history excluding the recent window). */
  overallSeen: number;
  overallPopulated: number;
  /** Recent window (~last 20 payloads). */
  recentSeen: number;
  recentPopulated: number;
}

export interface SilentNullConfig {
  minOverall?: number; // need enough baseline history (default 30)
  minRecent?: number; // need enough recent payloads (default 10)
  highRate?: number; // "was reliably populated" threshold (default 0.9)
  lowRate?: number; // "now effectively gone" threshold (default 0.1)
}

/**
 * Catch a field that was populated >90% historically and has suddenly dropped
 * to near-0% over the recent window — *without the parser throwing*. That's the
 * "a field moved deeper, parser didn't crash, cost silently reads null" case.
 * Severity is critical when the field is cost.amount_usd.
 */
export function silentNullDrift(
  provider: string,
  stats: FieldStat[],
  cfg: SilentNullConfig = {},
): DriftAlert[] {
  const minOverall = cfg.minOverall ?? 30;
  const minRecent = cfg.minRecent ?? 10;
  const highRate = cfg.highRate ?? 0.9;
  const lowRate = cfg.lowRate ?? 0.1;

  const alerts: DriftAlert[] = [];
  for (const s of stats) {
    if (s.overallSeen < minOverall || s.recentSeen < minRecent) continue;
    const overallRate = s.overallPopulated / s.overallSeen;
    const recentRate = s.recentPopulated / s.recentSeen;
    if (overallRate < highRate || recentRate > lowRate) continue;

    const critical = s.field === "cost.amount_usd";
    alerts.push({
      provider,
      type: "SILENT_NULL",
      severity: critical ? "critical" : "warn",
      field: s.field,
      message:
        `${s.field} went dark: ${(overallRate * 100).toFixed(0)}% populated historically, ` +
        `${(recentRate * 100).toFixed(0)}% across the last ${s.recentSeen}. Parser never threw.`,
      details: { overallRate, recentRate, overallSeen: s.overallSeen, recentSeen: s.recentSeen },
    });
  }
  return alerts;
}
