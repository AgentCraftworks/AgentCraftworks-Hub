# AgentCraftworks-Hub — FY27 Investment Roadmap
## Deliverable 3: Seizing the Copilot / Foundry Agentic Opportunity

**Repo role:** AgentCraftworks-Hub is the **Agent 365 control plane integration layer** — the human control tower over every deployed AgentCraftworks agent. It is the governance mesh that makes agentic transformation deployable in regulated industries and auditable for the Frontier Partner Specialization.

**Strategy anchor:** Section 3 of the AICraftworks FY27 Strategic Analysis (Tier 1: Agent 365, Azure AI Foundry, Copilot Studio extensibility; Tier 2: Purview + Defender + Entra; EC103 Trusted Platform narrative).

---

## Current-State Assessment

### ✅ What Exists Today

| Capability | Implementation | Location |
|---|---|---|
| GitHub API rate limit monitoring | `RateLimitPoller` + history store (SQLite) | `src/main/github/` |
| Actions billing / minutes tracking | `BillingPoller` | `src/main/github/` |
| Copilot Premium Request consumption | `CopilotUsagePoller` | `src/main/github/` |
| Enterprise audit log aggregation | `AuditLogPoller` (enterprise → org fallback) | `src/main/github/` |
| GHAW workflow health monitoring | `GhawWorkflowPoller` | `src/main/github/` |
| Threshold alerting | `AlertService` | `src/main/github/` |
| Action request approval queue | `ActionRequestStore` (T1–T3 tiering, pending/approved/rejected) | `src/main/github/` |
| Immutable operation audit log | `OperationLogStore` | `src/main/github/` |
| Rate governor panel | `RateGovernorPanel` | `src/renderer/components/dashboard/` |
| Squad coordinator + handoff flow | `SquadCoordinatorPanel`, `HandoffFlowPanel` | `src/renderer/components/dashboard/` |
| MCP server | Exposes monitoring as MCP tools for Copilot/Claude | `packages/mcp-server/` |
| Terminal dashboard (`hub monitor`) | Ink TUI, refreshes 30s | `packages/terminal-dashboard/` |

### ❌ Gaps vs Tier 1 Investment Requirements

| Required Capability | Gap | Priority |
|---|---|---|
| Agent 365 integration (live agent estate visibility) | No connection to Agent 365 APIs | 🔴 P1 |
| RBAC for Hub operations | No role/permission model; any token can approve requests | 🔴 P1 |
| Agent versioning registry | No version tracking for deployed agents | 🔴 P1 |
| Kill-switch (emergency stop per agent/scope) | No hard-stop mechanism | 🔴 P1 |
| Purview sensitivity label surfacing | Audit log does not surface DLP/label events | 🟡 P2 |
| Defender for Cloud alert ingestion | No Defender signal in dashboard | 🟡 P2 |
| Entra permission audit surface | No Entra/AAD permission visibility | 🟡 P2 |
| Responsible AI Playbook (productized) | Exists as concept only; not a shippable artifact | 🟡 P2 |
| Azure AI Foundry telemetry ingestion | No Foundry run/token/cost signals | 🟡 P2 |
| Marketplace metering / SaaS billing | No Azure Marketplace metering hooks | 🟠 P3 |
| Copilot Studio agent health | No Studio agent status polling | 🟠 P3 |
| Frontier Partner audit evidence export | No structured audit export | 🟠 P3 |

---

## Engineering Roadmap

### Phase 1 — Agent 365 Control Plane Integration (Q1 FY27 · 6 weeks)

**Goal:** Hub becomes the authoritative view of every deployed AgentCraftworks agent.

#### 1.1 Agent 365 Registry Poller
```
src/main/github/Agent365Poller.ts
```
- Poll Agent 365 REST API (`/agents`, `/agents/{id}/runs`, `/agents/{id}/status`) on a configurable interval (default 60 s).
- Surfaces: agent ID, name, version, owner, status (`active | suspended | terminated`), last-run timestamp, run count, error rate.
- Emit `agent365:update` events into `GitHubMonitorService` snapshot.

**IPC handler additions** (`src/main/ipc/`):
- `hub:agents:list` → returns current `Agent365Snapshot[]`
- `hub:agents:suspend` → calls Agent 365 suspend endpoint; logs to `OperationLogStore`; emits `agent365:suspended`
- `hub:agents:resume` → inverse of suspend

#### 1.2 Kill-Switch Mechanism
```
src/main/github/KillSwitchService.ts
```
- Hard-stop contract: `killSwitch(agentId, reason, actor)` → suspend via Agent 365 API + append `OperationLogStore` entry with `tier: 'T1'` + emit `kill-switch:fired` event.
- **Global kill**: `killSwitchAll(scope, reason, actor)` → suspend all agents in scope; creates a `ActionRequest` with `state: 'approved'` immediately (emergency bypass).
- Cooldown: 5-minute re-activation window enforced locally; cannot be overridden without `ADMIN` role (see RBAC below).
- **UI surface:** Red "Emergency Stop" button in `HubDashboard.tsx`, always visible, keyboard shortcut `Ctrl+Shift+K`.

#### 1.3 Agent Versioning Registry
```
src/main/github/AgentVersionStore.ts
```
- File-backed (`~/.agentcraftworks-hub/agent-versions.json`), mirrors `ActionRequestStore` pattern.
- Schema: `{ agentId, version, deployedAt, deployedBy, sha, changelogUrl, rollbackTarget? }`
- API: `registerVersion`, `listVersions`, `markRollback` (creates `ActionRequest` with tier T2).
- **IPC:** `hub:agents:versions` → version history per agent; `hub:agents:rollback` → triggers rollback `ActionRequest`.

#### 1.4 Dashboard Panel — Agent Control Tower
```
src/renderer/components/dashboard/AgentControlTowerPanel.tsx
```
- Table: agent name | version | status | last run | error rate | kill-switch toggle.
- Badge: `ACTIVE` (green), `SUSPENDED` (amber), `TERMINATED` (red), `DEGRADED` (orange, derived from error rate > 5%).
- Version history drawer: last 5 versions with changelog links.
- Action: inline kill-switch toggle + rollback button (opens confirmation modal).

---

### Phase 2 — RBAC & Audit Trail (Q1–Q2 FY27 · 4 weeks)

**Goal:** Every Hub action is attributable, role-gated, and exportable for the Frontier Partner audit.

#### 2.1 Role Model
```
src/shared/hub-rbac.ts
```
Three roles, least-privilege:

| Role | Permitted actions |
|---|---|
| `VIEWER` | Read-only: snapshots, logs, version history |
| `OPERATOR` | + Approve/reject T3 action requests; submit non-critical operations |
| `ADMIN` | + Kill-switch (all), approve T1/T2 requests, configure thresholds, export audit |

Role assignment: stored in `~/.agentcraftworks-hub/rbac.json`. In the transactable SaaS offer, roles are bound to Entra group membership (Phase 3).

#### 2.2 Audit Trail Export
```
src/main/github/AuditExporter.ts
```
- `exportAuditPackage(startDate, endDate): AuditPackage` → structured JSON + signed manifest.
- Includes: operation log, action requests, kill-switch events, version deployments, login events.
- Format: NDJSON + SHA-256 manifest (Frontier Partner Specialization requirement: "tamper-evident audit log").
- **IPC:** `hub:audit:export` → returns temp file path; `hub:audit:verify` → validates manifest signature.

#### 2.3 Telemetry Pipeline
```
src/main/github/TelemetryService.ts
```
- OpenTelemetry-compatible event emission (spans + metrics).
- Sinks: local OTLP file (always), Azure Monitor / Application Insights (when `APPLICATIONINSIGHTS_CONNECTION_STRING` env var set).
- Tracked metrics: agent runs/hour, approval latency (P50/P95), kill-switch frequency, RBAC role distribution.
- **Specialization requirement:** Frontier Partner audit needs telemetry demonstrating ≥30% "agentic workforce" adoption.

---

### Phase 3 — Purview + Defender + Entra Integration (Q2–Q3 FY27 · 5 weeks)

**Goal:** SecurityHardeningAgent surface; required for EC103 "Trusted Platform" narrative and Frontier Partner Specialization prereq (Data Security or IAM Specialization).

#### 3.1 Purview Sensitivity Label Poller
```
src/main/github/PurviewPoller.ts
```
- Microsoft Graph API: `GET /security/informationProtection/sensitivityLabels`
- Surfaces in Hub: label distribution (Confidential / Highly Confidential / Public) applied to agents, their output documents, and SharePoint/OneDrive destinations.
- Alert rule: any agent producing `HIGHLY CONFIDENTIAL` output without Purview DLP policy → `AlertService` fires `purview:unprotected-output`.
- **Dashboard panel:** `PurviewPanel.tsx` — label heatmap + unprotected output count.

#### 3.2 Defender for Cloud Alert Ingestion
```
src/main/github/DefenderPoller.ts
```
- Microsoft Defender REST API: `GET /subscriptions/{id}/providers/Microsoft.Security/alerts`
- Filter to agent-related alerts: resource type `microsoft.cognitiveservices` (Foundry), `microsoft.botservice` (Copilot Studio).
- Severity bucketing: HIGH / MEDIUM / LOW; emit `defender:high-alert` when HIGH count > 0.
- **Dashboard panel:** `DefenderPanel.tsx` — alert timeline + resource-to-agent mapping.

#### 3.3 Entra Permission Audit Surface
```
src/main/github/EntraAuditPoller.ts
```
- Microsoft Graph API: `GET /servicePrincipals` filtered to AgentCraftworks app registrations.
- Surfaces: app permissions granted, admin consent status, last sign-in, orphaned service principals.
- Alert rule: any service principal with `Directory.ReadWrite.All` or `Mail.ReadWrite` without explicit approval → `ActionRequest` auto-created with `tier: 'T1'`.
- **Dashboard panel:** `EntraAuditPanel.tsx` — permission matrix + consent status + overprivileged SP count.

---

### Phase 4 — Responsible AI Playbook (Productized) (Q2 FY27 · 2 weeks)

**Goal:** The Responsible AI Playbook is a shippable consulting deliverable — not just internal docs.

#### 4.1 Playbook as Structured Artifact
```
docs/responsible-ai/PLAYBOOK.md        ← human-readable
docs/responsible-ai/playbook.schema.json  ← machine-readable (used by MCP tool)
```

**Playbook structure (6 pillars):**

| Pillar | Hub implementation | Evidence type |
|---|---|---|
| **Fairness** | Agent output sampling + demographic parity checks | Automated test suite (`src/__tests__/rai/fairness.test.ts`) |
| **Reliability & Safety** | Kill-switch + kill-switch drill schedule (quarterly) | `OperationLogStore` entries tagged `rai:drill` |
| **Privacy & Security** | Purview label compliance + Entra permission audit | `PurviewPoller` + `EntraAuditPoller` reports |
| **Inclusiveness** | Accessibility audit of Hub UI (WCAG 2.1 AA) | Playwright accessibility tests |
| **Transparency** | Version history + changelog links on every agent | `AgentVersionStore` + public changelog |
| **Accountability** | RBAC audit trail + Frontier Partner export | `AuditExporter` package |

#### 4.2 MCP Tool — `rai_playbook_status`
```
packages/mcp-server/src/tools/raiPlaybook.ts
```
- Input: `{ agentId?: string }` — if omitted, returns org-wide RAI posture.
- Output: pillar scores (0–100), blockers, recommended next actions.
- Used by `SecurityHardeningAgent` in `AgentCraftworks-PlatformOps`.

#### 4.3 Playbook as Marketplace Deliverable
- Packaged as a PDF + JSON bundle downloadable from the transactable SaaS offer.
- Version-controlled; each version tagged `rai-playbook-vX.Y.Z`.
- Included in the Governance Blueprint consulting offer (see `GOVERNANCE_BLUEPRINT.md`).

---

### Phase 5 — Azure AI Foundry Telemetry Ingestion (Q3 FY27 · 3 weeks)

**Goal:** Hub shows Foundry token consumption, latency, model spend, and prompt-shield events alongside GitHub cost signals.

#### 5.1 Foundry Telemetry Poller
```
src/main/github/FoundryPoller.ts
```
- Azure AI Foundry REST API: projects, deployments, usage metrics (tokens/day, cost/day, latency P50/P95, error rate).
- Prompt Shield events: surface when a prompt injection or jailbreak attempt is blocked.
- Emit into `GitHubMonitorService` snapshot (`foundry: FoundryData | null`).

#### 5.2 Dashboard Panel
```
src/renderer/components/dashboard/FoundryUsagePanel.tsx
```
- Token burn chart (per model, per day).
- Model cost breakdown (recharts stacked bar).
- Prompt Shield event counter with drill-down.
- Threshold alert: `foundry:cost-spike` when daily spend exceeds configurable budget.

---

## Implementation Sequence (Gantt)

```
Month 1  ████ Phase 1: Agent 365 Control Plane (KillSwitch, Versioning, Registry Poller)
Month 2  ████ Phase 2: RBAC + Audit Trail + Telemetry
Month 3      ████ Phase 3: Purview + Defender + Entra (start)
Month 4           ████ Phase 3 (finish) + Phase 4: RAI Playbook
Month 5                ████ Phase 5: Foundry Telemetry
Month 6                     ████ Marketplace packaging (see MARKETPLACE_ARCHITECTURE.md)
```

---

## Definition of Done — Per Phase

All work in this roadmap carries `cx:required`. For each phase:

- [ ] TypeScript compiles clean (`npm run build`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Unit tests added for all new stores/pollers
- [ ] E2e Playwright test covers the new dashboard panel
- [ ] MCP tool (if applicable) returns valid schema-validated output
- [ ] `AuditExporter` package includes the phase's new event types
- [ ] PR reviewed, `cx:required` label applied, demo screenshot captured

---

## Funding Alignment

| Phase | Funding lever | Amount |
|---|---|---|
| Phase 1–2 (Agent 365 + RBAC) | MAICPP IUR licenses + MCI Frontier Accelerate Copilot Deployment Accelerator | Up to $100K |
| Phase 3 (Purview + Defender + Entra) | Zero Trust Workshop (pre-sales funded) + ME5 Usage Accelerator | Up to $50K |
| Phase 4 (RAI Playbook) | Envisioning & PoC (pre-sales, up to $25K) | $25K |
| Phase 5 (Foundry Telemetry) | ISV Success Azure credits + Cloud Accelerate Factory | Credits + delivery funding |

---

*Document owner: AgentCraftworks-Hub team*
*Last updated: 2026-07-28*
*Strategy reference: AICraftworks FY27 Strategic Analysis, Section 3 (Deliverable 3)*
