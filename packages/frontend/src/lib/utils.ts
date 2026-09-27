import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function md5cycle(x: number[], k: number[]) {
  let a = x[0], b = x[1], c = x[2], d = x[3]
  a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586)
  c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330)
  a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426)
  c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983)
  a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417)
  c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162)
  a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101)
  c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329)
  a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632)
  c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302)
  a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083)
  c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848)
  a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690)
  c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501)
  a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784)
  c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734)
  a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463)
  c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556)
  a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353)
  c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640)
  a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222)
  c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189)
  a = ii(a, b, c, d, k[0], 6, -640364487); d = ii(d, a, b, c, k[7], 10, -421815835)
  c = ii(c, d, a, b, k[14], 15, 530742520); b = ii(b, c, d, a, k[5], 21, -995338651)
  a = ii(a, b, c, d, k[12], 6, -198630844); d = ii(d, a, b, c, k[3], 10, 1126891415)
  c = ii(c, d, a, b, k[10], 15, -1416354905); b = ii(b, c, d, a, k[1], 21, -57434055)
  a = ii(a, b, c, d, k[8], 6, 1700485571); d = ii(d, a, b, c, k[15], 10, -1894986606)
  c = ii(c, d, a, b, k[6], 15, -1051523); b = ii(b, c, d, a, k[13], 21, -2054922799)
  a = ii(a, b, c, d, k[4], 6, 1873313359); d = ii(d, a, b, c, k[11], 10, -30611744)
  c = ii(c, d, a, b, k[2], 15, -1560198380); b = ii(b, c, d, a, k[9], 21, 1309151649)
  x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3])
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
  a = add32(add32(a, q), add32(x, t))
  return add32((a << s) | (a >>> (32 - s)), b)
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & c) | (~b & d), a, b, x, s, t)
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t)
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(b ^ c ^ d, a, b, x, s, t)
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(c ^ (b | ~d), a, b, x, s, t)
}

function md51(s: string) {
  const n = s.length
  let state = [1732584193, -271733879, -1732584194, 271733878]
  let i: number
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)))
  }
  s = s.substring(i - 64)
  const tail = Array(16).fill(0)
  for (i = 0; i < s.length; i++) {
    tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3)
  }
  tail[i >> 2] |= 0x80 << ((i % 4) << 3)
  if (i > 55) {
    md5cycle(state, tail)
    for (i = 0; i < 16; i++) tail[i] = 0
  }
  tail[14] = n * 8
  md5cycle(state, tail)
  return state
}

function md5blk(s: string) {
  const md5blks = Array(16).fill(0)
  for (let i = 0; i < 64; i += 4) {
    md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24)
  }
  return md5blks
}

const hex_chr = '0123456789abcdef'.split('')

function rhex(n: number) {
  let s = ''
  for (let j = 0; j < 4; j++) {
    s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F]
  }
  return s
}

function hex(x: number[]) {
  return x.map(rhex).join('')
}

function add32(a: number, b: number) {
  return (a + b) & 0xFFFFFFFF
}

export function md5(s: string): string {
  return hex(md51(s))
}

const SAFE_TAGS = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code', 'em', 'strong', 'del', 's',
  'b', 'i', 'u', 'sub', 'sup', 'mark', 'small',
  'a', 'ul', 'ol', 'li', 'img', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'details', 'summary', 'span', 'div',
  'dl', 'dt', 'dd', 'abbr',
])

const SAFE_ATTRS = new Set([
  'href', 'title', 'src', 'alt', 'target', 'rel', 'class',
  'align', 'width', 'height',
])

/** 链接/图片允许的协议白名单 */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** marked 会给代码块加 language-* class，其余 class 一律不允许（避免污染宿主页样式） */
const SAFE_CLASS_RE = /^language-[a-z0-9+#.-]*$/i
/**
 * 判断 href/src 是否安全。
 *
 * 不能只黑名单 `javascript:`：浏览器解析 URL 前会剥离 ASCII tab/LF/CR，
 * `java\tscript:` 剥掉 tab 就是 `javascript:`；HTML 解析器又会先把属性里的
 * `&#9;` 解码成 tab，所以连实体编码也能绕过。这里先剥掉所有控制字符与空白
 * 再取 scheme，走白名单。
 */
function isSafeUrlValue(value: string): boolean {
  const compact = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase()
  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/)
  if (!scheme) return true // 相对路径、#锚点、?query、//host 协议相对地址
  return SAFE_SCHEMES.has(`${scheme[1]}:`)
}

function isSafeAttr(tag: string, name: string, value: string): boolean {
  if (!SAFE_ATTRS.has(name)) return false
  if (name === 'href' || name === 'src') return isSafeUrlValue(value)
  if (name === 'class') return SAFE_CLASS_RE.test(value)
  return true
}

const LIKE_VISITOR_KEY = 'twikee_like_uid'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 生成 UUID。crypto.randomUUID 只在安全上下文可用，http 站点上退回 getRandomValues */
export function randomUuid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let inMemoryVisitorId: string | undefined

/**
 * 取点赞用的稳定访客 id。
 *
 * widget 通常跨域部署（博客一个域、API 另一个域），fetch 默认不带 Cookie，
 * 服务端的 HttpOnly Cookie 送不过来；没有稳定身份时每次点赞都是新用户，
 * 「取消点赞」永远无法生效。因此由前端持久化一份 id 随请求带上。
 * 服务端会同时把它固化进 Cookie，能带 Cookie 的场景下以后以 Cookie 为准。
 *
 * 隐私模式 / 禁用存储时退化为进程内 id（同一页面会话内仍稳定）。
 */
export function getLikeVisitorId(): string {
  try {
    const existing = localStorage.getItem(LIKE_VISITOR_KEY)
    if (existing && UUID_RE.test(existing)) return existing
    const id = randomUuid()
    localStorage.setItem(LIKE_VISITOR_KEY, id)
    return id
  } catch {
    inMemoryVisitorId = inMemoryVisitorId ?? randomUuid()
    return inMemoryVisitorId
  }
}

export function sanitizeHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html

  const sanitize = (node: Element) => {
    let i = 0
    while (i < node.children.length) {
      const child = node.children[i]
      const tag = child.tagName.toLowerCase()
      if (!SAFE_TAGS.has(tag)) {
        const childNodes = Array.from(child.childNodes)
        child.replaceWith(...childNodes)
      } else {
        const attrs = Array.from(child.attributes)
        for (const attr of attrs) {
          if (!isSafeAttr(tag, attr.name, attr.value)) {
            child.removeAttribute(attr.name)
          }
        }
        if (tag === 'a') {
          child.setAttribute('target', '_blank')
          child.setAttribute('rel', 'noopener noreferrer nofollow')
        }
        sanitize(child)
        i++
      }
    }
  }

  sanitize(template.content as unknown as Element)
  return template.innerHTML
}
