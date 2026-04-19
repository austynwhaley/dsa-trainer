"use client";

import { create } from "zustand";
import type {
  Problem,
  Language,
  ChatMessage,
  EditEvent,
  GhostComment,
  RunResult,
  PendingEdit,
  ComplexityEstimate,
  BenchmarkResult,
} from "./types";
import { PROBLEMS } from "./problems";

interface AppState {
  // Problem
  problem: Problem;
  setProblem: (p: Problem) => void;

  // Editor
  language: Language;
  setLanguage: (l: Language) => void;
  code: string;
  setCode: (c: string) => void;
  cursorLine: number;
  setCursorLine: (n: number) => void;

  // Edit history (for AI context)
  editHistory: EditEvent[];
  addEditEvent: (e: EditEvent) => void;

  // Ghost comments
  ghostComments: GhostComment[];
  setGhostComment: (g: GhostComment | null) => void;
  dismissGhostComment: (id: string) => void;
  clearGhostComments: () => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  updateLastAssistantMessage: (text: string) => void;
  clearChat: () => void;

  // Run results
  lastRunResult: RunResult | null;
  setRunResult: (r: RunResult | null) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;

  // Activity tracking for check-in timer
  lastActivityAt: number;
  touchActivity: () => void;

  // AI personality mode
  aiMode: "direct" | "friendly";
  setAiMode: (m: "direct" | "friendly") => void;

  // Pending editor edit — AI wrote something, waiting for accept/reject
  pendingEdit: PendingEdit | null;
  startPendingEdit: (original: string, final: string) => void;
  finishPendingAnimation: () => void;
  acceptPendingEdit: () => void;
  rejectPendingEdit: () => void;

  // Offer-to-write button shown in chat after an explanation
  pendingOffer: { label: string } | null;
  setPendingOffer: (o: { label: string } | null) => void;

  // Complexity estimate (AI-analyzed, debounced)
  complexity: ComplexityEstimate | null;
  complexityLoading: boolean;
  setComplexity: (c: ComplexityEstimate | null) => void;
  setComplexityLoading: (v: boolean) => void;

  // Benchmark
  benchmarkResult: BenchmarkResult | null;
  benchmarkRunning: boolean;
  showBenchmark: boolean;
  setBenchmarkResult: (r: BenchmarkResult | null) => void;
  setBenchmarkRunning: (v: boolean) => void;
  setShowBenchmark: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  problem: PROBLEMS[0],
  setProblem: (p) =>
    set((s) => ({
      problem: p,
      code: p.starterCode[s.language] ?? "",
      editHistory: [],
      ghostComments: [],
      lastRunResult: null,
      lastActivityAt: Date.now(),
    })),

  language: "javascript",
  setLanguage: (l) =>
    set((s) => ({
      language: l,
      code: s.problem.starterCode[l] ?? "",
      editHistory: [],
      ghostComments: [],
      lastActivityAt: Date.now(),
    })),

  code: PROBLEMS[0].starterCode.javascript,
  setCode: (c) => set({ code: c }),

  cursorLine: 0,
  setCursorLine: (n) => set({ cursorLine: n }),

  editHistory: [],
  addEditEvent: (e) =>
    set((s) => ({
      editHistory: [...s.editHistory.slice(-50), e],
      lastActivityAt: Date.now(),
    })),

  ghostComments: [],
  setGhostComment: (g) =>
    set((s) => {
      if (!g) return { ghostComments: [] };
      const filtered = s.ghostComments.filter((c) => c.line !== g.line);
      return { ghostComments: [...filtered, g] };
    }),
  dismissGhostComment: (id) =>
    set((s) => ({ ghostComments: s.ghostComments.filter((c) => c.id !== id) })),
  clearGhostComments: () => set({ ghostComments: [] }),

  chatMessages: [],
  addChatMessage: (m) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, m],
      // Only count non-hidden messages as activity
      lastActivityAt: m.hidden ? s.lastActivityAt : Date.now(),
    })),
  updateLastAssistantMessage: (text) =>
    set((s) => {
      const msgs = [...s.chatMessages];
      // Find the last assistant message (may not be array tail if hidden messages follow)
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant" && !msgs[i].hidden) {
          msgs[i] = { ...msgs[i], content: text };
          break;
        }
      }
      return { chatMessages: msgs };
    }),
  clearChat: () => set({ chatMessages: [] }),

  lastRunResult: null,
  setRunResult: (r) =>
    set({ lastRunResult: r, lastActivityAt: r ? Date.now() : Date.now() }),
  isRunning: false,
  setIsRunning: (v) => set({ isRunning: v }),

  lastActivityAt: Date.now(),
  touchActivity: () => set({ lastActivityAt: Date.now() }),

  aiMode: "direct",
  setAiMode: (m) => set({ aiMode: m }),

  pendingEdit: null,
  startPendingEdit: (original, final) =>
    set({ pendingEdit: { originalCode: original, finalCode: final, isAnimating: true } }),
  finishPendingAnimation: () =>
    set((s) =>
      s.pendingEdit ? { pendingEdit: { ...s.pendingEdit, isAnimating: false } } : {}
    ),
  acceptPendingEdit: () =>
    set((s) => ({
      pendingEdit: null,
      // code is already in the editor; sync the store value
      code: s.pendingEdit?.finalCode ?? s.code,
    })),
  rejectPendingEdit: () =>
    set((s) => ({
      pendingEdit: null,
      // store the original so CodeEditor can revert via value prop
      code: s.pendingEdit?.originalCode ?? s.code,
    })),

  pendingOffer: null,
  setPendingOffer: (o) => set({ pendingOffer: o }),

  complexity: null,
  complexityLoading: false,
  setComplexity: (c) => set({ complexity: c }),
  setComplexityLoading: (v) => set({ complexityLoading: v }),

  benchmarkResult: null,
  benchmarkRunning: false,
  showBenchmark: false,
  setBenchmarkResult: (r) => set({ benchmarkResult: r }),
  setBenchmarkRunning: (v) => set({ benchmarkRunning: v }),
  setShowBenchmark: (v) => set({ showBenchmark: v }),
}));
