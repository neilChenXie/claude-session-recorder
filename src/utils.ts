// src/utils.ts
export function truncate(text: string, maxLen: number = 500): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

export function cleanXmlTags(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "");
  cleaned = cleaned.replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, "");
  cleaned = cleaned.replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, "");
  return cleaned.trim();
}

export function formatTimestamp(isoTimestamp: string): string {
  if (!isoTimestamp) return "";
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatDate(isoTimestamp: string): string {
  if (!isoTimestamp) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(isoTimestamp: string): string {
  if (!isoTimestamp) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  }
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}
