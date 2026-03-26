# AgentCraftworks Hub Design Workspace

This folder is the repo-side design source of truth for AgentCraftworks Hub.
It is intended to mirror the current app UI and make design changes trackable through pull requests.

## Figma

Current file details:

- Figma file: https://www.figma.com/design/ysHQKLmIPoI9Q8CoBF5LAd/Hub-Design?node-id=0-1&t=9k8OFXXvghLjPkZ3-1
- Figma team/project: Hub-Design
- Owners: jenp@aicraftworks.ai

## Goals

- Keep visual decisions reviewable in git
- Keep code tokens and design tokens aligned
- Make handoff between design and implementation explicit

## Structure

- `figma-project-setup.md`: Step-by-step instructions for creating the Figma file from current UI
- `tokens/`: Design tokens extracted from app styles
- `components/`: Component inventory and source mapping
- `screens/`: Screen/frame checklist for parity and evolution
- `assets/`: Exported assets and icon notes

## Update Workflow

1. Update Figma draft and capture intended change.
2. Update token or component docs in this folder.
3. Implement code changes.
4. Include before/after screenshots in PR when UI behavior changes.
5. Keep token names stable where possible to avoid drift.

## Source Reference

Current baseline token source in app code:

- `src/renderer/styles/globals.css`
- `src/renderer/components/dashboard/HubDashboard.tsx`
- `src/renderer/App.tsx`
