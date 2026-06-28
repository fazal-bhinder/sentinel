import Link from "next/link";
import type { Alert } from "@/lib/types";
import { Panel } from "./Panel";

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function DriftAlerts({ alerts }: { alerts: Alert[] }) {
  const criticals = alerts.filter((a) => a.severity === "critical").length;

  return (
    <Panel
      eyebrow="Drift"
      title="Alerts"
      right={
        <span
          className={`font-mono text-xs ${criticals ? "text-dark" : "text-muted"}`}
        >
          {criticals ? `${criticals} critical` : `${alerts.length} total`}
        </span>
      }
    >
      {alerts.length === 0 ? (
        <p className="py-6 text-center font-mono text-xs text-faint">
          No drift detected. Every expected field is reporting.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {alerts.map((a) => {
            const critical = a.severity === "critical";
            return (
              <li key={a.id}>
                <Link
                  href={`/inspect?alertId=${a.id}`}
                  className={`block rounded-md border px-3.5 py-3 transition-colors hover:border-text/40 ${
                    critical
                      ? "border-dark/40 bg-dark/[0.06]"
                      : "border-warn/30 bg-warn/[0.05]"
                  }`}
                  style={critical ? { boxShadow: "0 0 0 1px rgba(255,92,73,0.12)" } : undefined}
                >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                      critical ? "text-dark" : "text-warn"
                    }`}
                  >
                    {a.severity} · {a.type.replace("_", " ")}
                  </span>
                  <span className="font-mono text-[10px] text-faint">{time(a.created_at)}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-text">{a.message}</p>
                <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-muted">
                  <span>{a.provider}</span>
                  {a.field && <span className="text-faint">· {a.field}</span>}
                  <span className="ml-auto text-faint">inspect →</span>
                </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
