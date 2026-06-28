"use client";

import { useState } from "react";
import type { ProviderVitals } from "@/lib/types";
import { Trace } from "./Trace";

const STATE_LABEL = { alive: "alive", warn: "fading", dark: "dark" } as const;
const STATE_COLOR = {
  alive: "text-alive",
  warn: "text-warn",
  dark: "text-dark",
} as const;

export function FieldVitals({ vitals }: { vitals: ProviderVitals[] }) {
  const order = ["openai", "anthropic", "cursor"];
  const sorted = [...vitals].sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
  // Default to the provider with something gone dark — that's the story.
  const initial =
    sorted.find((p) => p.fields.some((f) => f.state === "dark"))?.provider ??
    sorted[0]?.provider ??
    "openai";
  const [active, setActive] = useState(initial);
  const current = sorted.find((p) => p.provider === active) ?? sorted[0];
  const anyDark = current?.fields.some((f) => f.state === "dark");

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-panel">
      <div className="graticule pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <div className="eyebrow">Field vitals · last ~40 payloads</div>
            <h1 className="nameplate mt-1 text-2xl text-text">
              IS EVERY FIELD STILL <span className="text-alive">BREATHING?</span>
            </h1>
          </div>
          <div className="flex gap-1 rounded-md border border-line bg-ink/60 p-1">
            {sorted.map((p) => {
              const dark = p.fields.some((f) => f.state === "dark");
              return (
                <button
                  key={p.provider}
                  onClick={() => setActive(p.provider)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                    active === p.provider
                      ? "bg-raised text-text"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {p.provider}
                  {dark && <span className="h-1.5 w-1.5 rounded-full bg-dark" />}
                </button>
              );
            })}
          </div>
        </header>

        <div className="divide-y divide-line/70">
          {current?.fields.map((f) => (
            <div key={f.field} className="grid grid-cols-[180px_1fr_84px] items-center gap-4 px-6 py-3">
              <div className="font-mono text-[13px] text-muted">{f.field}</div>
              <Trace series={f.series} state={f.state} />
              <div className="text-right">
                <div className={`font-mono text-sm tabular-nums ${STATE_COLOR[f.state]}`}>
                  {Math.round(f.rate * 100)}%
                </div>
                <div className={`font-mono text-[10px] uppercase tracking-widest ${STATE_COLOR[f.state]}`}>
                  {STATE_LABEL[f.state]}
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="border-t border-line px-6 py-3">
          {anyDark ? (
            <p className="font-mono text-xs text-dark">
              ▟ a field flatlined to ~0% — and the parser never threw. cost read{" "}
              <span className="text-text">null</span> in silence.
            </p>
          ) : (
            <p className="font-mono text-xs text-alive">● all expected fields populating normally.</p>
          )}
        </footer>
      </div>
    </section>
  );
}
