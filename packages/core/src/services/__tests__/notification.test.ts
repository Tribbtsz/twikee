import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  escapeHtml,
  sanitizeUrl,
  escapeWecomMarkdown,
  postJson,
  TelegramAdapter,
  WebhookAdapter,
  WxPusherAdapter,
  WecomAdapter,
  NotificationService,
} from '../notification'
import type { NotificationEvent } from '../../types'

function makeEvent(overrides?: Partial<NotificationEvent['payload']['comment']>): NotificationEvent {
  return {
    type: 'comment.new',
    payload: {
      comment: {
        id: '1',
        url: '/post',
        nick: 'Alice',
        content: 'Hello',
        master: false,
        top: false,
        isSpam: false,
        likes: 0,
        createdAt: Date.now(),
        ...overrides,
      },
      url: 'https://example.com/post',
      siteName: 'Blog',
    },
  }
}

function mockFetchJson(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

describe('escape helpers', () => {
  it('escapeHtml encodes entities', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;')
  })

  it('sanitizeUrl allows http(s) only', () => {
    expect(sanitizeUrl('https://a.com/x')).toBe('https://a.com/x')
    expect(sanitizeUrl('http://a.com')).toBe('http://a.com')
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined()
    expect(sanitizeUrl('" onclick="x')).toBeUndefined()
    expect(sanitizeUrl(undefined)).toBeUndefined()
  })

  it('escapeWecomMarkdown escapes structural chars', () => {
    expect(escapeWecomMarkdown('[x](y) `z`')).toBe('\\[x\\]\\(y\\) \\`z\\`')
  })
})

describe('postJson', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('sends JSON with timeout signal and checks status', async () => {
    const fetchMock = mockFetchJson({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const res = await postJson('https://example.com/hook', { a: 1 })
    expect(res.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.com/hook')
    expect(JSON.parse(init.body)).toEqual({ a: 1 })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('throws on non-2xx', async () => {
    vi.stubGlobal('fetch', mockFetchJson({}, 500))
    await expect(postJson('https://example.com/hook', {})).rejects.toThrow('500')
  })

  it('skips body for GET', async () => {
    const fetchMock = mockFetchJson({})
    vi.stubGlobal('fetch', fetchMock)
    await postJson('https://example.com/hook', { a: 1 }, { method: 'GET' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
  })

  it('aborts after timeoutMs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(init.signal.reason))
          }),
      ),
    )
    await expect(postJson('https://example.com/hook', {}, { timeoutMs: 20 })).rejects.toThrow(/timed out/)
  })
})

describe('TelegramAdapter', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('escapes user html in message', async () => {
    const fetchMock = mockFetchJson({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TelegramAdapter({ botToken: 'tok', chatId: '1' })
    await adapter.send(makeEvent({ nick: '<b>Bob</b>', content: 'a < b & "c"' }))
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.chat_id).toBe('1')
    expect(body.text).toContain('&lt;b&gt;Bob&lt;/b&gt;')
    expect(body.text).toContain('a &lt; b &amp; &quot;c&quot;')
    expect(body.text).not.toContain('<b>Bob</b>')
  })

  it('drops non-http link', async () => {
    const fetchMock = mockFetchJson({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TelegramAdapter({ botToken: 'tok', chatId: '1' })
    await adapter.send(makeEvent({ link: 'javascript:alert(1)' }))
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body).text).not.toContain('javascript:')
  })
})

describe('WebhookAdapter', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('posts the event as JSON', async () => {
    const fetchMock = mockFetchJson({})
    vi.stubGlobal('fetch', fetchMock)
    const event = makeEvent()
    await new WebhookAdapter({ url: 'https://example.com/hook' }).send(event)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.com/hook')
    expect(JSON.parse(init.body).type).toBe('comment.new')
  })
})

describe('WxPusherAdapter', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('sends appToken/uids and accepts code 1000', async () => {
    const fetchMock = mockFetchJson({ code: 1000, msg: 'ok' })
    vi.stubGlobal('fetch', fetchMock)
    await new WxPusherAdapter({ appToken: 'AT_x', uids: 'UID_1, UID_2' }).send(makeEvent())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://wxpusher.zjiecode.com/api/send/message')
    const body = JSON.parse(init.body)
    expect(body.appToken).toBe('AT_x')
    expect(body.uids).toEqual(['UID_1', 'UID_2'])
    expect(body.contentType).toBe(1)
  })

  it('throws on business error code', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ code: 10001, msg: 'appToken error' }))
    await expect(new WxPusherAdapter({ appToken: 'bad', uids: 'UID_1' }).send(makeEvent())).rejects.toThrow(/10001/)
  })
})

describe('WecomAdapter', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('sends markdown and accepts errcode 0', async () => {
    const fetchMock = mockFetchJson({ errcode: 0, errmsg: 'ok' })
    vi.stubGlobal('fetch', fetchMock)
    await new WecomAdapter({ key: 'k' }).send(makeEvent({ content: 'line1\nline2' }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=k')
    const body = JSON.parse(init.body)
    expect(body.msgtype).toBe('markdown')
    expect(body.markdown.content).toContain('> line1\n> line2')
  })

  it('throws on business errcode', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ errcode: 40001, errmsg: 'invalid key' }))
    await expect(new WecomAdapter({ key: 'bad' }).send(makeEvent())).rejects.toThrow(/40001/)
  })

  it('truncates overlong content to 4096 limit', async () => {
    const fetchMock = mockFetchJson({ errcode: 0 })
    vi.stubGlobal('fetch', fetchMock)
    await new WecomAdapter({ key: 'k' }).send(makeEvent({ content: 'x'.repeat(5000) }))
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body).markdown.content.length).toBeLessThanOrEqual(4096)
  })
})

describe('NotificationService', () => {
  it('fans out to subscribed channels only', async () => {
    const a = { send: vi.fn(async () => {}) }
    const b = { send: vi.fn(async () => {}) }
    const svc = new NotificationService()
    svc.addChannel('a', a, ['comment.new'])
    svc.addChannel('b', b, ['comment.reply'])
    await svc.send(makeEvent())
    expect(a.send).toHaveBeenCalledTimes(1)
    expect(b.send).not.toHaveBeenCalled()
  })

  it('isolates channel failures', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = {
      send: vi.fn(async () => {
        throw new Error('boom')
      }),
    }
    const good = { send: vi.fn(async () => {}) }
    const svc = new NotificationService()
    svc.addChannel('bad', bad, ['comment.new'])
    svc.addChannel('good', good, ['comment.new'])
    await svc.send(makeEvent())
    expect(good.send).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('resolves with zero channels', async () => {
    await expect(new NotificationService().send(makeEvent())).resolves.toBeUndefined()
  })
})
