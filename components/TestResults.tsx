"use client";

import { useStore } from "@/lib/store";

export function TestResults() {
  const { lastRunResult, isRunning } = useStore();

  if (isRunning) {
    return (
      <div className="px-4 py-3 text-xs text-neutral-400 flex items-center gap-2">
        <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        Running…
      </div>
    );
  }

  if (!lastRunResult) return null;

  const { results, stdout, error } = lastRunResult;
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const allPassed = passed === total;

  return (
    <div className="text-xs font-mono">
      {/* Summary bar */}
      <div className={`px-4 py-2 flex items-center gap-3 border-b border-neutral-800 ${allPassed ? "bg-green-950/30" : "bg-red-950/20"}`}>
        <span className={allPassed ? "text-green-400" : "text-red-400"}>
          {allPassed ? "✓" : "✗"} {passed}/{total} passed
        </span>
        {lastRunResult.totalRuntime !== undefined && (
          <span className="text-neutral-500">{lastRunResult.totalRuntime}ms</span>
        )}
      </div>

      {/* Per-test results */}
      <div className="divide-y divide-neutral-800/50">
        {results.map((r, i) => (
          <div key={i} className="px-4 py-2 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={r.passed ? "text-green-400" : "text-red-400"}>
                {r.passed ? "✓" : "✗"}
              </span>
              <span className="text-neutral-400">Case {i + 1}</span>
              {r.runtime !== undefined && (
                <span className="text-neutral-600 ml-auto">{r.runtime}ms</span>
              )}
            </div>
            {!r.passed && (
              <div className="pl-4 space-y-0.5 text-neutral-400">
                <div>
                  <span className="text-neutral-500">input: </span>
                  <span className="text-neutral-300">{r.input}</span>
                </div>
                <div>
                  <span className="text-neutral-500">expected: </span>
                  <span className="text-green-300/80">{r.expectedOutput}</span>
                </div>
                <div>
                  <span className="text-neutral-500">got: </span>
                  <span className="text-red-300/80">{r.actualOutput || "(empty)"}</span>
                </div>
                {r.error && (
                  <div className="text-red-400/80 whitespace-pre-wrap mt-1">
                    {r.error.split("\n").slice(0, 6).join("\n")}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* stdout */}
      {stdout && (
        <div className="px-4 py-2 border-t border-neutral-800">
          <div className="text-neutral-500 mb-1">stdout</div>
          <pre className="text-neutral-300 whitespace-pre-wrap text-xs">{stdout}</pre>
        </div>
      )}

      {/* top-level error */}
      {error && !results.length && (
        <div className="px-4 py-2 text-red-400 whitespace-pre-wrap">{error}</div>
      )}
    </div>
  );
}
