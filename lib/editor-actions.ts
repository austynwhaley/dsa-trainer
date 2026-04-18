import type * as Monaco from "monaco-editor";

let _editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let _monaco: typeof Monaco | null = null;

let _hlCollection: Monaco.editor.IEditorDecorationsCollection | null = null;
let _noteCollection: Monaco.editor.IEditorDecorationsCollection | null = null;
let _clearTimer: ReturnType<typeof setTimeout> | null = null;
// Track active notes so we can append without losing existing ones
const _activeNotes: Array<{ line: number; text: string }> = [];

export function setEditorAndMonaco(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
) {
  _editor = editor;
  _monaco = monaco;
}

/** Highlight one or more line ranges (1-indexed). Replaces the previous AI highlight. */
export function aiHighlight(ranges: Array<{ start: number; end: number }>) {
  if (!_editor || !_monaco) return;
  const monaco = _monaco;

  const decorations: Monaco.editor.IModelDeltaDecoration[] = ranges.map(({ start, end }) => ({
    range: new monaco.Range(start, 1, end, Number.MAX_SAFE_INTEGER),
    options: {
      isWholeLine: true,
      className: "ai-highlight-line",
      linesDecorationsClassName: "ai-highlight-gutter",
      overviewRuler: {
        color: "#6366f1",
        position: monaco.editor.OverviewRulerLane.Left,
      },
    },
  }));

  if (_hlCollection) {
    _hlCollection.set(decorations);
  } else {
    _hlCollection = _editor.createDecorationsCollection(decorations);
  }

  // Scroll to the first highlighted line
  _editor.revealLineInCenter(ranges[0].start, monaco.editor.ScrollType.Smooth);

  // Auto-clear after 12s of inactivity
  scheduleClear(12000);
}

/** Add an inline note at a specific line (1-indexed). Stacks with existing notes. */
export function aiNote(line: number, text: string) {
  if (!_editor || !_monaco) return;
  const monaco = _monaco;

  _activeNotes.push({ line, text });

  const decorations: Monaco.editor.IModelDeltaDecoration[] = _activeNotes.map((n) => ({
    range: new monaco.Range(n.line, 1, n.line, 1),
    options: {
      after: {
        content: `  // ✦ ${n.text}`,
        inlineClassName: "ai-note-inline",
        cursorStops: monaco.editor.InjectedTextCursorStops.None,
      },
    },
  }));

  if (_noteCollection) {
    _noteCollection.set(decorations);
  } else {
    _noteCollection = _editor.createDecorationsCollection(decorations);
  }

  scheduleClear(12000);
}

/** Clear all AI highlights and notes immediately. */
export function aiClear() {
  if (_clearTimer) {
    clearTimeout(_clearTimer);
    _clearTimer = null;
  }
  _hlCollection?.clear();
  _noteCollection?.clear();
  _activeNotes.length = 0;
}

function scheduleClear(ms: number) {
  if (_clearTimer) clearTimeout(_clearTimer);
  _clearTimer = setTimeout(() => {
    _hlCollection?.clear();
    _noteCollection?.clear();
  }, ms);
}
