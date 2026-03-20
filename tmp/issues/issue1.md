## Summary

Implement GhawInsightsPoller and supporting data collection infrastructure in the AgentCraftworks-Hub main process to gather cross-repo GHAW workflow definitions and run telemetry into one normalized snapshot.

## Context

Defined in the [GHAW Workflows Dashboard Plan](docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md) — Workstream A, Milestone 1.

## Deliverables

- [ ] Add GhawInsightsPoller in main process (src/main/github/GhawInsightsPoller.ts)
- [ ] Add workflow definition scanner (read .github/workflows/ghaw-*.yml, parse 
ame, triggers, schedule crons)
- [ ] Add run ingestion logic per repo (list runs for trailing 30 days; derive conclusion, duration, trigger, run URL)
- [ ] Add GhawRunStore for local caching to reduce API pressure and support trend views (src/main/github/GhawRunStore.ts)
- [ ] Extend GitHubMonitorService snapshot with ghawInsights field
- [ ] Add GhawWorkflowDefinition, GhawWorkflowRun, GhawInsightsSnapshot to src/shared/hub-types.ts

## Acceptance Criteria

- GhawInsightsPoller successfully fetches runs for the last 30 days from all in-scope repos
- Workflow definitions are parsed correctly (triggers, schedule crons)
- Run telemetry is cached locally to avoid redundant API calls

## Related plan

See: docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md § 8.1
