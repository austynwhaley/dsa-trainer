import { NextResponse } from "next/server";
import type { TestCase, TestResult, RunResult } from "@/lib/types";

export const runtime = "nodejs";

// JavaScript execution happens in the browser (Web Worker).
// This endpoint handles Python execution server-side using a subprocess.
// For v1: simple Python runner via child_process, sandboxed with a timeout.

export async function POST(req: Request) {
  const { code, testCases, language } = await req.json() as {
    code: string;
    testCases: TestCase[];
    language: "python" | "java";
  };

  if (language === "python") {
    const { runPython } = await import("./python-runner");
    const result: RunResult = await runPython(code, testCases);
    return NextResponse.json(result);
  }

  if (language === "java") {
    const { runJava } = await import("./java-runner");
    const result: RunResult = await runJava(code, testCases);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
}
