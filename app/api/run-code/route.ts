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
    language: "python";
  };

  if (language !== "python") {
    return NextResponse.json({ error: "Only python runs server-side" }, { status: 400 });
  }

  const { runPython } = await import("./python-runner");
  const result: RunResult = await runPython(code, testCases);
  return NextResponse.json(result);
}
