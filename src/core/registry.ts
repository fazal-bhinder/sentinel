import type { Parser } from "./parser";
import { anthropicV1, cursorV1, openaiV1, openaiV2 } from "./parsers";

/** A version registry: parsers keyed by `provider:version`. */
export class Registry {
  private map = new Map<string, Parser>();

  register(p: Parser): this {
    this.map.set(`${p.provider}:${p.version}`, p);
    return this;
  }

  get(provider: string, version: number): Parser | undefined {
    return this.map.get(`${provider}:${version}`);
  }

  has(provider: string, version: number): boolean {
    return this.map.has(`${provider}:${version}`);
  }

  versions(provider: string): number[] {
    return [...this.map.values()]
      .filter((p) => p.provider === provider)
      .map((p) => p.version)
      .sort((a, b) => a - b);
  }

  latest(provider: string): Parser | undefined {
    const vs = this.versions(provider);
    return vs.length ? this.get(provider, vs[vs.length - 1]!) : undefined;
  }

  providers(): string[] {
    return [...new Set([...this.map.values()].map((p) => p.provider))];
  }

  all(): Parser[] {
    return [...this.map.values()];
  }
}

/**
 * Default registry. openai v2 is opt-in so we can model "before / after the v2
 * rollout" — used both by the seed demo and by the replay regression test.
 */
export function buildRegistry(opts: { openaiV2?: boolean } = {}): Registry {
  const r = new Registry().register(openaiV1).register(anthropicV1).register(cursorV1);
  if (opts.openaiV2) r.register(openaiV2);
  return r;
}
