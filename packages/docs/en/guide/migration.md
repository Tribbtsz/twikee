---
title: Migrations
description: When Twikee runs database migrations, how to add one, the known limitations and the production upgrade flow.
---

# Database migrations

Twikee manages schema changes through migrations. This page covers **when they run, how to add one, the pitfalls, and how to upgrade production**.

::: warning Read this first
Before changing the schema, read [Known limitations](#known-limitations) and [Production upgrade flow](#production-upgrade-flow) in full.
:::

## When they run

Migrations are triggered by `TursoAdapter.init()`:

```
first /api/* request
  → initDb()                          # packages/api/src/index.ts
    → new TursoAdapter(...)
    → db.init()                       # packages/core/src/adapters/turso.ts
      → new MigrationRunner(client)
      → runner.run(migrations)       # packages/core/src/migrations/index.ts
        → create the _migrations table (if missing)
        → read applied versions
        → run unapplied versions in ascending order
```

Key points:

- **Lazy**: they do not run at process start but on the **first request to any `/api/*` endpoint**.
- **Idempotent skip**: applied versions are recorded in the `_migrations` table and never re-run.
- **Automatic on deploy**: after Vercel deploys new code, the first API request applies new migrations, **with no manual step**.
- **Once per instance**: under serverless multi-instance / cold starts, every new instance runs `run()` once (see limitations below).

The same applies locally: after `pnpm dev`, the first API request creates the database, the tables and applies all migrations.

## Directory layout

```
packages/core/src/migrations/
├── runner.ts              # runner (usually untouched)
├── index.ts               # migration registry ← new migrations MUST be registered here
├── 001-initial.ts         # v1: initial schema
└── 002-soft-delete-top.ts # v2: soft delete + top flag
```

## Adding a migration

1. **Create a file** `packages/core/src/migrations/NNN-description.ts` with `version` set to the current maximum + 1:

   ```ts
   import type { Migration } from './runner'

   export const addFooColumn: Migration = {
     version: 3,
     name: 'add-foo-column',
     sql: [`ALTER TABLE comments ADD COLUMN foo TEXT`],
   }
   ```

2. **Register it in `index.ts`** (skip this and the migration silently never runs):

   ```ts
   import { addFooColumn } from './003-add-foo-column'

   export const migrations: Migration[] = [initial, softDeleteTop, addFooColumn]
   ```

3. **Build and verify**:

   ```bash
   pnpm -F @twikee/core build
   pnpm -F @twikee/core test
   ```

## Rules (important)

| Rule | Why |
|------|-----|
| **Versions only increase**; never edit a released version's SQL | Production already applied the old SQL and will not re-run it; new and old databases would diverge |
| **New migrations must be registered in `index.ts`** | The runner only reads the registry — a missing entry fails silently |
| **Prefer idempotent SQL** | Each version is wrapped in a transaction, but concurrent instances can still run the same DDL twice; idempotency is safer (see below) |
| **Separate DDL and data migrations into different versions** | Narrows the blast radius of a retry and eases debugging |
| **One statement does one thing** | Makes failures easier to pinpoint |

Idempotent patterns:

```sql
-- Good: safe to re-run
CREATE TABLE IF NOT EXISTS foo (...)
CREATE INDEX IF NOT EXISTS idx_foo ON foo(col)
UPDATE comments SET top = 1 WHERE ...          -- assignment is naturally idempotent
DELETE FROM comments WHERE pinned_from_id IS NOT NULL

-- Risky: re-running errors (duplicate column / table already exists)
ALTER TABLE comments ADD COLUMN bar TEXT
CREATE TABLE foo (...)
```

## Known limitations and guarantees

This section covers the **limitations you have to accept today**, the **guarantees you can rely on**, and **what not to break**.

### Current limitation: concurrent instances, no locking

Under serverless, multiple cold instances may enter `run()` at the same time. If there is an unapplied migration, two instances may execute the same DDL concurrently and one returns 500 on the conflict.

- It is usually **transient**: after the conflict the next request sees the version already applied and skips, so the service self-heals.
- Still, **brief 5xx errors can occur during migration** — avoid deploying at peak traffic.
- So **write idempotent SQL whenever possible**, keeping the cost of a concurrent re-run low.

This is the only limitation you have to live with. The next two items are guarantees that already hold today.

### Guarantee: each version runs in a transaction

`runner.run()` puts "all SQL for a version + writing `_migrations`" into a single transaction, so **a failure rolls everything back** and a retry starts clean:

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

Even so, prefer idempotent SQL:

- v1 uses `IF NOT EXISTS` throughout, so it is naturally re-runnable.
- v2 contains `ALTER TABLE ADD COLUMN` (**not idempotent**). The transaction guarantees rollback on a single-instance failure, but concurrent instances applying the same version for the first time can still collide (see "Current limitation" above); idempotency further reduces the impact.

### Guarantee: initialization is atomic and retryable

`initDb()` initializes fully into local variables and only publishes them once everything succeeds, while an `initPromise` lets concurrent requests share the same initialization:

```ts
let db: TursoAdapter | null = null
let initPromise: Promise<void> | null = null

const initDb = async () => {
  if (db) return
  if (!initPromise) {
    initPromise = (async () => {
      const adapter = new TursoAdapter(...)
      await adapter.init() // includes migrations; throws here on failure
      const comments = new CommentService(adapter)
      const auth = new AuthService(adapter)
      db = adapter // assign only after everything succeeds
      commentService = comments
      authService = auth
    })().catch((e) => {
      initPromise = null // release on failure so later requests can retry
      throw e
    })
  }
  await initPromise
}
```

Guarantees:

- **No half-initialized state**: if a migration fails, `db` stays `null` — you never get `db` set while `commentService` is `null`.
- **Recoverable**: after you fix the database (for example a wrong `TURSO_DATABASE_URL`), the next request retries initialization **without restarting the instance**.
- **Initialize once under concurrency**: concurrent requests share one `initPromise`, avoiding duplicate migration runs.

If migrations keep failing, the API returns 500 `Database initialization failed`. The original error appears in the server log after `[Twikee] database initialization failed`.

### Maintainer note: never fall back to `client.batch`

::: danger Keep migrations transactional
Do not replace `transaction()` with `client.batch(stmts, 'write')`. The local `@libsql/client` emits BEGIN/COMMIT/ROLLBACK based on mode, but the remote `@tursodatabase/serverless/compat` `LibSQLClient.batch` drops `mode` and degrades to autocommit (see its `dist/compat/index.js`): if you fall back, production migrations are **no longer one transaction** and a failure will not roll back as a whole. `transaction()` works on both drivers; only fall back to `batch('write')` when the client genuinely does not implement `transaction()`.
:::

## Production upgrade flow

1. **Back up first** (strongly recommended, especially for migrations with `ALTER`/`DELETE`/`UPDATE`):

   ```bash
   turso db shell <db-name> ".dump" > backup-$(date +%F).sql
   # or use the Turso console backup
   ```

2. Merge / sync the code; Vercel deploys automatically.

3. After deployment, **hit the API once** to trigger migrations and confirm a healthy response:

   ```bash
   # Liveness: should return {"status":"ok","timestamp":...}
   # Note: on Vercel, /health must go through a rewrite to reach the function,
   # otherwise it is handled by the static fallback.
   curl -s https://your-api-domain.com/health
   # Actually open the database (triggers and verifies migrations):
   # should return {"data":[...],"total":N,...}
   curl -s "https://your-api-domain.com/api/comment?url=/"
   ```

   If `/health` returns HTML instead of JSON, the `vercel.json` rewrite is missing or was changed.

4. Optionally confirm the migration was applied:

   ```sql
   SELECT version, name, applied_at FROM _migrations ORDER BY version;
   ```

5. On 5xx errors, check Vercel logs for `[Twikee] database initialization failed` / `[Twikee]`, then roll back the code or restore from backup as needed.

## Related files

- Runner: [`runner.ts`](https://github.com/Tribbtsz/twikee/blob/main/packages/core/src/migrations/runner.ts)
- Registry: [`index.ts`](https://github.com/Tribbtsz/twikee/blob/main/packages/core/src/migrations/index.ts)
- Adapter entry: [`turso.ts`](https://github.com/Tribbtsz/twikee/blob/main/packages/core/src/adapters/turso.ts)
- Deployment guide: [Deployment](/en/guide/deployment)
