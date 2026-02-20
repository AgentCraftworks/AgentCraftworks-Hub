# Tangent MCP Server Setup

Tangent exposes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI agents manage your Tangent configuration, projects, and agents programmatically.

The server script lives at `scripts/tangent-mcp-server.js` and communicates with a running Tangent instance over a local named pipe.

> **Prerequisite:** Tangent must be running for the MCP server to connect.

---

## Quick Setup (Copilot CLI)

Run the auto-install script from the Tangent directory:

```powershell
.\scripts\install-mcp.ps1
```

This writes the config to `~/.github/copilot/copilot-mcp.json` (merging with any existing servers).

---

## Manual Setup

### Copilot CLI

Add the Tangent server to `~/.github/copilot/copilot-mcp.json`:

```json
{
  "mcpServers": {
    "tangent": {
      "command": "node",
      "args": ["D:\\git\\tangent\\release\\scripts\\tangent-mcp-server.js"]
    }
  }
}
```

Replace `D:\\git\\tangent\\release` with the absolute path to your Tangent install directory.

### Claude Code

Claude Code supports MCP config in two locations:

**User-level** — `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tangent": {
      "command": "node",
      "args": ["D:\\git\\tangent\\release\\scripts\\tangent-mcp-server.js"]
    }
  }
}
```

**Project-level** — `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "tangent": {
      "command": "node",
      "args": ["D:\\git\\tangent\\release\\scripts\\tangent-mcp-server.js"]
    }
  }
}
```

Replace the path with the absolute path to your Tangent install directory. Use forward slashes or escaped backslashes depending on your OS.

---

## Available Tools

The Tangent MCP server exposes 8 tools:

### Configuration

| Tool | Description |
|------|-------------|
| `tangent_config_get` | Get Tangent configuration (editor, fontSize, startFolder) |
| `tangent_config_set` | Set a configuration value by key |

### Projects

| Tool | Description |
|------|-------------|
| `tangent_projects_list` | List all project folders configured in Tangent |
| `tangent_projects_add` | Add a new project folder |
| `tangent_projects_remove` | Remove a project folder |

### Agents

| Tool | Description |
|------|-------------|
| `tangent_agents_list` | List all agents across all project folders |
| `tangent_agents_add` | Add an agent to a project folder (name, command, args) |
| `tangent_agents_remove` | Remove an agent by name |

---

## Example Usage

Once configured, you can ask your AI agent to interact with Tangent naturally:

### Managing agents

> "Add a new agent called 'Linter' that runs `eslint` to my Web project"

The agent will call `tangent_agents_add` with:
```json
{
  "folder": "Web",
  "name": "Linter",
  "command": "eslint",
  "args": []
}
```

> "Remove the Linter agent"

Calls `tangent_agents_remove` with `{ "name": "Linter" }`.

> "What agents do I have configured?"

Calls `tangent_agents_list` and returns all agents grouped by project folder.

### Managing configuration

> "Show me my Tangent config"

Calls `tangent_config_get` and returns settings like editor, fontSize, and startFolder.

> "Change my font size to 16"

Calls `tangent_config_set` with `{ "key": "fontSize", "value": "16" }`.

### Managing projects

> "List my Tangent projects"

Calls `tangent_projects_list`.

> "Add a project folder called 'Backend'"

Calls `tangent_projects_add` with `{ "name": "Backend" }`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot connect to Tangent" | Make sure Tangent is running. The MCP server connects via named pipe. |
| Tool calls return errors | Check that Tangent's config server is enabled (it starts automatically). |
| Config file not picked up | Restart Copilot CLI or Claude Code after editing the MCP config file. |
| Path issues on Windows | Use double-backslashes (`\\`) in JSON paths, or use forward slashes. |
