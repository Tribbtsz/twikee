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

  it('status=deleted returns only soft-deleted comments', async () => {
    const created = await adapter.comments.create({ url: '/p', nick: 'C', content: 'to-delete' })
    await adapter.comments.softDelete(created.id)
    const deleted = await adapter.comments.getList({ url: '/p', includeSpam: true, status: 'deleted' })
    expect(deleted.total).toBe(1)
    expect(deleted.data[0].id).toBe(created.id)
    // 普通筛选看不到已删除的
    const all = await adapter.comments.getList({ url: '/p', includeSpam: true, status: 'all' })
    expect(all.total).toBe(2)
  })
})

describe('TursoAdapter comments.getList keyword search', () => {
  let adapter: TursoAdapter
  let dbFile: string

  beforeEach(async () => {
    dbFile = join(tmpdir(), `twikee-adapter-kw-${process.pid}-${counter++}.db`)
    adapter = new TursoAdapter({ url: `file:${dbFile}`, authToken: '' })
    await adapter.init()
    await adapter.comments.create({ url: '/p', nick: 'Alice', content: 'hello world' })
    await adapter.comments.create({ url: '/p', nick: 'Bob', content: 'another post' })
    await adapter.comments.create({ url: '/other', nick: 'Carol', content: 'hello there' })
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

  it('keyword matches content across pages when url is empty', async () => {
    const r = await adapter.comments.getList({ url: '', includeSpam: true, status: 'all', keyword: 'hello' })
    expect(r.total).toBe(2)
    expect(r.data.map((c) => c.nick).sort()).toEqual(['Alice', 'Carol'])
  })

  it('keyword matches nick', async () => {
    const r = await adapter.comments.getList({ url: '', includeSpam: true, status: 'all', keyword: 'bob' })
    expect(r.total).toBe(1)
    expect(r.data[0].nick).toBe('Bob')
  })

  it('keyword composes with url and status filters', async () => {
    const r = await adapter.comments.getList({ url: '/p', includeSpam: true, status: 'all', keyword: 'hello' })
    expect(r.total).toBe(1)
    expect(r.data[0].nick).toBe('Alice')
  })

  it('LIKE wildcards in keyword are escaped, not treated as patterns', async () => {
    // '%' 按字面匹配：三条评论内容里都没有 '%'，应返回 0，而不是全表
    const r = await adapter.comments.getList({ url: '', includeSpam: true, status: 'all', keyword: '%' })
    expect(r.total).toBe(0)
  })
})

/**
 * 列表带总数：COUNT(*) OVER () 把总数并进列表查询，省掉一次独立 COUNT 往返。
 * 这两条用例把「几次往返」和「越界时总数不能丢」都锁住。
 */
describe('TursoAdapter comments.getList total', () => {
  let adapter: TursoAdapter
  let dbFile: string
  let queryCount: () => number

  /** 数适配器发出去的执行次数（本地驱动下一次 execute = 一次往返）。
       注意它猴补的是三个 repo 共享的同一个 client 实例，计的是这个 client 上
       所有的 execute，所以断言只在「getList 内部不发别的查询」时成立。 */
  function trackQueries(target: TursoAdapter) {
    const repo = target.comments as unknown as {
      client: { execute: (...args: any[]) => Promise<unknown> }
    }
    const client = repo.client
    const original = client.execute.bind(client)
    let calls = 0
    client.execute = (...args: any[]) => {
      calls++
      return original(...args)
    }
    return () => calls
  }

  beforeEach(async () => {
    dbFile = join(tmpdir(), `twikee-list-${process.pid}-${counter++}.db`)
    adapter = new TursoAdapter({ url: `file:${dbFile}`, authToken: '' })
    await adapter.init()
    await adapter.comments.create({ url: '/p', nick: 'A', content: 'one' })
    await adapter.comments.create({ url: '/p', nick: 'B', content: 'two' })
    await adapter.comments.create({ url: '/p', nick: 'C', content: 'three' })
    queryCount = trackQueries(adapter)
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

  it('returns list and total in a single query', async () => {
    const before = queryCount()
    const r = await adapter.comments.getList({ url: '/p', pageSize: 10 })
    expect(r.total).toBe(3)
    expect(r.data).toHaveLength(3)
    // 窗口函数把 COUNT 并进了列表语句：常见路径只发一次
    expect(queryCount() - before).toBe(1)
  })

  it('keeps the real total on a partial page', async () => {
    const r = await adapter.comments.getList({ url: '/p', page: 2, pageSize: 2 })
    expect(r.total).toBe(3)
    expect(r.totalPages).toBe(2)
    expect(r.data).toHaveLength(1)
  })

  it('falls back to COUNT when the page is out of range', async () => {
    // 越界页列表为空，窗口函数给不出总数；这时补一次 COUNT，
    // 否则 total 会变 0、分页器失灵
    const before = queryCount()
    const r = await adapter.comments.getList({ url: '/p', page: 99, pageSize: 10 })
    expect(r.data).toHaveLength(0)
    expect(r.total).toBe(3)
    expect(queryCount() - before).toBe(2)
  })

  it('skips the COUNT when the first page is simply empty', async () => {
    // 零评论时第一页就空，总数必然是 0，不值得再补一次 COUNT
    const emptyFile = `${dbFile}-empty`
    const empty = new TursoAdapter({ url: `file:${emptyFile}`, authToken: '' })
    try {
      await empty.init()
      const repo = empty.comments as unknown as { client: { execute: (...a: any[]) => Promise<unknown> } }
      const client = repo.client
      const original = client.execute.bind(client)
      let calls = 0
      client.execute = (...args: any[]) => {
        calls++
        return original(...args)
      }
      const r = await empty.comments.getList({ url: '/nobody', pageSize: 10 })
      expect(r.data).toHaveLength(0)
      expect(r.total).toBe(0)
      expect(r.totalPages).toBe(0)
      expect(calls).toBe(1)
    } finally {
      try {
        empty.close()
      } catch {
        // ignore
      }
      try {
        if (existsSync(emptyFile)) rmSync(emptyFile, { force: true })
      } catch {
        // ignore
      }
    }
  })

  it('filters by url and still reports the filtered total', async () => {
    await adapter.comments.create({ url: '/other', nick: 'D', content: 'four' })
    const r = await adapter.comments.getList({ url: '/p', pageSize: 10 })
    expect(r.total).toBe(3)
    expect(r.data.every((c) => c.url === '/p')).toBe(true)
  })
})

/**
 * 公开端点的 master / isSpam 现在是随 create 一起写入的（原来是创建后补两次
 * update）。这两条用例坐实「create 的入参会落库、也会出现在返回值里」。
 */
describe('TursoAdapter comments.create flags', () => {
  let adapter: TursoAdapter
  let dbFile: string

  beforeEach(async () => {
    dbFile = join(tmpdir(), `twikee-flags-${process.pid}-${counter++}.db`)
    adapter = new TursoAdapter({ url: `file:${dbFile}`, authToken: '' })
    await adapter.init()
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

  it('persists master and isSpam passed at creation', async () => {
    const created = await adapter.comments.create({
      url: '/p',
      nick: 'Blogger',
      content: 'x',
      master: true,
      isSpam: true,
    })
    expect(created.master).toBe(true)
    expect(created.isSpam).toBe(true)

    const readBack = await adapter.comments.getById(created.id)
    expect(readBack?.master).toBe(true)
    expect(readBack?.isSpam).toBe(true)
  })

  it('defaults both flags to false', async () => {
    const created = await adapter.comments.create({ url: '/p', nick: 'Guest', content: 'x' })
    expect(created.master).toBe(false)
    expect(created.isSpam).toBe(false)
  })
})
