import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { createCommentRoutes } from '../comment'

function makeApp(notificationService: any) {
  const config = new Map<string, string>()
  const configGetCalls: string[] = []
  const configGetAllCalls: number[] = []
  const db: any = {
    config: {
      get: async (k: string) => {
        configGetCalls.push(k)
        return config.get(k) || null
      },
      getAll: async () => {
        configGetAllCalls.push(1)
        return Object.fromEntries(config)
      },
      set: async (k: string, v: string) => {
        config.set(k, v)
      },
    },
    comments: {
      create: async (data: any) => ({
        ...data,
        id: '1',
        createdAt: Date.now(),
        master: !!data.master,
        top: false,
        isSpam: !!data.isSpam,
        deleted: false,
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
  return { app, config, configGetCalls, configGetAllCalls }
}

const flush = () => new Promise<void>((r) => setImmediate(r))

afterEach(() => vi.restoreAllMocks())

// 注：vitest/node 下无 executionCtx，这里覆盖的是 defer 本地 fallback 路径；
// Vercel/CF 分支由 defer.test.ts 覆盖
describe('Comment routes with notifications', () => {
  it('POST / triggers notification but still returns 201', async () => {
    const send = vi.fn(async () => {})
    const { app } = makeApp({ send, channelCount: 1 })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].type).toBe('comment.new')
  })

  it('POST / builds the notification url from the same config snapshot', async () => {
    // SITE_NAME / SITE_URL 与 COMMENTS_CLOSED 等共用一次 getAll 快照，
    // 不再各发一次远程查询
    const send = vi.fn(async () => {})
    const { app, config } = makeApp({ send, channelCount: 1 })
    config.set('SITE_URL', 'https://blog.example.com')
    config.set('SITE_NAME', 'My Blog')
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/post/1', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send.mock.calls[0][0].payload.url).toBe('https://blog.example.com/post/1')
    expect(send.mock.calls[0][0].payload.siteName).toBe('My Blog')
  })

  it('POST / falls back to the raw url when SITE_URL is not configured', async () => {
    const send = vi.fn(async () => {})
    const { app } = makeApp({ send, channelCount: 1 })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/post/1', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send.mock.calls[0][0].payload.url).toBe('/post/1')
    expect(send.mock.calls[0][0].payload.siteName).toBeUndefined()
  })

  it('POST / reads config once for both the flags and the notification payload', async () => {
    const send = vi.fn(async () => {})
    const { app, configGetAllCalls, configGetCalls } = makeApp({ send, channelCount: 1 })
    await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(configGetAllCalls).toHaveLength(1)
    expect(configGetCalls).toHaveLength(0)
  })

  it('POST / reply triggers comment.reply event', async () => {
    const send = vi.fn(async () => {})
    const { app } = makeApp({ send, channelCount: 1 })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Bob', content: '+1', rid: '1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send.mock.calls[0][0].type).toBe('comment.reply')
  })

  it('POST / skips notification when no channels registered', async () => {
    const send = vi.fn(async () => {})
    const { app } = makeApp({ send, channelCount: 0 })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send).not.toHaveBeenCalled()
  })

  it('POST / still returns 201 and logs when notification fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn(async () => {
      throw new Error('channel down')
    })
    const { app } = makeApp({ send, channelCount: 1 })
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(send).toHaveBeenCalledTimes(1)
    await flush()
    await flush()
    expect(errSpy).toHaveBeenCalledWith('[Twikee] background task failed:', expect.any(Error))
  })
})
