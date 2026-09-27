import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@libsql/client'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, rmSync } from 'node:fs'
import { MigrationRunner } from '../../migrations/runner'
import type { Migration } from '../../migrations/runner'
import { initial } from '../../migrations/001-initial'
import { softDeleteTop } from '../../migrations/002-soft-delete-top'

/**
 * 用真实 libSQL 驱动（本地文件库）验证迁移执行器，而不是 mock。
 *
 * 为什么必须真跑：mock 只能验证「我们调用了 batch」，验证不了
 * 「batch(..., 'write') 在驱动层是否真的是原子事务」。而迁移的可靠性
 * 完全建立在后者之上——这是 mock 给不出答案的那类问题。
 */
let counter = 0

describe('MigrationRunner on a real libsql client', () => {
  let client: ReturnType<typeof createClient>
  let runner: MigrationRunner
  let dbFile: string

  beforeEach(() => {
    dbFile = join(tmpdir(), `twikee-mig-${process.pid}-${counter++}.db`)
    client = createClient({ url: `file:${dbFile}` })
    runner = new MigrationRunner(client)
  })

  afterEach(() => {
    try {
      client.close()
    } catch {
      // 关闭失败不掩盖测试结果
    }
    // Windows 上句柄释放有延迟，删不掉就算了，不能让它把测试染红
    try {
      if (existsSync(dbFile)) rmSync(dbFile, { force: true })
    } catch {
      /* ignore */
    }
  })

  it('applies all real migrations and records versions', async () => {
    await runner.run([initial, softDeleteTop])
    expect([...(await runner.getApplied())].sort()).toEqual([1, 2])

    // 表真的建出来了，002 的列也真的加上了
    const cols = await client.execute('PRAGMA table_info(comments)')
    const names = cols.rows.map((r) => r.name)
    expect(names).toContain('deleted')
    expect(names).toContain('top')
    expect(names).toContain('pinned_from_id')
  })

  it('re-running is a no-op', async () => {
    await runner.run([initial, softDeleteTop])
    await runner.run([initial, softDeleteTop])
    expect([...(await runner.getApplied())].sort()).toEqual([1, 2])
  })

  it('rolls back the whole version when a statement fails midway', async () => {
    // 历史 bug 的复现场景：旧执行器逐条 execute，第 1 条已提交、版本号未记录，
    // 重跑再执行 ALTER TABLE ADD COLUMN 就撞 duplicate column，之后每次启动都失败
    const broken: Migration = {
      version: 1,
      name: 'broken',
      sql: [
        'ALTER TABLE comments ADD COLUMN deleted INTEGER DEFAULT 0',
        'THIS IS NOT VALID SQL', // 第二条失败
      ],
    }

    await expect(runner.run([broken])).rejects.toThrow()

    // 版本未记录
    expect((await runner.getApplied()).size).toBe(0)
    // 第一条 ALTER 必须已被回滚，否则重试会报 duplicate column
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='comments'",
    )
    expect(tables.rows).toHaveLength(0)
  })

  it('a fixed migration succeeds after the broken one failed', async () => {
    // 失败后可自愈：不需要人工去库里手工删列/删表
    const broken: Migration = { version: 1, name: 'broken', sql: ['CREATE TABLE t (id TEXT)', 'NOT SQL'] }
    await expect(runner.run([broken])).rejects.toThrow()

    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='t'")
    expect(tables.rows).toHaveLength(0)

    const fixed: Migration = { version: 1, name: 'fixed', sql: ['CREATE TABLE t (id TEXT)'] }
    await runner.run([fixed])
    expect((await runner.getApplied()).has(1)).toBe(true)
  })

  it('applies statements inside a version in declared order', async () => {
    // 构造 v1 时代的库：不含 v2 的 deleted 列 + 置顶副本 + 回复了副本的子评论
    await client.batch(
      [
        `CREATE TABLE comments (
          id TEXT PRIMARY KEY, url TEXT NOT NULL, nick TEXT NOT NULL, mail TEXT, link TEXT,
          content TEXT NOT NULL, ua TEXT, ip TEXT, master INTEGER DEFAULT 0, top INTEGER DEFAULT 0,
          rid TEXT, pid TEXT, pinned_from_id TEXT, is_spam INTEGER DEFAULT 0, likes INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL, updated_at INTEGER
        )`,
        `INSERT INTO comments (id, url, nick, content, rid, top, created_at)
         VALUES ('a', '/p', 'A', 'root', NULL, 0, 1)`,
        `INSERT INTO comments (id, url, nick, content, rid, top, pinned_from_id, created_at)
         VALUES ('copy', '/p', 'A', 'pinned', NULL, 1, 'a', 2)`,
        `INSERT INTO comments (id, url, nick, content, rid, created_at)
         VALUES ('child', '/p', 'B', 'reply', 'copy', 3)`,
      ],
      'write',
    )

    await runner.run([softDeleteTop])

    const rows = await client.execute('SELECT id, rid, top FROM comments ORDER BY created_at')
    // 三件事必须都成立：副本删除、top 回写原评论、子评论改指向原评论（无孤儿）
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows.find((r) => r.id === 'a')!.top).toBe(1)
    expect(rows.rows.find((r) => r.id === 'child')!.rid).toBe('a')
  })

  it('does not mutate the caller-provided migrations array', async () => {
    const list = [softDeleteTop, initial] // 故意乱序
    await runner.run(list)
    expect(list.map((m) => m.version)).toEqual([2, 1]) // 原数组顺序未被就地排序破坏
  })
})
