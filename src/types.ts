// src/types.ts
export interface JsonlEntry {
  type: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
  };
  timestamp?: string;
  [key: string]: unknown;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown>; id?: string }
  | { type: "tool_result"; tool_use_id: string; content?: string }
  | { type: "thinking"; thinking?: string }
  | { type: string; [key: string]: unknown };

export interface LogEntry {
  type: 'user_message' | 'tool_use' | 'assistant_text';
  timestamp: string;
  content: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
}

export interface SessionInfo {
  sessionId: string;
  created: string;
  title: string;
}