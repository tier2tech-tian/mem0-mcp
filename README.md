# mem0 MCP Server

Claude Code 的持久化记忆系统。通过 [mem0](https://github.com/mem0ai/mem0) 为 Claude 提供跨会话的长期记忆能力。

## 功能

| 工具 | 说明 |
|------|------|
| `add_memory` | 保存记忆（异步，立即返回） |
| `search_memories` | 语义搜索记忆（支持 limit / threshold / metadata 过滤） |
| `get_memories` | 列出所有记忆 |
| `update_memory` | 修改指定记忆内容 |
| `delete_memory` | 删除指定记忆 |

## 服务地址

默认 mem0 服务运行在 `10.150.204.118:29476`（内网固定 IP）。

## 前置条件

- Node.js >= 18
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- 可访问的 mem0 服务（默认地址见上方）

## 安装

```bash
git clone https://github.com/tier2tech-tian/mem0-mcp.git
cd mem0-mcp
bash setup.sh
```

安装脚本会：
1. 安装依赖到 `~/.mem0-mcp/`
2. 交互式输入 mem0 URL、User ID、API Key
3. 自动注册到 Claude Code
4. 自动配置全局 `~/.claude/CLAUDE.md`，让 Claude 在所有项目中自动使用 mem0

重启 Claude Code 即可生效。

## 手动安装

```bash
# 复制文件
mkdir -p ~/.mem0-mcp
cp index.mjs package.json ~/.mem0-mcp/
cd ~/.mem0-mcp && npm install

# 注册 MCP server（按实际情况替换环境变量值）
claude mcp add -s user mem0 \
  -e MEM0_API_URL=http://10.150.204.118:29476 \
  -e MEM0_USER_ID=your-name \
  -e MEM0_AGENT_ID=claude-code \
  -e MEM0_API_KEY=your-api-key \
  -- node ~/.mem0-mcp/index.mjs
```

手动安装时需自行将 mem0 指引追加到 `~/.claude/CLAUDE.md`，参考 `setup.sh` 中的内容。

## 配置说明

### 环境变量

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `MEM0_API_URL` | **是** | mem0 服务地址 | `http://localhost:29476` |
| `MEM0_USER_ID` | **是** | 用户标识（隔离不同用户的记忆） | `default` |
| `MEM0_AGENT_ID` | 否 | Agent 标识 | `claude-code` |
| `MEM0_API_KEY` | 远程必填 | API 鉴权密钥，本地访问（127.0.0.1）可不填 | 空 |
| `MEM0_MACHINE_NAME` | 否 | 机器名标识，自动写入记忆 metadata | 系统 hostname |

### 远程访问配置

如果 mem0 服务运行在另一台机器上，需要：

1. **获取 API Key**：联系管理员在服务端创建，每个 user_id 对应一个 key
2. **设置环境变量**：
   - `MEM0_API_URL` 改为服务器内网地址，如 `http://10.150.204.118:29476`
   - `MEM0_API_KEY` 填入分配的 key（`mk_` 开头）
   - `MEM0_USER_ID` 填入你的用户名

### 配置示例

远程访问：
```bash
claude mcp add -s user mem0 \
  -e MEM0_API_URL=http://10.150.204.118:29476 \
  -e MEM0_USER_ID=zhangsan \
  -e MEM0_API_KEY=mk_xxxxxxxxxxxxxxxx \
  -- node ~/.mem0-mcp/index.mjs
```

本地访问（服务在本机）：
```bash
claude mcp add -s user mem0 \
  -e MEM0_API_URL=http://localhost:29476 \
  -e MEM0_USER_ID=zhangsan \
  -- node ~/.mem0-mcp/index.mjs
```

## 日志

运行日志写入 `~/mem0-local/logs/mcp.log`，记录：
- add_memory 成功/失败及提取的 facts 数量
- search_memories / update_memory / delete_memory 的失败详情

## 搜索参数

- **limit**: 最大返回条数（默认 10）
- **threshold**: 余弦距离阈值（越小越相关，如 0.6），过滤掉弱相关结果
- **filters**: metadata 过滤，如 `{"topic": "sandbox"}`
