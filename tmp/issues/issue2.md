## Summary

Implement aggregation, hotspot ranking, and anomaly detection engine on top of the raw GHAW run data (Workstream A).

## Context

Defined in the [GHAW Workflows Dashboard Plan](docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md) — Workstream B, Milestone 1.

## Deliverables

- [ ] Aggregators for trailing 7d and 30d windows (runs, failure rate, skip rate, p95 duration)
- [ ] Hotspot ranking by weighted score (volume + failure rate + skip rate + p95 duration)
- [ ] GhawAnomalyEngine implementing 5 detection rules:
  - High skip rate (>= 70%, >= 10 runs)
  - High failure rate (>= 25%, >= 8 runs)
  - Run spike (> 2.5x 14-day median)
  - Duration spike (p95 > 2x 14-day baseline)
  - Duplicate advisory pattern detection
- [ ] Confidence and severity scoring (info / warning / critical) with reason text
- [ ] GhawAnomaly type in src/shared/hub-types.ts

## Acceptance Criteria

- Anomaly engine produces correct severity for each rule type
- Hotspot list ranks workflows by weighted score descending
- Unit tests cover all 5 anomaly rule types

## Related plan

See: docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md § 8.2, § 6
