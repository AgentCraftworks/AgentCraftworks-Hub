## Summary

Model and expose 7-day and 30-day GHAW workflow runtime minutes (and billable minute estimates) in the Hub snapshot.

## Context

Defined in the [GHAW Workflows Dashboard Plan](docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md) — Workstream C, Milestone 1.

## Deliverables

- [ ] Compute runtime minutes from Actions run durations for workflows named GH-AW:*
- [ ] Apply OS multiplier estimates when job-level metadata is available (ubuntu x1, windows x2, macOS x10)
- [ ] Produce GhawMinutesSummary for both 7d and 30d windows
- [ ] Add methodology badge: Estimated (run-duration) vs Enriched (billing-calibrated) when enterprise billing data is available

## Acceptance Criteria

- Minutes summary is populated for both 7d and 30d windows
- Methodology label is always set and visible in the UI tooltip
- Zero division / empty-data edge cases are handled gracefully

## Related plan

See: docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md § 5, § 8.3
