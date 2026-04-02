/**
 * Shared inline style constants for dashboard panels.
 *
 * These replace the common Tailwind utility classes used across all panels.
 * Using plain style objects instead of makeStyles because Griffel's strict
 * typing rejects CSS custom properties and rgba() values in many contexts.
 */
import type { CSSProperties } from 'react'

/** Panel outer container — replaces `bg-white/5 rounded-xl p-4 border border-white/10` */
export const panelCard: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '12px',
  padding: '16px',
  border: '1px solid rgba(255,255,255,0.1)',
}

/** Panel card with flex column — same as panelCard + `flex flex-col gap-1` */
export const panelCardFlex: CSSProperties = {
  ...panelCard,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

/** Panel header row — replaces `flex items-center gap-2 text-sm font-semibold text-white/80 mb-3` */
export const panelHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.8)',
  marginBottom: '12px',
}

/** Panel header with justify-between */
export const panelHeaderSpaced: CSSProperties = {
  ...panelHeader,
  justifyContent: 'space-between',
}

/** Refresh button in panel header */
export const refreshBtn: CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 150ms',
  display: 'flex',
  alignItems: 'center',
}

/** Auto-label on right side of header — `ml-auto text-[10px] text-white/30 font-normal` */
export const headerSubtext: CSSProperties = {
  marginLeft: 'auto',
  fontSize: '10px',
  color: 'rgba(255,255,255,0.3)',
  fontWeight: 400,
}

/** Stat box — `bg-white/5 rounded-lg px-3 py-2` */
export const statBox: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '8px',
  paddingLeft: '12px',
  paddingRight: '12px',
  paddingTop: '8px',
  paddingBottom: '8px',
}

/** Stat label — `text-[10px] text-white/40` */
export const statLabel: CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.4)',
}

/** Stat value — `text-lg font-bold tabular-nums text-white/80` */
export const statValue: CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  color: 'rgba(255,255,255,0.8)',
}

/** Stat value highlight — `text-blue-400` */
export const statValueHighlight: CSSProperties = {
  ...statValue,
  color: '#60a5fa',
}

/** Loading state — `text-white/30 text-xs flex items-center justify-center` */
export const loadingState: CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/** Error state with icon — `flex flex-col items-center justify-center gap-2 text-white/30` */
export const errorState: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  color: 'rgba(255,255,255,0.3)',
}

/** Error detail — `text-xs text-center` */
export const errorDetail: CSSProperties = {
  fontSize: '12px',
  textAlign: 'center',
}

/** Scope highlight — `text-white/60` */
export const scopeHighlight: CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
}

/** Fine print — `text-[10px] text-white/20` */
export const finePrint: CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.2)',
  lineHeight: 1.6,
}

/** Section divider — `border-t border-white/10` */
export const divider: CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.1)',
  paddingTop: '12px',
}

/** Progress bar track — `h-2 bg-white/10 rounded-full overflow-hidden` */
export const barTrack: CSSProperties = {
  height: '8px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '999px',
  overflow: 'hidden',
}

/** Thin progress bar track — `h-1 bg-white/10 rounded-full overflow-hidden` */
export const thinBarTrack: CSSProperties = {
  height: '4px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '999px',
  overflow: 'hidden',
}

/** Primary text — `text-white/80` */
export const textPrimary: CSSProperties = { color: 'rgba(255,255,255,0.8)' }

/** Secondary text — `text-white/60` */
export const textSecondary: CSSProperties = { color: 'rgba(255,255,255,0.6)' }

/** Muted text — `text-white/40` */
export const textMuted: CSSProperties = { color: 'rgba(255,255,255,0.4)' }

/** Very muted text — `text-white/30` */
export const textFaint: CSSProperties = { color: 'rgba(255,255,255,0.3)' }

/** Tab button (active) */
export const tabActive: CSSProperties = {
  fontSize: '10px',
  paddingLeft: '8px',
  paddingRight: '8px',
  paddingTop: '2px',
  paddingBottom: '2px',
  borderRadius: '4px',
  background: 'rgba(59,130,246,0.3)',
  color: 'rgb(147,197,253)',
  border: 'none',
  cursor: 'pointer',
}

/** Tab button (inactive) */
export const tabInactive: CSSProperties = {
  fontSize: '10px',
  paddingLeft: '8px',
  paddingRight: '8px',
  paddingTop: '2px',
  paddingBottom: '2px',
  borderRadius: '4px',
  color: 'rgba(255,255,255,0.3)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 150ms',
}

/** Grid 2 columns — `grid grid-cols-2 gap-3` */
export const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '12px',
}

/** Grid responsive 2-4 columns */
export const grid2to4: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px',
}

/** Flex row with gap */
export const flexRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

/** Space-y-2 equivalent */
export const stackSm: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}
