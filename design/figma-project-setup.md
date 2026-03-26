# Figma Project Setup (AgentCraftworks Hub)

This guide creates a Figma file that matches the current Hub app baseline.

## 1) Create File and Pages

Create one Figma file named: AgentCraftworks Hub - Product Design

Recommended pages:

1. Foundations
2. Components
3. Screens - Current
4. Screens - Explorations
5. Handoff

## 2) Create Variables and Styles

Use token definitions in:

- `design/tokens/colors.json`
- `design/tokens/typography.json`
- `design/tokens/spacing.json`
- `design/tokens/elevation.json`

Set up at least these variable collections:

- Color
- Typography
- Spacing
- Radius
- Elevation

## 3) Rebuild Core Layout

Build the app shell first:

- Left sessions panel
- Center terminal viewport
- Right agents sidebar
- Bottom status bar
- Dashboard overlay state

Primary code references:

- `src/renderer/App.tsx`
- `src/renderer/components/dashboard/HubDashboard.tsx`

## 4) Build Dashboard Components

Implement component frames for:

- RateLimitPanel
- TokenActivityPanel
- ActionsMinutesPanel
- CopilotUsagePanel
- BillingPanel
- TokenAuthPanel

See source inventory:

- `design/components/component-inventory.md`

## 5) Define Responsive Rules

Create desktop-first behavior and test at these widths:

- 1366
- 1280
- 1024

Track panel collapse and overlay behavior as variants where relevant.

## 6) Handoff Checklist

For each approved design change:

1. Add a short rationale in the Figma frame description.
2. Update matching token/component file in this folder.
3. Link the implementation PR in the frame notes.
4. Mark implemented date in the Handoff page.
