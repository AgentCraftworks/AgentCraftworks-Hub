## Summary

Define and implement all new IPC channels and preload contracts needed to expose GHAW Insights data and toggle controls to the renderer process.

## Context

Defined in the [GHAW Workflows Dashboard Plan](docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md) — Workstream E, Milestone 2.

## Deliverables

- [ ] Add IPC handlers in src/main/ipc/hub-handlers.ts:
  - hub:getGhawSnapshot (request-reply)
  - hub:refreshGhaw (request-reply)
  - hub:setGhawWorkflowEnabled (request-reply, write)
  - hub:getGhawToggleHistory (request-reply)
- [ ] Extend preload hubAPI in src/preload/index.ts with typed wrappers for all 4 channels
- [ ] Confirm existing hub:getSnapshot / hub:snapshot events remain unchanged

## Acceptance Criteria

- All 4 new IPC channels are registered and functional
- Preload types are fully typed (no ny)
- No regression on existing hub:getSnapshot / hub:snapshot behavior

## Related plan

See: docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md § 8.5
