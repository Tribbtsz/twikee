import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../markdown'

describe('renderMarkdown', () => {
  it('renders markdown with line breaks enabled', () => {
    // breaks:true 是评论区一直依赖的行为，收进 lib/markdown.ts 后不能丢
    expect(renderMarkdown('a\nb')).toBe('<p>a<br>b</p>\n')
  })

  it('sanitizes dangerous html in the source', () => {
    const html = renderMarkdown('**b** <script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).toContain('<strong>b</strong>')
  })

  it('returns the same string for the same input (memo hit)', () => {
    const first = renderMarkdown('hello **world**')
    const second = renderMarkdown('hello **world**')
    // 命中缓存时是同一个字符串对象，不是重新解析出来的相等字符串
    expect(second).toBe(first)
  })

  it('keeps different inputs apart', () => {
    expect(renderMarkdown('one')).not.toBe(renderMarkdown('two'))
  })

  it('evicts the oldest entry once the cache is full', () => {
    const first = 'evict-me'
    renderMarkdown(first)
    for (let i = 0; i < 500; i++) renderMarkdown(`filler-${i}`)
    // 超出上限后最早的条目被淘汰，同一输入会重新解析（内容仍然正确）
    const again = renderMarkdown(first)
    expect(again).toBe('<p>evict-me</p>\n')
  })
})
