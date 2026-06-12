// src/summarize.ts
import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { stdin } from "process";

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
  | { type: "tool_use"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content?: string }
  | { type: "thinking"; thinking?: string }
  | { type: string; [key: string]: unknown };

export interface ConversationTurn {
  role: string;
  content: string;
  timestamp: string;
}

export function parseJsonl(filepath: string): JsonlEntry[] {
  const entries: JsonlEntry[] = [];
  try {
    const content = readFileSync(filepath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed));
      } catch {
        // Skip invalid JSON lines silently
      }
    }
  } catch {
    // File not found or read error
    return [];
  }
  return entries;
}

export function summarizeToolInput(
  toolName: string,
  inputDict: Record<string, unknown>
): string {
  if (toolName === "Read") {
    const path = String(inputDict.file_path || "");
    return `read ${path}`;
  }

  if (toolName === "Glob") {
    const pattern = String(inputDict.pattern || "");
    return `glob ${pattern}`;
  }

  if (toolName === "Grep") {
    const pattern = String(inputDict.pattern || "");
    const path = String(inputDict.path || "");
    return `grep '${pattern}' in ${path}`;
  }

  if (toolName === "Bash") {
    const cmd = String(inputDict.command || "");
    return cmd.slice(0, 120);
  }

  if (toolName === "Edit") {
    const path = String(inputDict.file_path || "");
    const oldStr = String(inputDict.old_string || "");
    const newStr = String(inputDict.new_string || "");
    if (oldStr) {
      const oldTruncated = oldStr.slice(0, 60);
      const newTruncated = newStr.slice(0, 60);
      return `${path}: '${oldTruncated}' -> '${newTruncated}'`;
    }
    return `${path}: write/edit`;
  }

  if (toolName === "Write") {
    const path = String(inputDict.file_path || "");
    const content = String(inputDict.content || "");
    return `${path}: ${content.length} chars`;
  }

  if (
    toolName === "TodoWrite" ||
    toolName === "TaskOutput" ||
    toolName === "AskUserQuestion" ||
    toolName === "CronCreate" ||
    toolName === "CronDelete"
  ) {
    return "...";
  }

  if (toolName === "Agent" || toolName === "Workflow") {
    const desc = String(
      inputDict.description || inputDict.name || ""
    );
    return desc.slice(0, 80);
  }

  // Unknown tool: list first 3 keys
  const keys = Object.keys(inputDict).slice(0, 3);
  return keys.join(", ");
}

export function extractConversation(entries: JsonlEntry[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const entry of entries) {
    const entryType = entry.type || "";
    if (entryType !== "user" && entryType !== "assistant") {
      continue;
    }

    const msg = entry.message;
    if (!msg || typeof msg !== "object") {
      continue;
    }

    const role = msg.role || entryType;
    const content = msg.content;

    if (Array.isArray(content)) {
      const textParts: string[] = [];

      for (const block of content) {
        if (!block || typeof block !== "object") {
          if (typeof block === "string") {
            textParts.push(block);
          }
          continue;
        }

        const blockType = (block as Record<string, unknown>).type as string;

        if (blockType === "text") {
          let text = String((block as Record<string, unknown>).text || "");
          // Strip system-reminder, ide_opened_file, ide_selection tags
          text = text.replace(
            /<system-reminder>[\s\S]*?<\/system-reminder>/g,
            ""
          );
          text = text.replace(
            /<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g,
            ""
          );
          text = text.replace(
            /<ide_selection>[\s\S]*?<\/ide_selection>/g,
            ""
          );
          text = text.trim();
          if (text) {
            textParts.push(text);
          }
        } else if (blockType === "tool_use") {
          const toolName = String(
            (block as Record<string, unknown>).name || ""
          );
          const toolInput = (block as Record<string, unknown>).input || {};
          const inputSummary = summarizeToolInput(
            toolName,
            toolInput as Record<string, unknown>
          );
          textParts.push(`[Tool: ${toolName}] ${inputSummary}`);
        }
        // Skip thinking and tool_result blocks
      }

      const combinedContent = textParts.join("\n").trim();
      if (combinedContent) {
        let finalContent = combinedContent;
        if (finalContent.length > 800) {
          finalContent = finalContent.slice(0, 800) + "...";
        }
        turns.push({
          role,
          content: finalContent,
          timestamp: entry.timestamp || "",
        });
      }
    } else if (typeof content === "string") {
      let text = content;
      text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "");
      text = text.replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, "");
      text = text.replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, "");
      text = text.trim();
      if (text) {
        let finalContent = text;
        if (finalContent.length > 800) {
          finalContent = finalContent.slice(0, 800) + "...";
        }
        turns.push({
          role,
          content: finalContent,
          timestamp: entry.timestamp || "",
        });
      }
    }
  }

  return turns;
}

export function generateSummary(
  filepath: string,
  outputDir: string
): string | null {
  const entries = parseJsonl(filepath);
  const turns = extractConversation(entries);

  if (turns.length === 0) {
    console.error("No conversation turns found in transcript.");
    return null;
  }

  const sessionId =
    process.env.CLAUDE_SESSION_ID ||
    basename(filepath).replace(/\.jsonl$/, "");
  const projectDir = process.env.CLAUDE_PROJECT_DIR || "";

  // Find first user message as title
  let firstUserMsg = "";
  for (const t of turns) {
    if (t.role === "user" && !t.content.startsWith("[Tool:")) {
      const clean = t.content.replace(/<[^>]*>/g, "").trim();
      if (clean) {
        firstUserMsg = clean;
        break;
      }
    }
  }

  let title = firstUserMsg.slice(0, 50).replace(/\n/g, " ").trim();
  if (!title) {
    title = "Claude Code Session";
  }

  // Timestamp from file modification time
  let created: string;
  try {
    const fileStat = statSync(filepath);
    created = new Date(fileStat.mtime).toISOString().replace("T", " ").slice(0, 19);
  } catch {
    created = new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  // Build summary lines
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`**Session ID:** \`${sessionId}\`  `);
  lines.push(`**Created:** ${created}  `);
  if (projectDir) {
    lines.push(`**Project:** \`${projectDir}\`  `);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Separate user and assistant turns
  const userMsgs = turns.filter((t) => t.role === "user");
  const assistantMsgs = turns.filter((t) => t.role === "assistant");

  // User Requests
  const userRequests: string[] = [];
  for (const msg of userMsgs) {
    const content = msg.content;
    if (content.startsWith("[Tool:") || content.length < 5) {
      continue;
    }
    const clean = content.replace(/<[^>]*>/g, "").trim();
    if (clean && clean.length >= 5) {
      userRequests.push(clean.slice(0, 200));
    }
  }

  if (userRequests.length > 0) {
    lines.push("## User Requests");
    for (const req of userRequests.slice(0, 10)) {
      lines.push(`- ${req}`);
    }
    lines.push("");
  }

  // Tools Used
  const toolActions: Array<{ name: string; detail: string }> = [];
  const filesEdited = new Set<string>();
  const commandsRun: string[] = [];

  for (const msg of assistantMsgs) {
    const content = msg.content;
    for (const lineItem of content.split("\n")) {
      const lineStripped = lineItem.trim();
      if (lineStripped.startsWith("[Tool:")) {
        const match = lineStripped.match(/\[Tool: (\w+)\] (.+)/);
        if (match) {
          const toolName = match[1];
          const toolDetail = match[2].slice(0, 120);
          toolActions.push({ name: toolName, detail: toolDetail });

          if (toolName === "Read") {
            // Track files read (optional)
          } else if (toolName === "Edit" || toolName === "Write") {
            const filePath = toolDetail.split(":")[0].trim();
            filesEdited.add(filePath);
          } else if (toolName === "Bash") {
            commandsRun.push(toolDetail);
          }
        }
      }
    }
  }

  if (toolActions.length > 0) {
    lines.push("## Tools Used");
    for (const { name, detail } of toolActions.slice(0, 20)) {
      lines.push(`- **${name}**: ${detail}`);
    }
    lines.push("");
  }

  // Key Assistant Responses
  const keyResponses: string[] = [];
  for (const msg of assistantMsgs) {
    const content = msg.content;
    const contentLines = content.split("\n");
    const toolLines = contentLines.filter((l) =>
      l.trim().startsWith("[Tool:")
    ).length;
    const totalLines = Math.max(contentLines.length, 1);

    if (toolLines / totalLines > 0.5) {
      continue;
    }

    const textOnly = contentLines
      .filter((l) => l.trim() && !l.trim().startsWith("[Tool:"))
      .join(" ");

    if (textOnly.length >= 10) {
      keyResponses.push(textOnly.slice(0, 400));
    }
  }

  if (keyResponses.length > 0) {
    lines.push("## Key Assistant Responses");
    for (const resp of keyResponses.slice(0, 8)) {
      lines.push(`- ${resp}`);
    }
    lines.push("");
  }

  // Files Modified
  if (filesEdited.size > 0) {
    lines.push("## Files Modified");
    for (const f of Array.from(filesEdited).sort()) {
      lines.push(`- \`${f}\``);
    }
    lines.push("");
  }

  // Commands Run
  if (commandsRun.length > 0) {
    lines.push("## Commands Run");
    for (const cmd of commandsRun.slice(0, 10)) {
      lines.push(`- \`${cmd.slice(0, 100)}\``);
    }
    lines.push("");
  }

  const summaryContent = lines.join("\n");

  // Generate output filename
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 19)
    .replace(/-/g, "")
    .slice(0, 15);
  const safeTitle = title
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .replace(/[^a-zA-Z0-9_-]/g, "");
  const outputFilename = `${timestamp}-${safeTitle}.md`;
  const outputPath = join(outputDir, outputFilename);

  // Create images subdirectory
  const imagesDir = join(outputDir, "images");
  mkdirSync(imagesDir, { recursive: true });

  writeFileSync(outputPath, summaryContent, "utf-8");
  console.log(`Session summary saved to: ${outputPath}`);
  return outputPath;
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

    if (hookData.session_id) {
      process.env.CLAUDE_SESSION_ID = hookData.session_id;
    }

    mkdirSync(outputDir, { recursive: true });
    const result = generateSummary(transcriptPath, outputDir);
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

  mkdirSync(outputDir, { recursive: true });
  const result = generateSummary(jsonlFile, outputDir);
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
