"use client";

import type { ReplayCell, ReplayResult } from "@/lib/types";
import { Panel } from "./Panel";

const STATUS = {
  green: { color: "#2DD4BF", glyph: "●", label: "match" },
  amber: { color: "#F5B544", glyph: "◐", label: "reparsed" },
  red: { color: "#FF5C49", glyph: "✕", label: "threw" },
} as const;

export function ReplayMatrix({
  result,
  onRun,
  running,
}: {
  result: ReplayResult | null;
  onRun: () => void;
  running: boolean;
}) {
  const cells = result?.cells ?? [];
  const providers = [...new Set(cells.map((c) => c.provider))];
  const versions = [...new Set(cells.map((c) => c.version))].sort((a, b) => a - b);
  const at = (p: string, v: number): ReplayCell | undefined =>
    cells.find((c) => c.provider === p && c.version === v);

  return (
    <Panel
      eyebrow="Replay"
      title="Parser × version matrix"
      right={
        <button
          onClick={onRun}
          disabled={running}
          className="rounded border border-line2 bg-raised px-3 py-1.5 font-mono text-xs text-text transition-colors hover:border-alive/60 hover:text-alive disabled:opacity-50"
        >
          {running ? "running…" : "↻ run replay"}
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-widest text-faint">
              <th className="pb-2 text-left font-normal">provider</th>
              {versions.map((v) => (
                <th key={v} className="pb-2 text-center font-normal">
                  v{v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p} className="border-t border-line/60">
                <td className="py-2.5 pr-3 text-[14px] text-text">{p}</td>
                {versions.map((v) => {
                  const cell = at(p, v);
                  if (!cell) {
                    return (
                      <td key={v} className="py-2.5 text-center font-mono text-xs text-faint">
                        —
                      </td>
                    );
                  }
                  const s = STATUS[cell.status];
                  return (
                    <td key={v} className="py-2.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span style={{ color: s.color }} className="text-sm leading-none">
                          {s.glyph}
                        </span>
                        <span className="font-mono text-[10px] text-muted tabular-nums">
                          {cell.drift > 0 ? `${cell.drift} reparsed` : `${cell.ok} ok`}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 space-y-1 border-t border-line/60 pt-3 font-mono text-[11px] text-faint">
        <p>green = identical to golden · amber = v2 reparsed the moved cost · red = threw</p>
        {result && (
          <p>
            {result.corpus_size} raw payloads in the corpus — one more than events: a late-cost
            backfill is a 2nd payload under the same dedup_key, not a new row.
          </p>
        )}
      </div>
    </Panel>
  );
}
