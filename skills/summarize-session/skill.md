---
name: summarize-session
description: Generate a Markdown summary of a Claude Code session transcript
---

Generate a summary of a Claude Code session transcript.

## Usage

This skill invokes the session recorder plugin to generate a Markdown summary.

### Arguments

- `--file <path>`: Path to the JSONL transcript file (optional, auto-detected if omitted)
- `--output <dir>`: Output directory for the summary file (optional, defaults to project's `./conversations`, not in `~/.claude/projects/` folder)


## Instructions for Claude

When this skill is invoked:

1. Determine the JSONL file path:
   - If `--file` argument is provided, use that path
   - Otherwise, attempts to locate the session's JSONL files of current project automatically in `~/.claude/projects/`

2. Determine the output directory:
   - If `--output` argument is provided, use that path
   - Otherwise, defaults to the project's `./conversations` directory (not in `~/.claude/projects/` folder)

3. Invoke the script:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/dist/summarize.js" --file <jsonl_path> --output <output_dir>
   ```

4. Read the generated Markdown file and present a brief summary to the user.

## Example

```
/summarize-session
/summarize-session --file /path/to/transcript.jsonl --output /path/to/output/dir
/summarize-session --output /custom/output/dir
```
