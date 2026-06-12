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
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatDate(isoTimestamp: string): string {
  if (!isoTimestamp) {
    return new Date().toISOString().slice(0, 10);
  }
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(isoTimestamp: string): string {
  if (!isoTimestamp) {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().replace("T", " ").slice(0, 19);
}
