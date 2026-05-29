import type { Context, Next } from 'hono'

export function demoGuard(allowed: string[] = []) {
  return async (c: Context, next: Next) => {
    if (!process.env.DEMO_MODE) {
      await next()
      return
    }
    const method = c.req.method
    const path = c.req.path
    const key = `${method} ${path}`
    if (allowed.some((p) => key.startsWith(p) || path.startsWith(p))) {
      await next()
      return
    }
    if (method === 'GET') {
      await next()
      return
    }
    return c.json({ error: 'Not available in demo mode' }, 403)
  }
}
