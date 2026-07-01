#!/bin/bash
set -e

PLUGIN_DIR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}"

if [ ! -d "$PLUGIN_DIR/dist" ]; then
  echo "[claude-session-recorder] 首次使用或更新，正在安装依赖..."
  cd "$PLUGIN_DIR"
  npm install
  npm run build
  echo "[claude-session-recorder] 构建完成"
fi
