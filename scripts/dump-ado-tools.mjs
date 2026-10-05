// Starts @azure-devops/mcp with a dummy credential (no network needed to list
// tools) and writes the tool/action catalog used by test/coverage.test.ts.
//   node scripts/dump-ado-tools.mjs [version] > test/fixtures/ado-mcp-tools.json
//   ADO_MCP_DIST=/path/to/azure-devops-mcp/dist/index.js node scripts/dump-ado-tools.mjs > ...
// The published package depends on a native keyring module (keytar) that needs
// libsecret-1-0 on Linux; ADO_MCP_DIST lets you use a source build instead.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const version = process.argv[2] ?? 'latest'
const dummy = ['dummyorg', '--authentication', 'envvar', '--tenant', '00000000-0000-0000-0000-000000000000']
const [command, args] = process.env.ADO_MCP_DIST
  ? ['node', [process.env.ADO_MCP_DIST, ...dummy]]
  : ['npx', ['-y', `@azure-devops/mcp@${version}`, ...dummy]]
const transport = new StdioClientTransport({
  command,
  args,
  env: { ...process.env, ADO_MCP_AUTH_TOKEN: 'dummy' },
  stderr: 'ignore',
})
const client = new Client({ name: 'dump-ado-tools', version: '0' })
await client.connect(transport)
const { tools } = await client.listTools()
const out = {
  server: client.getServerVersion(),
  tools: tools
    .map(t => ({ name: t.name, actions: t.inputSchema?.properties?.action?.enum ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name)),
}
console.log(JSON.stringify(out, null, 2))
await client.close()
