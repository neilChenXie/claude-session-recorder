// tests/formatter.test.ts
import { describe, it, expect } from "vitest";
import { formatTranscriptLog, generateFilename, extractSessionInfo } from "../src/formatter.js";
import type { LogEntry, JsonlEntry } from "../src/types.js";

describe("formatTranscriptLog", () => {
  it("formats user message correctly", () => {
    const entries: LogEntry[] = [
      { type: "user_message", timestamp: "2026-06-11T10:00:00Z", content: "Hello" },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test Title");

    expect(result).toContain("# 2026-06-11 10:00:00-Test Title");
    expect(result).toContain("session id：session-123");
    expect(result).toContain("#### 用户");
    expect(result).toContain("10:00:00 Hello");
  });

  it("formats tool_use with input and output", () => {
    const entries: LogEntry[] = [
      {
        type: "tool_use",
        timestamp: "2026-06-11T10:00:05Z",
        content: "",
        toolName: "Read",
        toolInput: "file_path: /project/file.ts",
        toolOutput: "file contents",
      },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test");

    expect(result).toContain("#### AI");
    expect(result).toContain("10:00:05 [tool]:Read");
    expect(result).toContain("file_path: /project/file.ts");
    expect(result).toContain("file contents");
  });

  it("formats assistant text response", () => {
    const entries: LogEntry[] = [
      {
        type: "assistant_text",
        timestamp: "2026-06-11T10:00:10Z",
        content: "I can help you with that.",
      },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test");

    expect(result).toContain("10:00:10 [答复]");
    expect(result).toContain("I can help you with that.");
  });

  it("escapes triple backticks in assistant text by using longer fence", () => {
    const entries: LogEntry[] = [
      {
        type: "assistant_text",
        timestamp: "2026-06-11T02:19:32Z",
        content: "已创建文件，包含以下内容：\n\n```\nnpm run build\n```",
      },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 02:19:32", "Test");

    // Should use 4 backticks for the fence when content contains 3
    expect(result).toContain("````");
    // The inner triple backticks should appear inside the fence
    expect(result).toMatch(/````\n.*```\n.*```\n````/s);
    // Should NOT have the inner ``` close the outer fence prematurely
    expect(result).not.toMatch(/````\n.*```\n````\n.*```/s);
  });

  it("uses 5 backticks when content contains 4 backticks", () => {
    const entries: LogEntry[] = [
      {
        type: "assistant_text",
        timestamp: "2026-06-11T10:00:00Z",
        content: "````\nsome code\n````",
      },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test");

    expect(result).toContain("`````");
  });

  it("uses standard 3 backticks when content has no backtick sequences", () => {
    const entries: LogEntry[] = [
      {
        type: "assistant_text",
        timestamp: "2026-06-11T10:00:00Z",
        content: "Simple text without code blocks",
      },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test");

    expect(result).toContain("```\nSimple text without code blocks\n```");
  });

  it("escapes backticks in user messages", () => {
    const entries: LogEntry[] = [
      {
        type: "user_message",
        timestamp: "2026-06-11T10:00:00Z",
        content: "Run this:\n```\necho hello\n```",
      },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test");

    expect(result).toContain("````");
  });

  it("escapes backticks in tool_use entries", () => {
    const entries: LogEntry[] = [
      {
        type: "tool_use",
        timestamp: "2026-06-11T10:00:05Z",
        content: "",
        toolName: "Bash",
        toolInput: "echo hello",
        toolOutput: "```\nhello\n```",
      },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test");

    expect(result).toContain("````");
  });

  it("formats multiple entries in order", () => {
    const entries: LogEntry[] = [
      { type: "user_message", timestamp: "2026-06-11T10:00:00Z", content: "First" },
      { type: "assistant_text", timestamp: "2026-06-11T10:00:05Z", content: "Response" },
      { type: "user_message", timestamp: "2026-06-11T10:01:00Z", content: "Second" },
    ];
    const result = formatTranscriptLog(entries, "session-123", "2026-06-11 10:00:00", "Test");

    const firstIdx = result.indexOf("First");
    const responseIdx = result.indexOf("Response");
    const secondIdx = result.indexOf("Second");

    expect(firstIdx).toBeLessThan(responseIdx);
    expect(responseIdx).toBeLessThan(secondIdx);
  });
});

describe("generateFilename", () => {
  it("generates filename with date and title", () => {
    const result = generateFilename("2026-06-11", "Help me create a server");
    expect(result).toBe("2026-06-11-Help-me-create-a-server.md");
  });

  it("truncates long titles to 30 chars", () => {
    const longTitle = "This is a very long title that should be truncated";
    const result = generateFilename("2026-06-11", longTitle);
    expect(result).toBe("2026-06-11-This-is-a-very-long-title-that.md");
  });

  it("replaces special characters in title", () => {
    const result = generateFilename("2026-06-11", "Hello/World\\Test:File");
    expect(result).toBe("2026-06-11-Hello-World-Test-File.md");
  });

  it("uses default title if empty", () => {
    const result = generateFilename("2026-06-11", "");
    expect(result).toBe("2026-06-11-Claude-Code-Session.md");
  });
});

describe("extractSessionInfo", () => {
  it("extracts first user message as title", () => {
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "Help me with X" }] },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const info = extractSessionInfo(entries, "session-123", "/path/to/transcript.jsonl");

    expect(info.title).toBe("Help me with X");
  });

  it("uses default title when no user messages", () => {
    const entries: JsonlEntry[] = [
      {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "Hello" }] },
        timestamp: "2026-06-11T10:00:00Z",
      },
    ];
    const info = extractSessionInfo(entries, "session-123", "/path/to/transcript.jsonl");

    expect(info.title).toBe("Claude Code Session");
  });

  it("extracts timestamp from first entry", () => {
    const entries: JsonlEntry[] = [
      {
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "Test" }] },
        timestamp: "2026-06-11T10:30:45Z",
      },
    ];
    const info = extractSessionInfo(entries, "session-123", "/path/to/transcript.jsonl");

    expect(info.created).toBe("2026-06-11 10:30:45");
  });
});
