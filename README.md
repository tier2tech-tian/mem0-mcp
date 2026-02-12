# mem0 MCP Server

Claude Code 的持久化记忆系统。通过 [mem0](https://github.com/mem0ai/mem0) 为 Claude 提供跨会话的长期记忆能力。

## 功能

| 工具 | 说明 |
|------|------|
| `add_memory` | 保存记忆 |
| `search_memories` | 语义搜索记忆（支持 limit / threshold） |
| `get_memories` | 列出所有记忆 |
| `delete_memory` | 删除指定记忆 |

## 前置条件

- Node.js >= 18
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- 可访问的 mem0 服务（自建或云端）

## 安装

```bash
git clone git@github.com:tier2tech-tian/mem0-mcp.git
cd mem0-mcp
bash setup.sh
```

安装脚本会：
1. 安装依赖到 `~/.mem0-mcp/`
2. 交互式输入 mem0 URL、User ID、API Key
3. 自动注册到 Claude Code

## 手动安装

```bash
# 复制文件
mkdir -p ~/.mem0-mcp
cp index.mjs package.json ~/.mem0-mcp/
cd ~/.mem0-mcp && npm install

# 注册 MCP server
claude mcp add -s user mem0 \
  -e MEM0_API_URL=https://your-mem0-server.com \
  -e MEM0_USER_ID=your-name \
  -e MEM0_AGENT_ID=claude-code \
  -e MEM0_API_KEY=your-api-key \
  -- node ~/.mem0-mcp/index.mjs
```

## 配置 MEMORY.md

将 `MEMORY.template.md` 复制到项目的 memory 目录，让 Claude 自动使用 mem0：

```bash
# 找到项目的 memory 目录（路径中的项目名会被编码）
mkdir -p ~/.claude/projects/<your-project>/memory
cp MEMORY.template.md ~/.claude/projects/<your-project>/memory/MEMORY.md
```

根据项目需要编辑 MEMORY.md，添加搜索关键词索引。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MEM0_API_URL` | mem0 服务地址 | `http://localhost:29476` |
| `MEM0_USER_ID` | 用户标识（隔离不同用户的记忆） | `default` |
| `MEM0_AGENT_ID` | Agent 标识 | `claude-code` |
| `MEM0_API_KEY` | API 鉴权密钥（可选） | 空 |

## 搜索参数

- **limit**: 最大返回条数（默认 10）
- **threshold**: 余弦距离阈值（越小越相关，如 0.6），过滤掉弱相关结果
