"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PROBLEMS } from "@/lib/problems";
import type { Problem } from "@/lib/types";

// Minimal markdown renderer for problem descriptions
function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-neutral-900 rounded p-3 text-sm my-2 overflow-x-auto"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-800 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

interface GenerateOptions {
  difficulty: "easy" | "medium" | "hard";
  topic: string;
}

export function ProblemPanel() {
  const { problem, setProblem } = useStore();
  const [tab, setTab] = useState<"description" | "select">("description");
  const [generating, setGenerating] = useState(false);
  const [genOptions, setGenOptions] = useState<GenerateOptions>({
    difficulty: "medium",
    topic: "arrays",
  });
  const [importText, setImportText] = useState("");
  const [error, setError] = useState("");

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/generate-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genOptions),
      });
      const data = await res.json();
      if (data.problem) {
        setProblem(data.problem as Problem);
        setTab("description");
      } else {
        setError("Generation failed. Try again.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setGenerating(false);
    }
  }

  function handleImport() {
    try {
      const parsed = JSON.parse(importText) as Problem;
      if (!parsed.id || !parsed.title) throw new Error("Missing fields");
      setProblem(parsed);
      setImportText("");
      setTab("description");
    } catch {
      setError("Invalid problem JSON.");
    }
  }

  const difficultyColor = {
    easy: "text-green-400",
    medium: "text-yellow-400",
    hard: "text-red-400",
  }[problem.difficulty];

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold leading-tight">{problem.title}</h2>
          <span className={`text-xs ${difficultyColor} capitalize`}>
            {problem.difficulty} · {problem.topic}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("description")}
            className={`px-2 py-1 text-xs rounded ${tab === "description" ? "bg-neutral-700" : "hover:bg-neutral-800"}`}
          >
            Problem
          </button>
          <button
            onClick={() => setTab("select")}
            className={`px-2 py-1 text-xs rounded ${tab === "select" ? "bg-neutral-700" : "hover:bg-neutral-800"}`}
          >
            Change
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "description" && (
          <div
            className="px-4 py-4 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.description) }}
          />
        )}

        {tab === "select" && (
          <div className="px-4 py-4 space-y-6">
            {/* Predefined problems */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Builtin Problems
              </h3>
              <ul className="space-y-1">
                {PROBLEMS.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => { setProblem(p); setTab("description"); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-neutral-800 flex justify-between items-center ${p.id === problem.id ? "bg-neutral-800" : ""}`}
                    >
                      <span>{p.title}</span>
                      <span className={`text-xs ${difficultyColors[p.difficulty]}`}>
                        {p.difficulty}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Generate */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Generate with AI
              </h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={genOptions.difficulty}
                    onChange={(e) => setGenOptions((o) => ({ ...o, difficulty: e.target.value as GenerateOptions["difficulty"] }))}
                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs flex-1"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <input
                    value={genOptions.topic}
                    onChange={(e) => setGenOptions((o) => ({ ...o, topic: e.target.value }))}
                    placeholder="topic (e.g. trees)"
                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs flex-1"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-xs font-medium"
                >
                  {generating ? "Generating…" : "Generate Problem"}
                </button>
              </div>
            </div>

            {/* Import JSON */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Import Problem JSON
              </h3>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"id":"...", "title":"...", ...}'
                rows={4}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs font-mono resize-none"
              />
              <button
                onClick={handleImport}
                className="mt-1 w-full px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs"
              >
                Import
              </button>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const difficultyColors: Record<string, string> = {
  easy: "text-green-400",
  medium: "text-yellow-400",
  hard: "text-red-400",
};
