import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, rmSync } from 'node:fs'
import { TursoAdapter } from '../turso'

/**
 * 用真实本地 libSQL 库验证适配器层，而不是 mock：status 过滤是直接落 SQL
 * where 条件的，只有真跑才能验证 count 与 list 用的是同一套条件。
 */
let counter = 0

describe('TursoAdapter comments.getList status filter', () => {
  let adapter: TursoAdapter
  let dbFile: string

  beforeEach(async () => {
    dbFile = join(tmpdir(), `twikee-adapter-${process.pid}-${counter++}.db`)
    adapter = new TursoAdapter({ url: `file:${dbFile}`, authToken: '' })
    await adapter.init()
    await adapter.comments.create({ url: '/p', nick: 'A', content: 'approved' })
    await adapter.comments.create({ url: '/p', nick: 'B', content: 'pending', isSpam: true })
  })

  afterEach(() => {
    try {
      adapter.close()
    } catch {
      // ignore
    }
    try {
      if (existsSync(dbFile)) rmSync(dbFile, { force: true })
    } catch {
      // ignore
    }
  })

  it('status=all with includeSpam returns every comment', async () => {
    const r = await adapter.comments.getList({ url: '/p', includeSpam: true, status: 'all' })
    expect(r.total).toBe(2)
    expect(r.data).toHaveLength(2)
  })

  it('status=approved returns only non-spam, and total matches', async () => {
    const r = await adapter.comments.getList({ url: '/p', includeSpam: true, status: 'approved' })
    expect(r.total).toBe(1)
    expect(r.data.every((c) => !c.isSpam)).toBe(true)
  })

  it('status=spam returns only spam, and pagination uses the filtered total', async () => {
    const r = await adapter.comments.getList({ url: '/p', includeSpam: true, status: 'spam', pageSize: 10 })
    expect(r.total).toBe(1)
    expect(r.totalPages).toBe(1)
    expect(r.data.every((c) => c.isSpam)).toBe(true)
  })
})
