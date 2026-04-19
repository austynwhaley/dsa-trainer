import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { code, language } = (await req.json()) as { code: string; language: string };

  if (!code || code.trim().length < 15) {
    return Response.json({ time: "O(?)", space: "O(?)", timeReason: "", spaceReason: "" });
  }

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: `Analyze this ${language} code's time and space complexity.
Return ONLY valid JSON, no other text:
{"time":"O(n)","space":"O(1)","timeReason":"one short sentence","spaceReason":"one short sentence"}

Rules: use standard Big-O notation, "O(?)" if uncertain, reasons under 55 chars each.

\`\`\`${language}
${code.slice(0, 2000)}
\`\`\``,
        },
      ],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const parsed = JSON.parse(jsonMatch[0]) as {
      time: string;
      space: string;
      timeReason: string;
      spaceReason: string;
    };
    return Response.json(parsed);
  } catch {
    return Response.json({ time: "O(?)", space: "O(?)", timeReason: "", spaceReason: "" });
  }
}
