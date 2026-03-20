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

Phase 1: Data foundation

1. Add `GhawInsightsPoller` in main process.
2. Extend `GitHubMonitorService` snapshot with `ghawInsights`.
3. Add IPC endpoints in `hub-handlers.ts`:
   - `hub:getGhawSnapshot`
   - `hub:refreshGhaw`
4. Extend preload API (`window.hubAPI`) for GHAW snapshot + refresh.
5. Add shared types in `hub-types.ts`.

Phase 2: UI integration

6. Add dashboard tabs inside `HubDashboard.tsx`.
7. Create new components under `src/renderer/components/dashboard/ghaw/`:
   - `GhawSummaryCards.tsx`
   - `GhawHotspotsTable.tsx`
   - `GhawAnomalyFeed.tsx`
   - `GhawWorkflowCatalog.tsx`
8. Add `useGhawInsights` hook.

Phase 3: Minutes + anomaly quality

9. Add trailing-window aggregation logic (7d/30d).
10. Add job-level OS weighting for billable estimate.
11. Add dedupe/anomaly rule engine with thresholds configurable.

Phase 4: hardening

12. Add tests for aggregation/anomaly rules.
13. Add docs and operator notes.
14. Optional alert integration via existing `AlertService`.

## 9) File-Level Change Plan

Main process

- `src/main/github/GitHubMonitorService.ts`
- `src/main/ipc/hub-handlers.ts`
- New: `src/main/github/GhawInsightsPoller.ts`
- New: `src/main/github/GhawAnomalyEngine.ts`
- New: `src/main/github/GhawRunStore.ts`

Preload

- `src/preload/index.ts`

Shared

- `src/shared/hub-types.ts`

Renderer

- `src/renderer/components/dashboard/HubDashboard.tsx`
- New: `src/renderer/components/dashboard/ghaw/*`
- New: `src/renderer/hooks/useGhawInsights.ts`
- Optional typings cleanup for `window.hubAPI`

## 10) Acceptance Criteria

1. User can switch between GitHub Usage and GHAW Insights in Hub.
2. Dashboard shows top hotspots and anomalies for 7d and 30d.
3. Dashboard shows estimated GHAW minutes for 7d and 30d, with methodology label.
4. User can drill into a workflow and inspect recent problematic runs.
5. Data refresh works from Hub refresh control.
6. No degradation to existing GitHub Usage panels.

## 11) Risks and Mitigations

- API rate pressure from multi-repo run polling:
  - Mitigation: cache, incremental fetches, ETag support, staggered polling.
- Billing precision ambiguity for “Copilot minutes”:
  - Mitigation: explicitly label estimate methodology and provide confidence note.
- Enterprise permission differences:
  - Mitigation: partial data rendering with per-panel error states.

## 12) Recommended Next Step

Implement Phase 1 + Phase 2 behind a feature flag (`hub.ghawInsights.enabled`) to validate data quality and UI ergonomics before enabling anomaly alerts and cost rollups.
