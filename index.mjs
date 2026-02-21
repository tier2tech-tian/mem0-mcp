import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MEM0_API = process.env.MEM0_API_URL || "http://localhost:29476";
const DEFAULT_USER_ID = process.env.MEM0_USER_ID || "heasenbug";
const DEFAULT_AGENT_ID = process.env.MEM0_AGENT_ID || "claude-code";
const MEM0_API_KEY = process.env.MEM0_API_KEY || "";

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (MEM0_API_KEY) {
    headers["Authorization"] = `Bearer ${MEM0_API_KEY}`;
  }
  const res = await fetch(`${MEM0_API}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`mem0 API error ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "mem0-local",
  version: "1.2.0",
});

// Add memory
server.tool(
  "add_memory",
  "Save a memory to mem0. Use this to remember important facts, preferences, decisions, or context.",
  {
    content: z.string().describe("The text content to remember"),
    user_id: z.string().optional().describe("User ID (default: heasenbug)"),
    agent_id: z.string().optional().describe("Agent ID (default: claude-code)"),
    metadata: z.record(z.any()).optional().describe("Optional metadata"),
  },
  async ({ content, user_id, agent_id, metadata }) => {
    // Fire-and-forget: return immediately, write in background
    api("/memories", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content }],
        user_id: user_id || DEFAULT_USER_ID,
        agent_id: agent_id || DEFAULT_AGENT_ID,
        metadata,
      }),
    }).catch((err) => {
      process.stderr.write(`[mem0] async add_memory failed: ${err.message}\n`);
    });
    return { content: [{ type: "text", text: JSON.stringify({ status: "queued", message: "Memory is being saved in the background." }) }] };
  }
);

// Search memories
server.tool(
  "search_memories",
  "Search mem0 for relevant memories. Use this to recall previous context, preferences, or decisions.",
  {
    query: z.string().describe("Search query"),
    user_id: z.string().optional().describe("User ID (default: heasenbug)"),
    agent_id: z.string().optional().describe("Agent ID - omit to search all agents under the user"),
    limit: z.number().optional().describe("Max number of results (default: 10)"),
    threshold: z.number().optional().describe("Max cosine distance to include (lower=more relevant, e.g. 0.6). Results above this score are filtered out."),
    filters: z.record(z.any()).optional().describe("Metadata filters (flat dict, multi-key = AND). Examples: {\"topic\": \"sandbox\"} or {\"topic\": \"已知问题\", \"context\": \"pytest 测试\"}"),
  },
  async ({ query, user_id, agent_id, limit, threshold, filters }) => {
    const body = {
      query,
      user_id: user_id || DEFAULT_USER_ID,
      limit: limit || 10,
    };
    if (agent_id) body.agent_id = agent_id;
    if (filters) body.filters = filters;
    const result = await api("/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (threshold != null && result.results) {
      result.results = result.results.filter(r => r.score <= threshold);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Get all memories
server.tool(
  "get_memories",
  "Retrieve all stored memories for a user.",
  {
    user_id: z.string().optional().describe("User ID (default: heasenbug)"),
    agent_id: z.string().optional().describe("Agent ID - omit to get all agents' memories"),
    limit: z.number().optional().describe("Max number of results (default: 10)"),
  },
  async ({ user_id, agent_id, limit }) => {
    const uid = user_id || DEFAULT_USER_ID;
    let url = `/memories?user_id=${encodeURIComponent(uid)}&limit=${limit || 10}`;
    if (agent_id) url += `&agent_id=${encodeURIComponent(agent_id)}`;
    const result = await api(url);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Delete a memory
server.tool(
  "delete_memory",
  "Delete a specific memory by ID.",
  {
    memory_id: z.string().describe("The memory ID to delete"),
  },
  async ({ memory_id }) => {
    const result = await api(`/memories/${encodeURIComponent(memory_id)}`, {
      method: "DELETE",
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
