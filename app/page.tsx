"use client";

import dynamic from "next/dynamic";
import { ProblemPanel } from "@/components/ProblemPanel";
import { ChatPanel } from "@/components/ChatPanel";

// Monaco must be loaded client-side only
const CodeEditor = dynamic(
  () => import("@/components/CodeEditor").then((m) => m.CodeEditor),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

function EditorSkeleton() {
  return (
    <div className="flex-1 h-full bg-neutral-950 flex items-center justify-center">
      <span className="text-neutral-600 text-sm">Loading editor…</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950">
      {/* Left: Problem description — 280px fixed */}
      <div className="w-[280px] shrink-0 flex flex-col border-r border-neutral-800 overflow-hidden">
        <ProblemPanel />
      </div>

      {/* Center: Code editor — flex-1 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <CodeEditor />
      </div>

      {/* Right: Chat — 320px fixed */}
      <div className="w-[320px] shrink-0 flex flex-col overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  );
}
