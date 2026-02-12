#!/bin/bash
set -e

INSTALL_DIR="$HOME/.mem0-mcp"

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
read -p "mem0 API URL (e.g. https://mem0.example.com): " MEM0_API_URL
read -p "Your user ID (used to isolate your memories): " MEM0_USER_ID
read -p "API Key (leave empty if not required): " MEM0_API_KEY

if [ -z "$MEM0_API_URL" ] || [ -z "$MEM0_USER_ID" ]; then
  echo "Error: API URL and User ID are required."
  exit 1
fi

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

echo ""
echo -e "${GREEN}Done!${NC} MCP server registered."
echo ""
echo "Next steps:"
echo "  1. Copy MEMORY.template.md to your project's memory directory:"
echo "     mkdir -p ~/.claude/projects/<your-project>/memory"
echo "     cp MEMORY.template.md ~/.claude/projects/<your-project>/memory/MEMORY.md"
echo "  2. Restart Claude Code"
echo "  3. Claude will now auto-search mem0 for context"
