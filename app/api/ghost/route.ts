import Anthropic from "@anthropic-ai/sdk";
import { buildAIContext } from "@/lib/context";
import { getGhostSystemPrompt } from "@/lib/system-prompt";
import type { AIContext } from "@/lib/types";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Very lightweight — we want a single short comment, not an essay.
const GHOST_USER_PROMPT = `Look at the code near the cursor (line {{LINE}}).
If there's something genuinely worth noting — an edge case, a subtle bug, a performance concern,
a nice touch — write a single short inline comment (under 80 chars, no leading // or #).
If there's nothing worth saying, respond with exactly: SKIP`;

export async function POST(req: Request) {
  const body = await req.json();
  const { context }: { context: AIContext } = body;

  const contextStr = buildAIContext(context);
  const systemPrompt = getGhostSystemPrompt(contextStr);

  const line = (context.cursorLine ?? 0) + 1;
  const userPrompt = GHOST_USER_PROMPT.replace("{{LINE}}", String(line));

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "SKIP";

  if (text === "SKIP" || text.length === 0) {
    return Response.json({ comment: null });
  }

  // Strip any accidental leading comment markers
  const clean = text.replace(/^[/#\s]+/, "").trim();
  return Response.json({ comment: clean });
}
