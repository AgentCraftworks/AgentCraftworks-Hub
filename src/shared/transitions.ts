import type { SessionStatus } from './types'

const VALID_TRANSITIONS = new Set<string>([
  'shell_ready->agent_launching',
  'agent_launching->agent_ready',
  'agent_launching->failed',
  'agent_ready->processing',
  'agent_ready->shell_ready',
  'processing->agent_ready',
  'processing->tool_executing',
  'processing->needs_input',
  'processing->failed',
  'tool_executing->processing',
  'tool_executing->agent_ready',
  'tool_executing->failed',
  'needs_input->processing',
  'needs_input->agent_ready',
  'failed->agent_ready',
  'failed->processing',
])

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  if (from === 'exited') return false
  if (to === 'exited') return true
  if (to === 'failed') return true
  return VALID_TRANSITIONS.has(`${from}->${to}`)
}
