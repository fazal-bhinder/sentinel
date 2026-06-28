import type {
  Alert,
  Inspection,
  Metrics,
  ProviderHealth,
  ProviderVitals,
  ReplayResult,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function get<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const res = await fetch(`${API}${path}`, { method, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  providers: () => get<ProviderHealth[]>("/providers"),
  alerts: () => get<Alert[]>("/alerts"),
  vitals: () => get<ProviderVitals[]>("/vitals"),
  metrics: () => get<Metrics>("/metrics"),
  replay: () => get<ReplayResult>("/replay"),
  runReplay: () => get<ReplayResult>("/replay", "POST"),
  inspect: (q: { eventId?: string; alertId?: number; provider?: string }) => {
    const p = new URLSearchParams();
    if (q.eventId) p.set("eventId", q.eventId);
    if (q.alertId != null) p.set("alertId", String(q.alertId));
    if (q.provider) p.set("provider", q.provider);
    return get<Inspection>(`/inspect?${p.toString()}`);
  },
};
