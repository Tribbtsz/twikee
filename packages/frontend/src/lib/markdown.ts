import { marked } from 'marked'
import { sanitizeHtml } from './utils'

// marked 的选项是全局单例状态，收在这里统一设置。原来它在 TkComment.vue
// 模块顶层调用，等于「TkSubmit 只有在 TkComment 被导入时才有 breaks:true」，
// 这种隐式耦合在拆组件时很容易踩到。
marked.setOptions({ breaks: true, gfm: true })

/** 条目数上限 */
const MAX_ENTRIES = 500
/** 缓存字符数预算（原始 markdown + 消毒后 HTML 的近似值），超出就继续淘汰最旧的 */
const MAX_CHARS = 4_000_000

const cache = new Map<string, string>()
let cachedChars = 0

function remember(key: string, html: string): string {
  cache.set(key, html)
  cachedChars += key.length + html.length
  // FIFO 淘汰：Map 保序，最旧的在最前面。两个上限都管，防止少量超长评论
  // 把内存吃爆（评论上限 10000 字符，500 条极端情况也不小）。
  while (cache.size > MAX_ENTRIES || cachedChars > MAX_CHARS) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    const dropped = cache.get(oldest)!
    cache.delete(oldest)
    cachedChars -= oldest.length + dropped.length
  }
  return html
}

/**
 * markdown → 消毒后的 HTML。
 *
 * 评论列表里同一份内容会被反复解析：翻页/提交后 buildCommentTree 会新建全部
 * 节点对象，TkComment 的 computed 和模板里的裸调用都会跟着重跑
 * marked.parse + sanitizeHtml。这里按内容做有界 memo，把重复解析变成查表。
 *
 * 安全性上缓存的是**已消毒**的 HTML，key 是原始 markdown：未消毒内容不可能
 * 被塞进缓存（renderMarkdown 是唯一的写入方），而 sanitizeHtml 是纯函数，
 * 同一输入的输出恒定，所以缓存不会让渲染结果与不缓存时产生差异。
 */
export function renderMarkdown(content: string): string {
  const cached = cache.get(content)
  if (cached !== undefined) return cached

  const parsed = marked.parse(content)
  // marked 将来若配上异步 renderer/扩展，parse 会返回 Promise；
  // 不拦的话它会被当成字符串塞进 innerHTML，静默渲染出 [object Promise]
  if (typeof parsed !== 'string') {
    throw new TypeError('[Twikee] renderMarkdown expects a synchronous markdown renderer')
  }
  return remember(content, sanitizeHtml(parsed))
}

/** 测试用：清空缓存 */
export function clearMarkdownCache(): void {
  cache.clear()
  cachedChars = 0
}
