import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { TursoAdapter, CommentService, AuthService } from '@twikee/core'
import type { NotificationService } from '@twikee/core'
import { createCommentRoutes } from './routes/comment'
import { createAuthRoutes } from './routes/auth'
import { createAdminRoutes } from './routes/admin'
import { requireAdmin } from './middleware/auth'
import { demoGuard } from './middleware/demo'
import { getNotificationService } from './lib/notification'

// CORS 白名单：逗号分隔。留空时保持默认放开（兼容旧行为），
// 生产环境建议配置为允许嵌入的前端站点来源列表。
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const app = new Hono<{
  Variables: {
    db: TursoAdapter
    commentService: CommentService
    authService: AuthService
    notificationService: NotificationService | null
  }
}>()

app.use('*', cors({
  origin: (origin: string) => {
    if (corsOrigins.length === 0) return '*' // 未配置：允许所有来源
    if (corsOrigins.includes(origin)) return origin
    return null // 不在白名单：不返回 CORS 头，浏览器拒绝
  },
}))
app.use('*', logger())

let db: TursoAdapter | null = null
let commentService: CommentService | null = null
let authService: AuthService | null = null
let initPromise: Promise<void> | null = null

const initDb = async () => {
  if (db) return

  // 并发请求共享同一次初始化；失败时释放，允许后续请求重试
  if (!initPromise) {
    initPromise = (async () => {
      const tursoUrl = process.env.TURSO_DATABASE_URL || ''
      const tursoToken = process.env.TURSO_AUTH_TOKEN || ''
      if (!tursoUrl) {
        throw new Error('TURSO_DATABASE_URL is not set')
      }

      // 先在局部变量里完整初始化（含 migration）
      const adapter = new TursoAdapter({ url: tursoUrl, authToken: tursoToken })
      await adapter.init()
      const comments = new CommentService(adapter)
      const auth = new AuthService(adapter)

      // 全部成功后才发布到模块变量，避免半初始化状态被后续请求复用
      db = adapter
      commentService = comments
      authService = auth
    })().catch((e) => {
      initPromise = null
      throw e
    })
  }

  await initPromise
}

app.use('/api/*', async (c, next) => {
  try {
    await initDb()
  } catch (e) {
    console.error('[Twikee] database initialization failed:', e)
    return c.json({ error: 'Database initialization failed' }, 500)
  }
  c.set('db', db!)
  c.set('commentService', commentService!)
  c.set('authService', authService!)
  c.set('notificationService', await getNotificationService(db!))
  await next()
})

app.use('/api/admin/*', requireAdmin({
  initDb: () => Promise.resolve(),
  verifyToken: async (token: string) => authService!.verifyToken(token),
}))

app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

app.get('/api/config', async (c) => {
  const gravatarCdn = await db!.config.get('GRAVATAR_CDN')
  const demoEnabled = await db!.config.get('DEMO_ENABLED')
  const commentsClosed = await db!.config.get('COMMENTS_CLOSED')
  return c.json({
    GRAVATAR_CDN: gravatarCdn || '',
    DEMO_ENABLED: demoEnabled !== 'false',
    COMMENTS_CLOSED: commentsClosed === 'true',
  })
})

app.route('/api/comment', createCommentRoutes())
app.route('/api/auth', createAuthRoutes())
app.use('/api/admin/*', demoGuard())
app.route('/api/admin', createAdminRoutes())

app.onError((err, c) => {
  console.error('[Twikee]', err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

export default app
