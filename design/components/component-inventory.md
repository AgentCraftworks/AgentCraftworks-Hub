# Component Inventory

This inventory maps current UI components to implementation files for Figma parity and handoff.

## App Shell

- App root and overlay orchestration: `src/renderer/App.tsx`
- Sessions list panel: `src/renderer/components/SessionsPanel/SessionsPanel.tsx`
- Terminal viewport: `src/renderer/components/Terminal/TerminalViewport.tsx`
- Agents sidebar: `src/renderer/components/AgentsSidebar/AgentsSidebar.tsx`
- Status bar: `src/renderer/components/StatusBar/StatusBar.tsx`
- Settings panel: `src/renderer/components/SettingsPanel/SettingsPanel.tsx`

## Dashboard

- Dashboard container: `src/renderer/components/dashboard/HubDashboard.tsx`
- Rate limit panel: `src/renderer/components/dashboard/RateLimitPanel.tsx`
- Token activity panel: `src/renderer/components/dashboard/TokenActivityPanel.tsx`
- Actions minutes panel: `src/renderer/components/dashboard/ActionsMinutesPanel.tsx`
- Copilot usage panel: `src/renderer/components/dashboard/CopilotUsagePanel.tsx`
- Billing panel: `src/renderer/components/dashboard/BillingPanel.tsx`
- Token auth panel: `src/renderer/components/dashboard/TokenAuthPanel.tsx`

## Dialogs

- Permission dialog: `src/renderer/components/PermissionDialog.tsx`
- User input dialog: `src/renderer/components/UserInputDialog.tsx`

## Foundations

- Global styles and theme variables: `src/renderer/styles/globals.css`

## Suggested Figma Component Sets

1. App Shell
2. Dashboard Panels
3. Inputs and Buttons
4. Dialogs
5. Status and Badges

## Variant Guidance

Use variants for:

- loading, empty, error, success states
- collapsed and expanded panel states
- active/inactive navigation and tabs
