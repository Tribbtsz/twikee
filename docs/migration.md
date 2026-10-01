# 数据库迁移 (Migration)

Twikee 的数据库结构变更通过 migration 管理。本文说明**什么时候跑、怎么新增、有哪些坑、线上怎么升级**。

> ⚠️ 改结构前请务必读完「[已知限制与可靠性说明](#已知限制与可靠性说明)」和「[线上升级流程](#线上升级流程)」两节。

## 什么时候执行

Migration 由 `TursoAdapter.init()` 触发，链路：

```
首个 /api/* 请求
  → initDb()                          # packages/api/src/index.ts
    → new TursoAdapter(...)
    → db.init()                       # packages/core/src/adapters/turso.ts
      → new MigrationRunner(client)
      → runner.run(migrations)       # packages/core/src/migrations/index.ts
        → 建 _migrations 表（如不存在）
        → 读取已应用版本
        → 按 version 升序执行未应用的版本
```

要点：

- **惰性执行**：不是进程启动时跑，而是**第一次访问任意 `/api/*` 接口时**触发。
- **幂等跳过**：已应用的版本号记录在 `_migrations` 表，不会重复执行。
- **自动部署**：Vercel 部署新代码后，第一个访问 API 的请求就会自动应用新迁移，**无需手动操作**。
- **每个实例各跑一次**：serverless 多实例/冷启动下，每个新实例都会执行一次 `run()`（见「已知限制」）。

本地开发同理：`pnpm dev` 后第一次访问 API 会自动建库 + 建表 + 应用全部迁移。

## 目录结构

```
packages/core/src/migrations/
├── runner.ts              # 执行器（一般不需要改）
├── index.ts               # 迁移注册表 ← 新增迁移必须在这里注册
├── 001-initial.ts         # v1：初始表结构
└── 002-soft-delete-top.ts # v2：软删除 + 置顶改 top 标记
```

## 如何新增一次迁移

1. **新建文件** `packages/core/src/migrations/NNN-描述.ts`，`version` 取当前最大版本 +1：

   ```ts
   import type { Migration } from './runner'

   export const addFooColumn: Migration = {
     version: 3,
     name: 'add-foo-column',
     sql: [
       `ALTER TABLE comments ADD COLUMN foo TEXT`,
     ],
   }
   ```

2. **注册到 `index.ts`**（漏了这步迁移不会执行，且没有任何报错）：

   ```ts
   import { addFooColumn } from './003-add-foo-column'

   export const migrations: Migration[] = [
     initial,
     softDeleteTop,
     addFooColumn,
   ]
   ```

3. **构建并验证**：

   ```bash
   pnpm -F @twikee/core build
   pnpm -F @twikee/core test
   ```

## 规范（重要）

| 规则 | 原因 |
|------|------|
| **版本号只增不改**，已发布的版本禁止回改 SQL | 线上库已按旧 SQL 应用过，改了也不会重跑；新库和老库会出现结构不一致 |
| **新迁移必须注册进 `index.ts`** | 执行器只认注册表，漏注册是静默失效 |
| **SQL 尽量写成幂等的** | 迁移已按版本包在事务里；但多实例并发下同一条 DDL 仍可能被重复执行，幂等更安全（见下） |
| **DDL 与数据迁移分开成不同 version** | 缩小失败重试的影响面，便于排查 |
| **单条 SQL 只做一件事** | 便于定位失败点 |

幂等写法参考：

```sql
-- 好：可重复执行
CREATE TABLE IF NOT EXISTS foo (...)
CREATE INDEX IF NOT EXISTS idx_foo ON foo(col)
UPDATE comments SET top = 1 WHERE ...          -- 赋值型天然幂等
DELETE FROM comments WHERE pinned_from_id IS NOT NULL

-- 危险：重跑会报错（duplicate column / table already exists）
ALTER TABLE comments ADD COLUMN bar TEXT
CREATE TABLE foo (...)
```

## 已知限制与可靠性说明

### 1. 每个版本在事务中执行（已修复）

`runner.run()` 把「一个版本的全部 SQL + 写 `_migrations`」放进同一个事务，**失败即整体回滚**，重跑从干净状态开始：

```ts
const tx = await client.transaction('write')
try {
  for (const stmt of stmts) await tx.execute(stmt)
  await tx.commit()
} catch (err) {
  await tx.rollback()
  throw err
}
```

> ⚠️ 不要退回 `client.batch(stmts, 'write')`：本地 `@libsql/client` 会按 mode 生成
> BEGIN/COMMIT/ROLLBACK，但远程 `@tursodatabase/serverless/compat` 的
> `LibSQLClient.batch` 会丢弃 `mode`、退化为 autocommit（见其 `dist/compat/index.js`），
> 生产环境将不再是事务。`transaction()` 在两个驱动上都可用。
> 客户端没实现 `transaction()` 时才退回 `batch('write')` 兜底。

即便如此，仍建议把 SQL 写成幂等的：

- v1 全用 `IF NOT EXISTS`，天然可重跑；
- v2 含 `ALTER TABLE ADD COLUMN`（**不幂等**）。事务保证了单实例失败回滚，但多实例并发同时首次应用同一版本时仍可能冲突（见第 2 节），幂等能进一步降低影响。

### 2. 多实例并发执行，无锁保护

serverless 下多个冷实例可能同时进入 `run()`。若恰好有未应用的迁移，两个实例可能同时执行同一条 DDL，其中一个会因冲突报错而返回 500。

- 通常是**暂时性**的：冲突实例报错后，下一个请求会发现版本已应用而跳过，服务自愈；
- 但**迁移期间可能出现短暂 5xx**，请避开流量高峰发布。

### 3. 初始化失败后可自动重试（已修复）

`initDb()` 采用「先完整初始化到局部变量、全部成功后再发布」的写法，并用 `initPromise` 让并发请求共享同一次初始化：

```ts
let db: TursoAdapter | null = null
let initPromise: Promise<void> | null = null

const initDb = async () => {
  if (db) return
  if (!initPromise) {
    initPromise = (async () => {
      const adapter = new TursoAdapter(...)
      await adapter.init()            // 含 migration，失败在此抛错
      const comments = new CommentService(adapter)
      const auth = new AuthService(adapter)
      db = adapter                    // 全部成功后才赋值
      commentService = comments
      authService = auth
    })().catch((e) => {
      initPromise = null              // 失败后释放，允许后续请求重试
      throw e
    })
  }
  await initPromise
}
```

行为保证：

- **不会半初始化**：migration 失败时 `db` 仍为 `null`，不会出现 `db` 有值但 `commentService` 为 `null` 的状态；
- **失败可恢复**：修复数据库（如修正 `TURSO_DATABASE_URL`）后，下一个请求会自动重试初始化，**无需重启实例**；
- **并发只初始化一次**：多个并发请求共享同一个 `initPromise`，避免重复跑 migration。

若迁移持续失败，接口会稳定返回 500 `Database initialization failed`，具体原因见服务端日志中 `[Twikee] database initialization failed` 后的原始错误。

## 线上升级流程

1. **先备份**（强烈建议，尤其是含 `ALTER`/`DELETE`/`UPDATE` 的迁移）：

   ```bash
   turso db shell <db-name> ".dump" > backup-$(date +%F).sql
   # 或使用 Turso 控制台的备份功能
   ```

2. 合并/同步代码，Vercel 自动部署。

3. 部署完成后**主动访问一次 API** 触发迁移，并确认返回正常：

   ```bash
   curl -s https://your-api-domain.com/health
   curl -s "https://your-api-domain.com/api/comment?url=/"
   ```

4. 核对迁移是否应用（可选）：

   ```sql
   SELECT version, name, applied_at FROM _migrations ORDER BY version;
   ```

5. 若出现 5xx，检查 Vercel 日志中的 `[Twikee] database initialization failed` / `[Twikee]` 报错，按需回滚代码或从备份恢复。

## 相关文件

- 执行器：[`packages/core/src/migrations/runner.ts`](../packages/core/src/migrations/runner.ts)
- 注册表：[`packages/core/src/migrations/index.ts`](../packages/core/src/migrations/index.ts)
- 适配器入口：[`packages/core/src/adapters/turso.ts`](../packages/core/src/adapters/turso.ts)
- 部署说明：[`docs/deployment.md`](./deployment.md)
