import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { TursoAdapter, CommentService, AuthService } from "@twikee/core";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

let db: TursoAdapter | null = null;
let commentService: CommentService | null = null;
let authService: AuthService | null = null;

const initDb = async () => {
  if (db) return;

  const tursoUrl = process.env.TURSO_DATABASE_URL || "file:./data/twikee.db";
  const tursoToken = process.env.TURSO_AUTH_TOKEN || "";

  // 自动创建本地数据库文件所在目录
  if (tursoUrl.startsWith("file:")) {
    mkdirSync(dirname(tursoUrl.slice(5)), { recursive: true });
  } else if (tursoUrl.startsWith("./") || tursoUrl.startsWith("/")) {
    mkdirSync(dirname(tursoUrl), { recursive: true });
  }

  db = new TursoAdapter({ url: tursoUrl, authToken: tursoToken });
  await db.init();

  commentService = new CommentService(db);
  authService = new AuthService(db);
};

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// 评论 API
app.get("/api/comment", async (c) => {
  await initDb();
  const url = c.req.query("url");
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "10");

  if (!url) return c.json({ error: "url is required" }, 400);

  const result = await commentService!.getList({ url, page, pageSize });
  return c.json(result);
});

app.post("/api/comment", async (c) => {
  await initDb();
  const body = await c.req.json();

  if (!body.url || !body.nick || !body.content) {
    return c.json({ error: "url, nick, content are required" }, 400);
  }

  const comment = await commentService!.create({
    url: body.url,
    nick: body.nick,
    mail: body.mail,
    link: body.link,
    content: body.content,
    ua: c.req.header("user-agent"),
    ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    rid: body.rid,
    pid: body.pid,
  });

  return c.json(comment, 201);
});

app.post("/api/comment/:id/like", async (c) => {
  await initDb();
  const id = c.req.param("id");
  const userId = c.req.header("x-user-id") || crypto.randomUUID();

  const success = await commentService!.like(id, userId);
  return c.json({ success });
});

// 认证 API
app.get("/api/auth/status", async (c) => {
  await initDb();
  const adminPassword = await db!.config.get("ADMIN_PASSWORD");
  return c.json({ initialized: !!adminPassword });
});

app.post("/api/auth/setup", async (c) => {
  await initDb();
  const adminPassword = await db!.config.get("ADMIN_PASSWORD");
  if (adminPassword) {
    return c.json({ error: "Password already set" }, 400);
  }

  const body = await c.req.json();
  const { password } = body;

  if (!password || password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }

  await db!.config.set("ADMIN_PASSWORD", password);
  const token = authService!.generateToken("admin");
  return c.json({ token });
});

app.post("/api/auth/login", async (c) => {
  await initDb();
  const body = await c.req.json();
  const { password } = body;

  const valid = await authService!.verifyAdminPassword(password);
  if (!valid) return c.json({ error: "Invalid password" }, 401);

  const token = authService!.generateToken("admin");
  return c.json({ token });
});

app.post("/api/auth/verify", async (c) => {
  await initDb();
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ valid: false }, 401);
  }

  const token = auth.slice(7);
  const { valid } = authService!.verifyToken(token);
  return c.json({ valid });
});

// 管理员中间件
const requireAdmin = async (c: any, next: any) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = auth.slice(7);
  const { valid } = authService!.verifyToken(token);

  if (!valid) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
};

// 管理员 API
app.get("/api/admin/comments", requireAdmin, async (c) => {
  await initDb();
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "20");
  const url = c.req.query("url") || "";
  const includeSpam = c.req.query("includeSpam") === "true";

  const result = await commentService!.getList({
    url,
    page,
    pageSize,
    includeSpam,
  });
  return c.json(result);
});

app.get("/api/admin/comments/all", requireAdmin, async (c) => {
  await initDb();
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "20");
  const url = c.req.query("url"); // 可选：按URL筛选
  const includeSpam = c.req.query("includeSpam") === "true";

  if (url) {
    // 按指定URL筛选
    const result = await commentService!.getList({
      url,
      page,
      pageSize,
      includeSpam,
    });
    return c.json(result);
  }

  const result = await db!.comments.getList({
    url: "",
    page,
    pageSize,
    includeSpam,
  });
  return c.json(result);
});

// 页面统计 API
app.get("/api/admin/pages", requireAdmin, async (c) => {
  await initDb();
  // 用 SQL 直接统计每个URL的评论数
  const client = (db as any)?.client;
  if (!client) return c.json({ error: "Database not initialized" }, 500);

  try {
    const result = await client.execute(
      `SELECT url, COUNT(*) as count,
       SUM(CASE WHEN is_spam = 1 THEN 1 ELSE 0 END) as spam_count,
       MAX(created_at) as last_comment
       FROM comments
       GROUP BY url
       ORDER BY last_comment DESC`,
    );

    const pages = result.rows.map((row: any) => ({
      url: row.url || "/",
      count: Number(row.count),
      spamCount: Number(row.spam_count),
      lastComment: Number(row.last_comment),
    }));

    return c.json({ data: pages, total: pages.length });
  } catch (e) {
    return c.json({ error: "Failed to get pages" }, 500);
  }
});

app.put("/api/admin/comment/:id", requireAdmin, async (c) => {
  await initDb();
  const id = c.req.param("id");
  const body = await c.req.json();

  const comment = await commentService!.update(id, body);
  return c.json(comment);
});

app.delete("/api/admin/comment/:id", requireAdmin, async (c) => {
  await initDb();
  const id = c.req.param("id");
  await commentService!.delete(id);
  return c.json({ success: true });
});

app.post("/api/admin/comment/:id/moderate", requireAdmin, async (c) => {
  await initDb();
  const id = c.req.param("id");
  const body = await c.req.json();
  const { action } = body; // 'approve' | 'spam' | 'delete'

  await commentService!.moderate(id, action);
  return c.json({ success: true });
});

app.post("/api/admin/comment/:id/top", requireAdmin, async (c) => {
  await initDb();
  const id = c.req.param("id");
  const body = await c.req.json();
  const { top } = body;

  const comment = await commentService!.setTop(id, top);
  return c.json(comment);
});

app.get("/api/admin/config", requireAdmin, async (c) => {
  await initDb();
  const config = await db!.config.getAll();
  return c.json(config);
});

app.post("/api/admin/config", requireAdmin, async (c) => {
  await initDb();
  const body = await c.req.json();

  for (const [key, value] of Object.entries(body)) {
    await db!.config.set(key, value as string);
  }

  return c.json({ success: true });
});

app.get("/api/admin/stats", requireAdmin, async (c) => {
  await initDb();
  // 统计评论数
  const allComments = await db!.comments.getList({
    url: "",
    page: 1,
    pageSize: 1000,
    includeSpam: true,
  });
  const total = allComments.total;
  const spam = allComments.data.filter((c) => c.isSpam).length;
  const pending = spam;
  const approved = total - spam;

  return c.json({ total, approved, pending });
});

export default app;
