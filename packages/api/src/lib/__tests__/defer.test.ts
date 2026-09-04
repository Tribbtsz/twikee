import { describe, it, expect, vi, afterEach } from 'vitest'
import { defer } from '../defer'

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
    await new Promise((r) => setTimeout(r, 10))
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
    await new Promise((r) => setTimeout(r, 10))
    expect(done).toBe(true)
  })

  it('catches background task errors without throwing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    defer({} as any, Promise.reject(new Error('boom')))
    await new Promise((r) => setTimeout(r, 10))
    expect(errSpy).toHaveBeenCalled()
  })

  it('uses @vercel/functions waitUntil on Vercel', async () => {
    process.env.VERCEL = '1'
    let done = false
    defer(
      {} as any,
      Promise.resolve().then(() => {
        done = true
      }),
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(done).toBe(true)
  })
})
