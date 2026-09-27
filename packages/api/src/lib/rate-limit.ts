import type { MiddlewareHandler } from 'hono'
import { getClientIp } from './visitor'

interface Bucket {
  count: number
  resetAt: number
}

/**
 * 进程内滑动窗口限流。
 *
 * 说明：serverless 多实例下这是「每实例」计数，防护强度有限（无法全局精确限流），
 * 但能把单实例上的爆破/刷量成本提高一个数量级。需要全局精确限流时应改用
 * Vercel KV / Upstash 等外部存储。
 */
const buckets = new Map<string, Bucket>()
const MAX_TRACKED_KEYS = 10_000

export interface RateLimitOptions {
  /** 窗口时长（毫秒） */
  windowMs: number
  /** 窗口内允许的最大请求数 */
  max: number
  /** 限流维度标识，如 'login'，最终 key 为 `标识:ip` */
  key: string
  message?: string
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const message = options.message ?? 'Too many requests, please try again later'
  return async (c, next) => {
    const now = Date.now()
    const key = `${options.key}:${getClientIp(c)}`

    // 惰性清理，避免 Map 无限增长
    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k)
      }
    }

    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      await next()
      return
    }

    if (bucket.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      c.header('Retry-After', String(retryAfter))
      return c.json({ error: message }, 429)
    }

    bucket.count++
    await next()
  }
}

/** 仅测试用：清空计数 */
export function resetRateLimits(): void {
  buckets.clear()
}
