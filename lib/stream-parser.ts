import { aiHighlight, aiNote, aiClear } from "./editor-actions";

// Matches [[...]] where the content may contain single ] (e.g. nums[0])
// but not ]]. Uses: ] only allowed if NOT followed by another ].
const MARKER_RE = /\[\[((?:[^\]]|\](?!\]))*)\]\]/g;

/**
 * Stateful stream processor — one instance per assistant message.
 * Tracks how far into the raw buffer we've already executed markers,
 * so each [[action]] fires exactly once even though we re-call feed()
 * on every streaming chunk.
 */
export class StreamProcessor {
  private executedUpTo = 0;

  feed(fullRaw: string): string {
    const newPart = fullRaw.slice(this.executedUpTo);

    // Detect a partial (unclosed) marker at the tail of newPart
    const lastOpen = newPart.lastIndexOf("[[");
    const hasPartial = lastOpen !== -1 && !newPart.slice(lastOpen).match(/\]\]/);

    // Only execute markers in the safe portion (before any partial marker)
    const safePart = hasPartial ? newPart.slice(0, lastOpen) : newPart;

    MARKER_RE.lastIndex = 0;
    safePart.replace(MARKER_RE, (_, inner: string) => {
      executeMarker(inner.trim());
      return "";
    });

    this.executedUpTo += safePart.length;

    // Return display text with all complete markers stripped + partial hidden
    MARKER_RE.lastIndex = 0;
    return fullRaw
      .replace(MARKER_RE, "")
      .replace(/\[\[(?:[^\]]|\](?!\]))*$/, ""); // hide trailing partial
  }
}

function executeMarker(inner: string) {
  if (inner === "clear") {
    aiClear();
    return;
  }

  if (inner.startsWith("hl:")) {
    const ranges: Array<{ start: number; end: number }> = [];
    for (const r of inner.slice(3).split(",").map((s) => s.trim())) {
      if (r.includes("-")) {
        const [a, b] = r.split("-").map(Number);
        if (!isNaN(a) && !isNaN(b)) ranges.push({ start: a, end: b });
      } else {
        const n = Number(r);
        if (!isNaN(n)) ranges.push({ start: n, end: n });
      }
    }
    if (ranges.length) aiHighlight(ranges);
    return;
  }

  if (inner.startsWith("note:")) {
    const rest = inner.slice(5);
    const colonIdx = rest.indexOf(":");
    if (colonIdx === -1) return;
    const line = Number(rest.slice(0, colonIdx));
    const text = rest.slice(colonIdx + 1).trim();
    if (!isNaN(line) && text) aiNote(line, text);
    return;
  }
}
