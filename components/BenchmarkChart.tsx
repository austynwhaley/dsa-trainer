"use client";

import type { BenchmarkPoint } from "@/lib/types";

interface Props {
  points: BenchmarkPoint[];
  logScale: boolean;
  measuredClass: string;
  staticTime?: string;
}

const SIZES = [10, 100, 1000, 10000, 100000];

const CLASSES = [
  { label: "O(1)",       fn: (_n: number) => 1,                      color: "#6b7280", dash: "4 2" },
  { label: "O(log n)",   fn: (n: number) => Math.log2(n),            color: "#a78bfa", dash: "4 2" },
  { label: "O(n)",       fn: (n: number) => n,                       color: "#60a5fa", dash: "4 2" },
  { label: "O(n log n)", fn: (n: number) => n * Math.log2(n),        color: "#34d399", dash: "4 2" },
  { label: "O(n²)",      fn: (n: number) => n * n,                   color: "#f87171", dash: "4 2" },
];

// OLS scale: k = dot(T, f) / dot(f, f) — fit each reference curve to user data
function fitScale(points: BenchmarkPoint[], fn: (n: number) => number): number {
  const valid = points.filter(p => !p.aborted && !p.error && p.medianMs > 0);
  if (!valid.length) return 1;
  const num = valid.reduce((s, p) => s + p.medianMs * fn(p.n), 0);
  const den = valid.reduce((s, p) => s + fn(p.n) ** 2, 0);
  return den === 0 ? 1 : num / den;
}

// Normalized log-space RSS — lower is a better fit
function logRss(points: BenchmarkPoint[], fn: (n: number) => number): number {
  const valid = points.filter(p => !p.aborted && !p.error && p.medianMs > 0 && fn(p.n) > 0);
  if (valid.length < 2) return Infinity;
  const offsets = valid.map(p => Math.log(p.medianMs) - Math.log(fn(p.n)));
  const logK = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  return offsets.reduce((s, o) => s + (o - logK) ** 2, 0) / valid.length;
}

export function detectComplexityClass(points: BenchmarkPoint[]): string {
  let best = CLASSES[2]; // default O(n)
  let bestRss = Infinity;
  for (const cls of CLASSES) {
    const rss = logRss(points, cls.fn);
    if (rss < bestRss) { bestRss = rss; best = cls; }
  }
  return best.label;
}

// ---- SVG layout ----
const W = 520, H = 240;
const ML = 52, MR = 88, MT = 12, MB = 36;
const PW = W - ML - MR, PH = H - MT - MB;

function scaleX(n: number, logMode: boolean): number {
  const ns = SIZES;
  const lo = logMode ? Math.log10(ns[0]) : ns[0];
  const hi = logMode ? Math.log10(ns[ns.length - 1]) : ns[ns.length - 1];
  const v = logMode ? Math.log10(n) : n;
  return ML + ((v - lo) / (hi - lo)) * PW;
}

function scaleY(ms: number, logMode: boolean, yMax: number, yMin: number): number {
  const lo = logMode ? Math.log10(Math.max(yMin, 0.001)) : 0;
  const hi = logMode ? Math.log10(yMax) : yMax;
  const v = logMode ? Math.log10(Math.max(ms, 0.001)) : ms;
  return MT + PH - ((v - lo) / (hi - lo)) * PH;
}

function polyPoints(ns: number[], vals: number[], logMode: boolean, yMax: number, yMin: number): string {
  return ns.map((n, i) => `${scaleX(n, logMode).toFixed(1)},${scaleY(vals[i], logMode, yMax, yMin).toFixed(1)}`).join(" ");
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
  if (ms >= 1) return ms.toFixed(1) + "ms";
  return ms.toFixed(3) + "ms";
}

function fmtN(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000) + "M";
  if (n >= 1000) return (n / 1000) + "K";
  return String(n);
}

export function BenchmarkChart({ points, logScale, measuredClass, staticTime }: Props) {
  const valid = points.filter(p => !p.aborted && !p.error && p.medianMs > 0);
  if (valid.length < 2) return (
    <div className="flex items-center justify-center h-40 text-neutral-500 text-xs">
      Not enough data points to render chart.
    </div>
  );

  const maxMs = Math.max(...valid.map(p => p.medianMs)) * 1.2;
  const minMs = Math.min(...valid.map(p => p.medianMs)) * 0.8;

  const measuredCls = CLASSES.find(c => c.label === measuredClass);

  // Y ticks
  const yTicks = (() => {
    if (logScale) {
      const ticks: number[] = [];
      let v = 0.001;
      while (v <= maxMs * 2) { if (v >= minMs * 0.5) ticks.push(v); v *= 10; }
      return ticks.slice(0, 6);
    }
    const step = maxMs / 4;
    return [0, step, step * 2, step * 3, step * 4].map(v => parseFloat(v.toFixed(3)));
  })();

  // Sub-millisecond warning
  const allFast = valid.every(p => p.medianMs < 0.5);

  const agree = staticTime && staticTime === measuredClass;
  const disagree = staticTime && staticTime !== "O(?)" && measuredClass !== "O(?)" && staticTime !== measuredClass;

  return (
    <div className="flex flex-col gap-2">
      {/* Complexity summary */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-neutral-400">Measured:</span>
        <span className="font-mono font-medium text-white">{measuredClass}</span>
        {staticTime && (
          <>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-400">AI estimate:</span>
            <span className={`font-mono font-medium ${agree ? "text-emerald-400" : disagree ? "text-amber-400" : "text-neutral-300"}`}>
              {staticTime}
            </span>
            {agree && <span className="text-emerald-600 text-xs">agree</span>}
            {disagree && <span className="text-amber-600 text-xs">disagree — interesting</span>}
          </>
        )}
      </div>

      {allFast && (
        <p className="text-xs text-neutral-500">
          Runtimes are sub-millisecond — measurements may not be reliable at these sizes.
        </p>
      )}

      {/* SVG chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
        {/* Grid */}
        {yTicks.map((t, i) => {
          const y = scaleY(t, logScale, maxMs, minMs).toFixed(1);
          return (
            <g key={i}>
              <line x1={ML} x2={ML + PW} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={ML - 4} y={parseFloat(y) + 3.5} textAnchor="end" fill="#6b7280" fontSize="9">
                {t === 0 ? "0" : fmtMs(t)}
              </text>
            </g>
          );
        })}

        {/* X ticks */}
        {SIZES.map((n) => {
          const x = scaleX(n, logScale).toFixed(1);
          return (
            <g key={n}>
              <line x1={x} x2={x} y1={MT} y2={MT + PH} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <text x={parseFloat(x)} y={MT + PH + 14} textAnchor="middle" fill="#6b7280" fontSize="9">{fmtN(n)}</text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={ML} x2={ML} y1={MT} y2={MT + PH} stroke="#374151" strokeWidth="1" />
        <line x1={ML} x2={ML + PW} y1={MT + PH} y2={MT + PH} stroke="#374151" strokeWidth="1" />

        {/* Reference curves */}
        {CLASSES.map((cls) => {
          const scale = fitScale(valid, cls.fn);
          const vals = SIZES.map(n => cls.fn(n) * scale);
          const pts = polyPoints(SIZES, vals, logScale, maxMs, minMs);
          const isBest = cls.label === measuredClass;
          return (
            <g key={cls.label}>
              <polyline
                points={pts}
                fill="none"
                stroke={cls.color}
                strokeWidth={isBest ? 1.5 : 0.8}
                strokeDasharray={isBest ? undefined : cls.dash}
                opacity={isBest ? 0.6 : 0.25}
              />
              {/* Label on right edge */}
              <text
                x={ML + PW + 4}
                y={parseFloat(polyPoints(SIZES.slice(-1), vals.slice(-1), logScale, maxMs, minMs).split(",")[1]) + 3}
                fill={cls.color}
                fontSize="9"
                opacity={isBest ? 0.9 : 0.4}
              >
                {cls.label}
              </text>
            </g>
          );
        })}

        {/* User's measured line */}
        <polyline
          points={valid.map(p => `${scaleX(p.n, logScale).toFixed(1)},${scaleY(p.medianMs, logScale, maxMs, minMs).toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((p, i) => {
          const x = scaleX(p.n, logScale);
          if (p.aborted) {
            return (
              <g key={i}>
                <line x1={x - 5} x2={x + 5} y1={MT + PH - 10} y2={MT + PH - 10} stroke="#f59e0b" strokeWidth="1.5" />
                <line x1={x} x2={x} y1={MT + PH - 15} y2={MT + PH - 5} stroke="#f59e0b" strokeWidth="1.5" />
                <text x={x} y={MT + PH - 18} textAnchor="middle" fill="#f59e0b" fontSize="8">timeout</text>
              </g>
            );
          }
          if (p.error) {
            return (
              <text key={i} x={x} y={MT + PH - 10} textAnchor="middle" fill="#ef4444" fontSize="9">err</text>
            );
          }
          if (p.medianMs <= 0) return null;
          const y = scaleY(p.medianMs, logScale, maxMs, minMs);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#818cf8" />
              <title>{fmtN(p.n)}: {fmtMs(p.medianMs)}</title>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={ML + PW / 2} y={H - 2} textAnchor="middle" fill="#4b5563" fontSize="9">Input size (n)</text>
        <text x={10} y={MT + PH / 2} textAnchor="middle" fill="#4b5563" fontSize="9"
          transform={`rotate(-90, 10, ${MT + PH / 2})`}>Time (ms)</text>

        {measuredCls && (
          <text x={ML + PW - 2} y={MT + 10} textAnchor="end" fill={measuredCls.color} fontSize="9" opacity="0.7">
            best fit: {measuredClass}
          </text>
        )}
      </svg>
    </div>
  );
}
