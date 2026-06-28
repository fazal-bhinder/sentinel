import type { Metrics } from "@/lib/types";
import { Panel } from "./Panel";

const BAR: Record<string, string> = { openai: "bg-oa", anthropic: "bg-an", cursor: "bg-cu" };

export function WeeklyCost({ metrics }: { metrics: Metrics }) {
  const weeks = [...new Set(metrics.weekly.map((w) => w.week))].sort();
  const providers = [...new Set(metrics.weekly.map((w) => w.provider))].sort();
  const max = Math.max(0.0001, ...metrics.weekly.map((w) => w.cost_usd));
  const total = metrics.weekly.reduce((s, w) => s + w.cost_usd, 0);
  const missing = metrics.missing_cost.reduce((s, m) => s + m.missing_cost, 0);

  const cell = (provider: string, week: string) =>
    metrics.weekly.find((w) => w.provider === provider && w.week === week)?.cost_usd ?? 0;

  const fmtWeek = (w: string) =>
    new Date(w).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <Panel
      eyebrow="Cost"
      title="Weekly spend per provider"
      right={<span className="font-mono text-sm tabular-nums text-text">${total.toFixed(2)}</span>}
    >
      <div className="flex items-end gap-4">
        {weeks.map((week) => (
          <div key={week} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-28 items-end gap-1">
              {providers.map((p) => {
                const v = cell(p, week);
                return (
                  <div
                    key={p}
                    className={`w-3 rounded-t-sm ${BAR[p] ?? "bg-muted"}`}
                    style={{ height: `${Math.max(2, (v / max) * 100)}%`, opacity: 0.85 }}
                    title={`${p} · wk ${fmtWeek(week)} · $${v.toFixed(4)}`}
                  />
                );
              })}
            </div>
            <span className="font-mono text-[10px] text-faint">{fmtWeek(week)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
        <div className="flex gap-3 font-mono text-[11px]">
          {providers.map((p) => (
            <span key={p} className="flex items-center gap-1.5 text-muted">
              <span className={`h-2 w-2 rounded-sm ${BAR[p]}`} /> {p}
            </span>
          ))}
        </div>
        <span
          className={`font-mono text-[11px] ${missing ? "text-warn" : "text-faint"}`}
          title="Events with cost=null — an honest undercount, not hidden."
        >
          {missing} missing cost
        </span>
      </div>
    </Panel>
  );
}
