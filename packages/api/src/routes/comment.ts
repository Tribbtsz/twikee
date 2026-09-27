import { Hono } from 'hono'
import type { CommentService, NotificationService } from '@twikee/core'
import type { TursoAdapter } from '@twikee/core'
import { CreateCommentSchema, CommentQuerySchema } from '../validation'
import { defer } from '../lib/defer'
import { getOrCreateVisitorId, getClientIp } from '../lib/visitor'
import { rateLimit } from '../lib/rate-limit'
import { safeJson } from '../lib/safe-json'

/** 提交评论：每 IP 每分钟 10 条 */
const commentLimiter = rateLimit({ windowMs: 60_000, max: 10, key: 'comment' })
/** 点赞：每 IP 每分钟 60 次 */
const likeLimiter = rateLimit({ windowMs: 60_000, max: 60, key: 'like' })

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

  app.post('/', commentLimiter, async (c) => {
    const db = c.var.db
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
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
      ip: getClientIp(c),
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
    if (ns && ns.channelCount > 0) {
      const siteName = await db.config.get('SITE_NAME')
      const siteUrl = await db.config.get('SITE_URL')
      const pageUrl = siteUrl ? `${siteUrl}${parsed.data.url}` : parsed.data.url
      defer(
        c,
        ns.send({
          type: comment.rid ? 'comment.reply' : 'comment.new',
          payload: { comment, url: pageUrl, siteName: siteName || undefined },
        }),
      )
    }

    return c.json(comment, 201)
  })

  app.post('/:id/like', likeLimiter, async (c) => {
    const id = c.req.param('id')
    if (!id || id.length > 64) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    // 不存在（或已软删除）的评论直接 404，避免往 likes 表写悬空行
    const comment = await c.var.commentService.getById(id)
    if (!comment || comment.deleted) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    // 身份由服务端签发的 Cookie 决定，不再信任客户端传入的 x-user-id
    const userId = getOrCreateVisitorId(c)
    try {
      const result = await c.var.commentService.like(id, userId)
      // 以服务端结果为权威，前后端不再各自维护计数
      return c.json({ success: true, ...result })
    } catch (e) {
      console.error('[Twikee] like failed:', e)
      return c.json({ error: 'Like failed' }, 500)
    }
  })

  return app
}
