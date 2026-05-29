import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import {
  TursoAdapter,
  CommentService,
  AuthService,
  NotificationService,
  TelegramAdapter,
  WebhookAdapter,
  EmailAdapter,
} from '@twikee/core'
import { createCommentRoutes } from './routes/comment'
import { createAuthRoutes } from './routes/auth'
import { createAdminRoutes } from './routes/admin'
import { requireAdmin } from './middleware/auth'
import { demoGuard } from './middleware/demo'

const app = new Hono<{
  Variables: {
    db: TursoAdapter
    commentService: CommentService
    authService: AuthService
    notificationService: NotificationService | null
  }
}>()

app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
}))
app.use('*', logger())

let db: TursoAdapter | null = null
let commentService: CommentService | null = null
let authService: AuthService | null = null
let notificationService: NotificationService | null = null

const initDb = async () => {
  if (db) return

  const tursoUrl = process.env.TURSO_DATABASE_URL || ''
  const tursoToken = process.env.TURSO_AUTH_TOKEN || ''
  if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is not set')
  }

  db = new TursoAdapter({ url: tursoUrl, authToken: tursoToken })
  await db.init()

  commentService = new CommentService(db)
  authService = new AuthService(db)

  await initNotifications()
}

const initNotifications = async () => {
  if (!db) return
  notificationService = new NotificationService()

  const enableNotif = await db.config.get('NOTIFICATION_ENABLE')
  if (enableNotif !== 'true') return

  const type = await db.config.get('NOTIFICATION_TYPE')

  if (type === 'telegram') {
    const botToken = await db.config.get('TELEGRAM_BOT_TOKEN')
    const chatId = await db.config.get('TELEGRAM_CHAT_ID')
    if (botToken && chatId) {
      notificationService.addChannel('telegram', new TelegramAdapter({ botToken, chatId }), [
        'comment.new',
        'comment.reply',
      ])
    }
  } else if (type === 'webhook') {
    const webhookUrl = await db.config.get('WEBHOOK_URL')
    if (webhookUrl) {
      notificationService.addChannel('webhook', new WebhookAdapter({ url: webhookUrl }), [
        'comment.new',
        'comment.reply',
      ])
    }
  } else if (type === 'email') {
    const apiKey = await db.config.get('SMTP_PASS')
    const from = await db.config.get('SMTP_FROM')
    const to = await db.config.get('SMTP_TO')
    if (apiKey && from && to) {
      notificationService.addChannel('email', new EmailAdapter({ apiKey, from, to }), [
        'comment.new',
        'comment.reply',
      ])
    }
  }
}

app.use('/api/*', async (c, next) => {
  try {
    await initDb()
  } catch (e) {
    return c.json({ error: 'Database initialization failed' }, 500)
  }
  c.set('db', db!)
  c.set('commentService', commentService!)
  c.set('authService', authService!)
  c.set('notificationService', notificationService)
  await next()
})

app.use('/api/admin/*', requireAdmin({
  initDb: () => Promise.resolve(),
  verifyToken: (token: string) => authService!.verifyToken(token),
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
