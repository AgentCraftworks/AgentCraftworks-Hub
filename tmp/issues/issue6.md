## Summary

Add tests, feature flag, and progressive rollout safety layer before shipping GHAW Insights to the full org.

## Context

Defined in the [GHAW Workflows Dashboard Plan](docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md) — Workstream F, Milestone 3.

## Deliverables

- [ ] Unit tests (Vitest) for:
  - Aggregators (7d/30d windows)
  - Anomaly engine (all 5 rule types)
  - Toggle planner logic
- [ ] Integration tests for IPC handlers (happy path + permission-denied)
- [ ] Feature flag: hub.ghawInsights.enabled (off by default)
- [ ] Progressive rollout gates:
  - Internal only → selected repos → full org

## Acceptance Criteria

- All anomaly rule unit tests pass (table-driven with it.each())
- Feature flag disables GHAW Insights tab entirely when disabled
- Integration test simulates permission-denied state and confirms graceful degradation

## Related plan

See: docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md § 8.6
