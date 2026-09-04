import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { createCommentRoutes } from '../comment'

function makeApp(notificationService: any) {
  const config = new Map<string, string>()
  const db: any = {
    config: {
      get: async (k: string) => config.get(k) || null,
      set: async (k: string, v: string) => {
        config.set(k, v)
      },
    },
    comments: {
      create: async (data: any) => ({
        ...data,
        id: '1',
        createdAt: Date.now(),
        master: false,
        top: false,
        isSpam: false,
        likes: 0,
      }),
    },
  }
  const commentService: any = { create: async (d: any) => db.comments.create(d) }

  const app = new Hono<{ Variables: { db: any; commentService: any; notificationService: any } }>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('commentService', commentService)
    c.set('notificationService', notificationService)
    await next()
  })
  app.route('/', createCommentRoutes())
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('Comment routes with notifications', () => {
  it('POST / triggers notification but still returns 201', async () => {
    const send = vi.fn(async () => {})
    const app = makeApp({ send })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].type).toBe('comment.new')
  })

  it('POST / reply triggers comment.reply event', async () => {
    const send = vi.fn(async () => {})
    const app = makeApp({ send })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Bob', content: '+1', rid: '1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send.mock.calls[0][0].type).toBe('comment.reply')
  })

  it('POST / still returns 201 when notification fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn(async () => {
      throw new Error('channel down')
    })
    const app = makeApp({ send })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
