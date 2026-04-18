import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { TestCase, TestResult, RunResult } from "@/lib/types";

const execFileAsync = promisify(execFile);

function jStr(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t") +
    '"'
  );
}

// Convert LRU "capacity=N, ops=[...]" → "[N, [...]]"
function normalizeInput(input: string): string {
  const m = input.match(/^capacity=(\d+),\s*ops=([\s\S]+)$/);
  if (m) return `[${m[1]}, ${m[2]}]`;
  return `[${input}]`;
}

function buildHarness(userCode: string, testCases: TestCase[]): string {
  const casesLiteral =
    "new String[][] { " +
    testCases
      .map(
        (tc) => `{ ${jStr(normalizeInput(tc.input))}, ${jStr(tc.expectedOutput)} }`
      )
      .join(", ") +
    " }";

  return `
import java.util.*;
import java.lang.reflect.*;
import java.util.stream.*;

${userCode}

public class Main {
    static int P = 0;

    @SuppressWarnings("unchecked")
    static Object jv(String s) {
        for (; P < s.length() && s.charAt(P) <= ' '; P++);
        if (P >= s.length()) return null;
        char c = s.charAt(P);
        if (c == '"') {
            P++;
            var sb = new StringBuilder();
            while (P < s.length() && s.charAt(P) != '"') {
                if (s.charAt(P) == '\\\\') P++;
                sb.append(s.charAt(P++));
            }
            P++;
            return sb.toString();
        }
        if (c == '[') {
            P++;
            var list = new ArrayList<Object>();
            for (;;) {
                for (; P < s.length() && s.charAt(P) <= ' '; P++);
                if (P >= s.length() || s.charAt(P) == ']') break;
                list.add(jv(s));
                for (; P < s.length() && s.charAt(P) <= ' '; P++);
                if (P < s.length() && s.charAt(P) == ',') P++;
            }
            if (P < s.length()) P++; // skip ]
            return list;
        }
        if (c == 't') { P += 4; return Boolean.TRUE; }
        if (c == 'f') { P += 5; return Boolean.FALSE; }
        if (c == 'n') { P += 4; return null; }
        int start = P;
        if (c == '-') P++;
        while (P < s.length() && (Character.isDigit(s.charAt(P)) || s.charAt(P) == '.')) P++;
        String n = s.substring(start, P);
        return n.contains(".") ? Double.parseDouble(n) : Long.parseLong(n);
    }

    @SuppressWarnings("unchecked")
    static Object cv(Object v, Class<?> t) throws Exception {
        if (v == null) return null;
        if (t == int.class || t == Integer.class) return ((Number) v).intValue();
        if (t == long.class || t == Long.class) return ((Number) v).longValue();
        if (t == boolean.class || t == Boolean.class) return (Boolean) v;
        if (t == String.class) return v.toString();
        if (t == int[].class) {
            var l = (List<Object>) v;
            var r = new int[l.size()];
            for (int i = 0; i < l.size(); i++) r[i] = ((Number) l.get(i)).intValue();
            return r;
        }
        if (t == int[][].class) {
            var l = (List<Object>) v;
            var r = new int[l.size()][];
            for (int i = 0; i < l.size(); i++) {
                var inner = (List<Object>) l.get(i);
                r[i] = new int[inner.size()];
                for (int j = 0; j < inner.size(); j++) r[i][j] = ((Number) inner.get(j)).intValue();
            }
            return r;
        }
        if (t == char[][].class) {
            var l = (List<Object>) v;
            var r = new char[l.size()][];
            for (int i = 0; i < l.size(); i++) {
                var inner = (List<Object>) l.get(i);
                r[i] = new char[inner.size()];
                for (int j = 0; j < inner.size(); j++) r[i][j] = inner.get(j).toString().charAt(0);
            }
            return r;
        }
        if (t == String[].class) {
            var l = (List<Object>) v;
            return l.stream().map(Object::toString).toArray(String[]::new);
        }
        if (t == List.class) {
            var l = (List<Object>) v;
            return l.stream().map(Object::toString).collect(Collectors.toList());
        }
        if (t.getSimpleName().equals("ListNode")) {
            var l = (List<Object>) v;
            if (l.isEmpty()) return null;
            Constructor<?> ctor = t.getDeclaredConstructor(int.class);
            Field nextF = t.getDeclaredField("next");
            Object head = null;
            for (int i = l.size() - 1; i >= 0; i--) {
                Object node = ctor.newInstance(((Number) l.get(i)).intValue());
                nextF.set(node, head);
                head = node;
            }
            return head;
        }
        return v;
    }

    static String jw(Object v) {
        if (v == null) return "null";
        if (v instanceof Boolean || v instanceof Number) return v.toString();
        if (v instanceof String) {
            return "\\"" + ((String) v).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"";
        }
        if (v instanceof int[]) {
            var a = (int[]) v;
            var sb = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(a[i]); }
            return sb.append("]").toString();
        }
        if (v instanceof int[][]) {
            var a = (int[][]) v;
            var sb = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) {
                if (i > 0) sb.append(",");
                sb.append("[");
                for (int j = 0; j < a[i].length; j++) { if (j > 0) sb.append(","); sb.append(a[i][j]); }
                sb.append("]");
            }
            return sb.append("]").toString();
        }
        if (v instanceof List) {
            var l = (List<?>) v;
            var sb = new StringBuilder("[");
            for (int i = 0; i < l.size(); i++) { if (i > 0) sb.append(","); sb.append(jw(l.get(i))); }
            return sb.append("]").toString();
        }
        try {
            Class<?> t = v.getClass();
            if (t.getSimpleName().equals("ListNode")) {
                var l = new ArrayList<Integer>();
                Field valF = t.getDeclaredField("val");
                Field nextF = t.getDeclaredField("next");
                Object cur = v;
                while (cur != null) { l.add((Integer) valF.get(cur)); cur = nextF.get(cur); }
                return jw(l);
            }
        } catch (Exception ignored) {}
        return "\\"" + v + "\\"";
    }

    public static void main(String[] a) throws Exception {
        String[][] CASES = ${casesLiteral};

        Class<?> solClass;
        try { solClass = Class.forName("Solution"); }
        catch (ClassNotFoundException e) {
            // LRU cache problem uses LRUCache class name directly
            try { solClass = Class.forName("LRUCache"); }
            catch (ClassNotFoundException e2) { System.out.println("{\\"error\\":\\"No Solution or LRUCache class found\\"}"); return; }
        }

        boolean hasGetPut = Arrays.stream(solClass.getDeclaredMethods())
            .map(Method::getName).collect(Collectors.toSet()).containsAll(Set.of("get", "put"));

        var out = new StringBuilder("{\\"results\\":[");
        boolean first = true;

        for (String[] tc : CASES) {
            String rawInput = tc[0];
            String expected = tc[1];
            long t0 = System.nanoTime();
            try {
                P = 0;
                @SuppressWarnings("unchecked")
                var args = (List<Object>) jv(rawInput);
                Object actual;

                if (hasGetPut) {
                    int cap = ((Number) args.get(0)).intValue();
                    Constructor<?> ctor = solClass.getDeclaredConstructor(int.class);
                    Object cache = ctor.newInstance(cap);
                    Method getM = solClass.getMethod("get", int.class);
                    Method putM = solClass.getMethod("put", int.class, int.class);
                    @SuppressWarnings("unchecked")
                    var ops = args.size() > 1 ? (List<Object>) args.get(1) : new ArrayList<Object>();
                    var opResults = new ArrayList<Object>();
                    opResults.add(null);
                    for (Object op : ops) {
                        @SuppressWarnings("unchecked")
                        var opArr = (List<Object>) op;
                        String opName = opArr.get(0).toString();
                        if ("put".equals(opName)) {
                            putM.invoke(cache, ((Number) opArr.get(1)).intValue(), ((Number) opArr.get(2)).intValue());
                            opResults.add(null);
                        } else if ("get".equals(opName)) {
                            opResults.add(getM.invoke(cache, ((Number) opArr.get(1)).intValue()));
                        }
                    }
                    actual = opResults;
                } else {
                    Method m = null;
                    for (Method meth : solClass.getDeclaredMethods()) {
                        if (Modifier.isPublic(meth.getModifiers()) && !Modifier.isStatic(meth.getModifiers())) {
                            m = meth; break;
                        }
                    }
                    if (m == null) throw new Exception("No public method found in Solution");
                    Object sol = solClass.getDeclaredConstructor().newInstance();
                    Class<?>[] params = m.getParameterTypes();
                    Object[] callArgs = new Object[params.length];
                    for (int i = 0; i < params.length; i++) callArgs[i] = cv(args.get(i), params[i]);
                    actual = m.invoke(sol, callArgs);
                }

                long runtime = (System.nanoTime() - t0) / 1_000_000L;
                String actualJson = jw(actual);
                boolean passed = actualJson.equals(expected);

                if (!first) out.append(",");
                first = false;
                out.append("{\\"passed\\":").append(passed)
                   .append(",\\"input\\":").append(jw(rawInput))
                   .append(",\\"expectedOutput\\":").append(jw(expected))
                   .append(",\\"actualOutput\\":").append(jw(actualJson))
                   .append(",\\"runtime\\":").append(runtime).append("}");
            } catch (Exception e) {
                Throwable cause = (e instanceof InvocationTargetException && e.getCause() != null) ? e.getCause() : e;
                String err = cause.toString();
                if (!first) out.append(",");
                first = false;
                out.append("{\\"passed\\":false,\\"input\\":").append(jw(rawInput))
                   .append(",\\"expectedOutput\\":").append(jw(expected))
                   .append(",\\"actualOutput\\":\\"\\",\\"error\\":").append(jw(err)).append("}");
            }
        }
        out.append("]}");
        System.out.println(out);
    }
}
`;
}

export async function runJava(code: string, testCases: TestCase[]): Promise<RunResult> {
  const dir = join(tmpdir(), `java_run_${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "Main.java");

  try {
    await writeFile(file, buildHarness(code, testCases), "utf8");

    // Compile
    try {
      await execFileAsync("javac", [file], { timeout: 15000 });
    } catch (compileErr: unknown) {
      const e = compileErr as { stderr?: string; message?: string };
      const errMsg = (e.stderr || e.message || "Compilation failed")
        .replace(/\/tmp\/java_run_[^/]+\//g, ""); // strip temp path from errors
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

    // Run
    const { stdout } = await execFileAsync("java", ["-cp", dir, "Main"], {
      timeout: 10000,
    });

    const parsed = JSON.parse(stdout.trim()) as { results: TestResult[]; error?: string };
    return {
      results: parsed.results,
      stdout: "",
      totalRuntime: parsed.results.reduce((s, r) => s + (r.runtime ?? 0), 0),
    };
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
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
