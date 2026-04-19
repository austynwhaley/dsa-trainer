"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

const DEBOUNCE_MS = 3000;
const MIN_CODE_LEN = 15;

export function ComplexityBadge() {
  const { code, language, complexity, complexityLoading, setComplexity, setComplexityLoading } = useStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<{ time: boolean; space: boolean }>({ time: false, space: false });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!code || code.trim().length < MIN_CODE_LEN) return;

    timerRef.current = setTimeout(async () => {
      setComplexityLoading(true);
      try {
        const res = await fetch("/api/complexity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, language }),
        });
        const data = await res.json();
        setComplexity(data);
      } catch {
        // silently ignore
      } finally {
        setComplexityLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [code, language]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!complexity && !complexityLoading) return null;

  const dot = complexityLoading ? (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse" />
  ) : null;

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      {dot}
      {complexity && (
        <>
          <div className="relative">
            <button
              onMouseEnter={() => setTooltip(t => ({ ...t, time: true }))}
              onMouseLeave={() => setTooltip(t => ({ ...t, time: false }))}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-default"
            >
              <span className="text-neutral-500">T:</span>
              <span className="font-mono text-indigo-300">{complexity.time}</span>
            </button>
            {tooltip.time && complexity.timeReason && (
              <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 whitespace-nowrap text-xs z-50 pointer-events-none">
                {complexity.timeReason}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onMouseEnter={() => setTooltip(t => ({ ...t, space: true }))}
              onMouseLeave={() => setTooltip(t => ({ ...t, space: false }))}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-default"
            >
              <span className="text-neutral-500">S:</span>
              <span className="font-mono text-emerald-300">{complexity.space}</span>
            </button>
            {tooltip.space && complexity.spaceReason && (
              <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 whitespace-nowrap text-xs z-50 pointer-events-none">
                {complexity.spaceReason}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
