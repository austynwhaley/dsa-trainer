export type Language = "javascript" | "typescript" | "python" | "java";

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  description: string;
  starterCode: Record<Language, string>;
  testCases: TestCase[];
  entryPoint?: string;      // function/class name runners invoke (e.g. "twoSum", "LRUCache")
  generateInput?: (n: number) => unknown[]; // returns arg array for benchmark at size n
  hints?: string[];
}

export interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
  runtime?: number;
}

export interface RunResult {
  results: TestResult[];
  stdout: string;
  error?: string;
  totalRuntime?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  hidden?: boolean; // internal trigger messages — not shown in UI
}

export interface EditEvent {
  timestamp: number;
  line: number;
  summary: string; // summarized for context
}

export interface GhostComment {
  line: number;
  text: string;
  id: string;
}

export interface PendingEdit {
  originalCode: string; // code before AI started writing
  finalCode: string;    // code AI intends to produce
  isAnimating: boolean; // still typing?
}

export interface ComplexityEstimate {
  time: string;        // "O(n²)", "O(n log n)", "O(?)"
  space: string;
  timeReason: string;  // one-sentence explanation
  spaceReason: string;
}

export interface BenchmarkPoint {
  n: number;
  medianMs: number;
  aborted?: boolean;
  error?: string;
}

export interface BenchmarkResult {
  points: BenchmarkPoint[];
  measuredClass: string;  // "O(n)", "O(n²)", etc.
}

export interface AIContext {
  problem: {
    title: string;
    description: string;
    difficulty: string;
  };
  code: string;
  language: Language;
  recentEdits: EditEvent[];
  chatHistory: ChatMessage[];
  lastRunResult?: RunResult;
  cursorLine?: number;
}
