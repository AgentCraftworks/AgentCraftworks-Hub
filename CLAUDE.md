# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Tangent**, a standalone Electron terminal application with a built-in Agents sidebar. Users navigate to a folder in the terminal, click an Agent (Copilot CLI, Claude Code, etc.) in the sidebar, and the AI tool launches in that terminal session. The full product spec is in `.resources/tangent-prd.md`.

The project is in early stages — currently just Next.js scaffolding. The target architecture is Electron + React + xterm.js (renderer) with node-pty (main process), targeting PowerShell on Windows for MVP.

## Commands

```bash
npm run dev       # Start Next.js dev server (port 3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint (flat config, v9)
```

No test framework is configured yet. The PRD specifies Vitest (unit) + Playwright (e2e).

## Tech Stack

- **Next.js 16** with App Router (not Pages Router)
- **React 19** with server components enabled
- **TypeScript 5** in strict mode
- **Tailwind CSS v4** via `@tailwindcss/postcss` plugin (not the legacy v3 config approach)
- **shadcn/ui** — "new-york" style, lucide icons, CSS variables enabled (see `components.json`)
- **ESLint 9** flat config format (`eslint.config.mjs`)

## Import Aliases

Path alias `@/*` maps to the project root (configured in `tsconfig.json`):
- `@/components` — components
- `@/components/ui` — shadcn/ui components
- `@/lib/utils` — `cn()` class merging utility
- `@/lib` — shared utilities
- `@/hooks` — custom React hooks

## Styling

- Tailwind v4 uses `@import "tailwindcss"` in `app/globals.css` (no `tailwind.config.js`)
- Theme colors use oklch() color space with CSS custom properties
- Dark mode via `@custom-variant dark (&:is(.dark *))`
- The PRD defines a GitHub Dark color theme with specific tokens (`--bg-primary: #0d1117`, etc.)
- Fonts: Geist Sans + Geist Mono (loaded via `next/font/google` in `app/layout.tsx`)

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components install to `@/components/ui`. The config in `components.json` handles style, aliases, and RSC settings.

## Architecture Notes from PRD

The PRD (`.resources/tangent-prd.md`) defines critical patterns that must be followed:

- **Session Naming Rules** (Section "Session Naming Rules"): All three fields (`folderPath`, `folderName`, `name`) must update atomically. Agent detection must NOT change the session name. This was a major bug source in previous iterations.
- **Status Engine**: 8 internal status values mapped to 4 UI states via a pure `mapStatusToUI()` function. All status computation happens in the main process; the renderer is a read-only consumer.
- **Status Detection Priority**: System A (file watcher) always overrides System B (output parsing). System B includes debounce/hysteresis rules to prevent flicker.
- **Valid State Transitions**: Only explicitly listed transitions are allowed. Invalid transitions must be logged and ignored, never thrown.
