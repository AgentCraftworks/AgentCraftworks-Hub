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

## Definition of Done — Customer Experience (MANDATORY)

> **⚠️ API tests passing alone does NOT constitute "done."**
> A feature is only complete when a real customer can experience it and that experience has been validated with real product screenshots.

### How CX validation is triggered — the `cx:required` label

Not every PR produces a tangible customer-facing outcome. To keep the standard meaningful without blocking unrelated work:

- **Label issues and PRs with `cx:required`** when the work directly produces or modifies a customer-visible experience.
- Work **without** `cx:required` must carry `cx:exempt` **and** a one-line justification in the PR description (e.g., "backend-only refactor", "partial implementation — CX tracked in #456").
- Author or maintainer can apply `cx:exempt`. **When in doubt, apply `cx:required`.**

### Blocking requirements for all PRs

- [ ] Unit tests pass
- [ ] TypeScript compiles clean
- [ ] ESLint passes
- [ ] PR reviewed and approved
- [ ] PR is labelled **either** `cx:required` **or** `cx:exempt` (with justification)

### Additional blocking requirements for `cx:required` work

> These only apply when the PR or linked issue carries the `cx:required` label.

- [ ] **CX capture spec exists** — `RecordingStudio/capture-specs/<feature-slug>.yaml` with `source_app`, `pass_criteria`, and real product selectors
- [ ] **CX synthetic test passes** — Playwright automation runs against the real running product; all `pass_criteria` assertions succeed
- [ ] **CX demo capture exists** — at least one screenshot or screen recording showing the feature from a customer perspective (real product only, no mocks)
- [ ] **Demo slug added to `cx-capture.yml`** — so the feature stays validated on every weekly CX synthetic run going forward

Full tooling instructions: `AgentCraftworks/RecordingStudio/AGENTS.md`

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
any branch → staging → main → v* tag → GitHub Release
```

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready code; tags trigger releases | PRs from staging only, 1 review required |
| `staging` | Integration testing; pushes trigger cross-platform builds | PRs from any branch; 1 review required |
| Any branch | Development work | No restrictions |

### Release process

1. Any branch → PR to staging (CI runs, review required)
2. Push to staging triggers cross-platform staging builds (artifacts)
3. Test staging artifacts internally
4. staging → PR to main (policy guard enforces this)
5. After merge, staging-refresh recreates staging from main
6. Tag main with `vX.Y.Z` to trigger release to GitHub Releases

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to non-main/staging branches; PRs to staging/main | Lint + build validation |
| `ghaw-branch-policy-guard.yml` | PRs to staging/main | Enforces branch flow |
| `ghaw-build-deploy.yml` | Push to staging/main, `v*` tags, or manual dispatch | Unified build: staging (unpacked dirs), production (full installers), or release (publish to GitHub Releases) |
| `ghaw-staging-refresh.yml` | staging→main PR merged | Resets staging to match main |

## Agent Session Git Hygiene (MANDATORY)

> **❌ `git add .` IS PROHIBITED.** Never use it. It can sweep up thousands of untracked generated or scratch files into your commit, producing PRs with thousands of unintended files. Always stage with explicit paths: `git add <file1> <file2> ...`
>
> **Required before any `git add`:** Run `git status --short` and read every line. Files marked `??` are untracked — they must be verified as intentional before staging. If you see paths you did not create as part of this task, do NOT stage them.

### Pre-staging scope check (MANDATORY — do this before every `git add`)

```bash
# 1. See exactly what you're about to stage
git status --short

# 2. Verify scope — if > ~15 files or any unexpected ?? lines, stop and investigate
#    Do NOT stage scratch files, generated dirs, or files you didn't create

# 3. Stage ONLY the files that are part of this task — by explicit path
git add path/to/file1 path/to/file2

# 4. Confirm what is actually staged before committing
git diff --cached --stat
#    If this shows more files than intended: git restore --staged <unwanted-file>
```

### ⚠️ Never commit to main or staging directly

Verify your branch before any git operation:

```bash
git branch --show-current   # Must NOT be 'main' or 'staging'
```

If it is: **STOP** immediately. Create a feature branch first — `git checkout -b feat/<description>`.

### Commit checklist

```
- [ ] git branch --show-current → NOT main or staging
- [ ] Build/type-check passes
- [ ] git status --short → reviewed all lines, no unexpected ?? files
- [ ] git add <file1> <file2> → EXPLICIT PATHS ONLY — NEVER git add .
- [ ] git diff --cached --stat → staged count matches expectation
- [ ] git commit -m "conventional commit message"
- [ ] git push origin <branch>
- [ ] gh pr create --base staging
```

## Build & Run

```bash
npm install
npm run dev          # Electron app (development)
npm run dist         # Build installer
hub monitor          # Terminal dashboard (after npm link)
```
