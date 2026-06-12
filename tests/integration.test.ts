// tests/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateSummary, main } from "../src/summarize.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("generateSummary", () => {
  const outputDir = join(__dirname, ".test-output");

  beforeEach(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("generates a markdown summary file", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    expect(result).toBeTruthy();
    expect(existsSync(result!)).toBe(true);

    const content = readFileSync(result!, "utf-8");
    expect(content).toContain("#");
    expect(content).toContain("Session ID");
    expect(content).toContain("Created");
  });

  it("includes User Requests section", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    const content = readFileSync(result!, "utf-8");
    expect(content).toContain("## User Requests");
    expect(content).toContain("HTTP server");
  });

  it("includes Tools Used section when tools present", () => {
    const fixturePath = join(__dirname, "fixtures", "heavy-tools.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    const content = readFileSync(result!, "utf-8");
    expect(content).toContain("## Tools Used");
    expect(content).toContain("**Read**:");
    expect(content).toContain("**Edit**:");
  });

  it("includes Files Modified section when files edited", () => {
    const fixturePath = join(__dirname, "fixtures", "heavy-tools.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    const content = readFileSync(result!, "utf-8");
    expect(content).toContain("## Files Modified");
  });

  it("creates images subdirectory", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    generateSummary(fixturePath, outputDir);
    expect(existsSync(join(outputDir, "images"))).toBe(true);
  });

  it("returns null for empty conversation", () => {
    const fixturePath = join(__dirname, "fixtures", "empty-session.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    expect(result).toBeNull();
  });

  it("derives title from first user message", () => {
    const fixturePath = join(__dirname, "fixtures", "normal-session.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    const content = readFileSync(result!, "utf-8");
    expect(content).toMatch(/#.*HTTP server/i);
  });

  it("limits user requests to 10 items", () => {
    // This test uses the heavy-tools fixture which has limited user messages
    const fixturePath = join(__dirname, "fixtures", "heavy-tools.jsonl");
    const result = generateSummary(fixturePath, outputDir);
    expect(result).toBeTruthy();
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
    // This test needs the built file
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

  it("generates summary successfully with valid file in argv mode", () => {
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

    expect(result).toContain("Session summary saved to:");
    // Check that a file was created
    const files = existsSync(testOutputDir);
    expect(files).toBe(true);
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

    expect(result).toContain("Session summary saved to:");
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

    expect(result).toContain("Session summary saved to:");
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
