"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { animateCodeIntoEditor } from "@/lib/editor-ref";
import { StreamProcessor } from "@/lib/stream-parser";
import type { AIContext, ChatMessage } from "@/lib/types";

// --- Segment parser for rendering code blocks in chat ---
interface TextSegment { type: "text"; content: string }
interface CodeSegment { type: "code"; lang: string; content: string }
type Segment = TextSegment | CodeSegment;

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) segments.push({ type: "text", content: text.slice(last, match.index) });
    segments.push({ type: "code", lang: match[1] || "text", content: match[2].trimEnd() });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", content: text.slice(last) });
  return segments.length ? segments : [{ type: "text", content: text }];
}

// Code block in chat — shows "Insert into editor" button that creates a pending edit
function CodeBlock({ code, lang, streaming }: { code: string; lang: string; streaming: boolean }) {
  const { startPendingEdit, code: currentCode, finishPendingAnimation, setCode } = useStore();
  const [inserting, setInserting] = useState(false);

  function insertIntoEditor() {
    if (inserting) return;
    setInserting(true);
    startPendingEdit(currentCode, code);
    animateCodeIntoEditor(code, (final) => {
      setCode(final);
      finishPendingAnimation();
      setInserting(false);
    });
  }

  return (
    <div className="mt-2 mb-1 rounded-md overflow-hidden border border-neutral-700">
      <div className="flex items-center justify-between px-3 py-1 bg-neutral-900 border-b border-neutral-700">
        <span className="text-xs text-neutral-500">{lang || "code"}</span>
        {!streaming && (
          <button onClick={insertIntoEditor} disabled={inserting}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors">
            {inserting
              ? <><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />writing…</>
              : <>
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 2h8l4 4v8H2V2z" opacity=".3"/>
                    <path d="M10 2v4h4M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                  </svg>
                  Insert into editor
                </>
            }
          </button>
        )}
      </div>
      <pre className="px-3 py-2 text-xs font-mono text-neutral-200 overflow-x-auto bg-neutral-950 leading-5 whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

// Offer-to-write button rendered after an AI explanation
function OfferButton({ label, onAccept }: { label: string; onAccept: () => void }) {
  return (
    <button
      onClick={onAccept}
      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-800/50 hover:bg-emerald-700/60 border border-emerald-700/50 text-emerald-300 text-xs font-medium transition-colors"
    >
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 2h10v2H5v8h8v2H3V2z" opacity=".4"/>
        <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
      {label}
    </button>
  );
}

function MessageContent({ msg, isLast, streaming }: { msg: ChatMessage; isLast: boolean; streaming: boolean }) {
  if (msg.role === "user") return <span className="whitespace-pre-wrap">{msg.content}</span>;
  if (!msg.content) return <span className="text-neutral-500">…</span>;

  const segments = parseSegments(msg.content);
  return (
    <>
      {segments.map((seg, i) => {
        const isLastSeg = isLast && i === segments.length - 1;
        if (seg.type === "code") {
          return <CodeBlock key={i} code={seg.content} lang={seg.lang} streaming={streaming} />;
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {seg.content}
            {isLastSeg && streaming && (
              <span className="inline-block w-1 h-3 bg-neutral-400 ml-0.5 animate-pulse align-middle" />
            )}
          </span>
        );
      })}
    </>
  );
}

export function ChatPanel() {
  const {
    chatMessages, addChatMessage, updateLastAssistantMessage, clearChat,
    problem, code, language, editHistory, lastRunResult, cursorLine,
    aiMode, setAiMode,
    pendingOffer, setPendingOffer,
    startPendingEdit, finishPendingAnimation, setCode,
  } = useStore();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, pendingOffer]);

  const buildContext = useCallback((): AIContext => ({
    problem: { title: problem.title, description: problem.description, difficulty: problem.difficulty },
    code, language,
    recentEdits: editHistory.slice(-10),
    chatHistory: chatMessages.slice(-8),
    lastRunResult: lastRunResult ?? undefined,
    cursorLine,
  }), [problem, code, language, editHistory, chatMessages, lastRunResult, cursorLine]);

  // Core send — handles NDJSON stream, dispatches text/tool events
  const sendMessage = useCallback(async (text: string, hidden = false) => {
    if (!text.trim() || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now(), hidden };
    addChatMessage(userMsg);
    if (!hidden) setInput("");
    setPendingOffer(null);

    const assistantMsg: ChatMessage = { role: "assistant", content: "", timestamp: Date.now() };
    addChatMessage(assistantMsg);
    setStreaming(true);

    const context = buildContext();
    const messages = [...chatMessages.filter((m) => !m.hidden), userMsg];
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({ context, messages, mode: aiMode }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const processor = new StreamProcessor();
      let buf = "";
      let accText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Process complete NDJSON lines
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: { type: string; delta?: string; name?: string; input?: Record<string, string> };
          try { event = JSON.parse(trimmed); } catch { continue; }

          if (event.type === "text" && event.delta) {
            accText += event.delta;
            updateLastAssistantMessage(processor.feed(accText));
          } else if (event.type === "tool" && event.name && event.input) {
            if (event.name === "write_to_editor") {
              const { code: newCode, explanation } = event.input;
              if (explanation) {
                // Append explanation to the chat message
                updateLastAssistantMessage((processor.feed(accText) || "") + `\n\n*${explanation}*`);
              }
              // Start pending edit
              const currentCode = useStore.getState().code;
              startPendingEdit(currentCode, newCode);
              animateCodeIntoEditor(newCode, (final) => {
                setCode(final);
                finishPendingAnimation();
              });
            } else if (event.name === "offer_to_write") {
              setPendingOffer({ label: event.input.button_label });
            }
          }
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name !== "AbortError") updateLastAssistantMessage("(Something went wrong. Check your API key.)");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, addChatMessage, updateLastAssistantMessage, chatMessages, buildContext,
      aiMode, setPendingOffer, startPendingEdit, finishPendingAnimation, setCode]);

  // When user clicks the offer button — send a hidden "write it" trigger
  const acceptOffer = useCallback(() => {
    sendMessage("write it", true);
  }, [sendMessage]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  }

  const visibleMessages = chatMessages.filter((m) => !m.hidden);

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-xs text-neutral-400">pair programmer</span>
        </div>
        <div className="flex items-center gap-2">
          {visibleMessages.length > 0 && (
            <button onClick={clearChat} title="Clear chat"
              className="text-neutral-600 hover:text-neutral-300 transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <div className="flex rounded overflow-hidden border border-neutral-700">
            <button onClick={() => setAiMode("friendly")}
              className={`px-2 py-1 text-xs transition-colors ${aiMode === "friendly" ? "bg-blue-600 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"}`}>
              friendly
            </button>
            <button onClick={() => setAiMode("direct")}
              className={`px-2 py-1 text-xs transition-colors ${aiMode === "direct" ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"}`}>
              direct
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {visibleMessages.length === 0 && (
          <div className="text-neutral-600 text-xs leading-relaxed">
            <p>I&apos;m here. I can see your code.</p>
            <p className="mt-2">Ask me anything — if you want me to write something, just ask and I&apos;ll type it directly into the editor.</p>
          </div>
        )}

        {visibleMessages.map((msg, i, arr) => {
          const isLast = i === arr.length - 1;
          return (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[92%] text-sm leading-relaxed rounded-lg px-3 py-2
                ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-100"}
                ${msg.role === "assistant" && !msg.content && streaming ? "animate-pulse" : ""}`}>
                <MessageContent msg={msg} isLast={isLast} streaming={streaming} />
              </div>
              {/* Offer button appears below last assistant message */}
              {isLast && msg.role === "assistant" && !streaming && pendingOffer && (
                <OfferButton label={pendingOffer.label} onAccept={acceptOffer} />
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-neutral-800">
        <div className="flex items-end gap-2 bg-neutral-800 rounded-lg px-3 py-2">
          <textarea ref={textareaRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
            placeholder="Ask something… (Enter to send)" rows={1} disabled={streaming}
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 resize-none outline-none leading-5"
            style={{ maxHeight: "120px" }} />
          {streaming
            ? <button onClick={() => abortRef.current?.abort()} className="text-neutral-400 hover:text-white text-xs shrink-0 pb-0.5">stop</button>
            : <button onClick={() => sendMessage(input)} disabled={!input.trim()}
                className="text-neutral-400 hover:text-white disabled:opacity-30 shrink-0 pb-0.5">
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M2 14L14 8 2 2v4.5l8 1.5-8 1.5V14z" /></svg>
              </button>
          }
        </div>
        <p className="text-neutral-600 text-xs mt-1 px-1">Shift+Enter for newline</p>
      </div>
    </div>
  );
}
