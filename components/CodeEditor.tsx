"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useStore } from "@/lib/store";
import { summarizeEdit } from "@/lib/context";
import type { AIContext } from "@/lib/types";
import { TestResults } from "./TestResults";

const GHOST_DEBOUNCE_MS = 4000; // wait 4s of silence before asking AI
const GHOST_MIN_CODE_LENGTH = 20; // don't trigger on near-empty buffers
const GHOST_COOLDOWN_MS = 15000; // don't show ghosts more than once per 15s

export function CodeEditor() {
  const {
    code, setCode, language, setLanguage, problem,
    cursorLine, setCursorLine,
    editHistory, addEditEvent,
    ghostComments, setGhostComment, dismissGhostComment, clearGhostComments,
    lastRunResult, setRunResult, isRunning, setIsRunning,
    chatMessages,
  } = useStore();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const ghostDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostCooldownRef = useRef<number>(0);
  const ghostDecorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const prevCodeRef = useRef(code);

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

  // --- Ask AI for a ghost comment ---
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
        setGhostComment({
          line,
          text: data.comment,
          id: `${line}-${Date.now()}`,
        });
      }
    } catch {
      // silently ignore ghost failures
    }
  }, [problem, language, editHistory, chatMessages, lastRunResult, setGhostComment]);

  // --- Code change handler ---
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value ?? "";
    const oldLines = prevCodeRef.current.split("\n");
    const newLines = newCode.split("\n");

    // Track which lines changed
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (oldLines[i] !== newLines[i]) {
        addEditEvent({
          timestamp: Date.now(),
          line: i,
          summary: summarizeEdit(oldLines[i] ?? "", newLines[i] ?? "", i),
        });
      }
    }

    prevCodeRef.current = newCode;
    setCode(newCode);

    // Clear ghost comments while typing
    clearGhostComments();

    // Debounce ghost comment request
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
      worker.onmessage = (e) => {
        setRunResult(e.data);
        setIsRunning(false);
        worker.terminate();
      };
      worker.onerror = (e) => {
        setRunResult({ results: [], stdout: "", error: e.message });
        setIsRunning(false);
        worker.terminate();
      };
      worker.postMessage({ code, testCases: problem.testCases, language });
    } else {
      try {
        const res = await fetch("/api/run-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, testCases: problem.testCases, language }),
        });
        const result = await res.json();
        setRunResult(result);
      } catch (err: unknown) {
        const e = err as Error;
        setRunResult({ results: [], stdout: "", error: e.message });
      } finally {
        setIsRunning(false);
      }
    }
  }, [code, language, problem.testCases, isRunning, setIsRunning, setRunResult, clearGhostComments]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add ghost comment CSS
    const style = document.createElement("style");
    style.textContent = `
      .ghost-comment-inline {
        color: #6b7280 !important;
        font-style: italic;
        opacity: 0.7;
        user-select: none;
      }
    `;
    document.head.appendChild(style);

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber - 1);
    });

    // Cmd/Ctrl+Enter to run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runCode);

    // Dismiss ghost comment on Escape
    editor.addCommand(monaco.KeyCode.Escape, () => {
      clearGhostComments();
    });
  };

  const monacoLanguage = language === "javascript" ? "javascript" : "python";

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900">
        <div className="flex rounded overflow-hidden border border-neutral-700">
          <button
            onClick={() => setLanguage("javascript")}
            className={`px-3 py-1 text-xs ${language === "javascript" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}
          >
            JavaScript
          </button>
          <button
            onClick={() => setLanguage("python")}
            className={`px-3 py-1 text-xs ${language === "python" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}
          >
            Python
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={runCode}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-xs font-medium text-white"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2l10 6-10 6V2z" />
          </svg>
          {isRunning ? "Running…" : "Run"}
          <span className="text-green-300/60 ml-1">⌘↵</span>
        </button>
      </div>

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

      {/* Test results panel */}
      {(lastRunResult || isRunning) && (
        <div className="border-t border-neutral-800 max-h-56 overflow-y-auto">
          <TestResults />
        </div>
      )}
    </div>
  );
}
