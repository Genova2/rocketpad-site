import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'
import { decide, type Mode, type PolicyOptions, type WriteHandling } from './policy.js'

export { classify, decide } from './policy.js'
export type { Decision, Mode, PolicyOptions, ToolClass, WriteHandling } from './policy.js'

export const name = 'dsh-azure-devops'
export const inject = ['tools']

export interface Config {
  serverName: string
  mode: Mode
  writes: WriteHandling
}

export const Config: Schema<Config> = Schema.object({
  serverName: Schema.string().default('ado'),
  mode: Schema.union(['read-only', 'read-write']).default('read-only'),
  writes: Schema.union(['ask', 'allow']).default('ask'),
})

export function apply(ctx: Context, config: Config): void {
  const opts: PolicyOptions = { serverName: config.serverName, mode: config.mode, writes: config.writes }

  // Extensible gate: reads pass, writes are allowed/asked/denied by mode.
  ctx.on('tools/pre-execute', async (exec: ToolExecution, next: () => Promise<PreToolDecision>): Promise<PreToolDecision> => {
    const d = decide(exec.name, exec.arguments, opts)
    switch (d.kind) {
      case 'deny': return { kind: 'deny', reason: d.reason }
      case 'ask': return { kind: 'ask', reason: d.reason }
      default: return next()
    }
  })

  // Monotonic backstop: no other listener can turn a denial back into permission.
  ctx.tools.guard(exec => {
    const d = decide(exec.name, exec.arguments, opts)
    return d.kind === 'deny' ? d.reason : undefined
  })
}
