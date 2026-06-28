/**
 * Structural fingerprint of a raw payload: the SET OF KEY PATHS present. Array
 * indices collapse to `[]`. We deliberately key on paths, not leaf value types,
 * for two reasons:
 *
 *   - cost is "born null, backfilled" — a nullable field going null must NOT
 *     read as a shape change. The path `cost.amount_usd` is present either way.
 *   - the structural drift we model is a *moved* field: cost.amount_usd vanishes
 *     and pricing.cost.amount_usd appears. That's a path-set change, which this
 *     catches cleanly while ignoring value-level nulls (left to silent-null).
 */
function leafPaths(value: unknown, prefix: string, out: string[]): void {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        out.push(`${prefix}[]`);
        return;
      }
      for (const v of value) leafPaths(v, `${prefix}[]`, out);
      return;
    }
    const keys = Object.keys(value as Record<string, unknown>).sort();
    if (keys.length === 0) {
      out.push(prefix);
      return;
    }
    for (const k of keys) {
      leafPaths((value as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k, out);
    }
    return;
  }
  out.push(prefix); // leaf (primitive or null): record the path, ignore the type
}

export function fingerprintPaths(raw: unknown): Set<string> {
  const out: string[] = [];
  leafPaths(raw, "", out);
  return new Set(out);
}

export function fingerprint(raw: unknown): string {
  return [...fingerprintPaths(raw)].sort().join("\n");
}
