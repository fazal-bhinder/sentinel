import type { CanonicalEvent } from "./canonical";
import { VOLATILE_FIELDS } from "./canonical";
import { stableStringify } from "./dedup";
import type { Registry } from "./registry";

/**
 * Contract 5 — replay harness. Re-run every parser version against the full
 * corpus of stored raw payloads and diff each result against the "golden"
 * canonical captured at ingest time.
 */
export type ReplayStatus = "ok" | "throw" | "drift";

export interface CorpusItem {
  provider: string;
  raw: unknown;
  golden: CanonicalEvent; // canonical captured when this payload was first ingested
}

export interface CellResult {
  provider: string;
  version: number;
  total: number;
  ok: number;
  drift: number;
  throw: number;
  /** green = identical to golden, amber = parses but differs, red = threw. */
  status: "green" | "amber" | "red";
  throwReasons: string[];
}

/** Project to the semantic fields a parser is responsible for (drop bookkeeping). */
export function semantic(ev: CanonicalEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ev)) {
    if ((VOLATILE_FIELDS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }
  return out;
}

export function diffStatus(golden: CanonicalEvent, candidate: CanonicalEvent): "ok" | "drift" {
  return stableStringify(semantic(golden)) === stableStringify(semantic(candidate)) ? "ok" : "drift";
}

/** Run the full provider × version matrix against the corpus. */
export function runReplay(registry: Registry, corpus: CorpusItem[]): CellResult[] {
  const cells: CellResult[] = [];
  for (const provider of registry.providers()) {
    const items = corpus.filter((c) => c.provider === provider);
    for (const version of registry.versions(provider)) {
      const parser = registry.get(provider, version)!;
      const cell: CellResult = {
        provider,
        version,
        total: items.length,
        ok: 0,
        drift: 0,
        throw: 0,
        status: "green",
        throwReasons: [],
      };
      for (const item of items) {
        try {
          const status = diffStatus(item.golden, parser.parse(item.raw));
          cell[status]++;
        } catch (e) {
          cell.throw++;
          const msg = (e as Error).message;
          if (!cell.throwReasons.includes(msg)) cell.throwReasons.push(msg);
        }
      }
      cell.status = cell.throw > 0 ? "red" : cell.drift > 0 ? "amber" : "green";
      cells.push(cell);
    }
  }
  return cells;
}
