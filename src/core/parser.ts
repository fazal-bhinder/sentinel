import type { CanonicalEvent, Provider } from "./canonical";

/**
 * Contract 3 — a versioned parser. `parse` is pure: same raw in, same canonical
 * out, no I/O. `expects` declares which canonical fields this version should
 * populate, so the drift detector knows what "should be present" means.
 */
export interface Parser {
  provider: Provider;
  version: number;
  expects: string[]; // e.g. ["cost.amount_usd", "usage.input_tokens"]
  parse(raw: unknown): CanonicalEvent;
}
