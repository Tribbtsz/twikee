import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { createCommentRoutes } from '../comment'
import { createAdminRoutes } from '../admin'
import { resetRateLimits } from '../../lib/rate-limit'
import { invalidateNotifications } from '../../lib/notification'
import { signEditToken } from '@twikee/core'

const FRESH_COMMENT = {
  id: 'c1',
  url: '/p',
  nick: 'Alice',
  content: 'hello',
  master: false,
  top: false,
  isSpam: false,
  deleted: false,
  likes: 0,
  createdAt: Date.now(),
}

function makeCommentApp(overrides: { comment?: any; notificationService?: any } = {}) {
  const config = new Map<string, string>()
  const calls = { update: [] as any[], delete: [] as string[], getCount: [] as string[] }
  const comment = overrides.comment ?? { ...FRESH_COMMENT }
  const db: any = {
    config: {
      get: async (k: string) => config.get(k) || null,
      set: async (k: string, v: string) => {
        config.set(k, v)
      },
      getAll: async () => Object.fromEntries(config),
    },
  }
  const commentService: any = {
    create: async (d: any) => ({ ...d, id: 'new1', createdAt: Date.now() }),
    getById: async (id: string) => (id === comment.id ? { ...comment } : null),
    getCount: async (url: string) => {
      calls.getCount.push(url)
      return url.length
    },
    update: async (id: string, data: any) => {
      calls.update.push({ id, data })
      return { ...comment, ...data }
    },
    delete: async (id: string) => {
      calls.delete.push(id)
      return { ...comment, deleted: true }
    },
  }
  const app = new Hono<{ Variables: { db: any; commentService: any; notificationService: any } }>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('commentService', commentService)
    c.set('notificationService', overrides.notificationService ?? null)
    await next()
  })
  app.route('/', createCommentRoutes())
  return { app, config, calls }
}

function makeAdminApp(comment: any = { ...FRESH_COMMENT }) {
  const hardDeleted: string[] = []
  const commentService: any = {
    getById: async (id: string) => (id === comment.id ? { ...comment } : null),
    hardDelete: async (id: string) => {
      hardDeleted.push(id)
    },
  }
  const db: any = { config: { get: async () => null, getAll: async () => ({}) } }
  const app = new Hono<{ Variables: { db: any; commentService: any; authService: any } }>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('commentService', commentService)
    c.set('authService', null)
    await next()
  })
  app.route('/', createAdminRoutes())
  return { app, hardDeleted }
}

describe('new public endpoints', () => {
  beforeEach(() => {
    resetRateLimits()
    invalidateNotifications()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('GET /count returns per-url counts', async () => {
    const { app } = makeCommentApp()
    const res = await app.request('/count?urls=' + encodeURIComponent('/a,/b'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.counts).toEqual({ '/a': 2, '/b': 2 })
  })

  it('GET /count rejects missing urls', async () => {
    const { app } = makeCommentApp()
    const res = await app.request('/count')
    expect(res.status).toBe(400)
  })

  it('GET /count caps at 20 urls', async () => {
    const { app, calls } = makeCommentApp()
    const urls = Array.from({ length: 25 }, (_, i) => `/p${i}`).join(',')
    const res = await app.request('/count?urls=' + encodeURIComponent(urls))
    expect(res.status).toBe(200)
    expect(calls.getCount).toHaveLength(20)
  })

  it('POST /:id/report returns 404 for unknown comment', async () => {
    const { app } = makeCommentApp()
    const res = await app.request('/nope/report', {
      method: 'POST',
      body: JSON.stringify({ reason: 'spam' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  it('POST /:id/report succeeds and notifies admin', async () => {
    const fetchCalls: Array<{ url: string; init: any }> = []
    vi.stubGlobal('fetch', async (url: string, init: any) => {
      fetchCalls.push({ url, init })
      return { ok: true, status: 200, type: 'basic', json: async () => ({}) } as any
    })
    const { app, config } = makeCommentApp()
    config.set('NOTIFICATION_ENABLE', 'true')
    config.set('NOTIFICATION_TYPE', 'webhook')
    config.set('WEBHOOK_URL', 'https://example.com/hook')
    const res = await app.request('/c1/report', {
      method: 'POST',
      body: JSON.stringify({ reason: '广告' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    // 通知走 defer 后台发送，等一个事件循环
    await new Promise((r) => setTimeout(r, 100))
    expect(fetchCalls.length).toBeGreaterThan(0)
    const sent = JSON.parse(fetchCalls[0].init.body)
    expect(sent.type).toBe('admin.report')
    expect(sent.payload.reason).toBe('广告')
    // webhook payload 不得外带 ip/ua
    expect(sent.payload.comment.ip).toBeUndefined()
    expect(sent.payload.comment.ua).toBeUndefined()
  })

  it('POST / returns editToken on create', async () => {
    const { app } = makeCommentApp()
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Bob', content: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(typeof body.editToken).toBe('string')
    expect(body.editToken.length).toBeGreaterThan(0)
  })

  it('POST / rejects blocked IP with 403', async () => {
    const { app, config } = makeCommentApp()
    config.set('BLOCKED_IPS', '1.2.3.4, 5.6.7.8')
    const blocked = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Spammer', content: 'x' }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '5.6.7.8' },
    })
    expect(blocked.status).toBe(403)
    const ok = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ url: '/p', nick: 'Alice', content: 'x' }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
    })
    expect(ok.status).toBe(201)
  })

  it('PUT /:id returns 404 for unknown comment', async () => {
    const { app } = makeCommentApp()
    const res = await app.request('/nope', {
      method: 'PUT',
      body: JSON.stringify({ content: 'new', editToken: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  it('PUT /:id returns 403 for bad token', async () => {
    const { app } = makeCommentApp()
    const res = await app.request('/c1', {
      method: 'PUT',
      body: JSON.stringify({ content: 'new', editToken: 'forged' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(403)
  })

  it('PUT /:id returns 403 when edit window expired', async () => {
    const old = { ...FRESH_COMMENT, createdAt: Date.now() - 31 * 60 * 1000 }
    const { app } = makeCommentApp({ comment: old })
    const res = await app.request('/c1', {
      method: 'PUT',
      body: JSON.stringify({ content: 'new', editToken: signEditToken('c1') }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/expired/)
  })

  it('PUT /:id edits with valid token', async () => {
    const { app, calls } = makeCommentApp()
    const res = await app.request('/c1', {
      method: 'PUT',
      body: JSON.stringify({ content: '  edited  ', editToken: signEditToken('c1') }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    expect(calls.update).toHaveLength(1)
    expect(calls.update[0].data.content).toBe('edited')
  })

  it('DELETE /:id soft-deletes with valid token', async () => {
    const { app, calls } = makeCommentApp()
    const res = await app.request('/c1', {
      method: 'DELETE',
      body: JSON.stringify({ editToken: signEditToken('c1') }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    expect(calls.delete).toEqual(['c1'])
  })

  it('DELETE /:id returns 403 for bad token', async () => {
    const { app } = makeCommentApp()
    const res = await app.request('/c1', {
      method: 'DELETE',
      body: JSON.stringify({ editToken: 'forged' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(403)
  })
})

describe('admin permanent delete', () => {
  it('DELETE /comment/:id/permanent hard-deletes existing comment', async () => {
    const { app, hardDeleted } = makeAdminApp()
    const res = await app.request('/comment/c1/permanent', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(hardDeleted).toEqual(['c1'])
  })

  it('DELETE /comment/:id/permanent returns 404 for unknown id', async () => {
    const { app, hardDeleted } = makeAdminApp()
    const res = await app.request('/comment/nope/permanent', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect(hardDeleted).toHaveLength(0)
  })
})
