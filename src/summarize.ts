// src/summarize.ts
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";
import { stdin } from "process";

export { parseJsonl, extractLogEntries, summarizeToolInput } from "./parser.js";
export type { JsonlEntry, ContentBlock, LogEntry } from "./types.js";

import type { JsonlEntry } from "./types.js";
import { parseJsonl, extractLogEntries } from "./parser.js";
import { formatTranscriptLog, generateFilename, extractSessionInfo } from "./formatter.js";
import { formatDate } from "./utils.js";

export function generateTranscriptLog(
  filepath: string,
  outputDir: string,
  sessionId?: string
): string | null {
  const entries = parseJsonl(filepath);

  if (entries.length === 0) {
    console.error("No entries found in transcript.");
    return null;
  }

  const logEntries = extractLogEntries(entries);

  if (logEntries.length === 0) {
    console.error("No conversation entries found in transcript.");
    return null;
  }

  // Determine session ID
  const finalSessionId = sessionId ||
    process.env.CLAUDE_SESSION_ID ||
    basename(filepath).replace(/\.jsonl$/, "");

  // Extract session info
  const sessionInfo = extractSessionInfo(entries, finalSessionId, filepath);

  // Generate output
  const content = formatTranscriptLog(
    logEntries,
    sessionInfo.sessionId,
    sessionInfo.created,
    sessionInfo.title
  );

  // Generate filename
  const date = formatDate(entries[0]?.timestamp || "");
  const filename = generateFilename(date, sessionInfo.title);
  const outputPath = join(outputDir, filename);

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Write file
  writeFileSync(outputPath, content, "utf-8");
  console.log(`Transcript log saved to: ${outputPath}`);

  return outputPath;
}

// Legacy function for backward compatibility
export function generateSummary(
  filepath: string,
  outputDir: string
): string | null {
  return generateTranscriptLog(filepath, outputDir);
}

// Legacy ConversationTurn type for backward compatibility
export interface ConversationTurn {
  role: string;
  content: string;
  timestamp: string;
}

// Legacy extractConversation for backward compatibility
export function extractConversation(entries: JsonlEntry[]): ConversationTurn[] {
  const logEntries = extractLogEntries(entries);
  return logEntries.map(entry => {
    if (entry.type === "user_message") {
      return { role: "user", content: entry.content, timestamp: entry.timestamp };
    } else {
      let content = entry.content;
      if (entry.type === "tool_use") {
        content = `[Tool: ${entry.toolName}] ${entry.toolInput || ""}`;
      }
      return { role: "assistant", content, timestamp: entry.timestamp };
    }
  });
}

interface HookStdin {
  transcript_path: string;
  cwd: string;
  session_id?: string;
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Hook mode: read JSON from stdin
    let inputData = "";
    for await (const chunk of stdin) {
      inputData += chunk;
    }

    if (!inputData.trim()) {
      console.error("No input provided on stdin");
      process.exit(2);
    }

    let hookData: HookStdin;
    try {
      hookData = JSON.parse(inputData);
    } catch (e) {
      console.error("Failed to parse stdin JSON:", e);
      process.exit(2);
    }

    const transcriptPath = hookData.transcript_path;
    if (!transcriptPath) {
      console.error("No transcript_path in stdin JSON");
      process.exit(2);
    }

    const outputDir = hookData.cwd
      ? join(hookData.cwd, "conversations")
      : join(dirname(transcriptPath), "conversations");

    const result = generateTranscriptLog(
      transcriptPath,
      outputDir,
      hookData.session_id
    );

    if (!result) {
      process.exit(2);
    }
    return;
  }

  // Skill mode: parse command line arguments
  let jsonlFile: string | null = null;
  let outputDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && i + 1 < args.length) {
      jsonlFile = args[++i];
    } else if (args[i] === "--output" && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (!args[i].startsWith("--") && !jsonlFile) {
      jsonlFile = args[i];
    }
  }

  if (!jsonlFile) {
    console.error("Usage: summarize [--file <jsonl_path>] [--output <dir>]");
    process.exit(2);
  }

  if (!existsSync(jsonlFile)) {
    console.error(`JSONL file not found: ${jsonlFile}`);
    process.exit(2);
  }

  // Determine output directory
  if (!outputDir) {
    const projectDir = process.env.CLAUDE_PROJECT_DIR;
    if (projectDir) {
      outputDir = join(projectDir, "conversations");
    } else {
      outputDir = join(dirname(jsonlFile), "conversations");
    }
  }

  const result = generateTranscriptLog(jsonlFile, outputDir);
  if (!result) {
    process.exit(2);
  }
}

// Run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
}
