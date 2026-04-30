import { Hono } from 'hono'
import { CommentService } from '@twikoo/core'
import type { DatabaseAdapter } from '@twikoo/core'

export function createCommentRoutes(db: DatabaseAdapter) {
  const app = new Hono()
  const commentService = new CommentService(db)
  
  app.get('/', async (c) => {
    const url = c.req.query('url')
    const page = parseInt(c.req.query('page') || '1')
    const pageSize = parseInt(c.req.query('pageSize') || '10')
    
    if (!url) {
      return c.json({ error: 'url is required' }, 400)
    }
    
    const result = await commentService.getList({ url, page, pageSize })
    return c.json(result)
  })
  
  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    const comment = await commentService.getById(id)
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    
    return c.json(comment)
  })
  
  app.post('/', async (c) => {
    const body = await c.req.json()
    
    if (!body.url || !body.nick || !body.content) {
      return c.json({ error: 'url, nick, content are required' }, 400)
    }
    
    const comment = await commentService.create({
      url: body.url,
      nick: body.nick,
      mail: body.mail,
      link: body.link,
      content: body.content,
      ua: c.req.header('user-agent'),
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      rid: body.rid,
      pid: body.pid
    })
    
    return c.json(comment, 201)
  })
  
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const comment = await commentService.update(id, body)
    return c.json(comment)
  })
  
  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    await commentService.delete(id)
    return c.json({ success: true })
  })
  
  app.post('/:id/like', async (c) => {
    const id = c.req.param('id')
    const userId = c.req.header('x-user-id') || crypto.randomUUID()
    
    const success = await commentService.like(id, userId)
    return c.json({ success })
  })
  
  return app
}
