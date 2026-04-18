import Anthropic from "@anthropic-ai/sdk";
import type { Problem } from "@/lib/types";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GENERATE_PROMPT = `Generate a DSA problem as a JSON object with this exact shape:
{
  "id": "slug-style-id",
  "title": "Problem Title",
  "difficulty": "easy" | "medium" | "hard",
  "topic": "topic name",
  "description": "markdown description with examples",
  "starterCode": {
    "javascript": "function signature here",
    "python": "def signature here"
  },
  "testCases": [
    { "input": "input as string", "expectedOutput": "expected as string", "description": "optional" }
  ]
}

Rules:
- 3-5 test cases, including at least one edge case
- The description should include clear examples with Input/Output blocks
- Starter code should have just the function signature with empty body
- Test inputs should be parseable as JSON values (arrays, numbers, strings)
- Make it a real problem someone might see in an interview, not a toy

Difficulty: {{DIFFICULTY}}
Topic: {{TOPIC}}

Respond with ONLY the JSON, no explanation, no markdown fences.`;

export async function POST(req: Request) {
  const body = await req.json();
  const { difficulty = "medium", topic = "arrays" } = body;

  const prompt = GENERATE_PROMPT.replace("{{DIFFICULTY}}", difficulty).replace(
    "{{TOPIC}}",
    topic
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  try {
    const problem = JSON.parse(text) as Problem;
    problem.id = problem.id || `generated-${Date.now()}`;
    return Response.json({ problem });
  } catch {
    return Response.json({ error: "Failed to parse generated problem", raw: text }, { status: 500 });
  }
}
