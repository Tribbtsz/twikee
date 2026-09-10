import type { TursoAdapter } from '@twikee/core'
import {
  NotificationService,
  TelegramAdapter,
  WebhookAdapter,
  EmailAdapter,
  WxPusherAdapter,
  WecomAdapter,
} from '@twikee/core'

/**
 * 通知服务缓存（进程内）
 *
 * 每次从 DB 全量重建太贵（多条串行读），纯内存热重载在 serverless
 * 多实例下又不可靠。折中方案：
 * - 用一次 config.getAll() 代替多次 get()
 * - 内存缓存，TTL 60s，过期才重建
 * - 管理端保存配置后调用 invalidateNotifications()，最多 60s 生效
 *
 * 成本：每条评论只多做一次内存判断；每 60s 一次 DB 读（后台执行，不阻塞响应）。
 */
const CACHE_TTL_MS = 60_000

let cache: { at: number; service: NotificationService | null } | null = null

function buildFromConfig(cfg: Record<string, string>): NotificationService | null {
  if (cfg['NOTIFICATION_ENABLE'] !== 'true') return null

  const service = new NotificationService()
  const type = cfg['NOTIFICATION_TYPE']

  if (type === 'telegram') {
    const botToken = cfg['TELEGRAM_BOT_TOKEN']
    const chatId = cfg['TELEGRAM_CHAT_ID']
    if (botToken && chatId) {
      service.addChannel('telegram', new TelegramAdapter({ botToken, chatId }), ['comment.new', 'comment.reply'])
    } else {
      console.warn('[Twikee] telegram misconfigured: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing')
    }
  } else if (type === 'webhook') {
    const webhookUrl = cfg['WEBHOOK_URL']
    if (webhookUrl) {
      service.addChannel('webhook', new WebhookAdapter({ url: webhookUrl }), ['comment.new', 'comment.reply'])
    } else {
      console.warn('[Twikee] webhook misconfigured: WEBHOOK_URL missing')
    }
  } else if (type === 'email') {
    const apiKey = cfg['SMTP_PASS']
    const from = cfg['SMTP_FROM']
    const to = cfg['SMTP_TO']
    if (apiKey && from && to) {
      service.addChannel('email', new EmailAdapter({ apiKey, from, to }), ['comment.new', 'comment.reply'])
    } else {
      console.warn('[Twikee] email misconfigured: SMTP_PASS/SMTP_FROM/SMTP_TO missing')
    }
  } else if (type === 'wxpusher') {
    const appToken = cfg['WXPUSHER_APP_TOKEN']
    const uids = cfg['WXPUSHER_UIDS']
    if (appToken && uids) {
      service.addChannel('wxpusher', new WxPusherAdapter({ appToken, uids }), ['comment.new', 'comment.reply'])
    } else {
      console.warn('[Twikee] wxpusher misconfigured: WXPUSHER_APP_TOKEN/WXPUSHER_UIDS missing')
    }
  } else if (type === 'wecom') {
    const key = cfg['WECOM_KEY']
    if (key) {
      service.addChannel('wecom', new WecomAdapter({ key }), ['comment.new', 'comment.reply'])
    } else {
      console.warn('[Twikee] wecom misconfigured: WECOM_KEY missing')
    }
  } else {
    console.warn(`[Twikee] unknown NOTIFICATION_TYPE: ${JSON.stringify(String(type).slice(0, 50))}`)
  }

  return service
}

export async function getNotificationService(db: TursoAdapter): Promise<NotificationService | null> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.service

  let service: NotificationService | null = null
  try {
    const cfg = await db.config.getAll()
    service = buildFromConfig(cfg)
  } catch (e) {
    // 读配置失败时保持禁用并记录，避免整条请求链 500
    console.error('[Twikee] failed to load notification config:', e)
  }
  cache = { at: now, service }
  return service
}

/** 配置保存后调用：强制下次读取时重建 */
export function invalidateNotifications(): void {
  cache = null
}
