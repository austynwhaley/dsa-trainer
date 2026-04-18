"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { AIContext } from "@/lib/types";

export function ChatPanel() {
  const {
    chatMessages, addChatMessage, updateLastAssistantMessage,
    problem, code, language, editHistory, lastRunResult, cursorLine,
  } = useStore();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const buildContext = useCallback((): AIContext => ({
    problem: { title: problem.title, description: problem.description, difficulty: problem.difficulty },
    code,
    language,
    recentEdits: editHistory.slice(-10),
    chatHistory: chatMessages.slice(-8),
    lastRunResult: lastRunResult ?? undefined,
    cursorLine,
  }), [problem, code, language, editHistory, chatMessages, lastRunResult, cursorLine]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg = { role: "user" as const, content: text, timestamp: Date.now() };
    addChatMessage(userMsg);
    setInput("");

    // placeholder for streaming response
    const assistantMsg = { role: "assistant" as const, content: "", timestamp: Date.now() };
    addChatMessage(assistantMsg);
    setStreaming(true);

    const context = buildContext();
    const messages = [...chatMessages, userMsg];

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({ context, messages }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        updateLastAssistantMessage(accumulated);
      }
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name !== "AbortError") {
        updateLastAssistantMessage("(Something went wrong. Check your API key.)");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, addChatMessage, updateLastAssistantMessage, chatMessages, buildContext]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleAbort() {
    abortRef.current?.abort();
  }

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-l border-neutral-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-neutral-400">pair programmer</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {chatMessages.length === 0 && (
          <div className="text-neutral-600 text-xs leading-relaxed">
            <p>I'm here. I can see your code.</p>
            <p className="mt-2">Ask me anything, or just start coding — I'll chime in if I notice something worth mentioning.</p>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`
                max-w-[85%] text-sm leading-relaxed rounded-lg px-3 py-2
                ${msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-100"
                }
                ${msg.role === "assistant" && !msg.content && streaming ? "animate-pulse" : ""}
              `}
            >
              {msg.role === "assistant" && !msg.content ? (
                <span className="text-neutral-500">…</span>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
              {msg.role === "assistant" && streaming && i === chatMessages.length - 1 && (
                <span className="inline-block w-1 h-3 bg-neutral-400 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-neutral-800">
        <div className="flex items-end gap-2 bg-neutral-800 rounded-lg px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask something… (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 resize-none outline-none leading-5"
            style={{ maxHeight: "120px" }}
            disabled={streaming}
          />
          {streaming ? (
            <button
              onClick={handleAbort}
              className="text-neutral-400 hover:text-white text-xs shrink-0 pb-0.5"
            >
              stop
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="text-neutral-400 hover:text-white disabled:opacity-30 shrink-0 pb-0.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 14L14 8 2 2v4.5l8 1.5-8 1.5V14z" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-neutral-600 text-xs mt-1 px-1">Shift+Enter for newline</p>
      </div>
    </div>
  );
}
