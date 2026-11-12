import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { createAdminRoutes } from '../admin'

function makeApp(config: Record<string, string>) {
  const db: any = { config: { get: async () => null, getAll: async () => config } }
  const app = new Hono<{ Variables: { db: any; commentService: any; authService: any } }>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('commentService', {})
    c.set('authService', null)
    await next()
  })
  app.route('/', createAdminRoutes())
  return app
}

describe('GET /admin/config secret handling', () => {
  it('secret 值不回传，只回传 <KEY>_SET 标记；空值视为未配置', async () => {
    const app = makeApp({
      SITE_NAME: 'blog',
      SMTP_PASS: 're_secret',
      TELEGRAM_BOT_TOKEN: 'tok',
      IMAGE_CDN_TOKEN: '', // 空字符串 = 未配置
    })
    const res = await app.request('/config')
    expect(res.status).toBe(200)
    const body = await res.json()
    // 非密钥键正常回传
    expect(body.SITE_NAME).toBe('blog')
    // 密钥值不下发
    expect(body.SMTP_PASS).toBeUndefined()
    expect(body.TELEGRAM_BOT_TOKEN).toBeUndefined()
    expect(body.IMAGE_CDN_TOKEN).toBeUndefined()
    // 已配置的密钥带 _SET 标记
    expect(body.SMTP_PASS_SET).toBe('true')
    expect(body.TELEGRAM_BOT_TOKEN_SET).toBe('true')
    // 空值密钥视为未配置，不带标记
    expect(body.IMAGE_CDN_TOKEN_SET).toBeUndefined()
    expect(body.ADMIN_PASSWORD_SET).toBeUndefined()
  })

  it('POST /config 拒收白名单之外的键（已下线键 / 手误）', async () => {
    const app = makeApp({})
    const res = await app.request('/config', {
      method: 'POST',
      body: JSON.stringify({ SMTP_HOST: 'smtp.example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('SMTP_HOST')
  })
})
