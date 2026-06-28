"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Alert, Metrics, ProviderHealth, ProviderVitals, ReplayResult } from "@/lib/types";
import { DriftAlerts } from "@/components/DriftAlerts";
import { FieldVitals } from "@/components/FieldVitals";
import { ProviderHealth as ProviderHealthPanel } from "@/components/ProviderHealth";
import { ReplayMatrix } from "@/components/ReplayMatrix";
import { WeeklyCost } from "@/components/WeeklyCost";

export default function Page() {
  const [vitals, setVitals] = useState<ProviderVitals[]>([]);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, p, a, m, r] = await Promise.all([
        api.vitals(),
        api.providers(),
        api.alerts(),
        api.metrics(),
        api.replay(),
      ]);
      setVitals(v);
      setProviders(p);
      setAlerts(a);
      setMetrics(m);
      setReplay(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runReplay = useCallback(async () => {
    setRunning(true);
    try {
      setReplay(await api.runReplay());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, []);

  const totalEvents = providers.reduce((s, p) => s + p.events, 0);
  const missing = providers.reduce((s, p) => s + p.missing_cost, 0);
  const integrity = totalEvents ? (1 - missing / totalEvents) * 100 : 100;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <StatusBar integrity={integrity} onRefresh={load} />

      {error && (
        <div className="mb-6 rounded-md border border-dark/40 bg-dark/[0.06] px-4 py-3 font-mono text-xs text-dark">
          Can&apos;t reach the API ({error}). Start it with{" "}
          <span className="text-text">npm run dev</span>, then run{" "}
          <span className="text-text">npm run seed</span>.
        </div>
      )}

      {loaded && !error && (
        <div className="space-y-6">
          <FieldVitals vitals={vitals} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ProviderHealthPanel providers={providers} />
            <DriftAlerts alerts={alerts} />
            <ReplayMatrix result={replay} onRun={runReplay} running={running} />
            {metrics && <WeeklyCost metrics={metrics} />}
          </div>
        </div>
      )}

      <footer className="mt-10 border-t border-line/60 pt-5 font-mono text-[11px] leading-relaxed text-faint">
        Oximy · canonical-event core + parser-drift/replay machinery. Out of scope on purpose: TLS
        interception, identity resolution, billion-row optimization — undemoable without real
        endpoints. Payloads are static fixtures.
      </footer>
    </main>
  );
}

function StatusBar({ integrity, onRefresh }: { integrity: number; onRefresh: () => void }) {
  const healthy = integrity >= 99;
  return (
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
      <div className="flex items-center gap-4">
        <span className="nameplate text-2xl text-text">OXIMY</span>
        <nav className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] sm:flex">
          <span className="text-alive">Signal Room</span>
          <Link href="/architecture" className="text-faint transition-colors hover:text-text">
            Architecture
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-5 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-faint">cost integrity</span>
          <span className={`tabular-nums ${healthy ? "text-alive" : "text-warn"}`}>
            {integrity.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="live-dot h-2 w-2 rounded-full bg-alive" />
          <span className="text-muted">live</span>
        </div>
        <button
          onClick={onRefresh}
          className="rounded border border-line2 bg-raised px-2.5 py-1 text-muted transition-colors hover:text-text"
        >
          ↻
        </button>
      </div>
    </header>
  );
}
