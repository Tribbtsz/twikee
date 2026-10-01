import { describe, it, expect } from 'vitest'
import { CreateCommentSchema, ImportSchema, AdminUpdateCommentSchema, AdminCommentQuerySchema } from '../validation'

/**
 * 校验层是公开端点的第一道防线，这些用例锁住「不该进来的进不来」。
 */
describe('CreateCommentSchema', () => {
  const base = { url: '/post', nick: 'Alice', content: 'Hello' }

  it('accepts a normal comment', () => {
    const r = CreateCommentSchema.safeParse(base)
    expect(r.success).toBe(true)
  })

  it('accepts optional fields when empty', () => {
    const r = CreateCommentSchema.safeParse({ ...base, mail: '', link: '' })
    expect(r.success).toBe(true)
  })

  describe('link protocol', () => {
    it('accepts http(s)', () => {
      for (const link of ['https://example.com', 'http://example.com/a?b=c', 'https://a.b.c:8080/x']) {
        expect(CreateCommentSchema.safeParse({ ...base, link }).success, link).toBe(true)
      }
    })

    it('rejects javascript: even though it is a valid WHATWG URL', () => {
      // z.string().url() 会接受它，所以必须有显式的协议白名单
      expect(CreateCommentSchema.safeParse({ ...base, link: 'javascript:alert(1)' }).success).toBe(false)
    })

    it('rejects data: urls', () => {
      expect(CreateCommentSchema.safeParse({ ...base, link: 'data:text/html,<script>alert(1)</script>' }).success).toBe(
        false,
      )
    })

    it('rejects other dangerous schemes', () => {
      for (const link of ['vbscript:msgbox(1)', 'file:///etc/passwd']) {
        expect(CreateCommentSchema.safeParse({ ...base, link }).success, link).toBe(false)
      }
    })
  })

  describe('rid/pid', () => {
    it('accepts reasonable ids', () => {
      const r = CreateCommentSchema.safeParse({
        ...base,
        rid: '0f8fad5b-d9cb-469f-a165-70867728950e',
        pid: '0f8fad5b-d9cb-469f-a165-70867728950e',
      })
      expect(r.success).toBe(true)
    })

    it('rejects overlong ids (junk data guard)', () => {
      const r = CreateCommentSchema.safeParse({ ...base, rid: 'x'.repeat(65) })
      expect(r.success).toBe(false)
    })

    it('rejects empty ids', () => {
      expect(CreateCommentSchema.safeParse({ ...base, rid: '' }).success).toBe(false)
    })
  })

  it('rejects missing required fields', () => {
    expect(CreateCommentSchema.safeParse({ url: '/p', content: 'x' }).success).toBe(false)
    expect(CreateCommentSchema.safeParse({ nick: 'A', content: 'x' }).success).toBe(false)
    expect(CreateCommentSchema.safeParse({ url: '/p', nick: 'A' }).success).toBe(false)
  })

  it('rejects oversized content', () => {
    expect(CreateCommentSchema.safeParse({ ...base, content: 'x'.repeat(10001) }).success).toBe(false)
  })

  it('rejects an overlong nick', () => {
    expect(CreateCommentSchema.safeParse({ ...base, nick: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('AdminUpdateCommentSchema', () => {
  it('allows only content/isSpam/top', () => {
    expect(AdminUpdateCommentSchema.safeParse({ content: 'x' }).success).toBe(true)
    expect(AdminUpdateCommentSchema.safeParse({ isSpam: true }).success).toBe(true)
    expect(AdminUpdateCommentSchema.safeParse({ top: false }).success).toBe(true)
  })

  it('rejects master — it must only be set by mail matching on the public endpoint', () => {
    expect(AdminUpdateCommentSchema.safeParse({ master: true }).success).toBe(false)
  })

  it('rejects unknown fields', () => {
    expect(AdminUpdateCommentSchema.safeParse({ likes: 999 }).success).toBe(false)
    expect(AdminUpdateCommentSchema.safeParse({ deleted: true }).success).toBe(false)
  })
})

describe('ImportSchema', () => {
  const item = { url: '/p', nick: 'A', content: 'x' }

  it('accepts a normal array', () => {
    expect(ImportSchema.safeParse([item]).success).toBe(true)
  })

  it('keeps ids so imported reply chains stay intact', () => {
    const r = ImportSchema.safeParse([{ ...item, id: 'legacy-1', rid: 'legacy-0', createdAt: 1700000000000 }])
    expect(r.success).toBe(true)
  })

  it('rejects more than 1000 items in one request', () => {
    const many = Array.from({ length: 1001 }, () => ({ ...item }))
    expect(ImportSchema.safeParse(many).success).toBe(false)
  })

  it('rejects non-array input', () => {
    expect(ImportSchema.safeParse({ ...item }).success).toBe(false)
  })

  it('rejects items missing required fields', () => {
    expect(ImportSchema.safeParse([{ url: '/p' }]).success).toBe(false)
  })
})

describe('AdminCommentQuerySchema', () => {
  it('defaults status to all', () => {
    const r = AdminCommentQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.status).toBe('all')
  })

  it('accepts approved/spam status filters', () => {
    for (const status of ['all', 'approved', 'spam']) {
      expect(AdminCommentQuerySchema.safeParse({ status }).success, status).toBe(true)
    }
  })

  it('rejects unknown status', () => {
    expect(AdminCommentQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false)
  })

  it('still parses includeSpam=false correctly (no Boolean coerce trap)', () => {
    const r = AdminCommentQuerySchema.safeParse({ includeSpam: 'false' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.includeSpam).toBe(false)
  })
})
