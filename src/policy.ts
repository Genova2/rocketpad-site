/**
 * Classification of every tool exposed by the official Azure DevOps MCP server
 * (@azure-devops/mcp 2.10.0), keyed by (tool, action).
 *
 * The server's own MCP annotations are not used: several consolidated tools mix
 * reads and writes behind an `action` argument, and some annotations are
 * imprecise (`wit_backlog` list is marked mutating, `pipelines_artifact` too).
 * Anything not listed here is denied, so a newer server version cannot silently
 * widen what the agent may do.
 */
export type ToolClass = 'read' | 'write' | 'forbidden'

/** Tools without an `action` argument. */
const SINGLE: Readonly<Record<string, ToolClass>> = {
  core_list_project_teams: 'read',
  core_list_projects: 'read',
  core_get_identity_ids: 'read',
  mcp_apps_ping: 'read',
  repo_pull_request_org: 'read',
  repo_search_commits: 'read',
  wit_work_item_attachment: 'read',
  testplan_show_test_results_from_build_id: 'read',
  search_code: 'read',
  search_wiki: 'read',
  search_workitem: 'read',
  advsec_get_alerts: 'read',
  advsec_get_alert_details: 'read',
  repo_create_branch: 'write',
  wit_work_item_attachment_upload: 'write',
  wit_work_item_attachment_link: 'write',
  wiki_upsert_page: 'write',
  work_capacity_write: 'write',
}

const reads = (...actions: string[]): Record<string, ToolClass> => Object.fromEntries(actions.map(a => [a, 'read']))
const writes = (...actions: string[]): Record<string, ToolClass> => Object.fromEntries(actions.map(a => [a, 'write']))

/** Tools dispatching on `action`. An action missing from the map is denied. */
const BY_ACTION: Readonly<Record<string, Readonly<Record<string, ToolClass>>>> = {
  work: reads('list_iterations', 'list_team_iterations', 'get_team_settings', 'get_team_capacity', 'get_iteration_capacities'),
  work_iteration_write: writes('create', 'assign'),
  pipelines_build: reads('list', 'get_status', 'get_changes'),
  pipelines_build_log: reads('list', 'get_content'),
  pipelines_definition: reads('list', 'list_revisions'),
  pipelines_run: reads('get', 'list'),
  // `download` is treated as a write: it is annotated mutating upstream and pulls arbitrary artifact bytes.
  pipelines_artifact: { list: 'read', download: 'write' },
  pipelines_write: {
    run_pipeline: 'write',
    create_pipeline: 'forbidden',
    rename_pipeline: 'forbidden',
    update_build_stage: 'forbidden',
  },
  repo_repository: reads('get', 'list'),
  repo_pull_request: reads('get', 'list', 'list_by_commits'),
  repo_pull_request_thread: reads('list', 'list_comments'),
  repo_branch: reads('get', 'list', 'list_mine'),
  repo_file: reads('get_content', 'list_directory'),
  repo_file_write: writes('create', 'update'),
  // `vote` would let the agent approve its own pull request; the human gate must stay human.
  repo_pull_request_write: { create: 'write', update: 'write', update_reviewers: 'write', vote: 'forbidden' },
  repo_pull_request_thread_write: writes('create', 'reply', 'update', 'update_status'),
  wit_work_item: reads('get', 'get_batch', 'list_comments', 'my', 'list_revisions', 'list_for_iteration', 'get_type'),
  wit_query: reads('get', 'get_results', 'wiql'),
  wit_backlog: { list: 'read', list_work_items: 'read', reorder: 'write' },
  wit_work_item_write: writes('create', 'update', 'update_batch', 'add_child'),
  wit_work_item_comment_write: writes('add', 'update'),
  wit_work_item_link_write: writes('link', 'unlink', 'link_to_pull_request', 'add_artifact_link'),
  wiki: reads('list_wikis', 'get_wiki', 'list_pages', 'get_page', 'get_page_content'),
  testplan: reads('list_plans', 'list_suites', 'list_cases'),
  testplan_test_plan_write: writes('create'),
  testplan_test_suite_write: writes('create', 'add_test_cases'),
  testplan_test_case_write: writes('create', 'update_steps'),
}

export type Classification = { readonly class: ToolClass } | { readonly class: 'unknown'; readonly why: string }

export function classify(tool: string, args: unknown): Classification {
  const single = SINGLE[tool]
  if (single !== undefined) return { class: single }

  const actions = BY_ACTION[tool]
  if (actions === undefined) return { class: 'unknown', why: `tool "${tool}" is not in the policy table` }

  const action = typeof args === 'object' && args !== null ? (args as { action?: unknown }).action : undefined
  if (typeof action !== 'string') return { class: 'unknown', why: `tool "${tool}" called without an action` }

  const cls = actions[action]
  if (cls === undefined) return { class: 'unknown', why: `action "${action}" of tool "${tool}" is not in the policy table` }
  return { class: cls }
}

export type Mode = 'read-only' | 'read-write'
export type WriteHandling = 'ask' | 'allow'

export interface PolicyOptions {
  /** Namespace configured on the mcp-client entry; tools are `mcp__<serverName>__<rawName>`. */
  readonly serverName: string
  readonly mode: Mode
  /** In `read-write` mode: ask a human first, or allow outright (needed for headless runs). */
  readonly writes: WriteHandling
}

export type Decision =
  | { readonly kind: 'pass' }
  | { readonly kind: 'allow' }
  | { readonly kind: 'ask'; readonly reason: string }
  | { readonly kind: 'deny'; readonly reason: string }

/** `pass` means the call is not for this server and the policy has no opinion. */
export function decide(toolName: string, args: unknown, opts: PolicyOptions): Decision {
  const prefix = `mcp__${opts.serverName}__`
  if (!toolName.startsWith(prefix)) return { kind: 'pass' }

  const raw = toolName.slice(prefix.length)
  const c = classify(raw, args)

  switch (c.class) {
    case 'read':
      return { kind: 'allow' }
    case 'write':
      if (opts.mode === 'read-only') return { kind: 'deny', reason: `Azure DevOps is read-only in this profile; "${raw}" modifies data.` }
      return opts.writes === 'ask'
        ? { kind: 'ask', reason: `"${raw}" will modify Azure DevOps.` }
        : { kind: 'allow' }
    case 'forbidden':
      return { kind: 'deny', reason: `"${raw}" with this action is never permitted for the agent.` }
    case 'unknown':
      return { kind: 'deny', reason: `Denied by Azure DevOps policy: ${c.why}.` }
  }
}
