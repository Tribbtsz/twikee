import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  TursoAdapter,
  CommentService,
  AuthService,
  NotificationService,
  TelegramAdapter,
  WebhookAdapter,
  EmailAdapter,
} from "@twikee/core";

const app = new Hono();

function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

app.use("*", cors());
app.use("*", logger());

let db: TursoAdapter | null = null;
let commentService: CommentService | null = null;
let authService: AuthService | null = null;
let notificationService: NotificationService | null = null;

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

  await initNotifications();
};

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

const initNotifications = async () => {
  if (!db) return;
  notificationService = new NotificationService();

  const enableNotif = await db.config.get("NOTIFICATION_ENABLE");
  if (enableNotif !== "true") return;

  const type = await db.config.get("NOTIFICATION_TYPE");

  if (type === "telegram") {
    const botToken = await db.config.get("TELEGRAM_BOT_TOKEN");
    const chatId = await db.config.get("TELEGRAM_CHAT_ID");
    if (botToken && chatId) {
      notificationService.addChannel("telegram", new TelegramAdapter({ botToken, chatId }), [
        "comment.new",
        "comment.reply",
      ]);
    }
  } else if (type === "webhook") {
    const webhookUrl = await db.config.get("WEBHOOK_URL");
    if (webhookUrl) {
      notificationService.addChannel("webhook", new WebhookAdapter({ url: webhookUrl }), [
        "comment.new",
        "comment.reply",
      ]);
    }
  } else if (type === "email") {
    const apiKey = await db.config.get("SMTP_PASS");
    const from = await db.config.get("SMTP_FROM");
    const to = await db.config.get("SMTP_TO");
    if (apiKey && from && to) {
      notificationService.addChannel("email", new EmailAdapter({ apiKey, from, to }), [
        "comment.new",
        "comment.reply",
      ]);
    }
  }
};

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

  // Check if comments are closed
  const commentsClosed = await db!.config.get("COMMENTS_CLOSED");
  if (commentsClosed === "true") {
    return c.json({ error: "评论已关闭" }, 403);
  }

  // Check if auto-approve is enabled
  const autoApprove = await db!.config.get("AUTO_APPROVE");
  const needsModeration = autoApprove !== "true";

  let isMaster = false;
  if (body.mail) {
    const bloggerEmail = await db!.config.get("BLOGGER_EMAIL");
    if (bloggerEmail && body.mail.toLowerCase() === bloggerEmail.toLowerCase()) {
      isMaster = true;
    }
  }

  const comment = await commentService!.create({
    url: sanitize(body.url),
    nick: sanitize(body.nick),
    mail: body.mail ? sanitize(body.mail) : undefined,
    link: body.link ? sanitize(body.link) : undefined,
    content: sanitize(body.content),
    ua: c.req.header("user-agent"),
    ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    rid: body.rid,
    pid: body.pid,
  });

  if (isMaster) {
    await commentService!.update(comment.id, { master: true });
    comment.master = true;
  }

  // Apply moderation: non-master comments need approval unless auto-approve is on
  if (needsModeration && !isMaster) {
    await commentService!.update(comment.id, { isSpam: true });
    comment.isSpam = true;
  }

  if (notificationService) {
    const siteName = await db!.config.get("SITE_NAME");
    const siteUrl = await db!.config.get("SITE_URL");
    const pageUrl = siteUrl ? `${siteUrl}${body.url}` : body.url;
    notificationService
      .send({
        type: comment.rid ? "comment.reply" : "comment.new",
        payload: { comment, url: pageUrl, siteName: siteName || undefined },
      })
      .catch(() => {});
  }

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

  const hashed = await AuthService.hashPassword(password);
  await db!.config.set("ADMIN_PASSWORD", hashed);
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
  await initDb();
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

app.post("/api/admin/import", requireAdmin, async (c) => {
  await initDb();
  const body = await c.req.json();

  if (!Array.isArray(body)) {
    return c.json({ error: "Expected an array of comments" }, 400);
  }

  let success = 0;
  let failed = 0;

  for (const item of body) {
    try {
      await commentService!.create({
        url: sanitize(item.url || "/"),
        nick: sanitize(item.nick || "Anonymous"),
        mail: item.mail ? sanitize(item.mail) : undefined,
        link: item.link ? sanitize(item.link) : undefined,
        content: sanitize(item.content || ""),
        rid: item.rid,
        pid: item.pid,
      });
      success++;
    } catch {
      failed++;
    }
  }

  return c.json({ success, failed });
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
  // Filter sensitive fields from response
  const { ADMIN_PASSWORD, SMTP_PASS, TELEGRAM_BOT_TOKEN, ...safeConfig } = config;
  return c.json(safeConfig);
});

app.post("/api/admin/config", requireAdmin, async (c) => {
  await initDb();
  const body = await c.req.json();

  for (const [key, value] of Object.entries(body)) {
    if (key === "ADMIN_PASSWORD" && value) {
      const hashed = await AuthService.hashPassword(value as string);
      await db!.config.set(key, hashed);
    } else {
      await db!.config.set(key, value as string);
    }
  }

  notificationService = null;
  await initNotifications();

  return c.json({ success: true });
});

// 公开配置（不含敏感信息）
app.get("/api/config", async (c) => {
  await initDb();
  const gravatarCdn = await db!.config.get("GRAVATAR_CDN");
  const demoEnabled = await db!.config.get("DEMO_ENABLED");
  return c.json({
    GRAVATAR_CDN: gravatarCdn || "",
    DEMO_ENABLED: demoEnabled !== "false",
  });
});

app.get("/api/admin/stats", requireAdmin, async (c) => {
  await initDb();
  const stats = await db!.comments.getStats();
  return c.json(stats);
});

export default app;
