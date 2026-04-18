import fs from "fs";
import path from "path";

type Mode = "direct" | "friendly";

const cache: Record<Mode, string | null> = { direct: null, friendly: null };

function loadPrompt(mode: Mode): string {
  if (!cache[mode]) {
    const file = mode === "friendly" ? "system-friendly.md" : "system.md";
    cache[mode] = fs.readFileSync(path.join(process.cwd(), "prompts", file), "utf-8");
  }
  return cache[mode]!;
}

export function getSystemPrompt(context: string, mode: Mode = "direct"): string {
  return loadPrompt(mode).replace("{{CONTEXT}}", context);
}

export function getGhostSystemPrompt(context: string, mode: Mode = "direct"): string {
  return (
    getSystemPrompt(context, mode) +
    "\n\nIMPORTANT: You are responding in ghost comment mode. Reply with ONLY the comment text — no leading // or #, no explanation, no preamble. One line, under 80 chars."
  );
}
