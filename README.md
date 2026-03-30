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
| **Workflow Health** | Real-time GHAW workflow status with configurable health thresholds |
| **Audit Log Activity** | Hourly activity aggregation (24h), actor breakdown (Copilot/Human/Bot), top API callers |

## Recent Features (March 2026)

### GHAW Workflow Health Panel

Real-time monitoring of GitHub Actions workflow health across the organization. The `GhawWorkflowPoller` service polls workflow run data and persists it for trend analysis. Health thresholds are configurable via extracted constants.

### Audit Log Hourly Activity Dashboard

Comprehensive audit log polling with:
- **Hourly aggregation** of API activity over the last 24 hours
- **Actor breakdown** by kind: Copilot, Human, Bot
- **Top API callers** identification within 1-hour windows
- **Enterprise-to-org fallback** — automatically falls back from enterprise audit endpoint to org-level on 403/404

### Deep-Link Routing

Hub deep-link routing infrastructure enables targeted dashboard navigation with context-specific filters. Supports workflow focus and filter propagation for direct navigation to specific dashboard views.

### Branding Consolidation

Complete rebrand from Tangent to AgentCraftworks across all files:
- File renames: `tangent-*.js` to `agentcraftworks-*.js`
- Type updates: `TangentConfig` to `AgentCraftworksConfig`
- Config paths: `~/.tangent` to `~/.agentcraftworks/`
- MCP tool prefixes: `tangent_*` to `agentcraftworks_*`

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

### Action Requests (Sprint 5)

Users with limited entitlements can request higher-tier capabilities. Admins review and approve/reject requests.

#### Submit a Request

```bash
# User requests access to a restricted capability
hub request submit \
  --action agentcraftworks.hub.openMyScope \
  --tier T3 \
  --rationale "Need team-lead approval for quarterly planning"

# Submitter will be auto-populated from env (GITHUB_USER or system user)
# Returns: request ID (e.g., req-1711270451234-a1b2c3d4)
```

**When triggered from VS Code:** If you click "Request Approval" in the Hub Companion panel, the extension pre-fills the action name, tier, and scope automatically.

#### List Requests

```bash
# All requests (any state)
hub request list

# Pending requests only (default limit: 10)
hub request list --state pending --limit 20

# Show resolved (approved/rejected) requests
hub request list --state approved
hub request list --state rejected

# Filter by action or scope (optional)
hub request list --action agentcraftworks.hub.openMyScope
```

**Output format:** JSON array with fields: `createdAt`, `action`, `tier`, `state`, `id`, `actor`, `submitter`, `rationale`, `note` (if approved/rejected)

#### Approve/Reject a Request

```bash
# Approve (requires T3 capability)
hub request approve \
  --id req-1711270451234-a1b2c3d4 \
  --note "Approved for Q2. Expires 2025-07-01."

# Reject
hub request reject \
  --id req-1711270451234-a1b2c3d4 \
  --note "Does not meet security review criteria."

# Both optional: idempotent (approve twice = idempotent)
hub request approve --id req-1711270451234-a1b2c3d4
```

#### Typical Workflow

1. **User in VS Code** clicks "Request Approval" in Hub Companion panel → submits locally
2. **Request appears** in [HubDashboard](src/renderer/components/dashboard/HubDashboard.tsx) `ActionRequestPanel` (with pending count badge)
3. **Admin** reviews in dashboard or via CLI (`hub request list --state pending`)
4. **Admin** approves: `hub request approve --id <req-id> --note "..."`
5. **User's action** is re-enabled in VS Code (or retry the blocked operation → passes auth gate)

**State machine:** `pending` → `approved|rejected` (terminal, idempotent)

**Data location:** `~/.agentcraftworks-hub/action-requests.json` (max 1000 entries, 30-day retention for approved/rejected; pending entries preserved indefinitely)

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

