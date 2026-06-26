// src/formatter.ts
import type { JsonlEntry, LogEntry } from "./types.js";
import { formatTimestamp, formatDateTime, cleanXmlTags } from "./utils.js";

export function generateFilename(date: string, shortSid: string, title: string): string {
  let safeTitle = title;
  if (!safeTitle) {
    safeTitle = "Claude-Code-Session";
  } else {
    // Truncate to 30 chars
    safeTitle = safeTitle.slice(0, 30);
    // Replace anything that's not alphanumeric, CJK, or hyphens
    safeTitle = safeTitle.replace(/[^a-zA-Z0-9一-鿿぀-ヿ가-힯-]/g, "-");
    // Collapse consecutive hyphens
    safeTitle = safeTitle.replace(/-+/g, "-");
    // Strip leading/trailing hyphens
    safeTitle = safeTitle.replace(/^-+|-+$/g, "");
  }
  return `${date}-${shortSid}-${safeTitle}.md`;
}

export function extractSessionInfo(
  entries: JsonlEntry[],
  sessionId: string,
  transcriptPath: string
): { sessionId: string; created: string; title: string } {
  let title = "Claude Code Session";
  let created = formatDateTime("");

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
          // Take first line only
          let firstLine = cleaned.split("\n")[0].trim();
          // Strip leading numbering/list markers
          firstLine = firstLine.replace(/^[-*\d]+[.、)\s]+/, "").trim();
          // Strip trailing connectors like "包含：", "要求：", "包括："
          firstLine = firstLine.replace(/[，：].*$/, "").trim();
          title = firstLine.slice(0, 50).trim() || cleaned.slice(0, 50).replace(/\n/g, " ").trim();
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

/**
 * Determine the minimum number of backticks needed to fence content
 * without conflicting with existing backtick sequences in the content.
 * CommonMark rule: fence must be longer than any backtick sequence in the content.
 */
function fenceLength(content: string): number {
  const matches = content.match(/`{3,}/g);
  if (!matches) return 3;
  const maxLen = Math.max(...matches.map(s => s.length));
  return maxLen + 1;
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

  // Determine role for each entry: "user" or "ai"
  type Role = "user" | "ai";
  function getRole(entry: LogEntry): Role {
    return entry.type === "user_message" ? "user" : "ai";
  }

  let currentRole: Role | null = null;

  for (const entry of entries) {
    const role = getRole(entry);
    const ts = formatTimestamp(entry.timestamp);

    // Emit role heading when role changes
    if (role !== currentRole) {
      currentRole = role;
      lines.push(`#### ${role === "user" ? "用户" : "AI"}`);
      lines.push("");
    }

    if (entry.type === "user_message") {
      const f = "`".repeat(fenceLength(entry.content));
      lines.push(f);
      lines.push(`${ts} ${entry.content}`);
      lines.push(f);
      lines.push("");
      lines.push("------------------");
      lines.push("");
    } else if (entry.type === "tool_use") {
      const combined = `${entry.toolInput || ""}\n${entry.toolOutput || ""}`;
      const f = "`".repeat(fenceLength(combined));
      lines.push(`${ts} [tool]:${entry.toolName || "Unknown"}`);
      lines.push(f);
      lines.push(` ${entry.toolInput || ""}`);
      if (entry.toolOutput) {
        lines.push(` `);
        lines.push(` ${entry.toolOutput}`);
      }
      lines.push(f);
      lines.push("");
      lines.push("------------------");
      lines.push("");
    } else if (entry.type === "assistant_text") {
      const f = "`".repeat(fenceLength(entry.content));
      lines.push(`${ts} [答复]`);
      lines.push(f);
      lines.push(entry.content);
      lines.push(f);
      lines.push("");
      lines.push("------------------");
      lines.push("");
    }
  }

  return lines.join("\n");
}
