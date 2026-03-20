## Summary

Standardize ghaw-config.json toggle support across all GHAW workflows that currently lack the guard step, ensuring every workflow in the org can be enabled/disabled from the Hub dashboard.

## Context

Defined in the [GHAW Workflows Dashboard Plan](docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md) — Milestone 3.

Currently these workflows lack the ghaw-config.json guard step:
- ghaw-pr-fix
- ghaw-branch-policy-guard
- ghaw-staging-refresh
- ghaw-changeset
- (and additional repo-specific variants such as ghaw-playwright)

## Deliverables

- [ ] Add ghaw-config.json guard step to each non-compliant workflow
- [ ] Ensure each workflow has a unique, stable WORKFLOW_ID environment variable
- [ ] Add schema validation for ghaw-config.json in CI (optional: JSON Schema linter step)
- [ ] Add a CI linter/check that fails when a new ghaw-* workflow is added without the guard (unless explicitly exempted)
- [ ] Update GHAW_WORKFLOWS_OVERVIEW.md in each affected repo to reflect standardization status

## Acceptance Criteria

- All ghaw-* workflows across AgentCraftworks-CE, AgentCraftworks, AgentCraftworks-VSCode, AgentCraftworks-WebSite are toggle-supported
- CI gate prevents future drift
- ghaw-config.json schema is documented

## Related plan

See: docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md § 9.4, § 10 (Milestone 3)
