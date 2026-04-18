import { execFile } from "child_process";
import { promisify } from "util";
import type { TestCase, TestResult, RunResult } from "@/lib/types";

const execFileAsync = promisify(execFile);

/**
 * Wraps user Python code in a harness that runs each test case and prints
 * JSON results. Runs with a 10s timeout per invocation.
 */
function buildPythonHarness(userCode: string, testCases: TestCase[]): string {
  const casesJson = JSON.stringify(
    testCases.map((tc) => ({ input: tc.input, expected: tc.expectedOutput }))
  );

  return `
import json, sys, time, traceback, io

${userCode}

_test_cases = ${casesJson}
_results = []

# Try to find the user's main function (last defined function)
import types
_user_fns = [(k, v) for k, v in list(locals().items()) if isinstance(v, types.FunctionType)]
_main_fn = _user_fns[-1][1] if _user_fns else None

for _tc in _test_cases:
    _inp = _tc["input"]
    _expected = str(_tc["expected"])
    try:
        _args = json.loads("[" + _inp + "]")
        _t0 = time.perf_counter()
        _old_stdout = sys.stdout
        sys.stdout = _buf = io.StringIO()
        _result = _main_fn(*_args)
        sys.stdout = _old_stdout
        _runtime = int((time.perf_counter() - _t0) * 1000)
        _actual = json.dumps(_result)
        _passed = _actual == _expected or str(_result) == _expected
        _results.append({
            "passed": _passed,
            "input": _inp,
            "expectedOutput": _expected,
            "actualOutput": _actual,
            "runtime": _runtime,
            "stdout": _buf.getvalue(),
        })
    except Exception as e:
        sys.stdout = _old_stdout if '_old_stdout' in dir() else sys.stdout
        _results.append({
            "passed": False,
            "input": _inp,
            "expectedOutput": _expected,
            "actualOutput": "",
            "error": traceback.format_exc(),
        })

print(json.dumps({"results": _results}))
`;
}

export async function runPython(code: string, testCases: TestCase[]): Promise<RunResult> {
  const harness = buildPythonHarness(code, testCases);

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      ["-c", harness],
      { timeout: 10000 }
    );

    const parsed = JSON.parse(stdout.trim()) as { results: TestResult[] };
    const stdout2 = parsed.results.map((r) => (r as TestResult & { stdout?: string }).stdout ?? "").join("");
    return {
      results: parsed.results,
      stdout: stdout2,
      totalRuntime: parsed.results.reduce((s, r) => s + (r.runtime ?? 0), 0),
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message?: string };
    return {
      results: testCases.map((tc) => ({
        passed: false,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: "",
        error: error.stderr || error.message || "Unknown error",
      })),
      stdout: "",
      error: error.stderr || error.message || "Execution failed",
    };
  }
}
