import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { createCommentRoutes } from '../comment'

function makeApp() {
  const config = new Map<string, string>()
  const db: any = {
    config: {
      get: async (k: string) => config.get(k) || null,
      set: async (k: string, v: string) => { config.set(k, v) },
    },
    comments: {
      create: async (data: any) => ({ ...data, id: '1', createdAt: Date.now(), master: false, top: false, isSpam: false, likes: 0 }),
      getList: async (q: any) => ({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
      like: async () => true,
    },
  }

  const commentService: any = {
    create: async (d: any) => db.comments.create(d),
    getList: async (q: any) => db.comments.getList(q),
    like: async (id: string, uid: string) => db.comments.like(id, uid),
  }

  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('commentService', commentService)
    c.set('notificationService', null)
    await next()
  })
  app.route('/', createCommentRoutes())
  return app
}

describe('Comment routes', () => {
  let app: Hono

  beforeAll(() => {
    app = makeApp()
  })

  it('GET / returns empty list', async () => {
    const res = await app.request('/?url=/test')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('GET / rejects missing url', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(400)
  })

  it('POST / creates a comment', async () => {
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.nick).toBe('Alice')
  })

  it('POST / rejects invalid body', async () => {
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('POST /:id/like', async () => {
    const res = await app.request('/1/like', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
