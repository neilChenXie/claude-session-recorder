---
name: summarize-session
description: Generate a Markdown summary of a Claude Code session transcript
argument-hint: [--file <path>] [--output <dir>]
---

Generate a summary of a Claude Code session transcript.

## Usage

This skill invokes the session recorder plugin to generate a Markdown summary.

### Arguments

- `--file <path>`: Path to the JSONL transcript file (optional, auto-detected if omitted)
- `--output <dir>`: Output directory for the summary file (optional, defaults to `<project>/conversations`)

### Behavior

1. If no `--file` argument is provided, the skill attempts to locate the current session's JSONL file automatically.
2. The summary is written to the `conversations/` directory in the project root.

## Instructions for Claude

When this skill is invoked:

1. Determine the JSONL file path:
   - If `--file` argument is provided, use that path
   - Otherwise, look for the transcript in `~/.claude/projects/` or ask the user

2. Invoke the script:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/dist/summarize.js" --file <jsonl_path>
   ```

3. Read the generated Markdown file and present a brief summary to the user.

## Example

```
/summarize-session
/summarize-session --file /path/to/transcript.jsonl
/summarize-session --output /custom/output/dir
```
