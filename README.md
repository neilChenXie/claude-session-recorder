# Claude Session Recorder Plugin

A Claude Code plugin that automatically generates Markdown logs of your session transcripts — preserving the chronological flow of every conversation.

## Features

- **Automatic Recording**: Generates a transcript log at the end of every Claude Code session via SessionEnd hook
- **Slash Command**: Use `/summarize-session` to manually generate a log at any time
- **Zero Configuration**: Hook auto-registers when the plugin is enabled
- **Chronological Flow**: Outputs a "流水账" (chronological log) format that preserves the exact order of user messages, tool calls, and AI responses
- **Smart Formatting**: Adaptive code fencing prevents backtick conflicts; XML tags are stripped for clean output

## Installation

### From npm

```bash
claude plugin add claude-session-recorder-plugin
```

### From GitHub

```bash
claude plugin add https://github.com/<user>/claude-session-recorder
```

## Usage

### Automatic (SessionEnd Hook)

Once the plugin is enabled, a transcript log is automatically generated when you exit Claude Code. The log is saved to:

```
<project-root>/conversations/<date>-<title>.md
```

### Manual (Slash Command)

Use the `/summarize-session` command:

```
/summarize-session
/summarize-session --file /path/to/transcript.jsonl
/summarize-session --output /custom/output/dir
```

### Standalone CLI

```bash
node dist/summarize.js --file <jsonl_path> [--output <dir>]
```

If `--output` is omitted, defaults to `<project>/conversations` (using `CLAUDE_PROJECT_DIR`) or `<jsonl-dir>/conversations`.

## Log Format

Each log file follows a chronological "流水账" structure:

```markdown
# 2026-06-11 10:00:00-Help me create a HTTP server

## 基本信息

* session id：abc123
* created：2026-06-11 10:00:00

### 对话记录

#### 用户

```
10:00:00 Help me create a simple HTTP server in Node.js
```

------------------

#### AI

```
10:01:00 [tool]:Write
``````
 file: /project/server.js
``````

------------------

```
10:02:00 [答复]
```
I've created a basic HTTP server...
```

------------------
```

Key formatting details:

- **Role headings** (`#### 用户` / `#### AI`) appear when the speaker changes
- **Tool calls** show `[tool]:ToolName` with input/output in code fences
- **AI text responses** show `[答复]` label
- **Adaptive fencing**: backtick count adjusts automatically to avoid conflicts with content containing backticks
- **XML stripping**: internal `<system-reminder>`, `<ide_opened_file>`, and `<ide_selection>` tags are removed
- **Content limits**: text truncated to 500 chars, Bash commands to 120 chars, filenames to 30 chars

## Development

### Setup

```bash
git clone https://github.com/<user>/claude-session-recorder
cd claude-session-recorder
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Type Check

```bash
npm run typecheck
```

### Local Testing

To test the plugin locally before publishing:

```bash
claude plugin add /path/to/claude-session-recorder
```

## Architecture

```
JSONL file → parseJsonl() → extractLogEntries() → extractSessionInfo() → formatTranscriptLog() → generateFilename() → .md file
```

- `src/parser.ts` — JSONL parsing + two-pass log entry extraction (first pass collects tool_results, second pass builds ordered entries)
- `src/formatter.ts` — Markdown generation, filename sanitization, adaptive code fencing
- `src/utils.ts` — Truncation, XML tag cleaning, timestamp formatting
- `src/types.ts` — Type definitions (JsonlEntry, ContentBlock, LogEntry, SessionInfo)
- `src/summarize.ts` — Main entry point (hook mode from stdin + CLI mode with flags)

## License

MIT