// tests/utils.test.ts
import { describe, it, expect } from "vitest";
import { truncate, cleanXmlTags, formatTimestamp, formatDate, formatDateTime } from "../src/utils.js";

describe("truncate", () => {
  it("returns original text if under max length", () => {
    expect(truncate("hello", 500)).toBe("hello");
  });

  it("truncates text over max length and adds ellipsis", () => {
    const longText = "a".repeat(600);
    const result = truncate(longText, 500);
    expect(result.length).toBe(503); // 500 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("uses default max length of 500", () => {
    const longText = "a".repeat(600);
    const result = truncate(longText);
    expect(result.length).toBe(503);
  });
});

describe("cleanXmlTags", () => {
  it("strips system-reminder tags", () => {
    const input = "Hello<system-reminder>internal</system-reminder>World";
    expect(cleanXmlTags(input)).toBe("HelloWorld");
  });

  it("strips ide_opened_file tags", () => {
    const input = "Check <ide_opened_file>file.ts</ide_opened_file> now";
    expect(cleanXmlTags(input)).toBe("Check  now");
  });

  it("strips ide_selection tags", () => {
    const input = "Edit <ide_selection>code</ide_selection> here";
    expect(cleanXmlTags(input)).toBe("Edit  here");
  });

  it("strips all XML tags together", () => {
    const input = "Start<system-reminder>a</system-reminder>Mid<ide_opened_file>b</ide_opened_file>End<ide_selection>c</ide_selection>";
    expect(cleanXmlTags(input)).toBe("StartMidEnd");
  });

  it("returns trimmed result", () => {
    const input = "  <system-reminder>x</system-reminder>text  ";
    expect(cleanXmlTags(input)).toBe("text");
  });
});

describe("formatTimestamp", () => {
  it("uses local timezone instead of UTC", () => {
    const iso = "2026-06-11T10:30:45Z";
    const date = new Date(iso);
    const expected = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    expect(formatTimestamp(iso)).toBe(expected);
  });

  it("pads single digits with zeros using local timezone", () => {
    const iso = "2026-06-11T09:05:03Z";
    const date = new Date(iso);
    const expected = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    expect(formatTimestamp(iso)).toBe(expected);
  });

  it("returns empty string for empty input", () => {
    expect(formatTimestamp("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatTimestamp("invalid")).toBe("");
  });
});

describe("formatDate", () => {
  it("formats ISO timestamp to local YYYY-MM-DD", () => {
    const iso = "2026-06-11T10:30:45Z";
    const date = new Date(iso);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    expect(formatDate(iso)).toBe(expected);
  });

  it("returns today for empty input using local timezone", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(formatDate("")).toBe(expected);
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("invalid")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("formats ISO timestamp to local YYYY-MM-DD HH:mm:ss", () => {
    const iso = "2026-06-11T10:30:45Z";
    const date = new Date(iso);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    expect(formatDateTime(iso)).toBe(expected);
  });

  it("returns now for empty input", () => {
    const result = formatDateTime("");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateTime("invalid")).toBe("");
  });
});