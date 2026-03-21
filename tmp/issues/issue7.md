## Summary

Implement the dashboard-driven workflow enable/disable toggle for GHAW workflows that already support ghaw-config.json.

## Context

Defined in the [GHAW Workflows Dashboard Plan](docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md) — Workstream D/E, Milestone 2.

Currently, many GHAW workflows check .github/ghaw-config.json for workflows[].enabled. Hub should expose this as an interactive toggle in the inventory view, writing changes back via a PR-based GitHub Contents API flow.

## Deliverables

- [ ] Add GhawConfigService to read, validate, and patch ghaw-config.json per repo (src/main/github/GhawConfigService.ts)
- [ ] Add GhawTogglePlanner to determine toggle safety, branch, and PR creation strategy (src/main/github/GhawTogglePlanner.ts)
- [ ] Implement hub:setGhawWorkflowEnabled IPC handler with:
  - Permission check (Contents API write access)
  - Config patch operation (update or insert entry)
  - PR creation (default) or direct commit (when policy permits)
- [ ] Add per-row Enabled toggle switch in inventory UI (only interactive for 	oggle-supported rows)
- [ ] Add confirmation modal: workflow name, repo, current → requested state, impact, PR target
- [ ] Add toggle history / activity log panel
- [ ] Show Not yet controllable for workflows without ghaw-config.json guard

Workflows known to be toggle-supported:
- ghaw-ci-doctor, ghaw-workflow-health, ghaw-daily-test-improver, ghaw-plan, ghaw-link-checker, ghaw-grumpy-reviewer, ghaw-issue-triage

## Acceptance Criteria

- Toggle action creates a PR in the target repo updating ghaw-config.json
- Toggle history is persisted and displayed in Hub
- Branch protection and permission errors are surfaced gracefully in UI
- 	oggle-supported vs Not yet controllable status is accurate

## Related plan

See: docs/plans/2026-03-20-ghaw-workflows-dashboard-plan.md § 9
