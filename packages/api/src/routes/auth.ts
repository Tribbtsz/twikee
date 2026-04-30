import { Hono } from 'hono'
import { AuthService } from '@twikoo/core'
import type { DatabaseAdapter } from '@twikoo/core'

export function createAuthRoutes(db: DatabaseAdapter) {
  const app = new Hono()
  const authService = new AuthService(db)
  
  app.post('/login', async (c) => {
    const body = await c.req.json()
    const { password } = body
    
    const valid = await authService.verifyAdminPassword(password)
    
    if (!valid) {
      return c.json({ error: 'Invalid password' }, 401)
    }
    
    const token = authService.generateToken('admin')
    return c.json({ token })
  })
  
  app.post('/verify', async (c) => {
    const body = await c.req.json()
    const { token } = body
    
    const { userId, valid } = authService.verifyToken(token)
    
    if (!valid) {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }
    
    return c.json({ userId, valid: true })
  })
  
  return app
}
