# dsh-azure-devops

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) bundle that lets an agent work
Azure DevOps (Services) work items and pull requests through Microsoft's official
[`@azure-devops/mcp`](https://github.com/microsoft/azure-devops-mcp) server, under a policy you control.

It does not reimplement the Azure DevOps API. It adds three things on top of the MCP server:

1. **Policy** (`src/policy.ts`): every tool call is classified by *(tool, action)* as read, write or
   forbidden. The default mode is **read-only**; writes can be enabled later, either asking a human first
   or allowed outright (for headless runs). Anything the table does not know is denied, so a newer server
   version cannot silently widen access.
2. **A workflow skill** (`skills/azure-devops-sdlc/SKILL.md`): implement a work item, or rework its pull
   request when a reviewer sends the item back to TODO.
3. **A ready-made profile layer** (`cordis.patch.yml`) that wires the MCP server and the policy together.

## Why a policy layer

The MCP server can filter by *domain* (`--domains`), but not by read vs. write, and its tools mix both
behind an `action` argument (`wit_backlog`, `pipelines_artifact`, `repo_pull_request_write`, ...). Its MCP
annotations are also imprecise for some of those. This bundle classifies each action itself, and
`test/coverage.test.ts` fails if a tool or action in `test/fixtures/ado-mcp-tools.json` is unclassified.

Always forbidden, in every mode:

- `repo_pull_request_write` with `action: vote`: the agent must not approve its own pull request.
- `pipelines_write` with `create_pipeline`, `rename_pipeline`, `update_build_stage`.

The policy also runs as a `tools.guard()`, which no other plugin can override.

This is defence in depth, not the boundary. Enforce the real gate in Azure DevOps with branch policies
(required human reviewer, required build, author cannot approve own changes) and give the agent an identity
that cannot push to the default branch.

## Install

```sh
dsh plugin --profile ado add "github:<owner>/dsh-azure-devops#v0.1.0"
export ADO_ORG=<your-organization>
dsh --profile ado
```

`npm run build` runs on install (`prepare`), so the git ref does not need a committed `lib/`.

### Configuration (environment variables read by `cordis.patch.yml`)

| Variable | Default | Meaning |
|---|---|---|
| `ADO_ORG` | required | Azure DevOps organization name |
| `ADO_AUTH` | `azcli` | `azcli`, `env`, `interactive`, `pat`, `envvar` (see the MCP server docs) |
| `ADO_TENANT_ID` | none | Entra tenant id |
| `ADO_MODE` | `read-only` | `read-only` or `read-write` |
| `ADO_WRITES` | `ask` | in `read-write`: `ask` a human, or `allow` |

Tools appear as `mcp__ado__<tool>`. Only the `repositories`, `work-items`, `pipelines` and `search`
domains are started, which also keeps the tool schemas out of the prompt for the rest.

### Authentication

The MCP server fetches a token on every call, so credential-chain modes refresh by themselves. Prefer
`azcli` (after `az login`) or `env` with a service principal / workload identity for pipelines. Avoid
`envvar` with a fixed token for long sessions: it expires. dsh removes ambient variables whose names match
`KEY|PASSWORD|SECRET|TOKEN` from the MCP child process, so `cordis.patch.yml` forwards
`AZURE_CLIENT_SECRET`, `ADO_MCP_AUTH_TOKEN` and `PERSONAL_ACCESS_TOKEN` explicitly when they are set.

### Deployment note

On Linux, the published `@azure-devops/mcp@2.10.0` loads a native keyring module (`keytar`) at startup and
exits with `libsecret-1.so.0: cannot open shared object file` unless `libsecret-1-0` is installed. Install it
on build agents and containers.

### Skills

Copy `skills/azure-devops-sdlc/` into a skill root your profile scans (see `dsh-skill-filesystem`).

## Using the policy without the bundle

```ts
import { decide } from 'dsh-azure-devops'
decide('mcp__ado__wit_work_item_write', { action: 'update' }, { serverName: 'ado', mode: 'read-only', writes: 'ask' })
// => { kind: 'deny', reason: '...' }
```

## Development

```sh
npm install
npm test            # policy, plugin wiring, and coverage of the server's tool catalog
npm run typecheck
# after bumping @azure-devops/mcp:
ADO_MCP_DIST=/path/to/azure-devops-mcp/dist/index.js node scripts/dump-ado-tools.mjs > test/fixtures/ado-mcp-tools.json
```

## Status and limits

Version 0.1.0 is the policy layer and workflow; it has not been run against a live Azure DevOps
organization. Verified: the policy and plugin wiring (unit tests), the tool catalog of the MCP server
(listed from a real server process), and that the patch's YAML parses and its expressions evaluate.
Not verified: loading the bundle in a real `dsh` profile, how a headless profile answers `ask`
(use `ADO_WRITES=allow` or stay read-only there), and the board-column and auto-complete behaviour
against a real project.

Field-level control inside `wit_work_item_write` `update` (for example restricting which fields or states
may be set) is not implemented.
