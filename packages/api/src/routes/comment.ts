import { Hono } from 'hono'
import type { CommentService, NotificationService } from '@twikee/core'
import type { TursoAdapter } from '@twikee/core'
import { signEditToken, verifyEditToken, EDIT_WINDOW_MS } from '@twikee/core'
import {
  CreateCommentSchema,
  CommentQuerySchema,
  CommentCountQuerySchema,
  MAX_COUNT_URLS,
  ReportSchema,
  EditOwnCommentSchema,
  DeleteOwnCommentSchema,
} from '../validation'
import { defer } from '../lib/defer'
import { getOrCreateVisitorId, getClientIp } from '../lib/visitor'
import { rateLimit } from '../lib/rate-limit'
import { safeJson } from '../lib/safe-json'
import { getNotificationService } from '../lib/notification'

/** 提交评论：每 IP 每分钟 10 条 */
const commentLimiter = rateLimit({ windowMs: 60_000, max: 10, key: 'comment' })
/** 点赞：每 IP 每分钟 60 次 */
const likeLimiter = rateLimit({ windowMs: 60_000, max: 60, key: 'like' })
/** 评论列表：每 IP 每分钟 120 次。每次请求触发 2 次 DB 查询，无保护会被刷量打爆账单 */
const listLimiter = rateLimit({ windowMs: 60_000, max: 120, key: 'comment-list' })
/** 批量评论数：每 IP 每分钟 120 次（上限 20 个 url，与列表同档） */
const countLimiter = rateLimit({ windowMs: 60_000, max: 120, key: 'comment-count' })
/** 举报：每 IP 每分钟 10 次（带通知，防骚扰管理员） */
const reportLimiter = rateLimit({ windowMs: 60_000, max: 10, key: 'comment-report' })
/** 编辑/删除自己的评论：每 IP 每分钟 10 次 */
const editLimiter = rateLimit({ windowMs: 60_000, max: 10, key: 'comment-edit' })

type Env = {
  Variables: {
    db: TursoAdapter
    commentService: CommentService
    notificationService: NotificationService | null
  }
}

export function createCommentRoutes() {
  const app = new Hono<Env>()

  app.get('/', listLimiter, async (c) => {
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

    // IP 黑名单：命中则拒绝发表（A4 修完后 getClientIp 已取正确客户端 IP）
    const clientIp = getClientIp(c)
    const blockedIps = await db.config.get('BLOCKED_IPS')
    if (blockedIps) {
      const blocked = new Set(
        blockedIps
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      if (blocked.has(clientIp)) {
        return c.json({ error: 'Forbidden' }, 403)
      }
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

    // 只做 trim：XSS 由前端 sanitizeHtml（白名单）兜底，通知渠道全部 escape。
    // 之前这里的 strip 会吃掉正文合法内容（"a < b > c" 入库变成 "a  c"）。
    function sanitize(str: string): string {
      return str.trim()
    }

    const comment = await c.var.commentService.create({
      url: sanitize(parsed.data.url),
      nick: sanitize(parsed.data.nick),
      mail: parsed.data.mail ? sanitize(parsed.data.mail) : undefined,
      link: parsed.data.link ? sanitize(parsed.data.link) : undefined,
      content: sanitize(parsed.data.content),
      ua: c.req.header('user-agent'),
      ip: clientIp,
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

    // 访客编辑凭证：HMAC 签发，随创建响应返回。前端存 localStorage，
    // 30 分钟内可凭它编辑/删除这条评论（PUT / DELETE /api/comment/:id）。
    return c.json({ ...comment, editToken: signEditToken(comment.id) }, 201)
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

    // 身份：HttpOnly Cookie 优先，跨域部署（博客与 API 不同域，带不上 Cookie）
    // 时退到请求头 x-user-id，详见 lib/visitor.ts
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

  /**
   * 批量评论数（博客列表页/归档页场景）。
   * GET /api/comment/count?urls=/a,/b,/c → { counts: { "/a": 3, "/b": 0 } }
   * url 上限 20 个：每个 url 一条 COUNT 查询，并发发出。
   */
  app.get('/count', countLimiter, async (c) => {
    const parsed = CommentCountQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const urls = parsed.data.urls
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COUNT_URLS)
    if (urls.length === 0) {
      return c.json({ error: 'urls is required' }, 400)
    }
    if (urls.some((u) => u.length > 2000)) {
      return c.json({ error: 'url too long' }, 400)
    }
    const counts: Record<string, number> = {}
    await Promise.all(
      urls.map(async (u) => {
        counts[u] = await c.var.commentService.getCount(u)
      }),
    )
    return c.json({ counts })
  })

  /**
   * 举报评论：访客举报不当内容 → 给管理员发 admin.report 通知。
   * 原因可选（最多 200 字）；不存在/已删除的评论返回 404。
   */
  app.post('/:id/report', reportLimiter, async (c) => {
    const id = c.req.param('id')
    if (!id || id.length > 64) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    const comment = await c.var.commentService.getById(id)
    if (!comment || comment.deleted) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    // 原因可空：无 body 时按 {} 处理，不必 400
    const body = await safeJson(c)
    const parsed = ReportSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }

    // 通知走后台发送，不阻塞响应（与创建评论的通知路径一致）
    const db = c.var.db
    const ns = await getNotificationService(db)
    if (ns && ns.channelCount > 0) {
      const siteName = await db.config.get('SITE_NAME')
      const siteUrl = await db.config.get('SITE_URL')
      const pageUrl = siteUrl ? `${siteUrl}${comment.url}` : comment.url
      defer(
        c,
        ns.send({
          type: 'admin.report',
          payload: {
            comment,
            url: pageUrl,
            siteName: siteName || undefined,
            reason: parsed.data.reason?.trim() || undefined,
          },
        }),
      )
    }
    return c.json({ success: true })
  })

  /**
   * 访客编辑自己的评论：需创建时签发的 editToken，且在创建后 30 分钟内。
   * token 错误/过期 → 403；评论不存在/已删除 → 404。
   */
  app.put('/:id', editLimiter, async (c) => {
    const id = c.req.param('id')
    if (!id || id.length > 64) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    const parsed = EditOwnCommentSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const comment = await c.var.commentService.getById(id)
    if (!comment || comment.deleted) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    if (!verifyEditToken(id, parsed.data.editToken)) {
      return c.json({ error: 'Invalid edit token' }, 403)
    }
    if (Date.now() - comment.createdAt > EDIT_WINDOW_MS) {
      return c.json({ error: 'Edit window expired' }, 403)
    }
    const updated = await c.var.commentService.update(id, { content: parsed.data.content.trim() })
    return c.json(updated)
  })

  /**
   * 访客删除自己的评论（软删除）：校验同上。
   */
  app.delete('/:id', editLimiter, async (c) => {
    const id = c.req.param('id')
    if (!id || id.length > 64) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    const body = await safeJson(c)
    if (body === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    const parsed = DeleteOwnCommentSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const comment = await c.var.commentService.getById(id)
    if (!comment || comment.deleted) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    if (!verifyEditToken(id, parsed.data.editToken)) {
      return c.json({ error: 'Invalid edit token' }, 403)
    }
    if (Date.now() - comment.createdAt > EDIT_WINDOW_MS) {
      return c.json({ error: 'Edit window expired' }, 403)
    }
    await c.var.commentService.delete(id)
    return c.json({ success: true })
  })

  return app
}
