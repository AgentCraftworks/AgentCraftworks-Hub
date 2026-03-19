# AgentCraftworks Hub

A GitHub Enterprise monitoring dashboard for AICraftworks — like Windows Task Manager, but for GitHub API consumption, Actions billing, Copilot usage, and monthly spend.

Built on top of [charris-msft/tangent](https://github.com/charris-msft/tangent) — extended with a monitoring dashboard.

## Dashboard Panels

| Panel | What it tracks |
|-------|----------------|
| **Rate Limit** | REST/Search/GraphQL limits, usage gauge, countdown to reset, 60-min sparkline |
| **Token Activity** | Who is consuming your API quota (via enterprise audit log) |
| **Actions Minutes** | Monthly usage vs. included, OS multipliers, overage cost |
| **Copilot Premium Requests** | Per-user/model breakdown, standard vs. premium |
| **Billing Summary** | Estimated month-to-date spend across all GitHub products |

## ⚠️ Electron ≠ VS Code Terminal

The Electron app is a **standalone desktop window**. For quick in-terminal access, use:

```bash
hub monitor    # Full Ink TUI — runs inside VS Code integrated terminal
hub status     # Single-line rate limit summary
```

## Quick Start

```bash
git clone https://github.com/AgentCraftworks/AgentCraftworks-Hub.git
cd AgentCraftworks-Hub
npm install
npm run dev        # Electron app (development mode)
```

## CLI

Install globally: `npm link`

```
hub help
hub status                          # Rate limit snapshot
hub monitor                         # Full terminal dashboard (VS Code terminal friendly)
hub config get
hub agents list
hub projects list
```

## MCP Server

Add to your Copilot Chat or Claude Desktop config to query monitoring data conversationally:

```json
{
  "mcpServers": {
    "agentcraftworks-hub": {
      "command": "node",
      "args": ["scripts/hub-mcp-server.js"],
      "env": { "GITHUB_TOKEN": "<your-token>", "GITHUB_ENTERPRISE": "AICraftworks" }
    }
  }
}
```

Available tools: `get_rate_limits`, `get_token_activity`, `get_actions_minutes`, `get_copilot_usage`, `get_billing_summary`

## Build from Source

```bash
npm run build      # Production build
npm run dist       # Build installer (.exe / .dmg / .AppImage)
```

## Required Token Scopes

| Feature | Required scope |
|---------|---------------|
| Rate limits | Any authenticated token |
| Actions minutes | `read:enterprise` |
| Copilot usage | `manage_billing:copilot` |
| Token activity (who is calling) | `read:audit_log` (enterprise admin) |

## Creating a Release

```bash
git tag v0.1.0
git push origin v0.1.0
# GitHub Actions builds and publishes installers automatically
```

