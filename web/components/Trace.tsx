import type { FieldVital } from "@/lib/types";

const STROKE: Record<FieldVital["state"], string> = {
  alive: "#2DD4BF",
  warn: "#F5B544",
  dark: "#FF5C49",
};

/**
 * A vital-sign trace. Each populated sample draws a heartbeat spike; each null
 * sample flatlines on the baseline. So an alive field beats steadily and a field
 * that's gone dark visibly flatlines — the silent-null moment, made literal.
 */
export function Trace({ series, state }: { series: number[]; state: FieldVital["state"] }) {
  const U = 10; // px per sample
  const W = Math.max(series.length, 1) * U;
  const H = 48;
  const base = H * 0.64;
  const peak = H * 0.16;
  const dip = H * 0.78;

  let d = `M 0 ${base}`;
  series.forEach((v, i) => {
    const x = i * U;
    const xc = x + U / 2;
    if (v) {
      d += ` L ${x + U * 0.18} ${base} L ${xc - U * 0.12} ${dip} L ${xc} ${peak} L ${xc + U * 0.12} ${dip} L ${x + U * 0.82} ${base} L ${x + U} ${base}`;
    } else {
      d += ` L ${x + U} ${base}`;
    }
  });

  const color = STROKE[state];
  const lastX = series.length * U;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-12 w-full"
      role="img"
      aria-label={`signal ${state}`}
    >
      <line x1="0" y1={base} x2={W} y2={base} stroke="#1E2B43" strokeWidth="1" />
      <path
        className="trace-draw"
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
      />
      {state === "dark" && (
        <circle className="pulse-dot" cx={lastX - 2} cy={base} r="3.5" fill={color} />
      )}
    </svg>
  );
}
