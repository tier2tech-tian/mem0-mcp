import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { hostname, cpus, homedir } from "node:os";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(homedir(), "mem0-local", "logs");
const LOG_FILE = join(LOG_DIR, "mcp.log");
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

function log(level, msg, extra) {
  const ts = new Date().toISOString();
  const line = extra
    ? `${ts} [${level}] ${msg} ${JSON.stringify(extra)}\n`
    : `${ts} [${level}] ${msg}\n`;
  try { appendFileSync(LOG_FILE, line); } catch {}
  if (level === "ERROR") process.stderr.write(`[mem0] ${msg}\n`);
}

const MEM0_API = process.env.MEM0_API_URL || "http://localhost:29476";
const DEFAULT_USER_ID = process.env.MEM0_USER_ID || "heasenbug";
const DEFAULT_AGENT_ID = process.env.MEM0_AGENT_ID || "claude-code";
const MEM0_API_KEY = process.env.MEM0_API_KEY || "";
const MACHINE_NAME = process.env.MEM0_MACHINE_NAME || hostname();
const CPU_MODEL = cpus()[0]?.model || "unknown";

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
    // 自动注入 source（机器名），调用方显式传入的 source 优先
    const mergedMetadata = { source: MACHINE_NAME, cpuModel: CPU_MODEL, ...metadata };
    // Fire-and-forget: return immediately, write in background
    const uid = user_id || DEFAULT_USER_ID;
    const aid = agent_id || DEFAULT_AGENT_ID;
    const preview = content.length > 80 ? content.slice(0, 80) + "..." : content;
    api("/memories", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content }],
        user_id: uid,
        agent_id: aid,
        metadata: mergedMetadata,
      }),
    }).then((res) => {
      const count = res?.results?.length ?? 0;
      log("INFO", `add_memory OK: ${count} facts extracted`, { user_id: uid, agent_id: aid, preview });
    }).catch((err) => {
      log("ERROR", `add_memory FAILED: ${err.message}`, { user_id: uid, agent_id: aid, preview });
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
    let result;
    try {
      result = await api("/search", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      log("ERROR", `search_memories FAILED: ${err.message}`, { query, user_id: body.user_id });
      throw err;
    }
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

// Update a memory
server.tool(
  "update_memory",
  "Update the text content of an existing memory by its ID.",
  {
    memory_id: z.string().describe("The memory ID to update"),
    content: z.string().describe("The new text content for this memory"),
  },
  async ({ memory_id, content }) => {
    let result;
    try {
      result = await api(`/memories/${encodeURIComponent(memory_id)}`, {
        method: "PUT",
        body: JSON.stringify({ data: content }),
      });
    } catch (err) {
      log("ERROR", `update_memory FAILED: ${err.message}`, { memory_id, preview: content.slice(0, 80) });
      throw err;
    }
    log("INFO", `update_memory OK`, { memory_id, preview: content.slice(0, 80) });
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
    let result;
    try {
      result = await api(`/memories/${encodeURIComponent(memory_id)}`, {
        method: "DELETE",
      });
    } catch (err) {
      log("ERROR", `delete_memory FAILED: ${err.message}`, { memory_id });
      throw err;
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
