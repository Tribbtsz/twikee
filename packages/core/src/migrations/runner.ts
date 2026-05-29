export interface Migration {
  version: number
  name: string
  sql: string[]
}

export class MigrationRunner {
  private client: {
    execute(stmt: { sql: string; args?: any[] }): Promise<{ rows: any[] }>
    execute(sql: string): Promise<{ rows: any[] }>
  }

  constructor(client: { execute(...args: any[]): Promise<{ rows: any[] }> }) {
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

  async run(migrations: Migration[]): Promise<void> {
    await this.ensureTable()
    const applied = await this.getApplied()
    for (const m of migrations.sort((a, b) => a.version - b.version)) {
      if (applied.has(m.version)) continue
      for (const sql of m.sql) {
        await this.client.execute({ sql })
      }
      await this.client.execute({
        sql: 'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
        args: [m.version, m.name, Date.now()],
      })
    }
  }
}
