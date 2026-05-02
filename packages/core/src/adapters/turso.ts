import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import type {
  Comment,
  User,
  Config,
  CreateCommentInput,
  UpdateCommentInput,
  CommentQuery,
  PaginatedResult,
  TursoConfig,
} from "../types";
import {
  DatabaseAdapter,
  type CommentRepository,
  type UserRepository,
  type ConfigRepository,
} from "./base";

class TursoCommentRepository implements CommentRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async create(data: CreateCommentInput): Promise<Comment> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await this.client.execute({
      sql: `INSERT INTO comments (id, url, nick, mail, link, content, ua, ip, rid, pid, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        now,
      ],
    });

    return {
      id,
      url: data.url,
      nick: data.nick,
      mail: data.mail,
      link: data.link,
      content: data.content,
      ua: data.ua,
      ip: data.ip,
      master: false,
      top: false,
      rid: data.rid,
      pid: data.pid,
      isSpam: false,
      likes: 0,
      createdAt: now,
    };
  }

  async getById(id: string): Promise<Comment | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM comments WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) return null;
    return this.rowToComment(result.rows[0]);
  }

  async getList(query: CommentQuery): Promise<PaginatedResult<Comment>> {
    const { url, page = 1, pageSize = 10, includeSpam = false } = query;
    const offset = (page - 1) * pageSize;

    const spamCondition = includeSpam ? "" : "AND is_spam = 0";
    const urlCondition = url ? "WHERE url = ?" : "WHERE 1=1";

    const countSql = `SELECT COUNT(*) as count FROM comments ${urlCondition} ${spamCondition}`;
    const countArgs = url ? [url] : [];
    const countResult = await this.client.execute({
      sql: countSql,
      args: countArgs,
    });
    const total = Number(countResult.rows[0].count);

    const listSql = `SELECT * FROM comments ${urlCondition} ${spamCondition} ORDER BY top DESC, created_at DESC LIMIT ? OFFSET ?`;
    const listArgs = url ? [url, pageSize, offset] : [pageSize, offset];
    const listResult = await this.client.execute({
      sql: listSql,
      args: listArgs,
    });

    return {
      data: listResult.rows.map((row) => this.rowToComment(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: UpdateCommentInput): Promise<Comment> {
    const sets: string[] = [];
    const args: (string | number | boolean | null)[] = [];

    if (data.content !== undefined) {
      sets.push("content = ?");
      args.push(data.content);
    }
    if (data.isSpam !== undefined) {
      sets.push("is_spam = ?");
      args.push(data.isSpam ? 1 : 0);
    }
    if (data.top !== undefined) {
      sets.push("top = ?");
      args.push(data.top ? 1 : 0);
    }
    if (data.master !== undefined) {
      sets.push("master = ?");
      args.push(data.master ? 1 : 0);
    }

    sets.push("updated_at = ?");
    args.push(Date.now());
    args.push(id);

    await this.client.execute({
      sql: `UPDATE comments SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });

    const comment = await this.getById(id);
    if (!comment) throw new Error("Comment not found after update");
    return comment;
  }

  async delete(id: string): Promise<void> {
    await this.client.execute({
      sql: "DELETE FROM comments WHERE id = ?",
      args: [id],
    });
  }

  async like(id: string, userId: string): Promise<boolean> {
    try {
      const existing = await this.client.execute({
        sql: "SELECT 1 FROM likes WHERE comment_id = ? AND user_id = ?",
        args: [id, userId],
      })

      if (existing.rows.length > 0) {
        await this.client.execute({
          sql: "DELETE FROM likes WHERE comment_id = ? AND user_id = ?",
          args: [id, userId],
        })
        await this.client.execute({
          sql: "UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?",
          args: [id],
        })
        return true
      }

      await this.client.execute({
        sql: "INSERT INTO likes (comment_id, user_id, created_at) VALUES (?, ?, ?)",
        args: [id, userId, Date.now()],
      })
      await this.client.execute({
        sql: "UPDATE comments SET likes = likes + 1 WHERE id = ?",
        args: [id],
      })
      return true
    } catch {
      return false
    }
  }

  async getCount(url: string): Promise<number> {
    const result = await this.client.execute({
      sql: "SELECT COUNT(*) as count FROM comments WHERE url = ? AND is_spam = 0",
      args: [url],
    });
    return Number(result.rows[0].count);
  }

  private rowToComment(row: any): Comment {
    return {
      id: row.id as string,
      url: row.url as string,
      nick: row.nick as string,
      mail: row.mail as string | undefined,
      link: row.link as string | undefined,
      content: row.content as string,
      ua: row.ua as string | undefined,
      ip: row.ip as string | undefined,
      master: Boolean(row.master),
      top: Boolean(row.top),
      rid: row.rid as string | undefined,
      pid: row.pid as string | undefined,
      isSpam: Boolean(row.is_spam),
      likes: Number(row.likes ?? 0),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number | undefined,
    };
  }
}

class TursoUserRepository implements UserRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async getById(id: string): Promise<User | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.rowToUser(result.rows[0]);
  }

  async getByMail(mail: string): Promise<User | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM users WHERE mail = ?",
      args: [mail],
    });
    if (result.rows.length === 0) return null;
    return this.rowToUser(result.rows[0]);
  }

  async create(data: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await this.client.execute({
      sql: "INSERT INTO users (id, nick, mail, link, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        id,
        data.nick,
        data.mail ?? null,
        data.link ?? null,
        data.avatar ?? null,
        now,
      ],
    });

    return { ...data, id, createdAt: now };
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const sets: string[] = [];
    const args: (string | number | null)[] = [];

    for (const key of ["nick", "mail", "link", "avatar"] as const) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`);
        args.push(data[key] ?? null);
      }
    }

    if (sets.length > 0) {
      args.push(id);
      await this.client.execute({
        sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ?`,
        args,
      });
    }

    const user = await this.getById(id);
    if (!user) throw new Error("User not found after update");
    return user;
  }

  private rowToUser(row: any): User {
    return {
      id: row.id as string,
      nick: row.nick as string,
      mail: row.mail as string | undefined,
      link: row.link as string | undefined,
      avatar: row.avatar as string | undefined,
      createdAt: row.created_at as number,
    };
  }
}

class TursoConfigRepository implements ConfigRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.client.execute({
      sql: "SELECT value FROM config WHERE key = ?",
      args: [key],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0].value as string;
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.execute({
      sql: "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)",
      args: [key, value, Date.now()],
    });
  }

  async getAll(): Promise<Record<string, string>> {
    const result = await this.client.execute("SELECT key, value FROM config");
    return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  }
}

export class TursoAdapter extends DatabaseAdapter {
  private client: Client;
  private _config: TursoConfig;

  comments: CommentRepository;
  users: UserRepository;
  config: ConfigRepository;

  constructor(config: TursoConfig) {
    super();
    this._config = config;

    // 支持本地文件: file:./local.db 或 ./local.db
    const url =
      config.url.startsWith("file:") ||
      config.url.startsWith("./") ||
      config.url.startsWith("/")
        ? config.url
        : config.url;

    this.client = createClient({
      url,
      authToken: config.authToken || undefined,
    });
    this.comments = new TursoCommentRepository(this.client);
    this.users = new TursoUserRepository(this.client);
    this.config = new TursoConfigRepository(this.client);
  }

  async init(): Promise<void> {
    // 自动创建本地数据库文件所在目录
    const url = this._config.url;
    if (url.startsWith("file:")) {
      const filePath = url.slice(5);
      mkdirSync(dirname(filePath), { recursive: true });
    } else if (url.startsWith("./") || url.startsWith("/")) {
      mkdirSync(dirname(url), { recursive: true });
    }

    await this.client.batch([
      `CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        nick TEXT NOT NULL,
        mail TEXT,
        link TEXT,
        content TEXT NOT NULL,
        ua TEXT,
        ip TEXT,
        master INTEGER DEFAULT 0,
        top INTEGER DEFAULT 0,
        rid TEXT,
        pid TEXT,
        is_spam INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_rid ON comments(rid)`,

      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nick TEXT NOT NULL,
        mail TEXT UNIQUE,
        link TEXT,
        avatar TEXT,
        created_at INTEGER NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS likes (
        comment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (comment_id, user_id)
      )`,
    ]);
  }

  async close(): Promise<void> {
    this.client.close();
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return await fn();
  }
}
