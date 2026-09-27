import { Hono } from 'hono'
import type { CommentService, TursoAdapter } from '@twikee/core'
import { AuthService, assertPublicHttpUrl } from '@twikee/core'
import {
  AdminCommentQuerySchema,
  AdminConfigSchema,
  ModerateSchema,
  TopSchema,
  AdminUpdateCommentSchema,
  ImportSchema,
  ADMIN_CONFIG_KEY_SET,
} from '../validation'
import { invalidateNotifications } from '../lib/notification'
import { safeJson } from '../lib/safe-json'

type Env = {
  Variables: {
    db: TursoAdapter
    commentService: CommentService
    authService: AuthService
  }
}

function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

export function createAdminRoutes() {
  const app = new Hono<Env>()

  app.get('/comments', async (c) => {
    const parsed = AdminCommentQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const { url, page, pageSize, includeSpam } = parsed.data
    const result = await c.var.commentService.getList({ url: url || '', page, pageSize, includeSpam })
    return c.json(result)
  })

  app.get('/comments/all', async (c) => {
    const parsed = AdminCommentQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const { url, page, pageSize, includeSpam } = parsed.data
    if (url) {
      const result = await c.var.commentService.getList({ url, page, pageSize, includeSpam })
      return c.json(result)
    }
    const result = await c.var.db.comments.getList({ url: '', page, pageSize, includeSpam })
    return c.json(result)
  })

  app.get('/pages', async (c) => {
    const client = (c.var.db as any)?.client
    if (!client) return c.json({ error: 'Database not initialized' }, 500)
    try {
      const result = await client.execute(`
        SELECT url, COUNT(*) as count,
        SUM(CASE WHEN is_spam = 1 THEN 1 ELSE 0 END) as spam_count,
        MAX(created_at) as last_comment
        FROM comments WHERE deleted = 0 GROUP BY url ORDER BY last_comment DESC
      `)
      const pages = result.rows.map((row: any) => ({
        url: row.url || '/',
        count: Number(row.count),
        spamCount: Number(row.spam_count),
        lastComment: Number(row.last_comment),
      }))
      return c.json({ data: pages, total: pages.length })
    } catch {
      return c.json({ error: 'Failed to get pages' }, 500)
    }
  })

  app.put('/comment/:id', async (c) => {
    const id = c.req.param('id')
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    // body 原样透传会构成 mass assignment：UpdateCommentInput 含 master/top/isSpam，
    // 一个 {"master":true} 就能把任意评论者设为博主，绕过下面的 moderate/top 端点
    const parsed = AdminUpdateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    try {
      const comment = await c.var.commentService.update(id, parsed.data)
      return c.json(comment)
    } catch {
      return c.json({ error: 'Comment not found' }, 404)
    }
  })

  app.delete('/comment/:id', async (c) => {
    const id = c.req.param('id')
    await c.var.commentService.delete(id)
    return c.json({ success: true })
  })

  app.post('/import', async (c) => {
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    // 逐条校验：数组元素无约束时，脏数据会绕过公开端点的全部校验直接入库
    const parsed = ImportSchema.safeParse(body)
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 10).map((i) => ({
        index: i.path[0],
        message: i.message,
      }))
      return c.json({ error: 'Invalid import data', issues }, 400)
    }

    let success = 0
    let failed = 0
    const failedItems: Array<{ index: number; reason: string }> = []

    for (const [index, item] of parsed.data.entries()) {
      try {
        await c.var.commentService.create({
          id: item.id,
          url: sanitize(item.url),
          nick: sanitize(item.nick),
          mail: item.mail ? sanitize(item.mail) : undefined,
          link: item.link ? sanitize(item.link) : undefined,
          content: sanitize(item.content),
          ua: item.ua ? sanitize(item.ua) : undefined,
          ip: item.ip ? sanitize(item.ip) : undefined,
          rid: item.rid ?? undefined,
          pid: item.pid ?? undefined,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt ?? undefined,
          likes: item.likes,
          isSpam: item.isSpam,
          master: item.master,
          top: item.top,
          deleted: item.deleted,
        })
        success++
      } catch (e) {
        failed++
        // id 冲突等：给出可定位的原因，而不是只报一个失败计数
        failedItems.push({ index, reason: String((e as Error)?.message ?? e).slice(0, 200) })
      }
    }
    return c.json({ success, failed, failedItems })
  })

  app.post('/comment/:id/moderate', async (c) => {
    const id = c.req.param('id')
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    const parsed = ModerateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    await c.var.commentService.moderate(id, parsed.data.action)
    return c.json({ success: true })
  })

  app.post('/comment/:id/top', async (c) => {
    const id = c.req.param('id')
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    const parsed = TopSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const comment = await c.var.commentService.setTop(id, parsed.data.top)
    return c.json(comment)
  })

  app.get('/config', async (c) => {
    const config = await c.var.db.config.getAll()
    const { ADMIN_PASSWORD, SMTP_PASS, TELEGRAM_BOT_TOKEN, WXPUSHER_APP_TOKEN, WECOM_KEY, IMAGE_CDN_TOKEN, ...safeConfig } = config
    return c.json(safeConfig)
  })

  // 密钥类配置：前端拿到的是空值，回保存时空值表示"不修改"，避免被清零
  const SECRET_KEYS = new Set(['ADMIN_PASSWORD', 'SMTP_PASS', 'TELEGRAM_BOT_TOKEN', 'WXPUSHER_APP_TOKEN', 'WECOM_KEY', 'IMAGE_CDN_TOKEN'])

  app.post('/config', async (c) => {
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    const parsed = AdminConfigSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid config' }, 400)
    }

    // 白名单校验：拒绝未知 key，避免脏数据进库
    const unknownKeys = Object.keys(parsed.data).filter((k) => !ADMIN_CONFIG_KEY_SET.has(k))
    if (unknownKeys.length > 0) {
      return c.json({ error: `Unknown config keys: ${unknownKeys.join(', ')}` }, 400)
    }

    const skipped: string[] = []
    for (const [key, value] of Object.entries(parsed.data)) {
      // Webhook 渠道会由服务端向该地址发请求，评论又是公开可提交的：
      // 不校验就会被当成 SSRF 跳板（打内网 / 云 metadata）并外带评论者信息
      if (key === 'WEBHOOK_URL' && typeof value === 'string' && value.trim()) {
        try {
          assertPublicHttpUrl(value.trim(), 'WEBHOOK_URL')
        } catch (e) {
          return c.json({ error: (e as Error).message }, 400)
        }
      }
      if (key === 'ADMIN_PASSWORD') {
        if (typeof value !== 'string' || !value.trim()) {
          skipped.push(key)
          continue
        }
        const hashed = await AuthService.hashPassword(value)
        await c.var.db.config.set(key, hashed)
        continue
      }
      if (SECRET_KEYS.has(key)) {
        if (typeof value !== 'string' || !value) {
          skipped.push(key)
          continue
        }
        await c.var.db.config.set(key, value)
        continue
      }
      if (typeof value !== 'string') {
        return c.json({ error: `Invalid value for ${key}` }, 400)
      }
      await c.var.db.config.set(key, value)
    }
    // 通知配置可能已变更：失效缓存，下次请求（最多 60s 内）重建
    invalidateNotifications()
    return c.json({ success: true, skipped })
  })

  app.get('/stats', async (c) => {
    const stats = await c.var.db.comments.getStats()
    return c.json(stats)
  })

  return app
}
