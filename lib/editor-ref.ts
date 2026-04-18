import type * as Monaco from "monaco-editor";

let _editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let _monaco: typeof Monaco | null = null;

// When true, CodeEditor's onChange handler skips edit-history tracking
export let isAnimating = false;

export function setEditorInstance(
  e: Monaco.editor.IStandaloneCodeEditor,
  m: typeof Monaco
) {
  _editor = e;
  _monaco = m;
}

/**
 * Animate code into the editor like a second person typing.
 *
 * - Finds where old and new code diverge
 * - Moves cursor there, pauses briefly, deletes only the old region
 * - Types the new content character-by-character at ~60fps
 * - Calls onDone(finalCode) when complete
 *
 * Does NOT call a progress callback during animation — doing so would
 * cause Monaco's controlled `value` prop to re-set the buffer mid-animation.
 */
export function animateCodeIntoEditor(
  newCode: string,
  onDone: (finalCode: string) => void
) {
  const editor = _editor;
  const monaco = _monaco;
  if (!editor || !monaco) {
    onDone(newCode);
    return;
  }

  const model = editor.getModel();
  if (!model) {
    editor.setValue(newCode);
    onDone(newCode);
    return;
  }

  const oldCode = model.getValue();

  // Find shared prefix
  let prefixLen = 0;
  const minLen = Math.min(oldCode.length, newCode.length);
  while (prefixLen < minLen && oldCode[prefixLen] === newCode[prefixLen]) prefixLen++;

  // Find shared suffix (without overlapping prefix)
  let oldSuffixStart = oldCode.length;
  let newSuffixStart = newCode.length;
  while (
    oldSuffixStart > prefixLen &&
    newSuffixStart > prefixLen &&
    oldCode[oldSuffixStart - 1] === newCode[newSuffixStart - 1]
  ) {
    oldSuffixStart--;
    newSuffixStart--;
  }

  const newMiddle = newCode.slice(prefixLen, newSuffixStart);

  if (oldCode === newCode) {
    onDone(newCode);
    return;
  }

  isAnimating = true;
  editor.updateOptions({ readOnly: true });

  const startPos = model.getPositionAt(prefixLen);
  const oldEndPos = model.getPositionAt(oldSuffixStart);

  editor.setPosition(startPos);
  editor.revealPositionInCenter(startPos, monaco.editor.ScrollType.Smooth);

  setTimeout(() => {
    // Delete old region in one shot
    model.applyEdits([{
      range: new monaco.Range(
        startPos.lineNumber, startPos.column,
        oldEndPos.lineNumber, oldEndPos.column
      ),
      text: "",
    }]);

    // Type new content — track position by absolute offset to avoid cursor drift
    const CHARS = 4;
    const MS = 16;
    let typed = 0;

    const interval = setInterval(() => {
      if (typed >= newMiddle.length) {
        clearInterval(interval);
        isAnimating = false;
        editor.updateOptions({ readOnly: false });
        editor.focus();
        const finalPos = model.getPositionAt(prefixLen + newMiddle.length);
        editor.setPosition(finalPos);
        onDone(model.getValue());
        return;
      }

      const chunk = newMiddle.slice(typed, typed + CHARS);
      const insertPos = model.getPositionAt(prefixLen + typed);
      typed += chunk.length;

      model.applyEdits([{
        range: new monaco.Range(insertPos.lineNumber, insertPos.column, insertPos.lineNumber, insertPos.column),
        text: chunk,
      }]);
      const newPos = model.getPositionAt(prefixLen + typed);
      editor.setPosition(newPos);
      editor.revealPosition(newPos);
    }, MS);
  }, 180);
}
