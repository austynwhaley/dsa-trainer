"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useStore } from "@/lib/store";
import { summarizeEdit } from "@/lib/context";
import { setEditorInstance, isAnimating } from "@/lib/editor-ref";
import { setEditorAndMonaco } from "@/lib/editor-actions";
import type { AIContext } from "@/lib/types";
import { TestResults } from "./TestResults";
import { ComplexityBadge } from "./ComplexityBadge";
import { BenchmarkPanel } from "./BenchmarkPanel";

const GHOST_DEBOUNCE_MS = 4000;
const GHOST_MIN_CODE_LENGTH = 20;
const GHOST_COOLDOWN_MS = 15000;

// Compute which lines (1-indexed) differ between two code strings.
function changedLineRange(
  oldCode: string,
  newCode: string
): { start: number; end: number } | null {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  let start = 0;
  while (
    start < oldLines.length &&
    start < newLines.length &&
    oldLines[start] === newLines[start]
  )
    start++;
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldLines[oldEnd] === newLines[newEnd]
  ) {
    oldEnd--;
    newEnd--;
  }
  if (start > newEnd) return null;
  return { start: start + 1, end: newEnd + 1 };
}

export function CodeEditor() {
  const {
    code, setCode, language, setLanguage, problem,
    cursorLine, setCursorLine,
    editHistory, addEditEvent,
    ghostComments, setGhostComment, clearGhostComments,
    lastRunResult, setRunResult, isRunning, setIsRunning,
    chatMessages,
    pendingEdit, acceptPendingEdit, rejectPendingEdit, finishPendingAnimation,
    showBenchmark, setShowBenchmark, benchmarkRunning,
  } = useStore();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const ghostDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostCooldownRef = useRef<number>(0);
  const ghostDecorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const pendingDecorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const prevCodeRef = useRef(code);

  // --- Sync editor when store code changes externally (reject reverts it) ---
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || isAnimating) return;
    if (editor.getValue() !== code) {
      editor.setValue(code);
    }
  }, [code]);

  // --- Pending edit decorations ---
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    if (!pendingEdit) {
      pendingDecorationsRef.current?.clear();
      return;
    }

    const range = changedLineRange(pendingEdit.originalCode, pendingEdit.finalCode);
    if (!range) {
      pendingDecorationsRef.current?.clear();
      return;
    }

    const decorations: Monaco.editor.IModelDeltaDecoration[] = [
      {
        range: new monaco.Range(range.start, 1, range.end, Number.MAX_SAFE_INTEGER),
        options: {
          isWholeLine: true,
          className: "pending-edit-line",
          linesDecorationsClassName: "pending-edit-gutter",
          overviewRuler: {
            color: "#22c55e",
            position: monaco.editor.OverviewRulerLane.Left,
          },
        },
      },
    ];

    if (pendingDecorationsRef.current) {
      pendingDecorationsRef.current.set(decorations);
    } else {
      pendingDecorationsRef.current = editor.createDecorationsCollection(decorations);
    }
  }, [pendingEdit]);

  // --- Ghost comment overlay ---
  const renderGhostDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const decorations: Monaco.editor.IModelDeltaDecoration[] = ghostComments.map((g) => ({
      range: new monaco.Range(g.line + 1, 1, g.line + 1, 1),
      options: {
        after: {
          content: `  // ${g.text}`,
          inlineClassName: "ghost-comment-inline",
          cursorStops: monaco.editor.InjectedTextCursorStops.None,
        },
      },
    }));

    if (ghostDecorationsRef.current) {
      ghostDecorationsRef.current.set(decorations);
    } else {
      ghostDecorationsRef.current = editor.createDecorationsCollection(decorations);
    }
  }, [ghostComments]);

  useEffect(() => {
    renderGhostDecorations();
  }, [ghostComments, renderGhostDecorations]);

  // --- Ghost comment request ---
  const requestGhostComment = useCallback(async (currentCode: string, line: number) => {
    if (currentCode.trim().length < GHOST_MIN_CODE_LENGTH) return;
    const now = Date.now();
    if (now - ghostCooldownRef.current < GHOST_COOLDOWN_MS) return;
    ghostCooldownRef.current = now;

    const ctx: AIContext = {
      problem: { title: problem.title, description: problem.description, difficulty: problem.difficulty },
      code: currentCode,
      language,
      recentEdits: editHistory.slice(-8),
      chatHistory: chatMessages.slice(-4),
      lastRunResult: lastRunResult ?? undefined,
      cursorLine: line,
    };

    try {
      const res = await fetch("/api/ghost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      });
      const data = await res.json();
      if (data.comment) {
        setGhostComment({ line, text: data.comment, id: `${line}-${Date.now()}` });
      }
    } catch { /* ignore */ }
  }, [problem, language, editHistory, chatMessages, lastRunResult, setGhostComment]);

  // --- Code change handler ---
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value ?? "";

    if (!isAnimating) {
      const oldLines = prevCodeRef.current.split("\n");
      const newLines = newCode.split("\n");
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        if (oldLines[i] !== newLines[i]) {
          addEditEvent({ timestamp: Date.now(), line: i, summary: summarizeEdit(oldLines[i] ?? "", newLines[i] ?? "", i) });
        }
      }

      // User typed while pending edit exists — dismiss it
      if (useStore.getState().pendingEdit) {
        useStore.getState().acceptPendingEdit(); // treat as implicit accept (they're editing on top)
      }
    }

    prevCodeRef.current = newCode;
    setCode(newCode);
    clearGhostComments();

    if (ghostDebounceRef.current) clearTimeout(ghostDebounceRef.current);
    ghostDebounceRef.current = setTimeout(() => {
      requestGhostComment(newCode, cursorLine);
    }, GHOST_DEBOUNCE_MS);
  }, [addEditEvent, setCode, clearGhostComments, requestGhostComment, cursorLine]);

  // --- Run code ---
  const runCode = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRunResult(null);
    clearGhostComments();

    if (language === "javascript") {
      const worker = new Worker("/workers/js-runner.js");
      worker.onmessage = (e) => { setRunResult(e.data); setIsRunning(false); worker.terminate(); };
      worker.onerror = (e) => { setRunResult({ results: [], stdout: "", error: e.message }); setIsRunning(false); worker.terminate(); };
      worker.postMessage({ code, testCases: problem.testCases, language, entryPoint: problem.entryPoint });
    } else if (language === "python" || language === "typescript" || language === "java") {
      try {
        const res = await fetch("/api/run-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, testCases: problem.testCases, language, entryPoint: problem.entryPoint }),
        });
        setRunResult(await res.json());
      } catch (err: unknown) {
        setRunResult({ results: [], stdout: "", error: (err as Error).message });
      } finally {
        setIsRunning(false);
      }
    }
  }, [code, language, problem.testCases, isRunning, setIsRunning, setRunResult, clearGhostComments]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorInstance(editor, monaco);
    setEditorAndMonaco(editor, monaco);

    const style = document.createElement("style");
    style.textContent = `.ghost-comment-inline { color: #6b7280 !important; font-style: italic; opacity: 0.7; user-select: none; }`;
    document.head.appendChild(style);

    editor.onDidChangeCursorPosition((e) => setCursorLine(e.position.lineNumber - 1));

    // Cmd/Ctrl+Enter: accept pending edit if one exists, otherwise run code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (useStore.getState().pendingEdit && !useStore.getState().pendingEdit?.isAnimating) {
        useStore.getState().acceptPendingEdit();
      } else {
        runCode();
      }
    });

    // Escape: reject pending edit if one exists, otherwise dismiss ghost comments
    editor.addCommand(monaco.KeyCode.Escape, () => {
      if (useStore.getState().pendingEdit && !useStore.getState().pendingEdit?.isAnimating) {
        useStore.getState().rejectPendingEdit();
      } else {
        clearGhostComments();
      }
    });
  };

  // --- Test results resize ---
  const [resultsHeight, setResultsHeight] = useState(180);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingResults = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  function onResultsDragStart(e: React.MouseEvent) {
    e.preventDefault();
    draggingResults.current = true;
    dragStartY.current = e.clientY;
    dragStartH.current = resultsHeight;
    function onMove(e: MouseEvent) {
      if (!draggingResults.current) return;
      const dy = dragStartY.current - e.clientY;
      const containerH = containerRef.current?.offsetHeight ?? 600;
      setResultsHeight(Math.max(80, Math.min(dragStartH.current + dy, containerH - 120)));
    }
    function onUp() {
      draggingResults.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const monacoLanguage =
    language === "javascript" ? "javascript" :
    language === "typescript" ? "typescript" :
    language === "java" ? "java" : "python";
  const showAcceptReject = !!pendingEdit && !pendingEdit.isAnimating;

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-neutral-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900">
        <div className="flex rounded overflow-hidden border border-neutral-700">
          <button onClick={() => setLanguage("javascript")}
            className={`px-3 py-1 text-xs ${language === "javascript" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}>
            JavaScript
          </button>
          <button onClick={() => setLanguage("typescript")}
            className={`px-3 py-1 text-xs ${language === "typescript" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}>
            TypeScript
          </button>
          <button onClick={() => setLanguage("python")}
            className={`px-3 py-1 text-xs ${language === "python" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}>
            Python
          </button>
          <button onClick={() => setLanguage("java")}
            className={`px-3 py-1 text-xs ${language === "java" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}>
            Java
          </button>
        </div>
        <div className="flex-1" />
        <ComplexityBadge />
        <button
          onClick={() => setShowBenchmark(!showBenchmark)}
          className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
            showBenchmark || benchmarkRunning
              ? "bg-indigo-900/60 border-indigo-700 text-indigo-300"
              : "border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500"
          }`}
        >
          Benchmark
        </button>
        <button onClick={runCode} disabled={isRunning || !!pendingEdit}
          className="flex items-center gap-1.5 px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded text-xs font-medium text-white">
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l10 6-10 6V2z" /></svg>
          {isRunning ? "Running…" : "Run"}
          <span className="text-green-300/60 ml-1">⌘↵</span>
        </button>
      </div>

      {/* Pending edit bar — floats between toolbar and editor */}
      {pendingEdit && (
        <div className={`flex items-center justify-between px-4 py-2 border-b text-xs select-none
          ${pendingEdit.isAnimating
            ? "bg-emerald-950/40 border-emerald-800/50"
            : "bg-emerald-950/60 border-emerald-700/60"}`}>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {pendingEdit.isAnimating ? "AI is writing…" : "AI edit — review and accept or reject"}
          </div>
          {showAcceptReject && (
            <div className="flex items-center gap-2">
              <button onClick={rejectPendingEdit}
                className="px-2 py-0.5 rounded border border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors">
                Reject <span className="opacity-50 ml-1">Esc</span>
              </button>
              <button onClick={acceptPendingEdit}
                className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors">
                Accept <span className="opacity-60 ml-1">⌘↵</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Monaco */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={monacoLanguage}
          value={code}
          onChange={handleCodeChange}
          onMount={handleMount}
          theme="vs-dark"
          options={{
            fontSize: 13,
            lineHeight: 20,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "line",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            tabSize: 2,
            wordWrap: "on",
            suggest: { preview: false },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { vertical: "auto", horizontal: "hidden" },
          }}
        />
      </div>

      {/* Benchmark panel */}
      {(showBenchmark || benchmarkRunning) && (
        <>
          <div onMouseDown={onResultsDragStart}
            className="h-1 shrink-0 cursor-row-resize bg-neutral-800 hover:bg-indigo-500/60 active:bg-indigo-500 transition-colors" />
          <div style={{ height: resultsHeight }} className="shrink-0">
            <BenchmarkPanel onClose={() => setShowBenchmark(false)} />
          </div>
        </>
      )}

      {/* Test results */}
      {!showBenchmark && !benchmarkRunning && (lastRunResult || isRunning) && (
        <>
          <div onMouseDown={onResultsDragStart}
            className="h-1 shrink-0 cursor-row-resize bg-neutral-800 hover:bg-blue-500/60 active:bg-blue-500 transition-colors" />
          <div style={{ height: resultsHeight }} className="shrink-0 overflow-y-auto">
            <TestResults />
          </div>
        </>
      )}
    </div>
  );
}
