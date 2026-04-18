"use client";

import { create } from "zustand";
import type {
  Problem,
  Language,
  ChatMessage,
  EditEvent,
  GhostComment,
  RunResult,
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

  // Run results
  lastRunResult: RunResult | null;
  setRunResult: (r: RunResult | null) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  problem: PROBLEMS[0],
  setProblem: (p) =>
    set((s) => ({
      problem: p,
      code: p.starterCode[s.language],
      editHistory: [],
      ghostComments: [],
      lastRunResult: null,
    })),

  language: "javascript",
  setLanguage: (l) =>
    set((s) => ({
      language: l,
      code: s.problem.starterCode[l],
      editHistory: [],
      ghostComments: [],
    })),

  code: PROBLEMS[0].starterCode.javascript,
  setCode: (c) => set({ code: c }),

  cursorLine: 0,
  setCursorLine: (n) => set({ cursorLine: n }),

  editHistory: [],
  addEditEvent: (e) =>
    set((s) => ({
      editHistory: [...s.editHistory.slice(-50), e],
    })),

  ghostComments: [],
  setGhostComment: (g) =>
    set((s) => {
      if (!g) return { ghostComments: [] };
      // Replace any existing comment on same line
      const filtered = s.ghostComments.filter((c) => c.line !== g.line);
      return { ghostComments: [...filtered, g] };
    }),
  dismissGhostComment: (id) =>
    set((s) => ({ ghostComments: s.ghostComments.filter((c) => c.id !== id) })),
  clearGhostComments: () => set({ ghostComments: [] }),

  chatMessages: [],
  addChatMessage: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),
  updateLastAssistantMessage: (text) =>
    set((s) => {
      const msgs = [...s.chatMessages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: text };
      }
      return { chatMessages: msgs };
    }),

  lastRunResult: null,
  setRunResult: (r) => set({ lastRunResult: r }),
  isRunning: false,
  setIsRunning: (v) => set({ isRunning: v }),
}));
