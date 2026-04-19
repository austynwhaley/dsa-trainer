import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { TestCase, RunResult } from "@/lib/types";

const execFileAsync = promisify(execFile);

function buildNodeHarness(jsCode: string, testCases: TestCase[], entryPoint: string): string {
  const casesJson = JSON.stringify(
    testCases.map((tc) => ({ input: tc.input, expected: tc.expectedOutput }))
  );
  const ep = JSON.stringify(entryPoint);
  const isLinkedList = entryPoint === "reverseList";
  const isLRU = entryPoint === "LRUCache";

  return `
const stdoutLines = [];
const _origLog = console.log;
console.log = (...args) => stdoutLines.push(args.map(String).join(" "));

class ListNode {
  constructor(val, next) { this.val = val ?? 0; this.next = next ?? null; }
}

${jsCode}

const _ep = ${ep};
let _fn;
try { _fn = eval(_ep); } catch (_) { _fn = undefined; }
if (typeof _fn === "undefined") {
  _origLog(JSON.stringify({ results: ${JSON.stringify(testCases)}.map(tc => ({
    passed: false, input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: "",
    error: \`Expected function or class '\${_ep}' was not defined in your code\`,
  })) }));
  process.exit(0);
}

const _cases = ${casesJson};
const _results = [];
const _isLinkedList = ${isLinkedList};
const _isLRU = ${isLRU};

function _arrayToList(arr) {
  if (!arr || !arr.length) return null;
  let head = null;
  for (let i = arr.length - 1; i >= 0; i--) head = new ListNode(arr[i], head);
  return head;
}

for (const tc of _cases) {
  stdoutLines.length = 0;
  const t0 = Date.now();
  try {
    let args;
    try { args = JSON.parse("[" + tc.input + "]"); } catch { args = [tc.input]; }

    let actual;
    if (_isLRU) {
      const cache = new _fn(args[0]);
      const ops = args[1] ?? [];
      const opResults = [null];
      for (const op of ops) {
        if (op[0] === "put") { cache.put(op[1], op[2]); opResults.push(null); }
        else if (op[0] === "get") opResults.push(cache.get(op[1]));
      }
      actual = opResults;
    } else {
      if (_isLinkedList) args = args.map(a => Array.isArray(a) ? _arrayToList(a) : a);
      actual = _fn(...args);
      if (actual !== null && typeof actual === "object" && "val" in actual && "next" in actual) {
        const arr = [];
        let cur = actual;
        while (cur) { arr.push(cur.val); cur = cur.next; }
        actual = arr;
      }
    }

    const runtime = Date.now() - t0;
    const actualJson = JSON.stringify(actual);
    const passed = actualJson === tc.expected || String(actual) === tc.expected;
    _results.push({ passed, input: tc.input, expectedOutput: tc.expected, actualOutput: actualJson, runtime, stdout: stdoutLines.join("\\n") });
  } catch (e) {
    _results.push({ passed: false, input: tc.input, expectedOutput: tc.expected, actualOutput: "", error: e.message });
  }
}

_origLog(JSON.stringify({ results: _results }));
`;
}

export async function runTypeScript(code: string, testCases: TestCase[], entryPoint = ""): Promise<RunResult> {
  const dir = join(tmpdir(), `ts_run_${randomUUID()}`);
  await mkdir(dir, { recursive: true });

  try {
    // Transpile TypeScript → JavaScript in-process (no subprocess needed)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require("typescript") as typeof import("typescript");
    const { outputText, diagnostics } = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: false,
        noEmitOnError: false,
      },
      reportDiagnostics: true,
    });

    if (diagnostics && diagnostics.length > 0) {
      const errMsg = diagnostics
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
        .join("\n");
      return {
        results: testCases.map((tc) => ({
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: "",
          error: errMsg,
        })),
        stdout: "",
        error: errMsg,
      };
    }

    const harnessFile = join(dir, "runner.js");
    await writeFile(harnessFile, buildNodeHarness(outputText, testCases, entryPoint), "utf8");

    const { stdout } = await execFileAsync("node", [harnessFile], { timeout: 10000 });
    const parsed = JSON.parse(stdout.trim()) as { results: typeof testCases extends infer T ? T : never[] };
    return {
      results: parsed.results as RunResult["results"],
      stdout: (parsed.results as Array<{ stdout?: string }>).map((r) => r.stdout ?? "").join(""),
      totalRuntime: (parsed.results as Array<{ runtime?: number }>).reduce((s, r) => s + (r.runtime ?? 0), 0),
    };
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    return {
      results: testCases.map((tc) => ({
        passed: false,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: "",
        error: e.stderr || e.message || "Execution failed",
      })),
      stdout: "",
      error: e.stderr || e.message || "Execution failed",
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
