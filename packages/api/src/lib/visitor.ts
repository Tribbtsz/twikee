import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { randomUUID } from 'node:crypto'

const VISITOR_COOKIE = 'tk_uid'
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365 // 1 年
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 取客户端 IP，仅用于限流与留痕。
 *
 * x-forwarded-for 形如 "client, proxy1, proxy2"：每经过一层代理就把上游 IP
 * 追加在**末尾**（RFC 7239），所以真实客户端 IP 在**开头**，离服务端最近的
 * 代理在末尾。取末尾会拿到固定代理 IP，导致限流 key 全站共用一个桶。
 * 因此从前往后取第一段合法 IP；x-real-ip / cf-connecting-ip 由可信代理
 * 直接给出客户端 IP，优先采用。
 */
export function getClientIp(c: Context): string {
  const realIp = c.req.header('x-real-ip')?.trim()
  if (realIp && isValidIp(realIp)) return realIp

  const cfIp = c.req.header('cf-connecting-ip')?.trim()
  if (cfIp && isValidIp(cfIp)) return cfIp

  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',')
    for (let i = 0; i < parts.length; i++) {
      const candidate = parts[i].trim()
      if (isValidIp(candidate)) return candidate
    }
  }
  return 'unknown'
}

function isValidIp(value: string): boolean {
  if (value.length > 45) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true // IPv4
  if (/^[0-9a-f:]+$/i.test(value) && value.includes(':')) return true // IPv6（含 IPv4 映射）
  return false
}

/**
 * 取访客唯一 id（点赞身份）。
 *
 * 旧实现是 `x-user-id 请求头 || crypto.randomUUID()`：前端从不发这个头，
 * 于是每次请求都是新 uuid，服务端只会插入不会删除，「取消点赞」永远不可能；
 * 任意调用方还能伪造该头篡改他人点赞状态。
 *
 * 现在身份按优先级取：
 * 1. HttpOnly Cookie（服务端签发，页面脚本读不到也改不了）
 * 2. 请求头 x-user-id（仅接受 UUID 格式）——widget 通常跨域部署
 *    （博客页面一个域、API 另一个域），跨站 POST 默认不带 Cookie、
 *    fetch 也不会带 credentials，此时由前端持久化的 id 保证身份稳定
 * 3. 都没有则现场生成并写入 Cookie
 *
 * 注意：无论哪种方式，刷赞的终极防线是限流（每条 like 端点 60 次/分/IP），
 * 因为匿名接口下「每个新身份=一个新赞」这点无法靠身份机制本身消除。
 */
export function getOrCreateVisitorId(c: Context): string {
  const fromCookie = getCookie(c, VISITOR_COOKIE)
  if (fromCookie && UUID_RE.test(fromCookie)) return fromCookie

  const fromHeader = c.req.header('x-user-id')?.trim()
  const id = fromHeader && UUID_RE.test(fromHeader) ? fromHeader : randomUUID()

  // 尽快把身份固化到 Cookie：一旦浏览器会携带（同源部署 / 支持 credentials 的部署），
  // 后续就不再依赖客户端传来的值
  const secure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: secure ? 'None' : 'Lax',
    secure,
    path: '/',
    maxAge: VISITOR_MAX_AGE,
  })
  return id
}
