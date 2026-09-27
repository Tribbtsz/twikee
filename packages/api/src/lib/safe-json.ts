import type { Context } from 'hono'

/**
 * 安全读取 JSON body。
 *
 * c.req.json() 在畸形 JSON 上会抛 SyntaxError，一路冒泡到 app.onError
 * 变成 500 Internal server error —— 客户端错误应该是 4xx，而且这让每个
 * POST 端点的健壮性都挂在全局错误处理上。
 *
 * 返回 null 表示 body 不是合法 JSON，调用方应回 400。
 */
export async function safeJson<T = unknown>(c: Context): Promise<T | null> {
  try {
    return (await c.req.json()) as T
  } catch {
    return null
  }
}
