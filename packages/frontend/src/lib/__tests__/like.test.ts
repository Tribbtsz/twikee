import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLikeController, type LikeState, type LikeController } from '../like'

interface FetchCall {
  url: string
  resolve: (payload: { status?: number; body?: unknown }) => void
}

/**
 * 控制器要求是「点下去立刻有反馈，但连点不能变成连发请求」。
 * 这里用手动 resolve 的 fetch stub 把「请求在飞」这段窗口真正夹出来，
 * 才能验证串行与合并的行为。
 */
function harness(initial: LikeState = { liked: false, count: 0 }) {
  let state: LikeState = { ...initial }
  const calls: FetchCall[] = []
  const persisted: boolean[] = []

  const fetchMock = vi.fn((url: string) => {
    return new Promise((resolve) => {
      calls.push({
        url,
        resolve: (payload) =>
          resolve({
            ok: (payload.status ?? 200) < 400,
            status: payload.status ?? 200,
            json: async () => payload.body ?? { success: true },
          } as Response),
      })
    })
  })

  const controller: LikeController = createLikeController({
    apiUrl: 'https://api.test',
    commentId: 'c1',
    read: () => ({ ...state }),
    apply: (next) => {
      state = { ...next }
    },
    persist: (liked) => persisted.push(liked),
    debounceMs: 250,
    onError: () => {},
  })

  return {
    controller,
    fetchMock,
    calls,
    persisted,
    state: () => ({ ...state }),
  }
}

describe('createLikeController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('点击立刻改本地状态，请求在合并窗口之后才发出', async () => {
    const h = harness()
    h.fetchMock.mockClear()
    vi.stubGlobal('fetch', h.fetchMock)

    h.controller.toggle()
    // 还没到窗口：UI 已经变了，但一个请求都没发
    expect(h.state()).toEqual({ liked: true, count: 1 })
    expect(h.persisted).toEqual([true])
    expect(h.calls).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(260)
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].url).toBe('https://api.test/api/comment/c1/like')
  })

  it('窗口内连点三次 → 只发一个请求', async () => {
    const h = harness()
    vi.stubGlobal('fetch', h.fetchMock)

    h.controller.toggle()
    h.controller.toggle()
    h.controller.toggle()
    expect(h.state()).toEqual({ liked: true, count: 1 })

    await vi.advanceTimersByTimeAsync(260)
    expect(h.calls).toHaveLength(1)
  })

  it('点两次回到原状态 → 一个请求都不发', async () => {
    const h = harness()
    vi.stubGlobal('fetch', h.fetchMock)

    h.controller.toggle()
    h.controller.toggle()
    expect(h.state()).toEqual({ liked: false, count: 0 })

    await vi.advanceTimersByTimeAsync(500)
    expect(h.calls).toHaveLength(0)
  })

  it('请求在飞时再点：串行发出，不并发，最终与服务端一致', async () => {
    const h = harness()
    vi.stubGlobal('fetch', h.fetchMock)

    h.controller.toggle()
    await vi.advanceTimersByTimeAsync(260)
    expect(h.calls).toHaveLength(1)
    expect(h.controller.isBusy()).toBe(true)

    // 第一个请求还没回来，又点一下（用户改主意 → 想取消赞）
    h.controller.toggle()
    expect(h.state()).toEqual({ liked: false, count: 0 })
    await vi.advanceTimersByTimeAsync(260)
    // 仍在飞，不允许并发第二个请求
    expect(h.calls).toHaveLength(1)

    // 第一个请求落地：服务端说「已赞」
    h.calls[0].resolve({ body: { success: true, liked: true, likes: 1 } })
    await vi.advanceTimersByTimeAsync(0)
    // 意图是「取消赞」，所以要补一次；此时 UI 保持用户意图
    expect(h.state().liked).toBe(false)

    await vi.advanceTimersByTimeAsync(260)
    expect(h.calls).toHaveLength(2)
    h.calls[1].resolve({ body: { success: true, liked: false, likes: 0 } })
    await vi.advanceTimersByTimeAsync(0)

    expect(h.state()).toEqual({ liked: false, count: 0 })
    expect(h.controller.isBusy()).toBe(false)
  })

  it('请求失败 → 回退到最后一次与服务端一致的状态，UI 不骗人', async () => {
    const h = harness()
    vi.stubGlobal('fetch', h.fetchMock)

    h.controller.toggle()
    await vi.advanceTimersByTimeAsync(260)
    expect(h.state()).toEqual({ liked: true, count: 1 })

    h.calls[0].resolve({ status: 500, body: { error: 'boom' } })
    await vi.advanceTimersByTimeAsync(0)

    expect(h.state()).toEqual({ liked: false, count: 0 })
    expect(h.persisted.at(-1)).toBe(false)
    expect(h.controller.isBusy()).toBe(false)
  })
})
