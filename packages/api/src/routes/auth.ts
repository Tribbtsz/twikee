import { Hono } from 'hono'
import type { TursoAdapter } from '@twikee/core'
import { AuthService } from '@twikee/core'
import { SetupSchema, LoginSchema } from '../validation'

type Env = {
  Variables: {
    db: TursoAdapter
    authService: AuthService
  }
}

export function createAuthRoutes() {
  const app = new Hono<Env>()

  app.get('/status', async (c) => {
    const adminPassword = await c.var.db.config.get('ADMIN_PASSWORD')
    return c.json({ initialized: !!adminPassword })
  })

  app.post('/setup', async (c) => {
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
    const token = c.var.authService.generateToken('admin')
    return c.json({ token })
  })

  app.post('/login', async (c) => {
    const body = await c.req.json()
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400)
    }

    const valid = await c.var.authService.verifyAdminPassword(parsed.data.password)
    if (!valid) return c.json({ error: 'Invalid password' }, 401)

    const token = c.var.authService.generateToken('admin')
    return c.json({ token })
  })

  app.post('/verify', async (c) => {
    const auth = c.req.header('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ valid: false }, 401)
    }
    const token = auth.slice(7)
    const { valid } = c.var.authService.verifyToken(token)
    return c.json({ valid })
  })

  return app
}
