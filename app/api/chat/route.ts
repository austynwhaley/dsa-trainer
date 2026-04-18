import Anthropic from "@anthropic-ai/sdk";
import { buildAIContext } from "@/lib/context";
import { getSystemPrompt } from "@/lib/system-prompt";
import type { AIContext, ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tools the AI can call instead of responding in chat.
// write_to_editor: creates a pending diff in the editor the user accepts/rejects.
// offer_to_write: shows a button in chat offering to write code.
const TOOLS: Anthropic.Tool[] = [
  {
    name: "write_to_editor",
    description: `Write code directly into the user's editor as a pending edit they can accept or reject.
Use this ONLY when the user explicitly asks you to write, implement, or fix something.
The code will animate in like a second person typing, then wait for accept/reject.
Do NOT use this proactively. Explain first in chat; write only when invited.`,
    input_schema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "The complete code for the editor. Replaces the full buffer.",
        },
        explanation: {
          type: "string",
          description: "One sentence shown in chat describing what you wrote.",
        },
      },
      required: ["code", "explanation"],
    },
  },
  {
    name: "offer_to_write",
    description: `After explaining an approach in prose, offer to write the code.
Use at the END of an explanation when the logical next step is to see the code.
This renders a button the user can click to have you write it — never auto-inserts.`,
    input_schema: {
      type: "object" as const,
      properties: {
        button_label: {
          type: "string",
          description: "Short button label, e.g. 'Write the fix' or 'Show me the solution'.",
        },
      },
      required: ["button_label"],
    },
  },
];

// Response event types streamed as NDJSON (one JSON object per line):
// {"type":"text","delta":"..."} — chat text chunk
// {"type":"tool","name":"write_to_editor","input":{code,explanation}} — editor write
// {"type":"tool","name":"offer_to_write","input":{button_label}} — chat offer button

export async function POST(req: Request) {
  const body = await req.json();
  const {
    context,
    messages,
    mode = "friendly",
  }: { context: AIContext; messages: ChatMessage[]; mode?: "direct" | "friendly" } = body;

  const contextStr = buildAIContext(context);
  const systemPrompt = getSystemPrompt(contextStr, mode);

  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: anthropicMessages,
    tools: TOOLS,
  });

  const encoder = new TextEncoder();

  // Track in-progress tool calls by content block index
  const toolBuffers: Record<number, { name: string; json: string }> = {};

  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        for await (const event of stream) {
          if (event.type === "content_block_start") {
            if (event.content_block.type === "tool_use") {
              toolBuffers[event.index] = { name: event.content_block.name, json: "" };
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              send({ type: "text", delta: event.delta.text });
            } else if (event.delta.type === "input_json_delta") {
              if (toolBuffers[event.index]) {
                toolBuffers[event.index].json += event.delta.partial_json;
              }
            }
          } else if (event.type === "content_block_stop") {
            const buf = toolBuffers[event.index];
            if (buf) {
              try {
                const input = JSON.parse(buf.json || "{}");
                send({ type: "tool", name: buf.name, input });
              } catch {
                // malformed tool JSON — skip silently
              }
              delete toolBuffers[event.index];
            }
          }
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
