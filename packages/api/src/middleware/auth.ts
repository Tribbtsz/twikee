import type { Context, Next } from 'hono'

export interface AuthDeps {
  verifyToken(token: string): { userId: string; valid: boolean }
  initDb(): Promise<void>
}

export function requireAdmin(deps: AuthDeps) {
  return async (c: Context, next: Next) => {
    await deps.initDb()
    const auth = c.req.header('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const token = auth.slice(7)
    const { valid } = deps.verifyToken(token)
    if (!valid) {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }
    await next()
  }
}
