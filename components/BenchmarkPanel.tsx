"use client";

import { useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import { BenchmarkChart, detectComplexityClass } from "./BenchmarkChart";
import { useState } from "react";
import type { BenchmarkPoint } from "@/lib/types";

const SIZES = [10, 100, 1000, 10000, 100000];

interface Props {
  onClose: () => void;
}

export function BenchmarkPanel({ onClose }: Props) {
  const { code, language, problem, benchmarkResult, benchmarkRunning,
    setBenchmarkResult, setBenchmarkRunning, complexity } = useStore();
  const [logScale, setLogScale] = useState(true);
  const workerRef = useRef<Worker | null>(null);

  const canBenchmark = language === "javascript" || language === "typescript";

  const runBenchmark = useCallback(async () => {
    if (benchmarkRunning || !problem.generateInput) return;
    setBenchmarkRunning(true);
    setBenchmarkResult(null);

    let jsCode = code;

    if (language === "typescript") {
      try {
        const res = await fetch("/api/transpile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.error) {
          setBenchmarkRunning(false);
          setBenchmarkResult({ points: [], measuredClass: "O(?)" });
          return;
        }
        jsCode = data.js;
      } catch {
        setBenchmarkRunning(false);
        setBenchmarkResult({ points: [], measuredClass: "O(?)" });
        return;
      }
    }

    // Generate inputs for each size in the main thread (generateInput may not be serializable)
    const items = SIZES.map(n => ({
      n,
      args: problem.generateInput!(n),
    }));

    const isLinkedList = problem.entryPoint === "reverseList";
    const isLRU = problem.entryPoint === "LRUCache";

    if (workerRef.current) workerRef.current.terminate();
    const worker = new Worker("/workers/js-runner.js");
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === "benchmarkResult") {
        const points: BenchmarkPoint[] = e.data.points;
        const measuredClass = detectComplexityClass(points);
        setBenchmarkResult({ points, measuredClass });
        setBenchmarkRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = () => {
      setBenchmarkResult({ points: [], measuredClass: "O(?)" });
      setBenchmarkRunning(false);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({
      type: "benchmark",
      code: jsCode,
      entryPoint: problem.entryPoint,
      isLinkedList,
      isLRU,
      items,
      timeoutMs: 2000,
    });
  }, [code, language, problem, benchmarkRunning, setBenchmarkResult, setBenchmarkRunning]);

  const staticTime = complexity?.time;

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-t border-neutral-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0">
        <span className="text-xs font-medium text-neutral-300">Benchmark</span>
        <div className="flex-1" />
        <button
          onClick={() => setLogScale(v => !v)}
          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
            logScale
              ? "border-indigo-600 text-indigo-400 bg-indigo-950/40"
              : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          log scale
        </button>
        {canBenchmark && (
          <button
            onClick={runBenchmark}
            disabled={benchmarkRunning || !problem.generateInput}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 rounded text-xs font-medium text-white"
          >
            {benchmarkRunning ? (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
                Running…
              </>
            ) : (
              "Run"
            )}
          </button>
        )}
        <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-xs px-1">✕</button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {!canBenchmark && (
          <p className="text-xs text-neutral-500 text-center py-8">
            Benchmarking is available for JavaScript and TypeScript only.
          </p>
        )}

        {canBenchmark && !benchmarkResult && !benchmarkRunning && (
          <p className="text-xs text-neutral-500 text-center py-8">
            Click Run to measure your solution&apos;s runtime across input sizes.
          </p>
        )}

        {benchmarkRunning && !benchmarkResult && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-neutral-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse" />
            Measuring…
          </div>
        )}

        {benchmarkResult && benchmarkResult.points.length > 0 && (
          <BenchmarkChart
            points={benchmarkResult.points}
            logScale={logScale}
            measuredClass={benchmarkResult.measuredClass}
            staticTime={staticTime}
          />
        )}

        {benchmarkResult && benchmarkResult.points.length === 0 && (
          <p className="text-xs text-neutral-500 text-center py-8">
            Benchmark failed — check that your code runs correctly first.
          </p>
        )}
      </div>
    </div>
  );
}
