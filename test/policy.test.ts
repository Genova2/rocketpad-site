import { describe, expect, it } from 'vitest'
import { decide, type PolicyOptions } from '../src/policy.js'

const ro: PolicyOptions = { serverName: 'ado', mode: 'read-only', writes: 'ask' }
const rwAsk: PolicyOptions = { serverName: 'ado', mode: 'read-write', writes: 'ask' }
const rwAllow: PolicyOptions = { serverName: 'ado', mode: 'read-write', writes: 'allow' }
const t = (raw: string) => `mcp__ado__${raw}`

describe('decide', () => {
  it('has no opinion on other servers', () => {
    expect(decide('mcp__github__create_issue', {}, ro).kind).toBe('pass')
    expect(decide('bash', { command: 'ls' }, ro).kind).toBe('pass')
  })

  it('allows reads in every mode', () => {
    for (const o of [ro, rwAsk, rwAllow]) {
      expect(decide(t('wit_work_item'), { action: 'get' }, o).kind).toBe('allow')
      expect(decide(t('repo_pull_request_thread'), { action: 'list' }, o).kind).toBe('allow')
      expect(decide(t('search_code'), { searchText: 'x' }, o).kind).toBe('allow')
    }
  })

  it('denies writes in read-only mode', () => {
    expect(decide(t('wit_work_item_write'), { action: 'update' }, ro).kind).toBe('deny')
    expect(decide(t('repo_create_branch'), {}, ro).kind).toBe('deny')
  })

  it('asks or allows writes in read-write mode', () => {
    expect(decide(t('wit_work_item_write'), { action: 'update' }, rwAsk).kind).toBe('ask')
    expect(decide(t('wit_work_item_write'), { action: 'update' }, rwAllow).kind).toBe('allow')
  })

  it('classifies mixed tools per action, not per tool', () => {
    expect(decide(t('wit_backlog'), { action: 'list' }, ro).kind).toBe('allow')
    expect(decide(t('wit_backlog'), { action: 'reorder' }, ro).kind).toBe('deny')
    expect(decide(t('pipelines_artifact'), { action: 'list' }, ro).kind).toBe('allow')
    expect(decide(t('pipelines_artifact'), { action: 'download' }, ro).kind).toBe('deny')
  })

  it('never lets the agent vote, in any mode', () => {
    for (const o of [ro, rwAsk, rwAllow]) {
      expect(decide(t('repo_pull_request_write'), { action: 'vote' }, o).kind).toBe('deny')
    }
    expect(decide(t('repo_pull_request_write'), { action: 'update', autoComplete: true }, rwAllow).kind).toBe('allow')
  })

  it('never lets the agent edit pipeline definitions', () => {
    for (const a of ['create_pipeline', 'rename_pipeline', 'update_build_stage']) {
      expect(decide(t('pipelines_write'), { action: a }, rwAllow).kind).toBe('deny')
    }
    expect(decide(t('pipelines_write'), { action: 'run_pipeline' }, rwAllow).kind).toBe('allow')
  })

  it('denies anything it does not recognise', () => {
    expect(decide(t('brand_new_tool'), {}, rwAllow).kind).toBe('deny')
    expect(decide(t('wit_work_item'), { action: 'delete_everything' }, rwAllow).kind).toBe('deny')
    expect(decide(t('wit_work_item'), {}, rwAllow).kind).toBe('deny')
    expect(decide(t('wit_work_item'), null, rwAllow).kind).toBe('deny')
    expect(decide(t('wit_work_item'), { action: 42 }, rwAllow).kind).toBe('deny')
  })

  it('honours a custom server name', () => {
    const o: PolicyOptions = { serverName: 'azdo', mode: 'read-only', writes: 'ask' }
    expect(decide('mcp__azdo__wit_work_item_write', { action: 'update' }, o).kind).toBe('deny')
    expect(decide('mcp__ado__wit_work_item_write', { action: 'update' }, o).kind).toBe('pass')
  })
})
