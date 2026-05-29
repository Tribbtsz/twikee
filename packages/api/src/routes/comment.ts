import { Hono } from 'hono'
import type { CommentService, NotificationService } from '@twikee/core'
import type { TursoAdapter } from '@twikee/core'
import { CreateCommentSchema, CommentQuerySchema } from '../validation'

type Env = {
  Variables: {
    db: TursoAdapter
    commentService: CommentService
    notificationService: NotificationService | null
  }
}

export function createCommentRoutes() {
  const app = new Hono<Env>()

  app.get('/', async (c) => {
    const parsed = CommentQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const { url, page, pageSize } = parsed.data
    const result = await c.var.commentService.getList({ url, page, pageSize })
    return c.json(result)
  })

  app.post('/', async (c) => {
    const db = c.var.db
    const body = await c.req.json()
    const parsed = CreateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }

    const commentsClosed = await db.config.get('COMMENTS_CLOSED')
    if (commentsClosed === 'true') {
      return c.json({ error: '评论已关闭' }, 403)
    }

    const autoApprove = await db.config.get('AUTO_APPROVE')
    const needsModeration = autoApprove === 'false'

    let isMaster = false
    if (parsed.data.mail) {
      const bloggerEmail = await db.config.get('BLOGGER_EMAIL')
      if (bloggerEmail && parsed.data.mail.toLowerCase() === bloggerEmail.toLowerCase()) {
        isMaster = true
      }
    }

    function sanitize(str: string): string {
      return str.replace(/<[^>]*>/g, '').trim()
    }

    const comment = await c.var.commentService.create({
      url: sanitize(parsed.data.url),
      nick: sanitize(parsed.data.nick),
      mail: parsed.data.mail ? sanitize(parsed.data.mail) : undefined,
      link: parsed.data.link ? sanitize(parsed.data.link) : undefined,
      content: sanitize(parsed.data.content),
      ua: c.req.header('user-agent'),
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      rid: parsed.data.rid,
      pid: parsed.data.pid,
    })

    if (isMaster) {
      await c.var.commentService.update(comment.id, { master: true })
      comment.master = true
    }

    if (needsModeration && !isMaster) {
      await c.var.commentService.update(comment.id, { isSpam: true })
      comment.isSpam = true
    }

    const ns = c.var.notificationService
    if (ns) {
      const siteName = await db.config.get('SITE_NAME')
      const siteUrl = await db.config.get('SITE_URL')
      const pageUrl = siteUrl ? `${siteUrl}${parsed.data.url}` : parsed.data.url
      ns.send({
        type: comment.rid ? 'comment.reply' : 'comment.new',
        payload: { comment, url: pageUrl, siteName: siteName || undefined },
      }).catch(() => {})
    }

    return c.json(comment, 201)
  })

  app.post('/:id/like', async (c) => {
    const id = c.req.param('id')
    const userId = c.req.header('x-user-id') || crypto.randomUUID()
    const success = await c.var.commentService.like(id, userId)
    return c.json({ success })
  })

  return app
}
