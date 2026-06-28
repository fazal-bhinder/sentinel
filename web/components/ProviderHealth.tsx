import Link from "next/link";
import type { ProviderHealth as PH } from "@/lib/types";
import { Panel } from "./Panel";

const DOT: Record<string, string> = { openai: "bg-oa", anthropic: "bg-an", cursor: "bg-cu" };

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function ProviderHealth({ providers }: { providers: PH[] }) {
  return (
    <Panel eyebrow="Stream" title="Provider health">
      <ul className="space-y-1">
        {providers.map((p) => (
          <li key={p.provider}>
            <Link
              href={`/inspect?provider=${p.provider}`}
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-raised"
            >
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${DOT[p.provider] ?? "bg-muted"}`} />
              <span className="text-[15px] text-text">{p.provider}</span>
              <span className="rounded border border-line2 bg-ink px-1.5 py-0.5 font-mono text-[10px] text-muted">
                v{p.live_version ?? p.parser_version}
                {(p.registered_versions?.length ?? 0) > 1
                  ? ` · ${p.registered_versions.length} live`
                  : ""}
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="tabular-nums text-text">{p.events.toLocaleString()}</span>
              <span className="text-faint">events</span>
              <span className="w-16 text-right text-muted">{ago(p.last_ingest)}</span>
            </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
