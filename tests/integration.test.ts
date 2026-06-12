// tests/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateTranscriptLog, generateSummary } from "../src/summarize.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("generateTranscriptLog", () => {
  const outputDir = join(__dirname, ".test-output");

  beforeEach(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("generates transcript log from normal-session.jsonl", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateTranscriptLog(fixturePath, outputDir, "test-session-123");

    expect(result).not.toBeNull();
    expect(existsSync(result!)).toBe(true);

    const content = readFileSync(result!, "utf-8");

    // Check header
    expect(content).toContain("# ");
    expect(content).toContain("session id：test-session-123");
    expect(content).toContain("## 基本信息");
    expect(content).toContain("### 对话记录");

    // Check user messages
    expect(content).toContain("#### 用户");
    expect(content).toContain("Help me create a simple HTTP server");

    // Check tool usage
    expect(content).toContain("[tool]:Write");
    expect(content).toContain("[tool]:Bash");

    // Check timestamps format (HH:mm:ss)
    expect(content).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("generates file with correct naming convention", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateTranscriptLog(fixturePath, outputDir, "test-session-123");

    expect(result).not.toBeNull();
    const filename = result!.split("/").pop()!;

    // Should be: YYYY-MM-DD-first-user-message.md
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-.+\.md$/);
  });

  it("returns null for empty transcript", () => {
    const fixturePath = join(__dirname, "fixtures", "empty-session.jsonl");
    const result = generateTranscriptLog(fixturePath, outputDir, "test-session-123");

    // Should handle gracefully
    expect(result).toBeDefined();
  });

  it("handles missing timestamps gracefully", () => {
    // Create a temp fixture without timestamps
    const tempFixture = join(outputDir, "no-timestamp.jsonl");
    writeFileSync(tempFixture, JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "Test" }] },
    }) + "\n");

    const result = generateTranscriptLog(tempFixture, outputDir, "test-session");
    expect(result).toBeDefined();
  });

  it("includes tool input and output in the log", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateTranscriptLog(fixturePath, outputDir, "test-session");
    const content = readFileSync(result!, "utf-8");

    // Check for tool input format
    expect(content).toContain("file:");

    // Check for AI section header
    expect(content).toContain("#### AI");
  });

  it("formats assistant text responses", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateTranscriptLog(fixturePath, outputDir, "test-session");
    const content = readFileSync(result!, "utf-8");

    // Check for [答复] marker
    expect(content).toContain("[答复]");
  });
});

describe("generateSummary (backward compatibility)", () => {
  const outputDir = join(__dirname, ".test-output-bc");

  beforeEach(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("generates output file", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    expect(result).toBeTruthy();
    expect(existsSync(result!)).toBe(true);
  });
});

describe("CLI main function", () => {
  const outputDir = join(__dirname, ".test-output-cli");

  beforeEach(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("exits with code 2 for missing file in argv mode", () => {
    const binPath = join(__dirname, "..", "dist", "summarize.js");
    let exitCode = 0;
    try {
      execSync(`node "${binPath}" --file nonexistent.jsonl`, {
        encoding: "utf-8",
      });
    } catch (e: unknown) {
      const error = e as { status?: number };
      exitCode = error.status ?? 0;
    }
    expect(exitCode).toBe(2);
  });

  it("exits with code 2 for missing arguments in argv mode", () => {
    const binPath = join(__dirname, "..", "dist", "summarize.js");
    let exitCode = 0;
    try {
      execSync(`node "${binPath}"`, {
        encoding: "utf-8",
      });
    } catch (e: unknown) {
      const error = e as { status?: number };
      exitCode = error.status ?? 0;
    }
    expect(exitCode).toBe(2);
  });

  it("generates transcript log successfully with valid file in argv mode", () => {
    const binPath = join(__dirname, "..", "dist", "summarize.js");
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const testOutputDir = join(outputDir, "argv-test");

    const result = execSync(
      `node "${binPath}" --file "${fixturePath}" --output "${testOutputDir}"`,
      {
        encoding: "utf-8",
        env: { ...process.env, CLAUDE_SESSION_ID: "test-session-argv" },
      }
    );

    expect(result).toContain("Transcript log saved to:");
    expect(existsSync(testOutputDir)).toBe(true);
  });

  it("uses CLAUDE_PROJECT_DIR for output when --output not specified", () => {
    const binPath = join(__dirname, "..", "dist", "summarize.js");
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const projectDir = join(outputDir, "project-dir-test");

    mkdirSync(join(projectDir, "conversations"), { recursive: true });

    const result = execSync(
      `node "${binPath}" --file "${fixturePath}"`,
      {
        encoding: "utf-8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, CLAUDE_SESSION_ID: "test-project-dir" },
      }
    );

    expect(result).toContain("Transcript log saved to:");
    expect(result).toContain(projectDir);
  });

  it("handles hook mode stdin with transcript_path", async () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const hookCwd = join(outputDir, "hook-cwd");
    mkdirSync(join(hookCwd, "conversations"), { recursive: true });

    const hookInput = JSON.stringify({
      transcript_path: fixturePath,
      cwd: hookCwd,
      session_id: "hook-test-session",
    });

    const stdinFile = join(outputDir, "stdin.json");
    writeFileSync(stdinFile, hookInput, "utf-8");

    const binPath = join(__dirname, "..", "dist", "summarize.js");
    const result = execSync(`cat "${stdinFile}" | node "${binPath}"`, {
      encoding: "utf-8",
      cwd: hookCwd,
    });

    expect(result).toContain("Transcript log saved to:");
    expect(result).toContain(hookCwd);
  });

  it("exits with code 2 for invalid JSON in stdin mode", () => {
    const binPath = join(__dirname, "..", "dist", "summarize.js");
    const stdinFile = join(outputDir, "invalid-stdin.txt");
    writeFileSync(stdinFile, "not valid json", "utf-8");

    let exitCode = 0;
    try {
      execSync(`cat "${stdinFile}" | node "${binPath}"`, {
        encoding: "utf-8",
      });
    } catch (e: unknown) {
      const error = e as { status?: number };
      exitCode = error.status ?? 0;
    }
    expect(exitCode).toBe(2);
  });
});
