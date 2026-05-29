import { Hono } from 'hono'
import type { CommentService, TursoAdapter } from '@twikee/core'
import { AuthService } from '@twikee/core'
import { AdminCommentQuerySchema, AdminConfigSchema, ModerateSchema, TopSchema } from '../validation'

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
        FROM comments GROUP BY url ORDER BY last_comment DESC
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
    const body = await c.req.json()
    const comment = await c.var.commentService.update(id, body)
    return c.json(comment)
  })

  app.delete('/comment/:id', async (c) => {
    const demoEnabled = await c.var.db.config.get('DEMO_ENABLED')
    if (demoEnabled !== 'false') {
      return c.json({ error: 'Not available in demo mode' }, 403)
    }
    const id = c.req.param('id')
    await c.var.commentService.delete(id)
    return c.json({ success: true })
  })

  app.post('/import', async (c) => {
    const demoEnabled = await c.var.db.config.get('DEMO_ENABLED')
    if (demoEnabled !== 'false') {
      return c.json({ error: 'Not available in demo mode' }, 403)
    }
    const body = await c.req.json()
    if (!Array.isArray(body)) {
      return c.json({ error: 'Expected an array of comments' }, 400)
    }
    let success = 0
    let failed = 0
    for (const item of body) {
      try {
        await c.var.commentService.create({
          url: sanitize(item.url || '/'),
          nick: sanitize(item.nick || 'Anonymous'),
          mail: item.mail ? sanitize(item.mail) : undefined,
          link: item.link ? sanitize(item.link) : undefined,
          content: sanitize(item.content || ''),
          rid: item.rid,
          pid: item.pid,
        })
        success++
      } catch {
        failed++
      }
    }
    return c.json({ success, failed })
  })

  app.post('/comment/:id/moderate', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = ModerateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    await c.var.commentService.moderate(id, parsed.data.action)
    return c.json({ success: true })
  })

  app.post('/comment/:id/top', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = TopSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const comment = await c.var.commentService.setTop(id, parsed.data.top)
    return c.json(comment)
  })

  app.get('/config', async (c) => {
    const config = await c.var.db.config.getAll()
    const { ADMIN_PASSWORD, SMTP_PASS, TELEGRAM_BOT_TOKEN, ...safeConfig } = config
    return c.json(safeConfig)
  })

  app.post('/config', async (c) => {
    const demoEnabled = await c.var.db.config.get('DEMO_ENABLED')
    const body = await c.req.json()
    for (const [key, value] of Object.entries(body)) {
      if (demoEnabled !== 'false') {
        if (key === 'ADMIN_PASSWORD' || key === 'DEMO_ENABLED' || key === 'COMMENTS_CLOSED' || key === 'AUTO_APPROVE') {
          continue
        }
      }
      if (key === 'ADMIN_PASSWORD') {
        const hashed = await AuthService.hashPassword(value as string)
        await c.var.db.config.set(key, hashed)
      } else {
        await c.var.db.config.set(key, value as string)
      }
    }
    return c.json({ success: true })
  })

  app.get('/stats', async (c) => {
    const stats = await c.var.db.comments.getStats()
    return c.json(stats)
  })

  return app
}
