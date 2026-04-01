# AGENTS.md — AgentCraftworks-Hub

> This file follows the [AGENTS.md](https://agents.md/) open standard.

## Project Overview

**AgentCraftworks-Hub** is the central monitoring dashboard for the AgentCraftworks GitHub Enterprise organization (AICraftworks). It is modeled after Windows Task Manager, providing real-time visibility into GitHub API consumption, Actions billing, Copilot usage, and estimated monthly spend.

Built on top of [charris-msft/tangent](https://github.com/charris-msft/tangent) — an Electron terminal app with an AI agents sidebar — extended with a GitHub monitoring dashboard.

## Organizational Boundary

| Component | What it does |
|-----------|-------------|
| **Electron app** (`src/`) | Full desktop dashboard + terminal agent launcher |
| **MCP server** (`packages/mcp-server/`) | Exposes monitoring data as MCP tools for Copilot/Claude |
| **Terminal dashboard** (`packages/terminal-dashboard/`) | Ink TUI — runs inside VS Code integrated terminal via `hub monitor` |

## What belongs here

- GitHub REST API rate limit monitoring and alerting
- GitHub Actions minutes tracking and cost projection
- GitHub Copilot Premium Request consumption per user/org
- GitHub Enterprise billing summary and trend analysis
- Enterprise audit log analysis (who is consuming API quota)
- GHAW workflow health monitoring and trend analysis
- Audit log hourly activity aggregation with actor classification
- Deep-link routing for targeted dashboard navigation
- The `hub` CLI and MCP server that exposes all monitoring data

## What does NOT belong here

- Product source code, MCP server, or AI agent definitions → `AgentCraftworks` / `AgentCraftworks-CE`
- CI/CD optimization or runner infrastructure → `AgentCraftworks-PlatformOps`
- Marketing analytics or customer metrics → `AgentCraftworks-BizOps`

## Repository Structure

```
AgentCraftworks-Hub/
├── packages/
│   ├── mcp-server/           # MCP server: query monitoring data from Copilot/Claude
│   └── terminal-dashboard/   # Ink TUI: hub monitor command for VS Code terminal
├── src/
│   ├── main/
│   │   ├── agents/           # AI agent launcher (from Tangent)
│   │   ├── config/           # App configuration (from Tangent)
│   │   ├── github/           # GitHub monitoring service (NEW)
│   │   │   ├── GitHubMonitorService.ts
│   │   │   ├── RateLimitPoller.ts
│   │   │   ├── BillingPoller.ts
│   │   │   ├── CopilotUsagePoller.ts
│   │   │   ├── AuditLogPoller.ts        # Hourly activity aggregation, actor breakdown
│   │   │   ├── GhawWorkflowPoller.ts    # GHAW workflow health monitoring
│   │   │   └── ActionRequestStore.ts    # Action request approval workflow
│   │   ├── ipc/              # IPC handlers (Tangent + Hub extensions)
│   │   ├── pty/              # Terminal sessions (from Tangent)
│   │   ├── session/          # Session management (from Tangent)
│   │   └── status/           # Status bar (from Tangent)
│   ├── renderer/
│   │   └── components/
│   │       ├── agents/       # Agent sidebar (from Tangent)
│   │       ├── terminal/     # xterm.js terminal (from Tangent)
│   │       └── dashboard/    # Hub monitoring panels (NEW)
│   ├── preload/
│   └── shared/
├── scripts/
│   ├── hub-cli.js            # CLI: hub config, hub agents, hub monitor
│   └── hub-mcp-server.js     # MCP server (GitHub monitoring tools)
└── AGENTS.md
```

## Coding Conventions

- **Runtime**: Node.js 22+ with CommonJS in scripts, ES Modules in src/
- **TypeScript**: Strict mode, `unknown` over `any`
- **React**: Functional components only, hooks for all state
- **Styling**: Tailwind CSS v4
- **Charts**: recharts for all data visualizations
- **GitHub API auth**: Default to `gh auth token`; additional tokens via OS keychain (keytar)

## Key GitHub API Endpoints (Enterprise: AICraftworks)

| Data | Endpoint | Scope required |
|------|----------|---------------|
| Rate limits | `GET /rate_limit` | Any token |
| Audit log (who is calling) | `GET /enterprises/AICraftworks/audit-log` | `read:audit_log` (enterprise admin) |
| Actions minutes | `GET /enterprises/AICraftworks/settings/billing/actions` | `read:enterprise` |
| Copilot usage | `GET /enterprises/AICraftworks/copilot/usage` | `manage_billing:copilot` |
| Billing usage | `GET /enterprises/AICraftworks/settings/billing/usage` | `read:enterprise` |

## ⚠️ Important: Electron ≠ VS Code Terminal

The Electron app runs as a standalone desktop window. It **cannot** be embedded in a VS Code terminal.

For in-terminal / VS Code integrated terminal use, run:
```
hub monitor    # Full Ink TUI (refreshes every 30s)
hub status     # Single-line summary
```

## Branching Policy (MANDATORY)

This repo follows the org-standard promotion flow:

```
feature/* → staging → main → v* tag → GitHub Release
```

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready code; tags trigger releases | PRs from staging only, 1 review required |
| `staging` | Integration testing; pushes trigger cross-platform builds | PRs from feature/* branches, 1 review required |
| `feature/*` | Development work | No restrictions |

### Accepted branch prefixes for PRs to staging

`feature/`, `feat/`, `fix/`, `hotfix/`, `chore/`, `docs/`

### Release process

1. Feature branch → PR to staging (CI runs, review required)
2. Push to staging triggers cross-platform staging builds (artifacts)
3. Test staging artifacts internally
4. staging → PR to main (policy guard enforces this)
5. After merge, staging-refresh recreates staging from main
6. Tag main with `vX.Y.Z` to trigger release to GitHub Releases

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to feature branches, PRs to staging/main | Lint + build validation |
| `ghaw-branch-policy-guard.yml` | PRs to staging/main | Enforces branch flow |
| `ghaw-staging-build.yml` | Push to staging | Cross-platform installer builds (artifacts) |
| `ghaw-staging-refresh.yml` | staging→main PR merged | Resets staging to match main |
| `release.yml` | `v*` tags | Cross-platform build + publish to GitHub Releases |

## Build & Run

```bash
npm install
npm run dev          # Electron app (development)
npm run dist         # Build installer
hub monitor          # Terminal dashboard (after npm link)
```
