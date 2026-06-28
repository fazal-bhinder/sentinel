import type { Inspection } from "@/lib/types";
import { Trace } from "@/components/Trace";

const STATUS_STYLE: Record<string, string> = {
  Healthy: "border-alive/40 bg-alive/10 text-alive",
  Drift: "border-warn/40 bg-warn/10 text-warn",
  "Silent Null": "border-dark/50 bg-dark/10 text-dark",
  "Replay Failed": "border-dark/50 bg-dark/10 text-dark",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${
        STATUS_STYLE[status] ?? "border-line2 text-muted"
      }`}
    >
      {status}
    </span>
  );
}

export function Section({
  n,
  title,
  subtitle,
  children,
}: {
  n: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel/80">
      <header className="flex items-baseline gap-3 border-b border-line px-5 py-3.5">
        <span className="font-mono text-[11px] text-faint">{n}</span>
        <h2 className="display text-[16px] leading-none text-text">{title}</h2>
        {subtitle && <span className="ml-auto font-mono text-[11px] text-faint">{subtitle}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FieldRow({ name, ok }: { name: string; ok: boolean }) {
  return (
    <li className="flex items-center gap-2 font-mono text-[13px]">
      <span className={ok ? "text-alive" : "text-dark"}>{ok ? "✓" : "✗"}</span>
      <span className={ok ? "text-text" : "text-dark"}>{name}</span>
    </li>
  );
}

export function ParserMatch({ parser }: { parser: Inspection["parser"] }) {
  const isPop = (f: string) => parser.populated.includes(f);
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr_1fr]">
      <div>
        <div className="eyebrow mb-2">Parser</div>
        <div className="rounded-md border border-line2 bg-ink/60 px-3 py-2 font-mono text-sm text-text">
          {parser.provider} v{parser.version}
        </div>
      </div>
      <div>
        <div className="eyebrow mb-2">Expected</div>
        <ul className="space-y-1.5">
          {parser.expects.map((f) => (
            <FieldRow key={f} name={f} ok />
          ))}
        </ul>
      </div>
      <div>
        <div className="eyebrow mb-2">Received</div>
        <ul className="space-y-1.5">
          {parser.expects.map((f) => (
            <FieldRow key={f} name={f} ok={isPop(f)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function StructuralDiff({ diff }: { diff: Inspection["structural_diff"] }) {
  if (!diff.changed) {
    return (
      <p className="font-mono text-[13px] text-alive">
        ● No structural change — this payload matches the provider&apos;s baseline shape.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {diff.removed.map((p) => (
          <span key={p} className="rounded border border-dark/40 bg-dark/10 px-2 py-1 font-mono text-[11px] text-dark">
            − {p}
          </span>
        ))}
        {diff.added.map((p) => (
          <span key={p} className="rounded border border-alive/40 bg-alive/10 px-2 py-1 font-mono text-[11px] text-alive">
            + {p}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DiffColumn label="Expected shape" paths={diff.baseline_paths} mark={diff.removed} markCls="text-dark line-through" />
        <DiffColumn label="Received shape" paths={diff.current_paths} mark={diff.added} markCls="text-alive" />
      </div>
    </div>
  );
}

function DiffColumn({
  label,
  paths,
  mark,
  markCls,
}: {
  label: string;
  paths: string[];
  mark: string[];
  markCls: string;
}) {
  return (
    <div className="rounded-md border border-line bg-ink/50 p-3">
      <div className="eyebrow mb-2">{label}</div>
      <ul className="space-y-1 font-mono text-[12px]">
        {paths.map((p) => (
          <li key={p} className={mark.includes(p) ? markCls : "text-muted"}>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone = "text-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-line bg-ink/50 px-3 py-2.5">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-mono text-lg tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export function SilentNullAnalysis({ sn }: { sn: NonNullable<Inspection["silent_null"]> }) {
  const critical = sn.status === "CRITICAL";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Field" value={sn.field} />
        <Stat label="Historical" value={`${Math.round(sn.historical_rate * 100)}%`} tone="text-alive" />
        <Stat label="Recent" value={`${Math.round(sn.recent_rate * 100)}%`} tone="text-dark" />
        <Stat label="Threshold" value={`${Math.round(sn.threshold * 100)}%`} />
        <Stat label="Status" value={sn.status} tone={critical ? "text-dark" : "text-warn"} />
      </div>
      <div className="rounded-md border border-line bg-ink/50 p-3">
        <div className="eyebrow mb-2">Population — last {sn.series.length} payloads</div>
        <Trace series={sn.series} state={critical ? "dark" : "warn"} />
        <p className="mt-2 font-mono text-[11px] text-dark">
          ▟ field populated reliably, then dropped to ~0% — and the parser never threw.
        </p>
      </div>
    </div>
  );
}

export function ReplayResults({ replay }: { replay: Inspection["replay"] }) {
  const passed = replay.status === "passed";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Replay status" value={passed ? "✓ Passed" : "✗ Failed"} tone={passed ? "text-alive" : "text-dark"} />
        <Stat label="Historical payloads" value={String(replay.historical)} />
        <Stat label="Regressions" value={String(replay.regressions)} tone={replay.regressions ? "text-dark" : "text-alive"} />
      </div>
      {replay.failures.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-dark/40">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="bg-dark/10 text-faint">
                <th className="px-3 py-2 text-left font-normal">payload</th>
                <th className="px-3 py-2 text-left font-normal">parser</th>
                <th className="px-3 py-2 text-left font-normal">expected</th>
                <th className="px-3 py-2 text-left font-normal">actual</th>
                <th className="px-3 py-2 text-left font-normal">reason</th>
              </tr>
            </thead>
            <tbody>
              {replay.failures.map((f, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-2 text-text">#{f.payload}</td>
                  <td className="px-3 py-2 text-muted">v{f.version}</td>
                  <td className="px-3 py-2 text-alive">{String(f.expected)}</td>
                  <td className="px-3 py-2 text-dark">{String(f.actual)}</td>
                  <td className="px-3 py-2 text-muted">{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const DOT: Record<string, { glyph: string; cls: string }> = {
  ok: { glyph: "✓", cls: "border-alive/60 bg-alive/15 text-alive" },
  warn: { glyph: "⚠", cls: "border-warn/60 bg-warn/15 text-warn" },
  fail: { glyph: "✗", cls: "border-dark/60 bg-dark/15 text-dark" },
};

function clock(at: string | null): string {
  if (!at) return "";
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function JourneyTimeline({ timeline }: { timeline: Inspection["timeline"] }) {
  return (
    <ol className="relative">
      {timeline.map((s, i) => {
        const d = DOT[s.status]!;
        const last = i === timeline.length - 1;
        return (
          <li key={s.stage} className="relative flex gap-4 pb-5 last:pb-0">
            {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-line" />}
            <span
              className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full border font-mono text-[13px] ${d.cls}`}
            >
              {d.glyph}
            </span>
            <div className="flex flex-1 items-baseline justify-between gap-3 pt-1">
              <div>
                <div className="text-[14px] text-text">{s.stage}</div>
                <div className="font-mono text-[11px] text-muted">{s.detail}</div>
              </div>
              <span className="font-mono text-[11px] text-faint tabular-nums">{clock(s.at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EngineeringNotes({ notes }: { notes: Inspection["notes"] }) {
  const items: [string, string][] = [
    ["Root cause", notes.root_cause],
    ["Impact", notes.impact],
    ["Suggested fix", notes.suggested_fix],
    ["Replay", notes.replay],
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-md border border-line bg-ink/50 px-4 py-3">
          <dt className="eyebrow">{k}</dt>
          <dd className="mt-1.5 text-[14px] leading-snug text-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
