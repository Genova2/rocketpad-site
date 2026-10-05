import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { classify } from '../src/policy.js'

interface Catalog { server: { version: string }, tools: { name: string, actions: string[] }[] }
const catalog: Catalog = JSON.parse(readFileSync(new URL('./fixtures/ado-mcp-tools.json', import.meta.url), 'utf8'))

// Regenerate with scripts/dump-ado-tools.mjs after bumping @azure-devops/mcp.
describe(`policy covers @azure-devops/mcp ${catalog.server.version}`, () => {
  it('lists tools', () => expect(catalog.tools.length).toBeGreaterThan(40))

  for (const tool of catalog.tools) {
    const actions: (string | undefined)[] = tool.actions.length ? tool.actions : [undefined]
    for (const action of actions) {
      it(`${tool.name}${action ? `:${action}` : ''} is classified`, () => {
        const c = classify(tool.name, action ? { action } : {})
        expect(c, JSON.stringify(c)).not.toMatchObject({ class: 'unknown' })
      })
    }
  }
})
