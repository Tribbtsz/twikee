import { Hono } from 'hono'
import type { TursoAdapter } from '@twikee/core'
import { AuthService } from '@twikee/core'
import { SetupSchema, LoginSchema } from '../validation'
import { rateLimit } from '../lib/rate-limit'

type Env = {
  Variables: {
    db: TursoAdapter
    authService: AuthService
  }
}

/** 登录/初始化密码：每 IP 每 5 分钟 10 次，挡住在线爆破 */
const authLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 10,
  key: 'auth',
  message: 'Too many attempts, please try again later',
})

export function createAuthRoutes() {
  const app = new Hono<Env>()

  app.get('/status', async (c) => {
    const adminPassword = await c.var.db.config.get('ADMIN_PASSWORD')
    return c.json({ initialized: !!adminPassword })
  })

  app.post('/setup', authLimiter, async (c) => {
    const adminPassword = await c.var.db.config.get('ADMIN_PASSWORD')
    if (adminPassword) {
      return c.json({ error: 'Password already set' }, 400)
    }

    const body = await c.req.json()
    const parsed = SetupSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }

    const hashed = await AuthService.hashPassword(parsed.data.password)
    await c.var.db.config.set('ADMIN_PASSWORD', hashed)
    const token = await c.var.authService.generateToken('admin')
    return c.json({ token })
  })

  app.post('/login', authLimiter, async (c) => {
    const body = await c.req.json()
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }

    const valid = await c.var.authService.verifyAdminPassword(parsed.data.password)
    if (!valid) return c.json({ error: 'Invalid password' }, 401)

    const token = await c.var.authService.generateToken('admin')
    return c.json({ token })
  })

  app.post('/verify', async (c) => {
    const auth = c.req.header('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ valid: false }, 401)
    }
    const token = auth.slice(7)
    const { valid } = await c.var.authService.verifyToken(token)
    return c.json({ valid })
  })

  return app
}
