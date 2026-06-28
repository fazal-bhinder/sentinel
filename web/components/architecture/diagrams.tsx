import { Fragment } from "react";
import { tokenizeJson } from "@/lib/highlight";
import { Trace } from "@/components/Trace";

type Tone = "default" | "accent" | "warn" | "dark";

const TONE: Record<Tone, string> = {
  default: "border-line bg-panel/80",
  accent: "border-alive/40 bg-alive/[0.05]",
  warn: "border-warn/40 bg-warn/[0.05]",
  dark: "border-dark/50 bg-dark/[0.06]",
};

interface Step {
  title: string;
  desc?: string;
  tone?: Tone;
}

function Node({ title, desc, tone = "default", compact = false }: Step & { compact?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 ${compact ? "py-2.5" : "py-3"} ${TONE[tone]}`}>
      <div className={`text-text ${compact ? "text-[13px]" : "text-[15px]"}`}>{title}</div>
      {desc && <div className="mt-0.5 font-mono text-[11px] leading-snug text-muted">{desc}</div>}
    </div>
  );
}

function VArrow() {
  return (
    <div className="flex justify-center py-1.5" aria-hidden>
      <div className="flex flex-col items-center">
        <div className="h-4 w-px bg-line2" />
        <span className="-mt-[7px] text-[11px] text-faint">▾</span>
      </div>
    </div>
  );
}

/** Vertical spine of steps with connectors (Diagram 1). */
export function Spine({ steps }: { steps: Step[] }) {
  return (
    <div className="mx-auto max-w-md">
      {steps.map((s, i) => (
        <Fragment key={s.title}>
          <Node {...s} />
          {i < steps.length - 1 && <VArrow />}
        </Fragment>
      ))}
    </div>
  );
}

/** Connector: vertical (with chevron) on mobile, animated horizontal on desktop. */
function FlowConnector() {
  return (
    <div className="flex items-center justify-center py-1 md:px-0.5 md:py-0" aria-hidden>
      <div className="flex flex-col items-center md:hidden">
        <div className="h-4 w-px bg-line2" />
        <span className="-mt-[7px] text-[11px] text-faint">▾</span>
      </div>
      <div className="hidden items-center md:flex">
        <div className="flow-line h-px w-4" />
        <span className="-ml-[3px] text-[11px] text-faint">▸</span>
      </div>
    </div>
  );
}

/** Animated pipeline — one payload flowing. Wraps to a vertical stack on mobile. */
export function HFlow({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch">
      {steps.map((s, i) => (
        <Fragment key={s.title}>
          <div className="md:min-w-0 md:flex-1">
            <Node {...s} compact />
          </div>
          {i < steps.length - 1 && <FlowConnector />}
        </Fragment>
      ))}
    </div>
  );
}

function MiniCode({ json }: { json: string }) {
  const toks = tokenizeJson(json);
  return (
    <pre className="overflow-auto rounded-md border border-line bg-ink/70 p-3 font-mono text-[11.5px] leading-relaxed">
      <code>
        {toks.map((t, i) => (
          <span key={i} className={t.cls}>
            {t.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

/* ============================ Diagram 1 ============================ */
export function HighLevelArchitecture() {
  return (
    <Spine
      steps={[
        { title: "AI Providers", desc: "OpenAI · Anthropic · Cursor send usage payloads" },
        { title: "Version Detection", desc: "fingerprint the raw shape, pick the right parser version" },
        { title: "Versioned Parser", desc: "pure parse(raw) → CanonicalEvent", tone: "accent" },
        { title: "Canonical Event", desc: "one shape every reader reads", tone: "accent" },
        { title: "Deduplication", desc: "upsert on a deterministic identity-only key" },
        { title: "Drift Detection", desc: "structural + silent-null, runs on every ingest", tone: "warn" },
        { title: "Database", desc: "events · raw_payloads (+golden) · drift_alerts" },
        { title: "API", desc: "Fastify reads — events, alerts, replay, vitals, inspect" },
        { title: "Dashboard", desc: "the read-only Signal Room" },
      ]}
    />
  );
}

/* ============================ Diagram 2 ============================ */
export function IngestionPipeline() {
  return (
    <HFlow
      steps={[
        { title: "Payload Received" },
        { title: "Identify Provider" },
        { title: "Choose Parser Version" },
        { title: "Normalize", tone: "accent" },
        { title: "Generate Dedup Key" },
        { title: "Check Drift", tone: "warn" },
        { title: "Store Event" },
        { title: "Update Dashboard" },
      ]}
    />
  );
}

/* ============================ Diagram 3 ============================ */
export function ReplayHarness() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mx-auto max-w-xs">
        <Node title="Historical Payloads" desc="the full stored corpus + each golden" />
      </div>
      <VArrow />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Node title="Parser v1" desc="the version captured at ingest" />
          <VArrow />
          <Node title="Golden Output" desc="what we recorded then" tone="accent" />
        </div>
        <div>
          <Node title="Parser v2" desc="the candidate / fixed version" />
          <VArrow />
          <Node title="New Output" desc="re-parse today" />
        </div>
      </div>
      <VArrow />
      <div className="mx-auto max-w-xs">
        <Node title="Compare" desc="semantic diff, golden vs new" />
      </div>
      <VArrow />
      <div className="mx-auto max-w-xs">
        <Node title="Regression?" desc="did any payload change for the worse / throw" tone="warn" />
      </div>
      <VArrow />
      <div className="grid grid-cols-2 gap-4">
        <Node title="✓ Pass" desc="identical, or improved" tone="accent" />
        <Node title="✗ Fail" desc="a parser change broke history" tone="dark" />
      </div>

      <div className="mt-5 flex flex-wrap gap-4 border-t border-line/60 pt-4 font-mono text-[11px]">
        <Legend color="bg-alive" label="green — passed (matches golden)" />
        <Legend color="bg-warn" label="yellow — drift fixed (v2 reparsed)" />
        <Legend color="bg-dark" label="red — regression / threw" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} /> {label}
    </span>
  );
}

/* ============================ Diagram 4 ============================ */
export function SilentNullDetection() {
  // Heartbeat: populated, populated, then the schema changes and it flatlines.
  const series = [
    ...Array(14).fill(1),
    ...Array(8).fill(1),
    ...Array(18).fill(0),
  ] as number[];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 eyebrow">Field population over time</div>
      <div className="rounded-lg border border-line bg-ink/50 p-4">
        <Trace series={series} state="dark" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {["100%", "100%", "100%", "100%"].map((p, i) => (
          <span key={i} className="rounded border border-alive/40 bg-alive/10 px-3 py-1.5 font-mono text-[12px] text-alive">
            {p}
          </span>
        ))}
      </div>
      <VArrow />
      <div className="mx-auto max-w-sm">
        <Node title="Provider Schema Changes" desc="cost moves cost → pricing.cost — no error thrown" tone="warn" />
      </div>
      <VArrow />
      <div className="flex justify-center">
        <span className="rounded border border-dark/50 bg-dark/10 px-4 py-1.5 font-mono text-[13px] font-semibold text-dark">
          4%
        </span>
      </div>
      <VArrow />
      <div className="mx-auto max-w-sm">
        <Node title="⚠ Critical Alert" desc="populated >90% historically, ~0% now — cost reads null in silence" tone="dark" />
      </div>
    </div>
  );
}

/* ============================ Diagram 5 ============================ */
export function CanonicalTransformation() {
  const openai = `{
  "model": "gpt-4o",
  "usage": { "prompt_tokens": 412 },
  "cost": { "amount_usd": 0.014 }
}`;
  const claude = `{
  "model": "claude-3-5-sonnet",
  "usage": { "input_tokens": 412 },
  "cost_usd": 0.014
}`;
  const cursor = `{
  "model": "cursor-fast",
  "tokens": { "in": 412 },
  "billing": { "usd": 0.014 }
}`;
  const canonical = `{
  "provider": "…",
  "model": "…",
  "usage": { "input_tokens": 412 },
  "cost": { "amount_usd": 0.014 }
}`;
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Labeled label="OpenAI payload">
          <MiniCode json={openai} />
        </Labeled>
        <Labeled label="Claude payload">
          <MiniCode json={claude} />
        </Labeled>
        <Labeled label="Cursor payload">
          <MiniCode json={cursor} />
        </Labeled>
      </div>
      <VArrow />
      <div className="mx-auto max-w-sm">
        <Node title="Versioned Parsers" desc="one per provider/version — each maps its quirks" tone="accent" />
      </div>
      <VArrow />
      <Labeled label="CanonicalEvent — one unified structure">
        <div className="mx-auto max-w-md">
          <MiniCode json={canonical} />
        </div>
      </Labeled>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      {children}
    </div>
  );
}
