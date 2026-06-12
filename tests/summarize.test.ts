// tests/summarize.test.ts
import { describe, it, expect } from "vitest";
import { parseJsonl, summarizeToolInput, extractConversation } from "../src/summarize.js";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import type { JsonlEntry } from "../src/summarize.js";

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
    expect(entries.length).toBe(3); // Only valid entries
  });

  it("returns empty array for non-existent file", () => {
    const entries = parseJsonl("/non/existent/file.jsonl");
    expect(entries).toEqual([]);
  });

  it("returns empty array for empty file", () => {
    const fixturePath = join(__dirname, "fixtures", "empty-session.jsonl");
    const entries = parseJsonl(fixturePath);
    expect(entries).toHaveLength(1); // One valid entry
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

  it("summarizes Grep tool", () => {
    const result = summarizeToolInput("Grep", { pattern: "function", path: "/project/src" });
    expect(result).toContain("pattern");
    expect(result).toContain("/project/src");
  });

  it("summarizes Bash tool", () => {
    const result = summarizeToolInput("Bash", { command: "npm run build" });
    expect(result).toContain("command");
    expect(result).toContain("npm run build");
  });

  it("truncates long Bash commands to 120 chars", () => {
    const longCmd = "a".repeat(200);
    const result = summarizeToolInput("Bash", { command: longCmd });
    expect(result.length).toBe(129); // "command: " + 120 chars
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

  it("summarizes Edit tool without old_string", () => {
    const result = summarizeToolInput("Edit", {
      file_path: "/project/file.ts",
      new_string: "new content",
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

  it("summarizes Workflow tool with name", () => {
    const result = summarizeToolInput("Workflow", { name: "my-workflow" });
    expect(result).toBe("my-workflow");
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

describe("extractConversation (legacy compatibility)", () => {
  it("extracts user and assistant turns", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const entries = parseJsonl(fixturePath);
    const turns = extractConversation(entries);
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(turns[0].role).toBe("user");
  });

  it("strips system-reminder tags from text", () => {
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello<system-reminder>some internal info</system-reminder>World",
            },
          ],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const turns = extractConversation(entries);
    expect(turns[0].content).toBe("HelloWorld");
  });

  it("strips ide_opened_file and ide_selection tags", () => {
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: "Check <ide_opened_file>file.ts</ide_opened_file> and <ide_selection>selected</ide_selection>",
            },
          ],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const turns = extractConversation(entries);
    expect(turns[0].content).toBe("Check  and");
  });

  it("summarizes tool_use blocks", () => {
    const entries: JsonlEntry[] = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              name: "Read",
              input: { file_path: "/project/file.ts" },
            },
          ],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const turns = extractConversation(entries);
    expect(turns[0].content).toContain("[Tool: Read]");
    expect(turns[0].content).toContain("file_path");
  });

  it("skips thinking blocks", () => {
    const entries: JsonlEntry[] = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "internal reasoning..." },
            { type: "text", text: "Hello" },
          ],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const turns = extractConversation(entries);
    expect(turns[0].content).toBe("Hello");
  });

  it("skips tool_result blocks", () => {
    const entries: JsonlEntry[] = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "tool_result", tool_use_id: "123", content: "output..." },
            { type: "text", text: "Done" },
          ],
        },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const turns = extractConversation(entries);
    expect(turns[0].content).toBe("Done");
  });

  it("truncates messages over 500 chars", () => {
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
    const turns = extractConversation(entries);
    expect(turns[0].content.length).toBe(503); // 500 + "..."
  });

  it("skips entries without type user or assistant", () => {
    const entries: JsonlEntry[] = [
      { type: "system", message: { role: "system", content: "init" } },
      {
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "Hello" }] },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const turns = extractConversation(entries);
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe("user");
  });

  it("handles empty content gracefully", () => {
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: { role: "user", content: [] },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const turns = extractConversation(entries);
    expect(turns).toHaveLength(0);
  });
});
