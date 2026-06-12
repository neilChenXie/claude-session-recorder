// src/parser.ts
import { readFileSync } from "fs";
import type { JsonlEntry, LogEntry } from "./types.js";
import { cleanXmlTags, truncate } from "./utils.js";

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
    return [];
  }
  return entries;
}

export function summarizeToolInput(
  toolName: string,
  inputDict: Record<string, unknown>
): string {
  if (toolName === "Read") {
    return `file_path: ${String(inputDict.file_path || "")}`;
  }

  if (toolName === "Glob") {
    return `pattern: ${String(inputDict.pattern || "")}`;
  }

  if (toolName === "Grep") {
    return `pattern: ${String(inputDict.pattern || "")}, path: ${String(inputDict.path || "")}`;
  }

  if (toolName === "Bash") {
    const cmd = String(inputDict.command || "");
    return `command: ${cmd.slice(0, 120)}`;
  }

  if (toolName === "Edit") {
    const path = String(inputDict.file_path || "");
    const oldStr = String(inputDict.old_string || "").slice(0, 60);
    const newStr = String(inputDict.new_string || "").slice(0, 60);
    if (oldStr) {
      return `file: ${path}\nold: '${oldStr}'\nnew: '${newStr}'`;
    }
    return `file: ${path}`;
  }

  if (toolName === "Write") {
    const path = String(inputDict.file_path || "");
    return `file: ${path}`;
  }

  if (toolName === "Agent" || toolName === "Workflow") {
    const desc = String(inputDict.description || inputDict.name || "");
    return desc.slice(0, 80);
  }

  // Unknown tool: list first 3 keys
  const keys = Object.keys(inputDict).slice(0, 3);
  return keys.join(", ");
}

export function extractLogEntries(entries: JsonlEntry[]): LogEntry[] {
  const logEntries: LogEntry[] = [];
  const toolResults = new Map<string, string>();

  // First pass: collect all tool_results by tool_use_id
  for (const entry of entries) {
    if (entry.type !== "user") continue;
    const msg = entry.message;
    if (!msg || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (!block || typeof block !== "object") continue;
      const blockType = (block as Record<string, unknown>).type;
      if (blockType === "tool_result") {
        const toolUseId = String((block as Record<string, unknown>).tool_use_id || "");
        const content = String((block as Record<string, unknown>).content || "");
        if (toolUseId) {
          toolResults.set(toolUseId, content);
        }
      }
    }
  }

  // Second pass: extract user messages and assistant content
  for (const entry of entries) {
    const entryType = entry.type || "";
    if (entryType !== "user" && entryType !== "assistant") {
      continue;
    }

    const msg = entry.message;
    if (!msg || typeof msg !== "object") {
      continue;
    }

    const timestamp = entry.timestamp || "";
    const content = msg.content;

    if (entryType === "user") {
      // Extract text content only (tool_results captured separately)
      if (Array.isArray(content)) {
        const textParts: string[] = [];
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          const blockType = (block as Record<string, unknown>).type;
          if (blockType === "text") {
            const text = String((block as Record<string, unknown>).text || "");
            const cleaned = cleanXmlTags(text);
            if (cleaned) textParts.push(cleaned);
          }
        }
        if (textParts.length > 0) {
          logEntries.push({
            type: "user_message",
            timestamp,
            content: truncate(textParts.join("\n")),
          });
        }
      } else if (typeof content === "string") {
        const cleaned = cleanXmlTags(content);
        if (cleaned) {
          logEntries.push({
            type: "user_message",
            timestamp,
            content: truncate(cleaned),
          });
        }
      }
    } else if (entryType === "assistant") {
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          const blockType = (block as Record<string, unknown>).type;

          if (blockType === "text") {
            const text = String((block as Record<string, unknown>).text || "");
            const cleaned = cleanXmlTags(text);
            if (cleaned) {
              logEntries.push({
                type: "assistant_text",
                timestamp,
                content: truncate(cleaned),
              });
            }
          } else if (blockType === "tool_use") {
            const toolName = String((block as Record<string, unknown>).name || "");
            const toolInput = (block as Record<string, unknown>).input || {};
            const toolId = String((block as Record<string, unknown>).id || "");

            const inputSummary = summarizeToolInput(toolName, toolInput as Record<string, unknown>);
            const toolOutput = toolResults.get(toolId) || "";

            logEntries.push({
              type: "tool_use",
              timestamp,
              content: "",
              toolName,
              toolInput: inputSummary,
              toolOutput: truncate(toolOutput),
            });
          }
          // Skip thinking blocks
        }
      } else if (typeof content === "string") {
        const cleaned = cleanXmlTags(content);
        if (cleaned) {
          logEntries.push({
            type: "assistant_text",
            timestamp,
            content: truncate(cleaned),
          });
        }
      }
    }
  }

  return logEntries;
}
