export interface Migration {
  version: number
  name: string
  sql: string[]
}

/**
 * 执行器收到的最小客户端接口。
 * `batch(stmts, mode)` 在 libsql / serverless 两个驱动下都会带上
 * BEGIN <mode> / COMMIT / ROLLBACK（驱动源码注释确认：single Hrana request
 * with BEGIN/COMMIT/ROLLBACK），因此是真正的原子事务。
 */
export interface MigrationClient {
  execute(stmt: { sql: string; args?: any[] }): Promise<{ rows: any[] }>
  execute(sql: string): Promise<{ rows: any[] }>
  batch(
    stmts: Array<{ sql: string; args?: any[] }>,
    mode?: 'deferred' | 'write' | 'read',
  ): Promise<Array<{ rows: any[] }>>
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
   * 每个版本的「全部 SQL + 写 _migrations」合进同一个 batch('write')：
   * 旧实现逐条 execute，中途失败时前面的语句已提交、版本号却没记录，
   * 重跑会再次执行 —— 若第一条是 `ALTER TABLE ADD COLUMN deleted`
   * （SQLite 无 ADD COLUMN IF NOT EXISTS），就会每次启动都报 duplicate column，
   * 迁移永远无法完成。现在失败即整体回滚，重跑从干净状态开始。
   */
  async run(migrations: Migration[]): Promise<void> {
    await this.ensureTable()
    const applied = await this.getApplied()
    // 复制一份再排序：migrations 是导出的模块级常量，sort 会就地修改共享状态
    const pending = [...migrations].sort((a, b) => a.version - b.version).filter((m) => !applied.has(m.version))
    if (pending.length === 0) return

    for (const m of pending) {
      await this.client.batch(
        [
          ...m.sql.map((sql) => ({ sql })),
          {
            sql: 'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
            args: [m.version, m.name, Date.now()],
          },
        ],
        'write',
      )
    }
  }
}
