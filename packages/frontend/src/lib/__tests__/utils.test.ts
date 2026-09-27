import { describe, it, expect } from 'vitest'
import { sanitizeHtml, randomUuid, getLikeVisitorId } from '../utils'

/**
 * sanitizeHtml 是评论区 v-html 的唯一防线（服务端只剥 <...> 标签，
 * 存储的是原文）。这些用例是这条防线的回归网。
 */
describe('sanitizeHtml', () => {
  it('keeps markdown-generated formatting', () => {
    const html = sanitizeHtml('<p>hello <strong>world</strong></p><ul><li>a</li></ul>')
    expect(html).toContain('<strong>world</strong>')
    expect(html).toContain('<li>a</li>')
  })

  it('keeps language-* class for code blocks', () => {
    expect(sanitizeHtml('<code class="language-ts">x</code>')).toContain('class="language-ts"')
  })

  it('drops arbitrary class values', () => {
    expect(sanitizeHtml('<div class="fixed inset-0 z-50">x</div>')).not.toContain('class=')
    expect(sanitizeHtml('<span class="language-ts btn">x</span>')).not.toContain('class=')
  })

  describe('url scheme allowlist', () => {
    it('keeps http/https/mailto/tel and relative urls', () => {
      for (const value of [
        'https://example.com',
        'http://example.com/a?b=c',
        '/relative/path',
        '#anchor',
        '?query=1',
        '//cdn.example.com/x.png',
        'mailto:a@b.com',
        'tel:+123',
      ]) {
        expect(sanitizeHtml(`<a href="${value}">x</a>`), value).toContain(`href="${value}"`)
      }
    })

    it('drops javascript: in every casing', () => {
      for (const value of [
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'JAVASCRIPT:alert(1)',
        '  javascript:alert(1)',
      ]) {
        expect(sanitizeHtml(`<a href="${value}">x</a>`), value).not.toContain('href')
      }
    })

    it('drops javascript: obfuscated with control characters', () => {
      // 浏览器解析 URL 前会剥离 ASCII tab/LF/CR，黑名单正则匹配不到这些形态
      for (const raw of ['java\tscript:alert(1)', 'java\nscript:alert(1)', 'java\rscript:alert(1)']) {
        expect(sanitizeHtml(`<a href="${raw}">x</a>`), JSON.stringify(raw)).not.toContain('href')
      }
    })

    it('drops javascript: written as an html entity', () => {
      // HTML 解析器会先把属性里的 &#9; 解码成 tab
      expect(sanitizeHtml('<a href="java&#9;script:alert(1)">x</a>')).not.toContain('href')
      expect(sanitizeHtml('<a href="java&#x0a;script:alert(1)">x</a>')).not.toContain('href')
    })

    it('drops other dangerous schemes', () => {
      for (const value of [
        'vbscript:msgbox(1)',
        'data:text/html,<script>alert(1)</script>',
        'data:image/svg+xml,<svg onload=alert(1)>',
        'file:///etc/passwd',
      ]) {
        expect(sanitizeHtml(`<a href="${value}">x</a>`), value).not.toContain('href')
        expect(sanitizeHtml(`<img src="${value}">`), value).not.toContain('src')
      }
    })

    it('applies the scheme check to img src too', () => {
      expect(sanitizeHtml('<img src="https://example.com/a.png" alt="ok">')).toContain(
        'src="https://example.com/a.png"',
      )
      expect(sanitizeHtml('<img src="javascript:alert(1)">')).not.toContain('src')
    })
  })

  describe('tag and attribute allowlist', () => {
    it('unwraps disallowed tags but keeps their text', () => {
      expect(sanitizeHtml('<script>alert(1)</script>')).toBe('alert(1)')
      expect(sanitizeHtml('<style>body{}</style>')).toBe('body{}')
    })

    it('drops event handler attributes', () => {
      expect(sanitizeHtml('<img src="/a.png" onerror="alert(1)">')).not.toContain('onerror')
      expect(sanitizeHtml('<div onclick="alert(1)">x</div>')).not.toContain('onclick')
    })

    it('drops attributes outside the allowlist', () => {
      expect(sanitizeHtml('<a href="/x" id="pwn" style="color:red" data-x="1">x</a>')).not.toContain('id=')
      expect(sanitizeHtml('<a href="/x" id="pwn" style="color:red" data-x="1">x</a>')).not.toContain('style=')
      expect(sanitizeHtml('<img srcset="/a.png 2x" src="/a.png">')).not.toContain('srcset')
    })

    it('never runs inline handlers on unwrapped tags', () => {
      const out = sanitizeHtml('<svg onload="alert(1)"><circle r="1"/></svg>')
      expect(out).not.toContain('onload')
      expect(out).not.toContain('<svg')
    })

    it('forces safe target/rel on links', () => {
      const out = sanitizeHtml('<a href="https://example.com">x</a>')
      expect(out).toContain('target="_blank"')
      expect(out).toContain('rel="noopener noreferrer nofollow"')
    })
  })

  it('is idempotent on its own output', () => {
    const once = sanitizeHtml('<p><a href="https://example.com">x</a></p>')
    expect(sanitizeHtml(once)).toBe(once)
  })
})

describe('visitor id', () => {
  it('randomUuid returns a v4 uuid', () => {
    const id = randomUuid()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('randomUuid falls back when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto.randomUUID
    // @ts-expect-error 故意置空以触发回退分支
    globalThis.crypto.randomUUID = undefined
    try {
      expect(randomUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      globalThis.crypto.randomUUID = original
    }
  })

  it('getLikeVisitorId is stable across calls and persisted', () => {
    localStorage.clear()
    const first = getLikeVisitorId()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(getLikeVisitorId()).toBe(first)
    expect(localStorage.getItem('twikee_like_uid')).toBe(first)
  })

  it('getLikeVisitorId replaces a malformed stored value', () => {
    localStorage.setItem('twikee_like_uid', 'not-a-uuid')
    expect(getLikeVisitorId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('getLikeVisitorId stays stable when storage throws', () => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError')
    }
    try {
      const first = getLikeVisitorId()
      const second = getLikeVisitorId()
      expect(first).toMatch(/^[0-9a-f-]{36}$/)
      expect(second).toBe(first)
    } finally {
      Storage.prototype.getItem = original
    }
  })
})
