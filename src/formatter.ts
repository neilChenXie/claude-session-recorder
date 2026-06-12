// src/formatter.ts
import type { JsonlEntry, LogEntry } from "./types.js";
import { formatTimestamp, formatDateTime, cleanXmlTags } from "./utils.js";

export function generateFilename(date: string, title: string): string {
  let safeTitle = title;
  if (!safeTitle) {
    safeTitle = "Claude Code Session";
  } else {
    // Truncate to 30 chars
    safeTitle = safeTitle.slice(0, 30);
    // Replace special characters and whitespace
    safeTitle = safeTitle.replace(/[/\\:\s]/g, "-");
  }
  return `${date}-${safeTitle}.md`;
}

export function extractSessionInfo(
  entries: JsonlEntry[],
  sessionId: string,
  transcriptPath: string
): { sessionId: string; created: string; title: string } {
  let title = "Claude Code Session";
  let created = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Find first user message for title
  for (const entry of entries) {
    if (entry.type !== "user") continue;
    const msg = entry.message;
    if (!msg || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (!block || typeof block !== "object") continue;
      if ((block as Record<string, unknown>).type === "text") {
        const text = String((block as Record<string, unknown>).text || "");
        const cleaned = cleanXmlTags(text);
        if (cleaned && cleaned.length >= 5) {
          title = cleaned.slice(0, 50).replace(/\n/g, " ").trim();
          break;
        }
      }
    }
    if (title !== "Claude Code Session") break;
  }

  // Get timestamp from first entry
  if (entries.length > 0 && entries[0].timestamp) {
    created = formatDateTime(entries[0].timestamp);
  }

  return {
    sessionId,
    created,
    title,
  };
}

export function formatTranscriptLog(
  entries: LogEntry[],
  sessionId: string,
  created: string,
  title: string
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${created}-${title}`);
  lines.push("");
  lines.push("## 基本信息");
  lines.push("");
  lines.push(`* session id：${sessionId}`);
  lines.push(`* created：${created}`);
  lines.push("");
  lines.push("### 对话记录");
  lines.push("");

  for (const entry of entries) {
    const ts = formatTimestamp(entry.timestamp);

    if (entry.type === "user_message") {
      lines.push("#### 用户");
      lines.push("");
      lines.push("```");
      lines.push(`${ts} ${entry.content}`);
      lines.push("```");
      lines.push("");
    } else if (entry.type === "tool_use") {
      lines.push("#### AI");
      lines.push("");
      lines.push(`${ts} [tool]:${entry.toolName || "Unknown"}`);
      lines.push("```");
      lines.push(` ${entry.toolInput || ""}`);
      if (entry.toolOutput) {
        lines.push(` `);
        lines.push(` ${entry.toolOutput}`);
      }
      lines.push("```");
      lines.push("");
    } else if (entry.type === "assistant_text") {
      lines.push(`${ts} [答复]`);
      lines.push("```");
      lines.push(entry.content);
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}
