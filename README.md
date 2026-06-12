# Claude Session Recorder Plugin

A Claude Code plugin that automatically generates Markdown summaries of your session transcripts.

## Features

- **Automatic Summarization**: Generates a summary at the end of every Claude Code session via SessionEnd hook
- **Slash Command**: Use `/summarize-session` to manually generate a summary at any time
- **Zero Configuration**: Hook auto-registers when the plugin is enabled
- **Informative Summaries**: Includes user requests, tools used, key responses, files modified, and commands run

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

Once the plugin is enabled, a summary is automatically generated when you exit Claude Code. The summary is saved to:

```
<project-root>/conversations/<timestamp>-<title>.md
```

### Manual (Slash Command)

Use the `/summarize-session` command:

```
/summarize-session
/summarize-session --file /path/to/transcript.jsonl
/summarize-session --output /custom/output/dir
```

## Summary Format

Each summary includes:

- **Title**: Derived from your first message
- **Metadata**: Session ID, creation timestamp, project path
- **User Requests**: Up to 10 user messages
- **Tools Used**: Up to 20 tool invocations with summaries
- **Key Assistant Responses**: Up to 8 text responses
- **Files Modified**: Files touched by Edit or Write tools
- **Commands Run**: Up to 10 bash commands

## Example Output

```markdown
# Help me create a HTTP server

**Session ID:** `abc123`
**Created:** 2026-06-11 10:00:00
**Project:** `/home/user/my-project`

---

## User Requests

- Help me create a simple HTTP server in Node.js
- Run the server

## Tools Used

- **Write**: /project/server.js: 150 chars
- **Bash**: node /project/server.js

## Files Modified

- `/project/server.js`
```

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

### Local Testing

To test the plugin locally before publishing:

```bash
claude plugin add /path/to/claude-session-recorder
```

## License

MIT
