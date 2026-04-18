# DSA Trainer

A pair-programming trainer for data structures & algorithms. An AI collaborator
watches you code in real time and behaves like a senior engineer sitting next to
you — it can type directly into the editor, highlight lines while it explains,
leave inline ghost comments, and proactively check in if you've been stuck.

## Quick start

```bash
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local

npm install
npm run dev
# Open http://localhost:3000
```

**Language requirements:**
- JavaScript runs entirely in the browser (no setup needed)
- Python requires `python3` on your PATH
- Java requires a JDK — `sudo apt install default-jdk` (or equivalent)

## Features

### AI that writes in the editor
When you ask the AI to write or fix code, it types directly into the editor as a
pending edit — character by character, like a second person at the keyboard.
You see a green overlay while it types, then Accept (⌘↵) or Reject (Esc) the change.

### Live highlighting
While the AI explains something in chat, it highlights the relevant lines in the
editor in real time as the message streams. `[[hl:8]]` highlights line 8,
`[[note:8:text]]` leaves an amber annotation.

### Ghost comments
After ~4 seconds of typing silence, a faint inline annotation appears on the
current line — a quick thought from the AI about what it sees. Disappears when
you start typing. Haiku-powered (fast, cheap).

### Check-in timer
If you've been idle for 5+ minutes and tests aren't all passing, the AI sends a
short message asking if you need help. 8-minute cooldown so it doesn't nag.

### Personality toggle
Switch between **direct** (default) and **friendly** modes in the chat header.
Both stay concise (1–3 sentences). Direct is opinionated and terse; friendly is
warmer and more willing to give hints.

## Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | Next.js (App Router) | API routes for streaming + server-side Anthropic calls |
| Editor | Monaco Editor | VS Code's editor — stable decoration API for ghost comments and pending edits |
| Styling | Tailwind CSS v4 | Fast iteration, no CSS files |
| State | Zustand | Lightweight global store, no boilerplate |
| LLM | Anthropic SDK (`claude-sonnet-4-6`) | Streaming + tool use, best code reasoning |
| Ghost comments | `claude-haiku-4-5` | Fast/cheap for the high-frequency ghost endpoint |
| JS execution | Web Worker (in-browser) | Zero latency, fully isolated |
| Python execution | `python3` subprocess | Simpler than Pyodide, no 50MB WASM download |
| Java execution | `javac` + `java` subprocess | Compile and run in a temp dir, cleaned up after each run |
| Deploy | Vercel | Zero-config with Next.js, handles streaming natively |
| Database | None | Single-player, local-first — no persistence needed |

## Architecture

```
app/
  page.tsx              — Three-panel layout (problem | editor | chat)
  api/
    chat/               — NDJSON streaming chat; emits text and tool-call events
    ghost/              — Ghost comment generation (debounced, Haiku)
    generate-problem/   — AI problem generation
    run-code/           — Server-side execution (Python + Java); JS runs client-side

components/
  CodeEditor.tsx        — Monaco wrapper, pending-edit overlay, ghost comments, run button
  ChatPanel.tsx         — Streaming chat UI with offer-to-write buttons and code block insertion
  CheckInTimer.tsx      — Background timer that triggers AI check-ins on idle
  ProblemPanel.tsx      — Problem description + problem switcher

lib/
  store.ts              — Zustand global state
  types.ts              — Shared types (Language, ChatMessage, PendingEdit, …)
  problems.ts           — 10 hardcoded problems (JS + Python + Java starter code)
  editor-ref.ts         — Shared Monaco instance + character-by-character animation
  editor-actions.ts     — aiHighlight(), aiNote(), aiClear() decoration helpers
  stream-parser.ts      — Stateful StreamProcessor: fires [[hl:]] markers exactly once per stream

prompts/
  system.md             — Direct mode AI personality
  system-friendly.md    — Friendly mode AI personality

public/workers/
  js-runner.js          — JavaScript Web Worker for in-browser execution
```

## How the AI writes in the editor

The chat API uses Anthropic tool use with two tools:

- **`write_to_editor`** — called when the user asks the AI to write or fix code.
  The code animates into the editor as a pending edit. The user sees Accept/Reject.
- **`offer_to_write`** — called at the end of an explanation. Renders a button in
  chat the user can click to trigger a `write_to_editor` follow-up.

The animation finds the diff region between old and new code (shared prefix/suffix),
then types only the changed middle portion using `model.applyEdits()` at ~60fps.
Position is tracked by absolute offset to avoid cursor drift.

## The system prompt

`prompts/system.md` (direct) and `prompts/system-friendly.md` (friendly) are loaded
at runtime — edit them and changes take effect on the next API call, no restart needed.

Key behavioral rules encoded in the prompts:
- **Two surfaces:** chat is for explaining, the editor tool is for writing code.
  The AI never dumps runnable code into chat expecting copy-paste.
- **`[[hl:LINE]]` markers** fire live as the message streams, highlighting lines
  in the editor while the AI talks about them.
- **Ghost mode:** when generating inline comments, the AI responds with only the
  comment text — no preamble, under 80 chars, specific to the exact line.

## Adding problems

Problems live in `lib/problems.ts`. Each needs starter code for all three languages:

```typescript
{
  id: "slug",
  title: "Problem Title",
  difficulty: "easy" | "medium" | "hard",
  topic: "arrays",
  description: "markdown string",
  starterCode: { javascript: "...", python: "...", java: "..." },
  testCases: [{ input: "...", expectedOutput: "..." }],
}
```

Test inputs are parsed as `JSON.parse("[" + input + "]")` and spread as arguments,
so `input: "[1,2,3], 9"` → `fn([1,2,3], 9)`.

You can also generate problems with AI via the "Change" tab in the problem panel.

## Known limitations

- **JavaScript test runner** uses a function-name allowlist in `public/workers/js-runner.js`.
  Custom problems with different function names may not auto-detect — add the name to the switch.
- **Java runner** requires `javac`/`java` on the server PATH. Compilation errors show
  inline in the test results panel.
- **Python/Java runners** have no sandboxing beyond a timeout. Don't run untrusted code.
- **No session persistence.** Refreshing clears everything.
- **Switching language** resets the code buffer to the starter code for that language.
