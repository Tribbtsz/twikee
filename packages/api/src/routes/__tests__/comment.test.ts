import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createCommentRoutes } from '../comment'
import { resetRateLimits } from '../../lib/rate-limit'

function makeApp() {
  const config = new Map<string, string>()
  const likeCalls: Array<{ id: string; userId: string }> = []
  const createCalls: any[] = []
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
      create: async (data: any) => {
        createCalls.push(data)
        return {
          ...data,
          id: '1',
          createdAt: Date.now(),
          master: !!data.master,
          top: false,
          isSpam: !!data.isSpam,
          deleted: false,
          likes: 0,
        }
      },
      getById: async (id: string) =>
        id === '1'
          ? {
              id: '1',
              url: '/p',
              nick: 'A',
              content: 'x',
              master: false,
              top: false,
              isSpam: false,
              deleted: false,
              likes: 1,
              createdAt: Date.now(),
            }
          : null,
      getList: async (_q: any) => ({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
      like: async (id: string, userId: string) => {
        likeCalls.push({ id, userId })
        return { liked: true, likes: 1 }
      },
    },
  }

  // 打标记改走 create 的入参后，路由不该再调 update；留个 spy 把这条钉死
  const updateCalls: any[] = []
  const commentService: any = {
    create: async (d: any) => db.comments.create(d),
    update: async (id: string, d: any) => {
      updateCalls.push({ id, d })
      return db.comments.getById(id)
    },
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
  return { app, likeCalls, createCalls, updateCalls, configGetCalls, configGetAllCalls, config }
}

describe('Comment routes', () => {
  let app: Hono
  let likeCalls: Array<{ id: string; userId: string }>
  let createCalls: any[]
  let updateCalls: any[]
  let configGetCalls: string[]
  let configGetAllCalls: number[]
  let config: Map<string, string>

  beforeAll(() => {
    const made = makeApp()
    app = made.app
    likeCalls = made.likeCalls
    createCalls = made.createCalls
    updateCalls = made.updateCalls
    configGetCalls = made.configGetCalls
    configGetAllCalls = made.configGetAllCalls
    config = made.config
  })

  // 限流计数是进程级的，用例之间必须隔离
  beforeEach(() => {
    resetRateLimits()
    likeCalls.length = 0
    createCalls.length = 0
    updateCalls.length = 0
    configGetCalls.length = 0
    configGetAllCalls.length = 0
    config.clear()
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

  it('POST / reads config once and never falls back to per-key gets', async () => {
    // 核心回归：配置必须是「一次 getAll 快照」。每次 get 都是一次远程往返，
    // 退回 5 次 get 不会弄坏任何功能断言，所以在这里把次数钉死。
    await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(configGetAllCalls).toHaveLength(1)
    expect(configGetCalls).toHaveLength(0)
  })

  it('POST / applies master/moderation flags on create without extra updates', async () => {
    // 标记随 create 写入：创建后不再补 update（每次 update = UPDATE + 回查两趟往返）
    config.set('AUTO_APPROVE', 'false')
    config.set('BLOGGER_EMAIL', 'me@example.com')
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Guest', mail: 'guest@example.com', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(createCalls[0].isSpam).toBe(true)
    expect(updateCalls).toHaveLength(0)
  })

  it('POST / rejects invalid body', async () => {
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('POST / rejects when comments are closed', async () => {
    config.set('COMMENTS_CLOSED', 'true')
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(403)
    // 关停时不该有任何写入
    expect(createCalls).toHaveLength(0)
  })

  it('POST / marks the blogger as master on create', async () => {
    // 邮箱命中 BLOGGER_EMAIL → master。原来是创建后补一次 update，
    // 现在随 create 一起写入，少两趟往返
    config.set('BLOGGER_EMAIL', 'me@example.com')
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Me', mail: 'Me@Example.com', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(createCalls[0].master).toBe(true)
    expect(createCalls[0].isSpam).toBe(false)
    const body = await res.json()
    expect(body.master).toBe(true)
  })

  it('POST / holds non-blogger comments for moderation when AUTO_APPROVE is false', async () => {
    config.set('AUTO_APPROVE', 'false')
    config.set('BLOGGER_EMAIL', 'me@example.com')
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Guest', mail: 'guest@example.com', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(createCalls[0].isSpam).toBe(true)
    expect(createCalls[0].master).toBe(false)
  })

  it('POST / exempts the blogger from moderation', async () => {
    // 博主评论免审核：即使 AUTO_APPROVE=false 也不该进待审核
    config.set('AUTO_APPROVE', 'false')
    config.set('BLOGGER_EMAIL', 'me@example.com')
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Me', mail: 'me@example.com', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    expect(createCalls[0].master).toBe(true)
    expect(createCalls[0].isSpam).toBe(false)
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
  })
})
