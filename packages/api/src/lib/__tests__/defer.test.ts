import { describe, it, expect, vi, afterEach } from 'vitest'
import { defer } from '../defer'
import { waitUntil as vercelWaitUntil } from '@vercel/functions'

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))

// 本地 fallback 路径：{} 与 Hono 真实 Context（executionCtx 为抛异常的 getter）有差异，
// 抛 getter 的情况由第 3 例单独模拟
const flush = () => new Promise<void>((r) => setImmediate(r))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.VERCEL
})

describe('defer', () => {
  it('uses executionCtx.waitUntil when available (Cloudflare)', async () => {
    const waitUntil = vi.fn()
    let done = false
    defer(
      { executionCtx: { waitUntil } } as any,
      Promise.resolve().then(() => {
        done = true
      }),
    )
    expect(waitUntil).toHaveBeenCalledTimes(1)
    await waitUntil.mock.calls[0][0]
    expect(done).toBe(true)
  })

  it('falls back to fire-and-forget without executionCtx', async () => {
    let done = false
    defer(
      {} as any,
      Promise.resolve().then(() => {
        done = true
      }),
    )
    await flush()
    await flush()
    expect(done).toBe(true)
  })

  it('falls back when executionCtx getter throws (Hono without ctx)', async () => {
    const ctx = {} as any
    Object.defineProperty(ctx, 'executionCtx', {
      get() {
        throw new Error('This context has no ExecutionContext')
      },
    })
    let done = false
    defer(
      ctx,
      Promise.resolve().then(() => {
        done = true
      }),
    )
    await flush()
    await flush()
    expect(done).toBe(true)
  })

  it('catches background task errors without throwing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    defer({} as any, Promise.reject(new Error('boom')))
    await flush()
    await flush()
    expect(errSpy).toHaveBeenCalledWith('[Twikee] background task failed:', expect.any(Error))
  })

  // 仅覆盖本地/CF 分支；Vercel/Edge 分支需 Vercel 运行时，见下
  it('uses @vercel/functions waitUntil on Vercel', async () => {
    process.env.VERCEL = '1'
    let done = false
    defer(
      {} as any,
      Promise.resolve().then(() => {
        done = true
      }),
    )
    const mocked = vi.mocked(vercelWaitUntil)
    await vi.waitFor(() => expect(mocked).toHaveBeenCalledTimes(1))
    await mocked.mock.calls[0][0]
    expect(done).toBe(true)
  })
})
