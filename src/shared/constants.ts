import type { StatusFile, SessionStatus } from './types'

// Status file value -> SessionStatus mapping
export const STATUS_FILE_MAP: Record<StatusFile['status'], SessionStatus> = {
  ready: 'agent_ready',
  processing: 'processing',
  tool: 'tool_executing',
  input: 'needs_input',
  error: 'failed'
}

// OSC 9;4 progress state codes
export const OSC_PROGRESS_STATES = {
  0: 'hidden',
  1: 'indeterminate',
  2: 'normal',
  3: 'error',
  4: 'warning'
} as const

// Timing constants for System B debounce
export const STATUS_TIMING = {
  MIN_HOLD_MS: 500,
  PROMPT_SILENCE_MS: 300,
  FAILED_PERSIST_MS: 2000,
  FAILED_WINDOW_MS: 3000,
  ACTIVITY_TIMEOUT_MS: 60_000,
  AGENT_LAUNCH_TIMEOUT_MS: 30_000,
  OUTPUT_BUFFER_LINES: 20
} as const

// Default zoom
export const ZOOM = {
  DEFAULT: 14,
  MIN: 8,
  MAX: 32,
  STEP: 2
} as const
