# GHAW Workflows Dashboard Plan

Date: 2026-03-20
Owner: AgentCraftworks Hub
Status: Proposed

## 1) Workspace-Wide Review Summary

### 1.1 Repositories with GHAW workflows

- AgentCraftworks: 19 files under `.github/workflows/ghaw-*.yml`
- AgentCraftworks-CE: 19 files under `.github/workflows/ghaw-*.yml`
- AgentCraftworks-VSCode: 7 files under `.github/workflows/ghaw-*.yml`
- AgentCraftworks-WebSite: 7 files under `.github/workflows/ghaw-*.yml`
- AgentCraftworks-PlatformOps: 1 file under `.github/workflows/ghaw-*.yml`
- AgentCraftworks-BizOps: none
- AgentSkillsRegistry: none
- work-iq-mcp: none
- TestRepo: none
- dispatch: none
- AgentCraftworks-Hub: none

### 1.2 Trigger families observed across workspace

- `pull_request`
- `push`
- `workflow_run`
- `check_run`
- `issue_comment`
- `issues`
- `schedule`
- `workflow_dispatch`

### 1.3 Current hotspot/trouble patterns (last 7 days, sampled from active repos)

- High run volume in AgentCraftworks and AgentCraftworks-CE (200+ GH-AW runs/week each).
- High skip rates in PR-fix style workflows (often 100% skipped in multiple repos).
- CI Coach remains high-volume because it is wired to `workflow_run` on TypeScript CI completion.
- Existing known issue pattern confirmed: duplicate/low-value advisory behavior under rapid CI churn.

## 2) Dashboard Objective

Add a new Hub view that answers:

1. Which GHAW workflows are creating the most noise, failures, or skipped executions?
2. Where are anomalies/trouble spots by repo, workflow, and trigger type?
3. How many GitHub Copilot-related minutes are being consumed by GHAW workflows over trailing 7 and 30 days?

## 3) Placement in AgentCraftworks-Hub

### 3.1 UX placement

- Keep existing GitHub Usage dashboard intact.
- Add a second Hub view: **GHAW Insights**.
- Toggle model:
  - Option A (recommended): tab switch inside Hub overlay (`GitHub Usage` | `GHAW Insights`)
  - Option B: second status-bar button (more visual noise, less preferred)

Recommendation: Option A for consistency and shared data lifecycle.

### 3.2 Existing integration points to reuse

- Renderer entry and overlay container:
  - `src/renderer/App.tsx`
  - `src/renderer/components/StatusBar/StatusBar.tsx`
- Existing Hub dashboard scaffold:
  - `src/renderer/components/dashboard/HubDashboard.tsx`
  - `src/renderer/hooks/useHubMonitor.ts`
- Main-process orchestration and IPC:
  - `src/main/ipc/hub-handlers.ts`
  - `src/main/github/GitHubMonitorService.ts`
- Preload namespace:
  - `src/preload/index.ts`
- Shared types:
  - `src/shared/hub-types.ts`

## 4) Proposed Data Model

Extend shared types with GHAW-specific structures.

```ts
interface GhawWorkflowRun {
  repo: string
  workflowName: string
  workflowPath?: string
  trigger: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  runId: number
  runUrl: string
}

interface GhawWorkflowDefinition {
  repo: string
  workflowName: string
  workflowPath: string
  triggers: string[]
  scheduleCrons: string[]
}

interface GhawAnomaly {
  severity: 'info' | 'warning' | 'critical'
  type:
    | 'high_skip_rate'
    | 'high_failure_rate'
    | 'run_spike'
    | 'duration_spike'
    | 'duplicate_advisory_pattern'
  repo: string
  workflowName: string
  metricValue: number
  baselineValue?: number
  note: string
}

interface GhawMinutesSummary {
  window: '7d' | '30d'
  ghawRuntimeMinutes: number
  estimatedBillableMinutes: {
    ubuntu: number
    windows: number
    macos: number
    total: number
  }
  estimatedCostUsd?: number
  methodology: 'run_duration_estimate' | 'billing_api_enriched'
}

interface GhawInsightsSnapshot {
  definitions: GhawWorkflowDefinition[]
  runs7d: GhawWorkflowRun[]
  runs30d: GhawWorkflowRun[]
  anomalies: GhawAnomaly[]
  topHotspots: Array<{
    repo: string
    workflowName: string
    runs7d: number
    failRate7d: number
    skipRate7d: number
    p95DurationMinutes7d: number
  }>
  minutes7d: GhawMinutesSummary
  minutes30d: GhawMinutesSummary
  fetchedAt: number
  error?: string
}
```

## 5) Copilot Minutes (7d/30d) Design

## 5.1 What we can reliably measure now

Use GitHub Actions run timing for workflows whose name starts with `GH-AW:`.

- Source: Actions run list + run timing fields (`run_started_at`, `updated_at`/`completed_at`)
- Group by OS when job-level data is available
- Compute trailing windows:
  - 7 days
  - 30 days

Output:

- Runtime minutes (actual)
- Estimated billable minutes (OS multipliers)
- Estimated cost (optional)

## 5.2 Precision notes

“GitHub Copilot minutes used by workflows” is not consistently exposed as a dedicated per-workflow billing metric in a single public endpoint. Therefore:

- Primary metric: **GHAW Actions runtime/billable estimate** (per workflow/repo/window)
- Enriched metric (optional): correlate with enterprise billing endpoints when available to calibrate estimates
- UI should show a methodology badge (Estimated vs Enriched)

## 5.3 API strategy

- For each repo in scope:
  - List GH-AW runs for 30 days
  - For each run, derive duration and conclusion
  - Optional: fetch jobs for OS-level billable multipliers
- Cache raw run records locally (same pattern as existing history store)

## 6) Hotspot & Anomaly Detection Rules

Initial rules:

1. High skip rate: skip rate >= 70% and runs >= 10 in window
2. High failure rate: failure rate >= 25% and runs >= 8
3. Run spike: daily run count > 2.5x 14-day median
4. Duration spike: p95 duration > 2x 14-day baseline
5. Duplicate advisory pattern:
   - same actor/workflow posting near-identical advisory messages
   - repeated within short interval on same PR

Each anomaly includes severity and action hint.

## 7) Proposed UI for GHAW Insights View

Top section:

- Window switch: 7d / 30d
- KPI cards:
  - Total GH-AW runs
  - Failure rate
  - Skip rate
  - Estimated GHAW minutes
  - Estimated GHAW cost

Middle section:

- Hotspots table (sortable): repo, workflow, runs, fail%, skip%, p95 duration
- Trigger heatmap: trigger type vs repo (run density and failure shading)
- Anomaly feed: chronological cards with severity and drill link

Bottom section:

- Workflow catalog explorer:
  - workflow name
  - repo
  - triggers
  - schedule cron
- Detail drawer for selected workflow:
  - sparkline (daily run count)
  - 7d/30d outcomes
  - recent runs with direct links

## 8) Implementation Plan (AgentCraftworks-Hub)

### 8.1 Workstream A: Data collection and normalization

Goal: collect cross-repo GH-AW workflow definitions and run telemetry into one normalized snapshot.

Deliverables:

1. Add `GhawInsightsPoller` in main process.
2. Add workflow definition scanner:
  - read `.github/workflows/ghaw-*.yml`
  - parse `name`, `on` triggers, schedule cron entries
3. Add run ingestion logic per repo:
  - list runs for trailing 30 days
  - derive conclusion, duration, trigger, run URL
4. Add local cache/store (`GhawRunStore`) to reduce API pressure and support trend views.
5. Extend `GitHubMonitorService` snapshot with `ghawInsights`.

### 8.2 Workstream B: Metrics, hotspots, and anomaly engine

Goal: compute actionable operational signals, not raw tables only.

Deliverables:

1. Aggregators for trailing 7-day and 30-day windows.
2. Hotspot ranking by weighted score:
  - run volume
  - failure rate
  - skip rate
  - p95 duration
3. Anomaly engine (`GhawAnomalyEngine`) implementing rules from Section 6.
4. Confidence and severity scoring (`info`, `warning`, `critical`) with reason text.

### 8.3 Workstream C: Copilot minutes and cost model

Goal: show 7d/30d GH-AW minutes and cost in a way users can trust.

Deliverables:

1. Runtime minutes from Actions run duration.
2. Billable estimate by OS multiplier when job metadata is available.
3. 2 explicit windows:
  - trailing 7 days
  - trailing 30 days
4. Methodology badge and tooltip text:
  - `Estimated (run-duration)`
  - `Enriched (billing-calibrated)` when enterprise billing correlation is available.

### 8.4 Workstream D: Inventory UI and workflow controls

Goal: provide an operational inventory that supports immediate action.

Deliverables:

1. Add tab switch in Hub overlay:
  - `GitHub Usage`
  - `GHAW Insights`
2. Build inventory table with:
  - repo
  - workflow
  - trigger(s)
  - schedule
  - current enable/disable state
  - support status (`toggle-supported`, `toggle-not-supported`)
3. Add enable/disable control in each inventory row.
4. Add confirmation modal with impact summary before applying toggle.
5. Add activity log panel for recent toggle operations.

### 8.5 Workstream E: IPC and preload contracts

Goal: define stable renderer-main contracts for insights and controls.

Deliverables:

1. Add IPC endpoints:
  - `hub:getGhawSnapshot`
  - `hub:refreshGhaw`
  - `hub:setGhawWorkflowEnabled`
  - `hub:getGhawToggleHistory`
2. Extend preload `hubAPI` surface with typed methods for above.
3. Keep existing `hub:getSnapshot` behavior unchanged to avoid regressions.

### 8.6 Workstream F: quality, rollout, and guardrails

Goal: ship safely and avoid new noisy automation.

Deliverables:

1. Unit tests for:
  - aggregators
  - anomaly rules
  - toggle planner logic
2. Integration tests for IPC handlers and permission-denied states.
3. Feature flag: `hub.ghawInsights.enabled`.
4. Progressive rollout:
  - internal only
  - selected repos
  - full org

## 9) Dashboard-driven enable/disable capability

### 9.1 Existing capability status

Many GH-AW workflows already implement `ghaw-config.json` checks (for example, `ghaw-ci-doctor`, `ghaw-workflow-health`, `ghaw-daily-test-improver`, `ghaw-plan`, `ghaw-link-checker`, `ghaw-grumpy-reviewer`, `ghaw-issue-triage`).

There are also workflows without that guard pattern (for example, `ghaw-pr-fix`, `ghaw-branch-policy-guard`, `ghaw-staging-refresh`, `ghaw-changeset`, and repo-specific variants such as `ghaw-playwright`).

Design implication:

- inventory must clearly show whether toggle is supported per workflow.
- unsupported rows should show `Not yet controllable` with a guided action.

### 9.2 Control-plane design

Source of truth for toggle state:

- `.github/ghaw-config.json` in target repo.
- key: `workflows[].id` and `workflows[].enabled`.

Write model from dashboard:

1. User flips workflow toggle in inventory.
2. Hub validates support and target repo permissions.
3. Hub creates a config patch operation:
  - update existing workflow entry
  - or insert new entry if missing
4. Hub writes via GitHub Contents API on a branch and opens PR (recommended default), or direct commit when allowed by policy.
5. Inventory refreshes and records operation in toggle history.

Safety defaults:

- PR-based config updates by default.
- require explicit confirmation for disabling high-criticality workflows.
- show branch protection warning when direct write is blocked.

### 9.3 Toggle UX behavior

Row actions:

- `Enabled` switch (interactive when supported)
- `View config` deep-link to `.github/ghaw-config.json`
- `Explain` action showing why a row is not toggle-supported

Modal content on change:

- workflow name + repo
- current state -> requested state
- expected impact on triggers
- resulting PR/commit target

### 9.4 Backfill and standardization plan

To make toggle capability consistent across all GH-AW workflows:

1. Add config-guard step to workflows missing it.
2. Ensure each workflow has a unique stable `WORKFLOW_ID`.
3. Add schema validation for `ghaw-config.json` in CI.
4. Add linter/check that fails when new `ghaw-*` workflow lacks guard support (unless explicitly exempted).

## 10) Milestones and delivery order

Milestone 1 (Data and read-only insights)

1. Workstream A + B (read-only)
2. UI tab + inventory read-only table
3. 7d/30d minutes (estimated mode)

Milestone 2 (Toggle controls)

1. Implement Workstream E toggle IPC and write pipeline
2. Add row switch, confirmation, operation history
3. Ship toggle for `toggle-supported` workflows only

Milestone 3 (Coverage hardening)

1. Backfill guard support to non-compliant workflows
2. Add policy/linter to prevent future drift
3. Enable org-wide toggle support target

Milestone 4 (Enrichment and alerts)

1. Add billing-calibrated minutes mode
2. Connect severe anomalies to optional alert channel

## 11) File-Level Change Plan

Main process

- `src/main/github/GitHubMonitorService.ts`
- `src/main/ipc/hub-handlers.ts`
- New: `src/main/github/GhawInsightsPoller.ts`
- `src/main/ipc/hub-handlers.ts`
- New: `src/main/github/GhawInsightsPoller.ts`
- New: `src/main/github/GhawAnomalyEngine.ts`
- New: `src/main/github/GhawRunStore.ts`
- New: `src/main/github/GhawConfigService.ts`
- New: `src/main/github/GhawTogglePlanner.ts`

Preload

- `src/preload/index.ts`

Shared

- `src/shared/hub-types.ts`

Renderer

- `src/renderer/components/dashboard/HubDashboard.tsx`
- New: `src/renderer/components/dashboard/ghaw/*`
- New: `src/renderer/hooks/useGhawInsights.ts`
- New: `src/renderer/hooks/useGhawWorkflowToggles.ts`
- Optional typings cleanup for `window.hubAPI`

## 12) Acceptance Criteria

1. User can switch between GitHub Usage and GHAW Insights in Hub.
2. Dashboard shows top hotspots and anomalies for 7d and 30d.
3. Dashboard shows estimated GHAW minutes for 7d and 30d, with methodology label.
4. User can drill into a workflow and inspect recent problematic runs.
5. Data refresh works from Hub refresh control.
6. Inventory clearly shows toggle support status per workflow.
7. User can enable/disable supported workflows from inventory view with confirmation.
8. Toggle action creates auditable PR/commit and shows resulting link in UI.
9. No degradation to existing GitHub Usage panels.

## 13) Risks and Mitigations

- API rate pressure from multi-repo run polling:
  - Mitigation: cache, incremental fetches, ETag support, staggered polling.
- Billing precision ambiguity for “Copilot minutes”:
  - Mitigation: explicitly label estimate methodology and provide confidence note.
- Enterprise permission differences:
  - Mitigation: partial data rendering with per-panel error states.
- Config drift across repos (some workflows support toggle, some do not):
  - Mitigation: show support status in UI and run backfill standardization plan.
- Unsafe disable of critical workflows:
  - Mitigation: criticality flags + confirmation + default PR-based change flow.

## 14) Recommended Next Step

Implement Milestone 1 (read-only insights) and Milestone 2 (toggle controls for already-supported workflows) behind `hub.ghawInsights.enabled`, then start Milestone 3 to standardize toggle support across remaining workflows.
