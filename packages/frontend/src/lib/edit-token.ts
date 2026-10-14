/**
 * 访客编辑凭证（localStorage）。
 *
 * 创建评论成功后，服务端随响应返回 editToken（HMAC 签发），前端按评论 id
 * 存一份。30 分钟内凭它可编辑/删除这条评论（PUT / DELETE /api/comment/:id）。
 * 过期或不存在时视为无权限，前端不显示编辑按钮。
 */

const KEY_PREFIX = 'twikee_edit_'
/** 与服务端 EDIT_WINDOW_MS 对齐：30 分钟 */
export const EDIT_WINDOW_MS = 30 * 60 * 1000

interface StoredToken {
  token: string
  createdAt: number
}

function storageKey(id: string): string {
  return `${KEY_PREFIX}${id}`
}

/** 保存创建成功后服务端返回的 editToken */
export function saveEditToken(id: string, token: string): void {
  if (typeof window === 'undefined' || !id || !token) return
  try {
    const value: StoredToken = { token, createdAt: Date.now() }
    localStorage.setItem(storageKey(id), JSON.stringify(value))
  } catch {
    // localStorage 不可用（隐私模式等）：编辑功能降级，不影响评论本身
  }
}

/**
 * 取出有效的 editToken：不存在、格式坏、超过 30 分钟都返回 null
 *（过期时顺手清掉，避免 key 越积越多）。
 */
export function getEditToken(id: string): string | null {
  if (typeof window === 'undefined' || !id) return null
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredToken>
    if (!parsed.token || typeof parsed.createdAt !== 'number') {
      localStorage.removeItem(storageKey(id))
      return null
    }
    if (Date.now() - parsed.createdAt > EDIT_WINDOW_MS) {
      localStorage.removeItem(storageKey(id))
      return null
    }
    return parsed.token
  } catch {
    return null
  }
}

/** 评论被删除后清掉本地凭证 */
export function clearEditToken(id: string): void {
  if (typeof window === 'undefined' || !id) return
  try {
    localStorage.removeItem(storageKey(id))
  } catch {
    // 忽略
  }
}
