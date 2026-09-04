import type { Context } from 'hono'

/**
 * 在响应返回后继续执行后台任务，兼容各 serverless 运行时：
 * - Vercel (Node.js / Edge): @vercel/functions 的 waitUntil
 * - Cloudflare Workers / Pages: c.executionCtx.waitUntil
 * - 本地 / 其他: 直接以 fire-and-forget 方式执行
 */
export function defer(c: Context, task: Promise<unknown>): void {
  const safe = task.catch((err) => {
    console.error('[Twikee] background task failed:', err)
  })

  if (typeof process !== 'undefined' && process.env.VERCEL) {
    void import('@vercel/functions')
      .then(({ waitUntil }) => waitUntil(safe))
      .catch((err) => console.error('[Twikee] @vercel/functions unavailable:', err))
    return
  }

  try {
    const execCtx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined
    if (execCtx && typeof execCtx.waitUntil === 'function') {
      execCtx.waitUntil(safe)
      return
    }
  } catch {
    // 无 executionCtx（本地 node 等），走 fire-and-forget
  }

  void safe
}
