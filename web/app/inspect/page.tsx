"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Inspection } from "@/lib/types";
import { JsonBlock } from "@/components/inspect/JsonBlock";
import {
  EngineeringNotes,
  JourneyTimeline,
  ParserMatch,
  ReplayResults,
  Section,
  SilentNullAnalysis,
  StatusBadge,
  StructuralDiff,
} from "@/components/inspect/sections";

function Inspect() {
  const params = useSearchParams();
  const [data, setData] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = {
      eventId: params.get("eventId") ?? undefined,
      alertId: params.get("alertId") ? Number(params.get("alertId")) : undefined,
      provider: params.get("provider") ?? undefined,
    };
    api
      .inspect(q)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [params]);

  if (error) {
    return (
      <Shell>
        <div className="rounded-md border border-dark/40 bg-dark/[0.06] px-4 py-3 font-mono text-xs text-dark">
          Couldn&apos;t load this event ({error}). Make sure the API is running and the DB is seeded.
        </div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <div className="animate-pulse font-mono text-sm text-faint">reconstructing event lifecycle…</div>
      </Shell>
    );
  }

  const ev = data.event;
  const ts = new Date(ev.occurred_at).toLocaleString();

  return (
    <Shell>
      {/* Header */}
      <div className="mb-6 rounded-lg border border-line bg-panel/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Event inspection</div>
            <h1 className="display mt-1 text-2xl text-text">
              {ev.provider} · v{ev.parser_version}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-muted">
              <span>
                <span className="text-faint">event_id</span> {String(ev.event_id).slice(0, 18)}…
              </span>
              <span>
                <span className="text-faint">occurred</span> {ts}
              </span>
            </div>
          </div>
          <StatusBadge status={data.status} />
        </div>
      </div>

      <div className="space-y-6">
        <Section n="01" title="Raw provider payload" subtitle="exactly as received">
          <JsonBlock value={data.raw_payload} />
        </Section>

        <Section n="02" title="Selected parser" subtitle={`${data.parser.missing.length} field(s) missing`}>
          <ParserMatch parser={data.parser} />
        </Section>

        <Section
          n="03"
          title="Canonical event"
          subtitle={data.null_paths.length ? "null fields highlighted" : "fully populated"}
        >
          <JsonBlock value={data.canonical} />
        </Section>

        <Section n="04" title="Structural diff" subtitle="expected vs received shape">
          <StructuralDiff diff={data.structural_diff} />
        </Section>

        <Section n="05" title="Silent null analysis" subtitle="why the alert fired">
          {data.silent_null ? (
            <SilentNullAnalysis sn={data.silent_null} />
          ) : (
            <p className="font-mono text-[13px] text-alive">
              ● No silent-null condition — the monitored fields are populating within threshold.
            </p>
          )}
        </Section>

        <Section n="06" title="Replay results" subtitle={`${data.replay.historical} historical payloads`}>
          <ReplayResults replay={data.replay} />
        </Section>

        <Section n="07" title="Event journey" subtitle="how it moved through the system">
          <JourneyTimeline timeline={data.timeline} />
        </Section>

        <Section n="08" title="Engineering notes" subtitle="incident summary">
          <EngineeringNotes notes={data.notes} />
        </Section>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <nav className="mb-7 flex items-center gap-4 border-b border-line pb-5">
        <Link href="/" className="nameplate text-xl text-text transition-colors hover:text-alive">
          OXIMY
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">/ inspect</span>
        <Link
          href="/"
          className="ml-auto rounded border border-line2 bg-raised px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-text"
        >
          ← back to signal room
        </Link>
      </nav>
      {children}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Shell>{null}</Shell>}>
      <Inspect />
    </Suspense>
  );
}
