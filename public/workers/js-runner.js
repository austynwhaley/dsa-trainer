/**
 * JavaScript code runner Web Worker.
 * Runs user code in an isolated Worker context with a timeout.
 * Receives: { code, testCases, language }
 * Posts back: RunResult
 */

// Intercept console.log to capture stdout
const stdoutLines = [];
const origLog = console.log;
console.log = (...args) => {
  stdoutLines.push(args.map(String).join(" "));
};

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeOutput(val) {
  if (val === null || val === undefined) return "null";
  return JSON.stringify(val);
}

self.onmessage = function (e) {
  const { code, testCases } = e.data;
  const results = [];
  let globalStdout = "";

  // Extract class-based code vs function code
  // We eval once to define the function/class, then call per test
  let userFn = null;
  let evalError = null;

  try {
    // Wrap in a function to capture the last defined function/class
    const wrapper = new Function(
      "ListNode",
      `${code}
      // Try to find the main export
      // Return the last function or class defined at top level
      const names = Object.getOwnPropertyNames(this);
      return typeof climbStairs !== 'undefined' ? climbStairs
        : typeof twoSum !== 'undefined' ? twoSum
        : typeof isValid !== 'undefined' ? isValid
        : typeof search !== 'undefined' ? search
        : typeof reverseList !== 'undefined' ? reverseList
        : typeof maxSubArray !== 'undefined' ? maxSubArray
        : typeof numIslands !== 'undefined' ? numIslands
        : typeof merge !== 'undefined' ? merge
        : typeof wordBreak !== 'undefined' ? wordBreak
        : typeof LRUCache !== 'undefined' ? LRUCache
        : null;
      `
    );

    class ListNode {
      constructor(val, next) {
        this.val = val ?? 0;
        this.next = next ?? null;
      }
    }

    userFn = wrapper(ListNode);
  } catch (err) {
    evalError = err.message;
  }

  if (evalError || !userFn) {
    for (const tc of testCases) {
      results.push({
        passed: false,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: "",
        error: evalError || "Could not find a function to run",
      });
    }
    self.postMessage({ results, stdout: "", error: evalError });
    return;
  }

  for (const tc of testCases) {
    stdoutLines.length = 0;
    const t0 = performance.now();
    try {
      // Parse inputs — wrap in array brackets so we can spread
      let args;
      try {
        args = JSON.parse("[" + tc.input + "]");
      } catch {
        args = [tc.input];
      }

      // Handle linked list problems: convert array to linked list
      if (tc.input.startsWith("[") && userFn.name === "reverseList") {
        const arr = JSON.parse(tc.input);
        let head = null;
        for (let i = arr.length - 1; i >= 0; i--) {
          head = { val: arr[i], next: head };
        }
        args = [head];
      }

      // Handle LRUCache (class, not function)
      let actual;
      if (userFn.toString().startsWith("class LRU")) {
        // Special harness: parse ops from test case description
        const cache = new userFn(args[0]);
        const ops = args[1] ?? [];
        const opResults = [null];
        for (const op of ops) {
          if (op[0] === "put") opResults.push(cache.put(op[1], op[2]) ?? null);
          else if (op[0] === "get") opResults.push(cache.get(op[1]));
        }
        actual = opResults;
      } else {
        actual = userFn(...args);
      }

      // Normalize linked list output back to array
      if (actual !== null && typeof actual === "object" && "val" in actual && "next" in actual) {
        const arr = [];
        let cur = actual;
        while (cur) {
          arr.push(cur.val);
          cur = cur.next;
        }
        actual = arr;
      }

      const runtime = Math.round(performance.now() - t0);
      const actualStr = normalizeOutput(actual);
      const expectedParsed = (() => {
        try {
          return JSON.parse(tc.expectedOutput);
        } catch {
          return tc.expectedOutput;
        }
      })();
      const passed = deepEqual(actual, expectedParsed) || actualStr === tc.expectedOutput;

      results.push({
        passed,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: actualStr,
        runtime,
        stdout: stdoutLines.join("\n"),
      });
      globalStdout += stdoutLines.join("\n");
    } catch (err) {
      results.push({
        passed: false,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: "",
        error: err.message,
        stdout: stdoutLines.join("\n"),
      });
    }
  }

  self.postMessage({
    results,
    stdout: globalStdout,
    totalRuntime: results.reduce((s, r) => s + (r.runtime ?? 0), 0),
  });
};
