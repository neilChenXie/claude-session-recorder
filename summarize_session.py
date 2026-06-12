#!/usr/bin/env python3
"""
Claude Code session transcript summarizer.
Reads JSONL transcript, extracts key exchanges, and writes a concise markdown summary.

Usage:
  python3 summarize_session.py <jsonl_file> [output_dir]

Environment variables (set by Claude Code SessionEnd hook):
  CLAUDE_SESSION_ID - session UUID
  CLAUDE_PROJECT_DIR - project root path
"""

import json
import os
import re
import sys
from datetime import datetime


def parse_jsonl(filepath):
    """Parse a JSONL transcript file into structured entries."""
    entries = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            entries.append(obj)
    return entries


def extract_conversation(entries):
    """Extract human-readable conversation turns from JSONL entries.

    JSONL structure:
    - entries with type='user' have message={role:'user', content:[...blocks]}
    - entries with type='assistant' have message={role:'assistant', content:[...blocks]}
    - content blocks: text, tool_use, tool_result, thinking
    """
    turns = []
    for entry in entries:
        entry_type = entry.get("type", "")
        if entry_type not in ("user", "assistant"):
            continue

        msg = entry.get("message", {})
        if not isinstance(msg, dict):
            continue

        role = msg.get("role", entry_type)
        content = msg.get("content", "")

        if isinstance(content, list):
            text_parts = []
            for block in content:
                if not isinstance(block, dict):
                    if isinstance(block, str):
                        text_parts.append(block)
                    continue

                block_type = block.get("type", "")

                if block_type == "text":
                    text = block.get("text", "")
                    # Strip system-reminder tags and IDE tags for cleaner output
                    text = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.DOTALL)
                    text = re.sub(r"<ide_opened_file>.*?</ide_opened_file>", "", text, flags=re.DOTALL)
                    text = re.sub(r"<ide_selection>.*?</ide_selection>", "", text, flags=re.DOTALL)
                    text = text.strip()
                    if text:
                        text_parts.append(text)

                elif block_type == "tool_use":
                    tool_name = block.get("name", "")
                    tool_input = block.get("input", {})
                    input_summary = summarize_tool_input(tool_name, tool_input)
                    text_parts.append(f"[Tool: {tool_name}] {input_summary}")

                elif block_type == "thinking":
                    pass  # Skip thinking blocks - internal reasoning

                elif block_type == "tool_result":
                    pass  # Skip tool results - too verbose

            content = "\n".join(text_parts)
        elif isinstance(content, str):
            content = re.sub(r"<system-reminder>.*?</system-reminder>", "", content, flags=re.DOTALL)
        else:
            continue

        # Truncate very long messages
        if len(content) > 800:
            content = content[:800] + "..."

        content = content.strip()
        if content:
            timestamp = entry.get("timestamp", "")
            turns.append({"role": role, "content": content, "timestamp": timestamp})

    return turns


def summarize_tool_input(tool_name, input_dict):
    """Create a brief summary of tool input."""
    if tool_name in ("Read",):
        path = input_dict.get("file_path", "")
        return f"read {path}"
    elif tool_name in ("Glob",):
        pattern = input_dict.get("pattern", "")
        return f"glob {pattern}"
    elif tool_name in ("Grep", "Bash"):
        if tool_name == "Bash":
            cmd = input_dict.get("command", "")
            return cmd[:120]
        pattern = input_dict.get("pattern", "")
        path = input_dict.get("path", "")
        return f"grep '{pattern}' in {path}"
    elif tool_name in ("Edit",):
        path = input_dict.get("file_path", "")
        old = input_dict.get("old_string", "")
        new = input_dict.get("new_string", "")
        if old:
            return f"{path}: '{old[:60]}' -> '{new[:60]}'"
        else:
            return f"{path}: write/edit"
    elif tool_name in ("Write",):
        path = input_dict.get("file_path", "")
        content_len = len(input_dict.get("content", ""))
        return f"{path}: {content_len} chars"
    elif tool_name == "Bash":
        cmd = input_dict.get("command", "")
        return cmd[:120]
    elif tool_name in ("TodoWrite", "TaskOutput", "AskUserQuestion", "CronCreate", "CronDelete"):
        return "..."
    elif tool_name in ("Agent", "Workflow"):
        desc = input_dict.get("description", input_dict.get("name", ""))
        return desc[:80]
    else:
        keys = list(input_dict.keys())[:3]
        return ", ".join(keys)


def generate_summary(filepath, output_dir):
    """Generate a markdown summary from a JSONL transcript."""
    entries = parse_jsonl(filepath)
    turns = extract_conversation(entries)

    if not turns:
        print("No conversation turns found in transcript.")
        return None

    session_id = os.environ.get("CLAUDE_SESSION_ID",
                                os.path.basename(filepath).replace(".jsonl", ""))
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")

    # Find first user message as title
    first_user_msg = ""
    for t in turns:
        if t["role"] == "user" and not t["content"].startswith("[Tool:"):
            # Strip IDE/system tags from content for title
            clean = re.sub(r"<.*?>", "", t["content"]).strip()
            if clean:
                first_user_msg = clean
                break

    title = first_user_msg[:50].replace("\n", " ").strip()
    if not title:
        title = "Claude Code Session"

    # Timestamp from file
    file_mtime = os.path.getmtime(filepath)
    created = datetime.fromtimestamp(file_mtime).strftime("%Y-%m-%d %H:%M:%S")

    # Build summary
    lines = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**Session ID:** `{session_id}`  ")
    lines.append(f"**Created:** {created}  ")
    if project_dir:
        lines.append(f"**Project:** `{project_dir}`  ")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Separate user and assistant turns
    user_msgs = [t for t in turns if t["role"] == "user"]
    assistant_msgs = [t for t in turns if t["role"] == "assistant"]

    # === User Requests ===
    user_requests = []
    for msg in user_msgs:
        content = msg["content"]
        # Skip tool_result messages and very short ones
        if content.startswith("[Tool:") or len(content) < 5:
            continue
        # Strip system/IDE tags
        clean = re.sub(r"<.*?>", "", content).strip()
        if clean and len(clean) >= 5:
            user_requests.append(clean[:200])

    if user_requests:
        lines.append("## User Requests")
        for req in user_requests[:10]:
            lines.append(f"- {req}")
        lines.append("")

    # === Tools Used ===
    tool_actions = []
    files_read = set()
    files_edited = set()
    commands_run = []

    for msg in assistant_msgs:
        content = msg["content"]
        for line_item in content.split("\n"):
            line_stripped = line_item.strip()
            if line_stripped.startswith("[Tool:"):
                # Parse tool info
                m = re.match(r"\[Tool: (\w+)\] (.+)", line_stripped)
                if m:
                    tool_name = m.group(1)
                    tool_detail = m.group(2)[:120]
                    tool_actions.append((tool_name, tool_detail))

                    if tool_name == "Read":
                        files_read.add(tool_detail.replace("read ", ""))
                    elif tool_name in ("Edit", "Write"):
                        files_edited.add(tool_detail.split(":")[0].strip())
                    elif tool_name == "Bash":
                        commands_run.append(tool_detail)

    if tool_actions:
        lines.append("## Tools Used")
        for (name, detail) in tool_actions[:20]:
            lines.append(f"- **{name}**: {detail}")
        lines.append("")

    # === Key Responses ===
    key_responses = []
    for msg in assistant_msgs:
        content = msg["content"]
        # Skip messages dominated by tool calls
        tool_lines = sum(1 for l in content.split("\n") if l.strip().startswith("[Tool:"))
        total_lines = max(content.count("\n"), 1)
        if tool_lines / total_lines > 0.5:
            continue

        # Extract pure text (no tool markers)
        text_only = []
        for l in content.split("\n"):
            l_stripped = l.strip()
            if l_stripped and not l_stripped.startswith("[Tool:"):
                text_only.append(l_stripped)

        if text_only:
            combined = " ".join(text_only)[:400]
            # Skip very short or empty responses
            if len(combined) >= 10:
                key_responses.append(combined)

    if key_responses:
        lines.append("## Key Assistant Responses")
        for resp in key_responses[:8]:
            lines.append(f"- {resp}")
        lines.append("")

    # === Files Modified ===
    if files_edited:
        lines.append("## Files Modified")
        for f in sorted(files_edited):
            lines.append(f"- `{f}`")
        lines.append("")

    # === Bash Commands ===
    if commands_run:
        lines.append("## Commands Run")
        for cmd in commands_run[:10]:
            lines.append(f"- `{cmd[:100]}`")
        lines.append("")

    summary_content = "\n".join(lines)

    # Generate output filename
    timestamp = datetime.now().strftime("%Y%m%d-%H-%M-%S")
    safe_title = title.replace("/", "-").replace(" ", "-")[:50]
    safe_title = "".join(c for c in safe_title if c.isalnum() or c in "-_")
    output_filename = f"{timestamp}-{safe_title}.md"
    output_path = os.path.join(output_dir, output_filename)

    # Also create an images subfolder if it doesn't exist
    images_dir = os.path.join(output_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(summary_content)

    print(f"Session summary saved to: {output_path}")
    return output_path


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 summarize_session.py <jsonl_file> [output_dir]")
        sys.exit(1)

    jsonl_file = sys.argv[1]
    if not os.path.exists(jsonl_file):
        print(f"JSONL file not found: {jsonl_file}")
        sys.exit(1)

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    if len(sys.argv) >= 3:
        output_dir = sys.argv[2]
    elif project_dir:
        output_dir = os.path.join(project_dir, "conversations")
    else:
        output_dir = os.path.join(os.path.dirname(jsonl_file), "conversations")

    os.makedirs(output_dir, exist_ok=True)

    result = generate_summary(jsonl_file, output_dir)
    if not result:
        sys.exit(1)


if __name__ == "__main__":
    main()