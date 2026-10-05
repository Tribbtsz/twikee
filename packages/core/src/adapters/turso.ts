import { createClient as createServerlessClient } from '@tursodatabase/serverless/compat'
import { createClient as createLibsqlClient } from '@libsql/client'
import type { Client } from '@tursodatabase/serverless/compat'
import type {
  Comment,
  User,
  CreateCommentInput,
  UpdateCommentInput,
  CommentQuery,
  PaginatedResult,
  TursoConfig,
} from '../types'
import {
  DatabaseAdapter,
  type CommentRepository,
  type CommentStats,
  type LikeResult,
  type UserRepository,
  type ConfigRepository,
} from './base'
import { MigrationRunner } from '../migrations/runner'
import { migrations } from '../migrations'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/** likes 表主键冲突（并发双击时后到者会撞上） */
function isPrimaryKeyViolation(err: unknown): boolean {
  const code = (err as { code?: string; extendedCode?: string } | null)?.code
  if (code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true
  const message = String((err as Error | undefined)?.message ?? '')
  return /UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(message)
}

/**
 * SQLite 的 NULL 读出来是 JS `null`，而 Comment/User 的可选字段类型是 undefined。
 * 不归一化的话类型是谎言：`x.mail === undefined` 永远为 false，API 序列化后
 * 前端还会收到 `"mail": null`。所有从库里读出来的文本字段都过这个函数。
 */
function normalizeText(value: unknown): string | undefined {
  if (value == null) return undefined
  return String(value)
}

// 本地 SQLite 文件：确保父目录存在，否则 libsql 会报 SQLITE_CANTOPEN(14)
function ensureLocalDbDir(url: string): void {
  const path = url.startsWith('file:') ? url.slice('file:'.length) : url
  if (!path || path === ':memory:') return
  const dir = dirname(resolve(path))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

class TursoCommentRepository implements CommentRepository {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  async create(data: CreateCommentInput): Promise<Comment> {
    const id = data.id ?? randomUUID()
    const now = data.createdAt ?? Date.now()
    const likes = data.likes ?? 0
    const isSpam = data.isSpam ?? false
    const master = data.master ?? false
    const top = data.top ?? false
    const deleted = data.deleted ?? false

    await this.client.execute({
      sql: `INSERT INTO comments (id, url, nick, mail, link, content, ua, ip, rid, pid, master, top, is_spam, likes, deleted, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        data.url,
        data.nick,
        data.mail ?? null,
        data.link ?? null,
        data.content,
        data.ua ?? null,
        data.ip ?? null,
        data.rid ?? null,
        data.pid ?? null,
        master ? 1 : 0,
        top ? 1 : 0,
        isSpam ? 1 : 0,
        likes,
        deleted ? 1 : 0,
        now,
        data.updatedAt ?? null,
      ],
    })

    return {
      id,
      url: data.url,
      nick: data.nick,
      mail: data.mail,
      link: data.link,
      content: data.content,
      ua: data.ua,
      ip: data.ip,
      master,
      top,
      rid: data.rid,
      pid: data.pid,
      isSpam,
      deleted,
      likes,
      createdAt: now,
      updatedAt: data.updatedAt,
    }
  }

  async getById(id: string): Promise<Comment | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM comments WHERE id = ?',
      args: [id],
    })

    if (result.rows.length === 0) return null
    return this.rowToComment(result.rows[0])
  }

  async getList(query: CommentQuery): Promise<PaginatedResult<Comment>> {
    const { url, page = 1, pageSize = 10, includeSpam = false, includeDeleted = false, status } = query
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const args: (string | number)[] = []
    if (url) {
      conditions.push('url = ?')
      args.push(url)
    }
    // 显式 status 优先于 includeSpam：approved/spam 直接落 SQL 条件，
    // 这样 count 与 list 用同一个 where，分页与计数天然一致
    if (status === 'spam') conditions.push('is_spam = 1')
    else if (status === 'approved') conditions.push('is_spam = 0')
    else if (!includeSpam) conditions.push('is_spam = 0')
    if (!includeDeleted) conditions.push('deleted = 0')
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countSql = `SELECT COUNT(*) as count FROM comments ${where}`
    const countResult = await this.client.execute({
      sql: countSql,
      args,
    })
    const total = Number(countResult.rows[0].count)

    const listSql = `SELECT * FROM comments ${where} ORDER BY top DESC, created_at DESC LIMIT ? OFFSET ?`
    const listResult = await this.client.execute({
      sql: listSql,
      args: [...args, pageSize, offset],
    })

    return {
      data: listResult.rows.map((row) => this.rowToComment(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async update(id: string, data: UpdateCommentInput): Promise<Comment> {
    const sets: string[] = []
    const args: (string | number | boolean | null)[] = []

    if (data.content !== undefined) {
      sets.push('content = ?')
      args.push(data.content)
    }
    if (data.isSpam !== undefined) {
      sets.push('is_spam = ?')
      args.push(data.isSpam ? 1 : 0)
    }
    if (data.top !== undefined) {
      sets.push('top = ?')
      args.push(data.top ? 1 : 0)
    }
    if (data.master !== undefined) {
      sets.push('master = ?')
      args.push(data.master ? 1 : 0)
    }

    sets.push('updated_at = ?')
    args.push(Date.now())
    args.push(id)

    await this.client.execute({
      sql: `UPDATE comments SET ${sets.join(', ')} WHERE id = ?`,
      args,
    })

    const comment = await this.getById(id)
    if (!comment) throw new Error('Comment not found after update')
    return comment
  }

  async delete(id: string): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM comments WHERE id = ?',
      args: [id],
    })
  }

  async softDelete(id: string): Promise<Comment> {
    await this.client.execute({
      sql: "UPDATE comments SET deleted = 1, top = 0, content = '', updated_at = ? WHERE id = ?",
      args: [Date.now(), id],
    })
    const comment = await this.getById(id)
    if (!comment) throw new Error('Comment not found after soft delete')
    return comment
  }

  /**
   * 点赞 / 取消点赞。
   *
   * 历史实现是「SELECT 判断 → 分别 INSERT/UPDATE」的三次独立写入：并发下两个请求
   * 会同时读到「未赞」而双双插入，且 likes 计数与 likes 表永久漂移。
   * 现在 likes 表是权威源，切换行 + 重算计数放进同一个事务，
   * 并让并发双击走「后到者按取消赞处理」的收敛路径。
   *
   * 这里不能用 batch()：线上远程驱动 @tursodatabase/serverless/compat 的 batch
   * 只转发 sql，**会把 args 丢掉**（见其 dist/compat/index.js 里 `return normalized.sql`），
   * 带参数的语句必然抛 BATCH_ERROR。它的 transaction() 是正常的，所以走事务。
   */
  async like(id: string, userId: string): Promise<LikeResult> {
    const syncCount = {
      sql: 'UPDATE comments SET likes = (SELECT COUNT(*) FROM likes WHERE comment_id = ?) WHERE id = ?',
      args: [id, id],
    }
    const insertLike = {
      sql: 'INSERT INTO likes (comment_id, user_id, created_at) VALUES (?, ?, ?)',
      args: [id, userId, Date.now()],
    }
    const deleteLike = {
      sql: 'DELETE FROM likes WHERE comment_id = ? AND user_id = ?',
      args: [id, userId],
    }

    const existing = await this.client.execute({
      sql: 'SELECT 1 FROM likes WHERE comment_id = ? AND user_id = ?',
      args: [id, userId],
    })

    // 当前未赞 → 本次点击意图是「赞」
    let liked = existing.rows.length === 0

    if (liked) {
      try {
        await this.runAtomic([insertLike, syncCount])
      } catch (err) {
        // 并发双击：两个请求都判定为「未赞」并同时 INSERT，主键约束让后到者失败。
        // 此时该行的赞已存在，本次点击按「取消赞」收敛，保证两次点击 = 最终未赞。
        if (!isPrimaryKeyViolation(err)) throw err
        liked = false
        await this.runAtomic([deleteLike, syncCount])
      }
    } else {
      await this.runAtomic([deleteLike, syncCount])
    }

    const result = await this.client.execute({
      sql: 'SELECT likes FROM comments WHERE id = ?',
      args: [id],
    })
    return { liked, likes: Number(result.rows[0]?.likes ?? 0) }
  }

  /**
   * 原子执行一组写语句。
   *
   * 优先 transaction()：远程 compat 的 batch() 会丢 args（见 like() 的注释），
   * 带参数语句走它必挂。只有客户端没实现事务时才退回 batch —— 那种情况下
   * 本方法只保证「语句都发出去」，原子性由驱动自己决定。
   */
  private async runAtomic(stmts: Array<{ sql: string; args?: unknown[] }>): Promise<void> {
    if (typeof this.client.transaction === 'function') {
      const tx = await this.client.transaction('write')
      try {
        for (const stmt of stmts) {
          await tx.execute(stmt as { sql: string; args?: any[] })
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
      return
    }
    await this.client.batch(stmts as Array<{ sql: string; args?: any[] }>, 'write')
  }

  async getCount(url: string): Promise<number> {
    const result = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM comments WHERE url = ? AND is_spam = 0 AND deleted = 0',
      args: [url],
    })
    return Number(result.rows[0].count)
  }

  async getStats(): Promise<CommentStats> {
    const result = await this.client.execute(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_spam = 0 THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN is_spam = 1 THEN 1 ELSE 0 END) as pending FROM comments WHERE deleted = 0',
    )
    const row = result.rows[0]
    return {
      total: Number(row.total),
      // SUM 在没有行时返回 null，Number(null)=0；为可读性显式兜底
      approved: Number(row.approved ?? 0),
      pending: Number(row.pending ?? 0),
    }
  }

  /**
   * SQLite 的 NULL 在运行时是 JS `null`，不是 `undefined`。
   * 原实现用 `as string | undefined` 断言掩盖了这一点：类型承诺缺失字段，
   * API 序列化后前端收到的却是 `"mail": null`。这里统一归一化为 undefined。
   */
  private rowToComment(row: any): Comment {
    return {
      id: row.id as string,
      url: row.url as string,
      nick: row.nick as string,
      mail: normalizeText(row.mail),
      link: normalizeText(row.link),
      content: row.content as string,
      ua: normalizeText(row.ua),
      ip: normalizeText(row.ip),
      master: Boolean(row.master),
      top: Boolean(row.top),
      rid: normalizeText(row.rid),
      pid: normalizeText(row.pid),
      pinnedFromId: normalizeText(row.pinned_from_id),
      isSpam: Boolean(row.is_spam),
      deleted: Boolean(row.deleted),
      likes: Number(row.likes ?? 0),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at == null ? undefined : (row.updated_at as number),
    }
  }
}

class TursoUserRepository implements UserRepository {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  async getById(id: string): Promise<User | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [id],
    })
    if (result.rows.length === 0) return null
    return this.rowToUser(result.rows[0])
  }

  async getByMail(mail: string): Promise<User | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM users WHERE mail = ?',
      args: [mail],
    })
    if (result.rows.length === 0) return null
    return this.rowToUser(result.rows[0])
  }

  async create(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const id = randomUUID()
    const now = Date.now()

    await this.client.execute({
      sql: 'INSERT INTO users (id, nick, mail, link, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, data.nick, data.mail ?? null, data.link ?? null, data.avatar ?? null, now],
    })

    return { ...data, id, createdAt: now }
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const sets: string[] = []
    const args: (string | number | null)[] = []

    for (const key of ['nick', 'mail', 'link', 'avatar'] as const) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`)
        args.push(data[key] ?? null)
      }
    }

    if (sets.length > 0) {
      args.push(id)
      await this.client.execute({
        sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
        args,
      })
    }

    const user = await this.getById(id)
    if (!user) throw new Error('User not found after update')
    return user
  }

  private rowToUser(row: any): User {
    return {
      id: row.id as string,
      nick: row.nick as string,
      mail: normalizeText(row.mail),
      link: normalizeText(row.link),
      avatar: normalizeText(row.avatar),
      createdAt: row.created_at as number,
    }
  }
}

class TursoConfigRepository implements ConfigRepository {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  async get(key: string): Promise<string | null> {
    const result = await this.client.execute({
      sql: 'SELECT value FROM config WHERE key = ?',
      args: [key],
    })
    if (result.rows.length === 0) return null
    return result.rows[0].value as string
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.execute({
      sql: 'INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)',
      args: [key, value, Date.now()],
    })
  }

  async getAll(): Promise<Record<string, string>> {
    const result = await this.client.execute('SELECT key, value FROM config')
    return Object.fromEntries(result.rows.map((row) => [row.key, row.value]))
  }
}

export class TursoAdapter extends DatabaseAdapter {
  private client: Client
  private _config: TursoConfig

  comments: CommentRepository
  users: UserRepository
  config: ConfigRepository

  constructor(config: TursoConfig) {
    super()
    this._config = config

    // 本地文件 (file:./local.db 或 ./local.db) 用 @libsql/client，远程 Turso 用 serverless 驱动
    const url = config.url
    const isLocal = url.startsWith('file:') || url.startsWith('./') || url.startsWith('/')

    if (isLocal) {
      ensureLocalDbDir(url)
    }

    this.client = (isLocal
      ? createLibsqlClient({
          url,
          authToken: config.authToken || undefined,
        })
      : createServerlessClient({
          url,
          authToken: config.authToken || undefined,
        })) as unknown as Client
    this.comments = new TursoCommentRepository(this.client)
    this.users = new TursoUserRepository(this.client)
    this.config = new TursoConfigRepository(this.client)
  }

  async init(): Promise<void> {
    const runner = new MigrationRunner(this.client)
    await runner.run(migrations)
  }

  async close(): Promise<void> {
    this.client.close()
  }
}
