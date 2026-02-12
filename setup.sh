#!/bin/bash
set -e

INSTALL_DIR="$HOME/.mem0-mcp"
CLAUDE_MD="$HOME/.claude/CLAUDE.md"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}mem0 MCP Server Setup${NC}"
echo "================================"

# Check dependencies
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required. Install it first."
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "Error: Claude Code CLI is required. Install it first."
  exit 1
fi

# Collect config
DEFAULT_USER_ID="$(hostname -s | tr '[:upper:]' '[:lower:]')"

read -p "mem0 API URL (e.g. https://mem0.example.com): " MEM0_API_URL
read -p "User ID [$DEFAULT_USER_ID]: " MEM0_USER_ID
read -p "API Key (leave empty if not required): " MEM0_API_KEY

MEM0_USER_ID="${MEM0_USER_ID:-$DEFAULT_USER_ID}"

if [ -z "$MEM0_API_URL" ]; then
  echo "Error: API URL is required."
  exit 1
fi

echo "User ID: $MEM0_USER_ID"

# Install
echo ""
echo "Installing to $INSTALL_DIR ..."

if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}Directory exists, updating...${NC}"
  cp index.mjs package.json "$INSTALL_DIR/"
else
  mkdir -p "$INSTALL_DIR"
  cp index.mjs package.json "$INSTALL_DIR/"
fi

cd "$INSTALL_DIR" && npm install --silent

# Register MCP server
echo ""
echo "Registering MCP server with Claude Code..."

ENV_ARGS="-e MEM0_API_URL=$MEM0_API_URL -e MEM0_USER_ID=$MEM0_USER_ID -e MEM0_AGENT_ID=claude-code"
if [ -n "$MEM0_API_KEY" ]; then
  ENV_ARGS="$ENV_ARGS -e MEM0_API_KEY=$MEM0_API_KEY"
fi

eval claude mcp add -s user mem0 $ENV_ARGS -- node "$INSTALL_DIR/index.mjs"

# Setup global CLAUDE.md
echo ""
MEM0_MARKER="## Mem0 Memory System"

if [ -f "$CLAUDE_MD" ] && grep -q "$MEM0_MARKER" "$CLAUDE_MD"; then
  echo -e "${YELLOW}Global CLAUDE.md already has mem0 config, skipping.${NC}"
else
  echo "Adding mem0 instructions to global CLAUDE.md ..."
  mkdir -p "$(dirname "$CLAUDE_MD")"
  cat >> "$CLAUDE_MD" << 'BLOCK'

## Mem0 Memory System

All project knowledge is stored in **mem0**. Search mem0 for context at the start of each session or when encountering relevant topics.

### Auto-save triggers
- User expresses a preference (e.g., "always use bun", "don't auto-commit")
- A tricky bug is discovered and resolved — record the cause and solution
- Important architectural decisions or conventions are learned
- User corrects a wrong approach

### Auto-search triggers
- Session start — search for memories related to the current project/task
- Encountering a problem that may have been handled before
- User mentions a topic that may have related history

### Guidelines
- Keep memories concise, specific, and actionable
- Do not save temporary or one-off information
- Use short keywords (2-5 words) for search queries, not full sentences
BLOCK
  echo -e "${GREEN}Global CLAUDE.md updated.${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC} Restart Claude Code to activate."
