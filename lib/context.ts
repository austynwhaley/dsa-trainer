import type { AIContext } from "./types";

/**
 * Builds a structured context string to pass to the AI.
 * Kept concise so it fits cleanly in the prompt without overwhelming it.
 */
export function buildAIContext(ctx: AIContext): string {
  const parts: string[] = [];

  parts.push(`PROBLEM: ${ctx.problem.title} (${ctx.problem.difficulty})`);
  parts.push(`\n${ctx.problem.description}`);

  parts.push(`\n---\nLANGUAGE: ${ctx.language}`);
  parts.push(`\nCURRENT CODE:\n\`\`\`${ctx.language}\n${ctx.code || "(empty)"}\n\`\`\``);

  if (ctx.cursorLine !== undefined) {
    parts.push(`\nCURSOR: line ${ctx.cursorLine + 1}`);
  }

  if (ctx.recentEdits.length > 0) {
    const editSummary = ctx.recentEdits
      .slice(-8)
      .map((e) => `  • line ${e.line + 1}: ${e.summary}`)
      .join("\n");
    parts.push(`\nRECENT EDITS (last ${Math.min(8, ctx.recentEdits.length)}):\n${editSummary}`);
  }

  if (ctx.lastRunResult) {
    const r = ctx.lastRunResult;
    if (r.error) {
      parts.push(`\nLAST RUN: ERROR\n${r.error}`);
    } else {
      const passed = r.results.filter((t) => t.passed).length;
      const total = r.results.length;
      parts.push(`\nLAST RUN: ${passed}/${total} tests passed`);
      const failed = r.results.filter((t) => !t.passed);
      if (failed.length > 0) {
        const failDetails = failed
          .slice(0, 3)
          .map((t) => `  • Input: ${t.input} → got ${t.actualOutput}, expected ${t.expectedOutput}`)
          .join("\n");
        parts.push(failDetails);
      }
      if (r.stdout) {
        parts.push(`  stdout: ${r.stdout.slice(0, 200)}`);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Summarize a code change for the edit history.
 * Keeps it short — just enough for the AI to understand what changed.
 */
export function summarizeEdit(
  oldLine: string,
  newLine: string,
  lineNum: number
): string {
  const o = oldLine.trim();
  const n = newLine.trim();
  if (!o && n) return `added: ${n.slice(0, 60)}`;
  if (o && !n) return `deleted line`;
  if (o !== n) return `changed to: ${n.slice(0, 60)}`;
  return `modified`;
}
