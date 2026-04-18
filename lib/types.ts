export type Language = "javascript" | "python";

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
