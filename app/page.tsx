"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect } from "react";
import { ProblemPanel } from "@/components/ProblemPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { CheckInTimer } from "@/components/CheckInTimer";

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

const MIN_PANEL = 180;
const DEFAULT_LEFT = 280;
const DEFAULT_RIGHT = 320;

function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;

    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      onDrag(e.clientX - lastX.current);
      lastX.current = e.clientX;
    }
    function onUp() {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onDrag]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 shrink-0 cursor-col-resize bg-neutral-800 hover:bg-blue-500/60 active:bg-blue-500 transition-colors select-none"
      style={{ touchAction: "none" }}
    />
  );
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);

  const getContainerWidth = () => containerRef.current?.offsetWidth ?? window.innerWidth;

  const handleLeftDrag = useCallback((dx: number) => {
    setLeftWidth((w) => {
      const containerW = getContainerWidth();
      const newW = w + dx;
      const centerMin = MIN_PANEL;
      const maxLeft = containerW - rightWidth - centerMin - 2; // 2 handles
      return Math.max(MIN_PANEL, Math.min(newW, maxLeft));
    });
  }, [rightWidth]);

  const handleRightDrag = useCallback((dx: number) => {
    setRightWidth((w) => {
      const containerW = getContainerWidth();
      const newW = w - dx;
      const centerMin = MIN_PANEL;
      const maxRight = containerW - leftWidth - centerMin - 2;
      return Math.max(MIN_PANEL, Math.min(newW, maxRight));
    });
  }, [leftWidth]);

  // Reset on window resize so panels don't overflow
  useEffect(() => {
    function onResize() {
      const w = window.innerWidth;
      setLeftWidth((l) => Math.min(l, w - rightWidth - MIN_PANEL - 2));
      setRightWidth((r) => Math.min(r, w - leftWidth - MIN_PANEL - 2));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [leftWidth, rightWidth]);

  return (
    <div ref={containerRef} className="flex h-screen w-screen overflow-hidden bg-neutral-950 select-none">
      <CheckInTimer />
      {/* Left: Problem */}
      <div style={{ width: leftWidth }} className="shrink-0 flex flex-col overflow-hidden border-r border-neutral-800">
        <ProblemPanel />
      </div>

      <ResizeHandle onDrag={handleLeftDrag} />

      {/* Center: Editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <CodeEditor />
      </div>

      <ResizeHandle onDrag={handleRightDrag} />

      {/* Right: Chat */}
      <div style={{ width: rightWidth }} className="shrink-0 flex flex-col overflow-hidden border-l border-neutral-800">
        <ChatPanel />
      </div>
    </div>
  );
}
