import { Hono } from 'hono'
import { CommentService, AuthService } from '@twikee/core'
import type { DatabaseAdapter } from '@twikee/core'

export function createAdminRoutes(db: DatabaseAdapter) {
  const app = new Hono()
  const commentService = new CommentService(db)
  const authService = new AuthService(db)
  
  const requireAdmin = async (c: any, next: any) => {
    const auth = c.req.header('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    
    const token = auth.slice(7)
    const { valid } = authService.verifyToken(token)
    
    if (!valid) {
      return c.json({ error: 'Invalid token' }, 401)
    }
    
    await next()
  }
  
  app.use('*', requireAdmin)
  
  app.get('/comments', async (c) => {
    const page = parseInt(c.req.query('page') || '1')
    const pageSize = parseInt(c.req.query('pageSize') || '20')
    const includeSpam = c.req.query('includeSpam') === 'true'
    
    const result = await commentService.getList({ url: '', page, pageSize, includeSpam })
    return c.json(result)
  })
  
  app.post('/moderate', async (c) => {
    const body = await c.req.json()
    const { id, action } = body
    
    await commentService.moderate(id, action)
    return c.json({ success: true })
  })
  
  app.post('/top', async (c) => {
    const body = await c.req.json()
    const { id, top } = body
    
    await commentService.setTop(id, top)
    return c.json({ success: true })
  })
  
  app.get('/config', async (c) => {
    const config = await db.config.getAll()
    return c.json(config)
  })
  
  app.post('/config', async (c) => {
    const body = await c.req.json()
    
    for (const [key, value] of Object.entries(body)) {
      await db.config.set(key, value as string)
    }
    
    return c.json({ success: true })
  })
  
  return app
}
