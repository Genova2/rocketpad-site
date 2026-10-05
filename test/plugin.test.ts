import { describe, expect, it } from 'vitest'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { apply, Config } from '../src/index.js'

type PreHandler = (exec: ToolExecution, next: () => Promise<PreToolDecision>) => Promise<PreToolDecision>

function mount(raw: Partial<Config> = {}) {
  let pre: PreHandler | undefined
  const guards: ((e: ToolExecution) => string | undefined)[] = []
  const ctx = {
    on: (event: string, h: PreHandler) => { if (event === 'tools/pre-execute') pre = h },
    tools: { guard: (g: (e: ToolExecution) => string | undefined) => { guards.push(g) } },
  }
  apply(ctx as never, Config(raw as Config))
  const exec = (name: string, args: unknown) => ({ name, arguments: args }) as unknown as ToolExecution
  return {
    pre: (name: string, args: unknown) => pre!(exec(name, args), async () => ({ kind: 'allow' })),
    guard: (name: string, args: unknown) => guards.map(g => g(exec(name, args))).find(r => r !== undefined),
  }
}

describe('plugin wiring', () => {
  it('defaults to read-only', async () => {
    const p = mount()
    expect((await p.pre('mcp__ado__wit_work_item', { action: 'get' })).kind).toBe('allow')
    expect((await p.pre('mcp__ado__wit_work_item_write', { action: 'update' })).kind).toBe('deny')
    expect(p.guard('mcp__ado__wit_work_item_write', { action: 'update' })).toMatch(/read-only/)
    expect(p.guard('mcp__ado__wit_work_item', { action: 'get' })).toBeUndefined()
  })

  it('delegates calls it has no opinion on to the next listener', async () => {
    const p = mount()
    expect((await p.pre('bash', { command: 'ls' })).kind).toBe('allow')
    expect(p.guard('bash', {})).toBeUndefined()
  })

  it('asks for writes in read-write mode, but the guard does not block an ask', async () => {
    const p = mount({ mode: 'read-write' })
    expect((await p.pre('mcp__ado__repo_create_branch', {})).kind).toBe('ask')
    expect(p.guard('mcp__ado__repo_create_branch', {})).toBeUndefined()
  })

  it('keeps vote denied by the guard even when writes are allowed', async () => {
    const p = mount({ mode: 'read-write', writes: 'allow' })
    expect((await p.pre('mcp__ado__repo_pull_request_write', { action: 'vote' })).kind).toBe('deny')
    expect(p.guard('mcp__ado__repo_pull_request_write', { action: 'vote' })).toBeTruthy()
  })

  it('rejects an invalid mode in config', () => {
    expect(() => Config({ mode: 'yolo' } as never)).toThrow()
  })
})
