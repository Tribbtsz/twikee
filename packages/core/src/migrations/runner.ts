export interface Migration {
  version: number
  name: string
  sql: string[]
}

/** 交互式事务，由驱动在 BEGIN/COMMIT/ROLLBACK 之间保持同一会话 */
export interface MigrationTransaction {
  execute(stmt: { sql: string; args?: any[] }): Promise<unknown>
  commit(): Promise<void>
  rollback(): Promise<void>
}

/**
 * 执行器收到的最小客户端接口。
 *
 * 注意：不能依赖 `batch(stmts, 'write')` 的原子性。本地 `@libsql/client`
 * 会按 mode 生成 BEGIN/COMMIT/ROLLBACK，但远程 `@tursodatabase/serverless/compat`
 * 的 `LibSQLClient.batch` 会把 mode 丢掉、退化成 autocommit（见其 dist 实现）。
 * 两个驱动都实现了 `transaction()`，所以原子迁移优先走它，`batch` 只作兜底。
 */
export interface MigrationClient {
  execute(stmt: { sql: string; args?: any[] }): Promise<{ rows: any[] }>
  execute(sql: string): Promise<{ rows: any[] }>
  batch(
    stmts: Array<{ sql: string; args?: any[] }>,
    mode?: 'deferred' | 'write' | 'read',
  ): Promise<Array<{ rows: any[] }>>
  transaction?(mode?: 'deferred' | 'write' | 'read'): Promise<MigrationTransaction>
}

export class MigrationRunner {
  private client: MigrationClient

  constructor(client: MigrationClient) {
    this.client = client
  }

  async ensureTable(): Promise<void> {
    await this.client.execute({
      sql: `CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )`,
    })
  }

  async getApplied(): Promise<Set<number>> {
    const result = await this.client.execute('SELECT version FROM _migrations ORDER BY version')
    return new Set(result.rows.map((r: any) => r.version as number))
  }

  /**
   * 应用所有未执行的迁移。
   *
   * 每个版本的「全部 SQL + 写 _migrations」必须是原子的：中途失败时前面的语句
   * 若已提交、版本号却没记录，重跑会再次执行；若第一条是
   * `ALTER TABLE ADD COLUMN deleted`（SQLite 无 ADD COLUMN IF NOT EXISTS），
   * 就会每次启动都报 duplicate column，迁移永远无法完成。
   *
   * 优先用 `transaction()`（libsql / serverless compat 两驱动都支持真正的
   * BEGIN/COMMIT/ROLLBACK）；客户端没实现 transaction 时才退回 `batch('write')`。
   */
  async run(migrations: Migration[]): Promise<void> {
    await this.ensureTable()
    const applied = await this.getApplied()
    // 复制一份再排序：migrations 是导出的模块级常量，sort 会就地修改共享状态
    const pending = [...migrations].sort((a, b) => a.version - b.version).filter((m) => !applied.has(m.version))
    if (pending.length === 0) return

    for (const m of pending) {
      const stmts = [
        ...m.sql.map((sql) => ({ sql })),
        {
          sql: 'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
          args: [m.version, m.name, Date.now()],
        },
      ]

      if (typeof this.client.transaction === 'function') {
        const tx = await this.client.transaction('write')
        try {
          for (const stmt of stmts) {
            await tx.execute(stmt)
          }
          await tx.commit()
        } catch (err) {
          try {
            await tx.rollback()
          } catch {
            // 连接已断开等：回滚失败不应掩盖原始错误
          }
          throw err
        }
      } else {
        await this.client.batch(stmts, 'write')
      }
    }
  }
}
