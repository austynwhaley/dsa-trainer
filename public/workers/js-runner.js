/**
 * JavaScript code runner Web Worker.
 * Receives: { code, testCases, language, entryPoint }
 *        or { type: 'benchmark', code, entryPoint, isLinkedList, isLRU, items, timeoutMs }
 * Posts back: RunResult  or  { type: 'benchmarkResult', points: [...] }
 */

const stdoutLines = [];
const origLog = console.log;
console.log = (...args) => {
  stdoutLines.push(args.map(String).join(" "));
};

function normalizeOutput(val) {
  if (val === null || val === undefined) return "null";
  return JSON.stringify(val);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

class ListNode {
  constructor(val, next) {
    this.val = val ?? 0;
    this.next = next ?? null;
  }
}

function arrayToList(arr) {
  if (!arr || !arr.length) return null;
  let head = null;
  for (let i = arr.length - 1; i >= 0; i--) head = new ListNode(arr[i], head);
  return head;
}

function listToArray(node) {
  const arr = [];
  while (node) { arr.push(node.val); node = node.next; }
  return arr;
}

// --- resolve entry function from user code ---
function resolveEntry(code, entryPoint) {
  const ep = entryPoint || "";
  const wrapper = new Function(
    "ListNode",
    `${code}
    if (typeof ${ep || "undefined_sentinel"} !== "undefined") return ${ep};
    ${ep ? `throw new Error("Expected function or class '${ep}' was not defined in your code");` : "return null;"}
    `
  );
  return wrapper(ListNode);
}

// ---- Normal test run ----
function handleRun({ code, testCases, entryPoint }) {
  let userFn = null;
  let evalError = null;
  try {
    userFn = resolveEntry(code, entryPoint);
  } catch (err) {
    evalError = err.message;
  }

  if (evalError || !userFn) {
    const results = testCases.map((tc) => ({
      passed: false,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: "",
      error: evalError || `Expected function '${entryPoint}' was not defined in your code`,
    }));
    self.postMessage({ results, stdout: "", error: evalError });
    return;
  }

  const isLinkedList = entryPoint === "reverseList";
  const isLRU = entryPoint === "LRUCache";
  const results = [];
  let globalStdout = "";

  for (const tc of testCases) {
    stdoutLines.length = 0;
    const t0 = performance.now();
    try {
      let args;
      try { args = JSON.parse("[" + tc.input + "]"); } catch { args = [tc.input]; }

      let actual;
      if (isLRU) {
        const cache = new userFn(args[0]);
        const ops = args[1] ?? [];
        const opResults = [null];
        for (const op of ops) {
          if (op[0] === "put") { cache.put(op[1], op[2]); opResults.push(null); }
          else if (op[0] === "get") opResults.push(cache.get(op[1]));
        }
        actual = opResults;
      } else {
        if (isLinkedList) {
          args = args.map((a) => Array.isArray(a) ? arrayToList(a) : a);
        }
        actual = userFn(...args);
        if (actual !== null && typeof actual === "object" && "val" in actual && "next" in actual) {
          actual = listToArray(actual);
        }
      }

      const runtime = Math.round(performance.now() - t0);
      const actualStr = normalizeOutput(actual);
      const expectedParsed = (() => { try { return JSON.parse(tc.expectedOutput); } catch { return tc.expectedOutput; } })();
      const passed = deepEqual(actual, expectedParsed) || actualStr === tc.expectedOutput;

      results.push({ passed, input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: actualStr, runtime, stdout: stdoutLines.join("\n") });
      globalStdout += stdoutLines.join("\n");
    } catch (err) {
      results.push({ passed: false, input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: "", error: err.message, stdout: stdoutLines.join("\n") });
    }
  }

  self.postMessage({ results, stdout: globalStdout, totalRuntime: results.reduce((s, r) => s + (r.runtime ?? 0), 0) });
}

// ---- Benchmark ----
// items: Array<{ n, args: unknown[] }>  (one set of args per size)
// timeoutMs: abort a single run if it exceeds this
function handleBenchmark({ code, entryPoint, isLinkedList, isLRU, items, timeoutMs }) {
  let userFn = null;
  try { userFn = resolveEntry(code, entryPoint); } catch (err) {
    self.postMessage({ type: "benchmarkResult", error: err.message, points: [] });
    return;
  }

  const REPEATS = 3;
  const points = [];

  for (const { n, args } of items) {
    // Build prepared args (convert once; functions are pure so reuse is fine)
    let preparedArgs;
    try {
      if (isLinkedList) {
        preparedArgs = args.map((a) => Array.isArray(a) ? arrayToList(a) : a);
      } else {
        preparedArgs = args;
      }
    } catch (err) {
      points.push({ n, medianMs: 0, error: String(err) });
      continue;
    }

    // Warm-up
    try {
      if (isLRU) {
        const c = new userFn(preparedArgs[0]);
        for (const op of (preparedArgs[1] ?? [])) {
          if (op[0] === "put") c.put(op[1], op[2]); else c.get(op[1]);
        }
      } else {
        userFn(...preparedArgs);
      }
    } catch { /* warmup errors are ok */ }

    // Measured runs
    const times = [];
    let aborted = false;
    let runError = null;

    for (let r = 0; r < REPEATS; r++) {
      try {
        const t0 = performance.now();
        if (isLRU) {
          const c = new userFn(preparedArgs[0]);
          for (const op of (preparedArgs[1] ?? [])) {
            if (op[0] === "put") c.put(op[1], op[2]); else c.get(op[1]);
          }
        } else {
          userFn(...preparedArgs);
        }
        const elapsed = performance.now() - t0;
        if (elapsed > timeoutMs) { aborted = true; break; }
        times.push(elapsed);
      } catch (err) {
        runError = String(err);
        break;
      }
    }

    if (runError) {
      points.push({ n, medianMs: 0, error: runError });
    } else if (aborted || times.length === 0) {
      points.push({ n, medianMs: 0, aborted: true });
      // All remaining sizes will also be aborted
      const remaining = items.slice(items.indexOf(items.find(i => i.n === n))).slice(1);
      for (const rem of remaining) points.push({ n: rem.n, medianMs: 0, aborted: true });
      break;
    } else {
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      points.push({ n, medianMs: median });
    }
  }

  self.postMessage({ type: "benchmarkResult", points });
}

self.onmessage = function (e) {
  if (e.data.type === "benchmark") {
    handleBenchmark(e.data);
    return;
  }
  handleRun(e.data);
};
