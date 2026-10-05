import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, rmSync } from 'node:fs'
import { TursoAdapter } from '../turso'

/**
 * 点赞走的是「切换 likes 行 + 重算计数」这组写语句，必须原子。
 *
 * 这里额外模拟线上远程驱动的一个坑：@tursodatabase/serverless/compat 的
 * `batch()` 只转发 sql、**会丢掉 args**（dist/compat/index.js 里
 * `return normalized.sql`），所以带参数的语句一旦走 batch 必然报 BATCH_ERROR
 * —— 线上「点赞无效」就是这么来的。把 batch 换成上面的丢参数版本后，
 * like() 仍然要能跑通，等于给「必须走 transaction()」这条约束上锁。
 */
let counter = 0

function droppingBatch(adapter: TursoAdapter) {
  const repo = adapter.comments as unknown as {
    client: {
      batch: (stmts: Array<{ sql: string }>, mode?: string) => Promise<unknown>
    }
  }
  const client = repo.client
  const original = client.batch.bind(client)
  client.batch = (stmts, mode) =>
    original(
      stmts.map((s) => ({ sql: s.sql })),
      mode,
    )
}

describe('TursoAdapter like', () => {
  let adapter: TursoAdapter
  let dbFile: string
  const userId = '11111111-2222-4333-8444-555555555555'

  beforeEach(async () => {
    dbFile = join(tmpdir(), `twikee-like-${process.pid}-${counter++}.db`)
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

  it('同一身份连点两次 = 赞 → 取消赞，计数跟着回到 0', async () => {
    const comment = await adapter.comments.create({ url: '/p', nick: 'A', content: 'x' })

    const first = await adapter.comments.like(comment.id, userId)
    expect(first.liked).toBe(true)
    expect(first.likes).toBe(1)

    const second = await adapter.comments.like(comment.id, userId)
    expect(second.liked).toBe(false)
    expect(second.likes).toBe(0)
  })

  it('即使驱动的 batch 会丢 args（远程 compat 的行为），点赞依然可用', async () => {
    const comment = await adapter.comments.create({ url: '/p', nick: 'B', content: 'y' })
    droppingBatch(adapter)

    const first = await adapter.comments.like(comment.id, userId)
    expect(first.liked).toBe(true)
    expect(first.likes).toBe(1)

    const second = await adapter.comments.like(comment.id, userId)
    expect(second.liked).toBe(false)
    expect(second.likes).toBe(0)
  })

  it('不同身份各算一次赞', async () => {
    const comment = await adapter.comments.create({ url: '/p', nick: 'C', content: 'z' })

    const a = await adapter.comments.like(comment.id, '11111111-1111-4111-8111-111111111111')
    expect(a.likes).toBe(1)
    const b = await adapter.comments.like(comment.id, '22222222-2222-4222-8222-222222222222')
    expect(b.liked).toBe(true)
    expect(b.likes).toBe(2)
  })
})
