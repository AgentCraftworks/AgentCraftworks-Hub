import { describe, expect, it } from 'vitest'
import { buildDeepLink, parseDeepLink, parseScopeString } from '../hub-contracts'

describe('hub-contracts deep-link routing', () => {
  it('parses workflow run deep-link path patterns', () => {
    const payload = parseDeepLink('agentcraftworks-hub://ghaw/workflows/101/runs/202?scope=org:AICraftWorks')
    expect(payload).not.toBeNull()
    expect(payload?.panel).toBe('workflow-run')
    expect(payload?.scopeRaw).toBe('org:AICraftWorks')
    expect(payload?.filters?.workflowId).toBe(101)
    expect(payload?.filters?.runId).toBe(202)
  })

  it('parses query-based workflow filters', () => {
    const payload = parseDeepLink(
      'agentcraftworks-hub://dashboard?panel=workflows&scope=repo:AgentCraftworks/AgentCraftworks-Hub&status=in_progress&conclusion=failure&actor=hub-desktop&limit=25',
    )
    expect(payload).not.toBeNull()
    expect(payload?.panel).toBe('workflows')
    expect(payload?.filters).toMatchObject({
      status: 'in_progress',
      conclusion: 'failure',
      actor: 'hub-desktop',
      limit: 25,
    })
    expect(payload?.scope).toMatchObject({
      org: 'AgentCraftworks',
      repo: 'AgentCraftworks/AgentCraftworks-Hub',
    })
  })

  it('builds a shareable deep-link that round-trips through parser', () => {
    const built = buildDeepLink({
      panel: 'workflow-run',
      scopeRaw: 'org:AICraftWorks',
      persona: 'ops-admin',
      filters: {
        workflowId: 101,
        runId: 202,
        state: 'pending',
      },
    })
    const parsed = parseDeepLink(built)
    expect(parsed).not.toBeNull()
    expect(parsed?.panel).toBe('workflow-run')
    expect(parsed?.persona).toBe('ops-admin')
    expect(parsed?.filters).toMatchObject({
      workflowId: 101,
      runId: 202,
      state: 'pending',
    })
  })
})

describe('hub-contracts scope parsing', () => {
  it('parses compound scope strings', () => {
    const scope = parseScopeString('org:AICraftWorks,repo:AgentCraftworks/AgentCraftworks-Hub,window:30d')
    expect(scope).toMatchObject({
      org: 'AICraftWorks',
      repo: 'AgentCraftworks/AgentCraftworks-Hub',
      window: '30d',
    })
  })
})
