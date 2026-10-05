import { getLikeVisitorId } from './utils'

export interface LikeState {
  liked: boolean
  count: number
}

export interface LikeControllerOptions {
  apiUrl: string
  commentId: string
  /** 读当前 UI 上的状态（含乐观值） */
  read: () => LikeState
  /** 把状态写回 UI */
  apply: (next: LikeState) => void
  /** 记住「我已赞」，刷新后不丢 */
  persist: (liked: boolean) => void
  /** 连点合并窗口，默认 250ms */
  debounceMs?: number
  onError?: (err: unknown) => void
}

export interface LikeController {
  toggle: () => void
  /** 本地还有未确认的改动、或请求在飞 —— 此时别用服务端 props 覆盖乐观值 */
  isBusy: () => boolean
  dispose: () => void
}

/**
 * 点赞：乐观更新 + 请求合并。
 *
 * 交互要求是「点下去立刻有反应，但连点不能变成连发请求」：
 * - 点击 → 立刻改本地状态（UI + localStorage），请求推迟到 debounceMs 之后发
 * - 只记「我想要的最终状态 desired」：期间又点回原状态，这次请求直接不发
 * - 请求串行：在飞时不再发；落地后若意图仍与服务端不一致，再补一次
 * - 服务端结果权威：落地按它校正；失败则回退到上一次与服务端一致的状态
 */
export function createLikeController(options: LikeControllerOptions): LikeController {
  const debounceMs = options.debounceMs ?? 250
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let disposed = false
  let desired: boolean | null = null
  // 上一次与服务端对齐的状态。初次以本地记忆为准（这就是原来的设计），
  // 第一次请求回来后会自我校正。
  let serverLiked = options.read().liked
  let serverCount = options.read().count

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const write = (liked: boolean, count: number) => {
    options.apply({ liked, count: Math.max(0, count) })
    options.persist(liked)
  }

  const toggle = () => {
    const current = options.read()
    const liked = !current.liked
    desired = liked
    write(liked, current.count + (liked ? 1 : -1))
    clearTimer()
    timer = setTimeout(() => {
      void flush()
    }, debounceMs)
  }

  async function flush(): Promise<void> {
    timer = null
    if (disposed || inFlight) return
    // 意图已经回到服务端状态（比如连点两次）→ 不必打扰服务端
    if (desired === null || desired === serverLiked) {
      desired = null
      return
    }

    const want = desired
    inFlight = true
    try {
      const res = await fetch(`${options.apiUrl}/api/comment/${options.commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': getLikeVisitorId() },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { success?: boolean; liked?: boolean; likes?: number }
      if (!data?.success) throw new Error('服务端未确认点赞')

      serverLiked = !!data.liked
      if (typeof data.likes === 'number') serverCount = data.likes

      if (desired === want) {
        // 期间没有新点击：以服务端为准，收工
        desired = null
        write(serverLiked, serverCount)
      } else if (desired !== null) {
        // 期间又点过：先把用户的意图放回 UI，等下一轮收敛
        write(desired, serverCount + (desired ? 1 : -1))
      }
    } catch (err) {
      desired = null
      write(serverLiked, serverCount)
      options.onError?.(err)
    } finally {
      inFlight = false
      if (desired !== null && desired !== serverLiked) {
        clearTimer()
        timer = setTimeout(() => {
          void flush()
        }, debounceMs)
      }
    }
  }

  return {
    toggle,
    isBusy: () => inFlight || timer !== null || desired !== null,
    dispose: () => {
      disposed = true
      clearTimer()
    },
  }
}
