// tests/parser.test.ts
import { describe, it, expect } from "vitest";
import { parseJsonl, extractLogEntries, summarizeToolInput } from "../src/parser.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { JsonlEntry } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("parseJsonl", () => {
  it("parses valid JSONL file into entries", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const entries = parseJsonl(fixturePath);
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveProperty("type", "user");
    expect(entries[1]).toHaveProperty("type", "assistant");
  });

  it("skips invalid JSON lines silently", () => {
    const fixturePath = join(__dirname, "fixtures", "invalid-lines.jsonl");
    const entries = parseJsonl(fixturePath);
    expect(entries.length).toBe(3);
  });

  it("returns empty array for non-existent file", () => {
    const entries = parseJsonl("/non/existent/file.jsonl");
    expect(entries).toEqual([]);
  });
});

describe("summarizeToolInput", () => {
  it("summarizes Read tool", () => {
    const result = summarizeToolInput("Read", { file_path: "/project/src/index.ts" });
    expect(result).toContain("file_path");
    expect(result).toContain("/project/src/index.ts");
  });

  it("summarizes Glob tool", () => {
    const result = summarizeToolInput("Glob", { pattern: "**/*.ts" });
    expect(result).toContain("pattern");
    expect(result).toContain("**/*.ts");
  });

  it("summarizes Bash tool", () => {
    const result = summarizeToolInput("Bash", { command: "npm run build" });
    expect(result).toContain("command");
    expect(result).toContain("npm run build");
  });

  it("summarizes Edit tool with old_string", () => {
    const result = summarizeToolInput("Edit", {
      file_path: "/project/file.ts",
      old_string: "const x = 1",
      new_string: "const x = 2",
    });
    expect(result).toContain("file:");
    expect(result).toContain("/project/file.ts");
  });

  it("summarizes Write tool", () => {
    const result = summarizeToolInput("Write", {
      file_path: "/project/new.ts",
      content: "x".repeat(500),
    });
    expect(result).toContain("file:");
    expect(result).toContain("/project/new.ts");
  });

  it("summarizes Agent tool with description", () => {
    const result = summarizeToolInput("Agent", {
      description: "Run type checker",
      subagent_type: "general-purpose",
    });
    expect(result).toBe("Run type checker");
  });

  it("summarizes unknown tools with first 3 keys", () => {
    const result = summarizeToolInput("UnknownTool", {
      foo: 1,
      bar: 2,
      baz: 3,
      qux: 4,
    });
    expect(result).toBe("foo, bar, baz");
  });
});

describe("extractLogEntries", () => {
  it("extracts user messages", () => {
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello world" }],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const logEntries = extractLogEntries(entries);
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].type).toBe("user_message");
    expect(logEntries[0].content).toBe("Hello world");
  });

  it("extracts assistant text responses", () => {
    const entries: JsonlEntry[] = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "I can help with that" }],
        },
        timestamp: "2026-06-11T10:00:05Z",
      },
    ];
    const logEntries = extractLogEntries(entries);
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].type).toBe("assistant_text");
    expect(logEntries[0].content).toBe("I can help with that");
  });

  it("extracts tool_use with input and output", () => {
    const entries: JsonlEntry[] = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              name: "Read",
              id: "tool-123",
              input: { file_path: "/project/file.ts" },
            },
          ],
        },
        timestamp: "2026-06-11T10:00:05Z",
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-123",
              content: "file contents here",
            },
          ],
        },
        timestamp: "2026-06-11T10:00:06Z",
      },
    ];
    const logEntries = extractLogEntries(entries);
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].type).toBe("tool_use");
    expect(logEntries[0].toolName).toBe("Read");
    expect(logEntries[0].toolInput).toContain("file_path");
    expect(logEntries[0].toolOutput).toBe("file contents here");
  });

  it("strips XML tags from text content", () => {
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello<system-reminder>hidden</system-reminder>World",
            },
          ],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const logEntries = extractLogEntries(entries);
    expect(logEntries[0].content).toBe("HelloWorld");
  });

  it("truncates long content to 500 chars", () => {
    const longText = "a".repeat(600);
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: longText }],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const logEntries = extractLogEntries(entries);
    expect(logEntries[0].content.length).toBe(503); // 500 + "..."
  });

  it("processes normal-session.jsonl fixture correctly", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const entries = parseJsonl(fixturePath);
    const logEntries = extractLogEntries(entries);

    // Should have: user msg, assistant text, tool_use, user msg, tool_use
    expect(logEntries.length).toBeGreaterThanOrEqual(3);

    const userMsgs = logEntries.filter(e => e.type === "user_message");
    const toolUses = logEntries.filter(e => e.type === "tool_use");
    const assistantTexts = logEntries.filter(e => e.type === "assistant_text");

    expect(userMsgs.length).toBeGreaterThanOrEqual(2);
    expect(toolUses.length).toBeGreaterThanOrEqual(2);
  });
});
