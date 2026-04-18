"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { StreamProcessor } from "@/lib/stream-parser";

// How long (ms) of total silence before the AI checks in.
// 5 minutes feels right: long enough to not interrupt thinking,
// short enough to catch someone stuck.
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

// Minimum code length before we bother checking in.
// Don't interrupt someone who hasn't started yet.
const MIN_CODE_LENGTH = 40;

// How long to wait after a check-in before the next one can fire.
// Prevents repeated nagging if the user stays quiet.
const CHECKIN_COOLDOWN_MS = 8 * 60 * 1000;

const CHECK_INTERVAL_MS = 30_000; // poll every 30s

export function CheckInTimer() {
  const {
    lastActivityAt, code, language, problem,
    editHistory, chatMessages, lastRunResult,
    addChatMessage, updateLastAssistantMessage, aiMode,
  } = useStore();

  const lastCheckInAt = useRef<number>(0);
  const streamingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (streamingRef.current) return;

      const now = Date.now();
      const idleMs = now - lastActivityAt;
      const sinceLastCheckIn = now - lastCheckInAt.current;

      // Not idle long enough
      if (idleMs < IDLE_THRESHOLD_MS) return;

      // Too soon after the last check-in
      if (sinceLastCheckIn < CHECKIN_COOLDOWN_MS) return;

      // Nothing written yet — don't interrupt
      if (code.trim().length < MIN_CODE_LENGTH) return;

      // All tests passing — they're done, not stuck
      const allPassed =
        lastRunResult &&
        lastRunResult.results.length > 0 &&
        lastRunResult.results.every((r) => r.passed);
      if (allPassed) return;

      lastCheckInAt.current = now;
      streamingRef.current = true;

      // Build idle duration string for the AI
      const idleMinutes = Math.round(idleMs / 60_000);
      const idleStr = idleMinutes === 1 ? "about a minute" : `about ${idleMinutes} minutes`;

      // Hidden trigger message — instructs the AI, not shown in UI
      const triggerMsg = {
        role: "user" as const,
        content: `[check-in: the user has been idle for ${idleStr}. Send a single short message asking if they need any suggestions or help. Keep it casual — one sentence, like a colleague glancing over. Don't be alarming.]`,
        timestamp: now,
        hidden: true,
      };

      // Placeholder assistant message (visible)
      const assistantMsg = {
        role: "assistant" as const,
        content: "",
        timestamp: now,
        hidden: false,
      };

      addChatMessage(triggerMsg);
      addChatMessage(assistantMsg);

      const context = {
        problem: { title: problem.title, description: problem.description, difficulty: problem.difficulty },
        code,
        language,
        recentEdits: editHistory.slice(-8),
        chatHistory: chatMessages.filter((m) => !m.hidden).slice(-6),
        lastRunResult: lastRunResult ?? undefined,
      };

      // Include the trigger in the messages sent to the API, but exclude prior hidden messages
      const apiMessages = [
        ...chatMessages.filter((m) => !m.hidden).slice(-6),
        triggerMsg,
      ];

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context, messages: apiMessages, mode: aiMode }),
        });

        if (!res.body) throw new Error("No body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const processor = new StreamProcessor();
        let buf = "";
        let accText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed) as { type: string; delta?: string };
              if (event.type === "text" && event.delta) {
                accText += event.delta;
                updateLastAssistantMessage(processor.feed(accText));
              }
              // check-in never triggers editor writes
            } catch { /* ignore */ }
          }
        }
      } catch {
        // silently drop failed check-ins
        updateLastAssistantMessage("(check-in failed)");
      } finally {
        streamingRef.current = false;
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    lastActivityAt, code, language, problem,
    editHistory, chatMessages, lastRunResult,
    addChatMessage, updateLastAssistantMessage,
  ]);

  return null; // no UI — purely behavioral
}
