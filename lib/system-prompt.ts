import fs from "fs";
import path from "path";

let cached: string | null = null;

export function getSystemPrompt(context: string): string {
  // In production, Next.js bundles don't always have fs — read once and cache.
  if (!cached) {
    const promptPath = path.join(process.cwd(), "prompts", "system.md");
    cached = fs.readFileSync(promptPath, "utf-8");
  }
  return cached.replace("{{CONTEXT}}", context);
}

export function getGhostSystemPrompt(context: string): string {
  const base = getSystemPrompt(context);
  return (
    base +
    "\n\nIMPORTANT: You are responding in ghost comment mode. Reply with ONLY the comment text — no leading // or #, no explanation, no preamble. One line, under 80 chars."
  );
}
