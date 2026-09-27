import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createCommentRoutes } from '../comment'
import { resetRateLimits } from '../../lib/rate-limit'

function makeApp() {
  const config = new Map<string, string>()
  const likeCalls: Array<{ id: string; userId: string }> = []
  const db: any = {
    config: {
      get: async (k: string) => config.get(k) || null,
      set: async (k: string, v: string) => { config.set(k, v) },
    },
    comments: {
      create: async (data: any) => ({ ...data, id: '1', createdAt: Date.now(), master: false, top: false, isSpam: false, likes: 0 }),
      getById: async (id: string) => (id === '1' ? { id: '1', url: '/p', nick: 'A', content: 'x', master: false, top: false, isSpam: false, deleted: false, likes: 1, createdAt: Date.now() } : null),
      getList: async (_q: any) => ({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
      like: async (id: string, userId: string) => {
        likeCalls.push({ id, userId })
        return { liked: true, likes: 1 }
      },
    },
  }

  const commentService: any = {
    create: async (d: any) => db.comments.create(d),
    getById: async (id: string) => db.comments.getById(id),
    getList: async (q: any) => db.comments.getList(q),
    like: async (id: string, uid: string) => db.comments.like(id, uid),
  }

  const app = new Hono<{
    Variables: {
      db: any
      commentService: any
      notificationService: any
    }
  }>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('commentService', commentService)
    c.set('notificationService', null)
    await next()
  })
  app.route('/', createCommentRoutes())
  return { app, likeCalls }
}

describe('Comment routes', () => {
  let app: Hono
  let likeCalls: Array<{ id: string; userId: string }>

  beforeAll(() => {
    const made = makeApp()
    app = made.app
    likeCalls = made.likeCalls
  })

  // 限流计数是进程级的，用例之间必须隔离
  beforeEach(() => {
    resetRateLimits()
    likeCalls.length = 0
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

  it('POST /:id/like returns server-authoritative state', async () => {
    const res = await app.request('/1/like', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.liked).toBe(true)
    expect(body.likes).toBe(1)
  })

  it('POST /:id/like sets an HttpOnly visitor cookie', async () => {
    const res = await app.request('/1/like', { method: 'POST' })
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('tk_uid=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('POST /:id/like reuses the same visitor id from the cookie', async () => {
    // 关键回归：旧实现每次请求都新生成 uuid，导致只能插入不能删除，
    // 「取消点赞」永远不可能发生
    const first = await app.request('/1/like', { method: 'POST' })
    const uid = /tk_uid=([^;]+)/.exec(first.headers.get('set-cookie') ?? '')?.[1]
    expect(uid).toBeTruthy()

    // 带 Cookie 再请求：不应再签发新 id
    const second = await app.request('/1/like', {
      method: 'POST',
      headers: { Cookie: `tk_uid=${uid}` },
    })
    expect(second.status).toBe(200)
    expect(second.headers.get('set-cookie')).toBeNull()
  })

  it('POST /:id/like keeps a stable identity so unlike is possible', async () => {
    // 核心回归：旧实现每次请求都换成新 uuid，服务端只会 INSERT 不会 DELETE，
    // 「取消点赞」永远不可能，计数单调递增
    likeCalls.length = 0
    const uid = '33333333-3333-4333-8333-333333333333'
    await app.request('/1/like', { method: 'POST', headers: { 'x-user-id': uid } })
    await app.request('/1/like', { method: 'POST', headers: { 'x-user-id': uid } })
    expect(likeCalls).toHaveLength(2)
    expect(likeCalls[0].userId).toBe(uid)
    expect(likeCalls[1].userId).toBe(uid)
  })

  it('POST /:id/like 404s for a missing comment', async () => {
    likeCalls.length = 0
    const res = await app.request('/does-not-exist/like', { method: 'POST' })
    expect(res.status).toBe(404)
    // 不存在评论不应产生任何点赞写入
    expect(likeCalls).toHaveLength(0)
  })

  it('POST /:id/like rejects a malformed x-user-id and mints a fresh id', async () => {
    const res = await app.request('/1/like', {
      method: 'POST',
      headers: { 'x-user-id': 'not-a-uuid' },
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    const uid = /tk_uid=([^;]+)/.exec(cookie)?.[1]
    expect(uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('POST /:id/like prefers the cookie over the x-user-id header', async () => {
    // cookie 是服务端签发的（HttpOnly），优先级高于客户端传来的值
    const res = await app.request('/1/like', {
      method: 'POST',
      headers: {
        Cookie: 'tk_uid=11111111-1111-4111-8111-111111111111',
        'x-user-id': '22222222-2222-4222-8222-222222222222',
      },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeNull()
  })})
