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
  it("formats ISO timestamp to HH:mm:ss", () => {
    expect(formatTimestamp("2026-06-11T10:30:45Z")).toBe("10:30:45");
  });

  it("pads single digits with zeros", () => {
    expect(formatTimestamp("2026-06-11T09:05:03Z")).toBe("09:05:03");
  });

  it("returns empty string for empty input", () => {
    expect(formatTimestamp("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatTimestamp("invalid")).toBe("");
  });
});

describe("formatDate", () => {
  it("extracts YYYY-MM-DD from ISO timestamp", () => {
    expect(formatDate("2026-06-11T10:30:45Z")).toBe("2026-06-11");
  });

  it("returns today for empty input", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(formatDate("")).toBe(today);
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("invalid")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("formats ISO timestamp to YYYY-MM-DD HH:mm:ss", () => {
    expect(formatDateTime("2026-06-11T10:30:45Z")).toBe("2026-06-11 10:30:45");
  });

  it("returns now for empty input", () => {
    const result = formatDateTime("");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateTime("invalid")).toBe("");
  });
});