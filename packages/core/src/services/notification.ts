import type { NotificationEvent } from '../types'

const TIMEOUT_MS = 8000

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (/["'<>\s]/.test(trimmed)) return undefined
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.href
  } catch {
    return undefined
  }
}

export function escapeWecomMarkdown(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/([`*_\[\]()#+\-.!|>])/g, '\\$1')
}

export function truncate(s: string, max: number): string {
  const chars = Array.from(s)
  if (chars.length <= max) return s
  return `${chars.slice(0, max - 1).join('')}…`
}

// 在转义后的 HTML 上截断：避开实体（&amp;）与标签（<b>）中间，防止制造新的解析失败
function truncateHtml(s: string, max: number): string {
  const chars = Array.from(s)
  if (chars.length <= max) return s
  let cut = chars.slice(0, max - 1).join('')
  const amp = cut.lastIndexOf('&')
  if (amp !== -1 && !cut.slice(amp).includes(';')) cut = cut.slice(0, amp)
  const lt = cut.lastIndexOf('<')
  if (lt !== -1 && !cut.slice(lt).includes('>')) cut = cut.slice(0, lt)
  return `${cut}…`
}

// 在转义后的 WeCom markdown 上截断：去掉尾部悬空转义符
function truncateWecom(s: string, max: number): string {
  const chars = Array.from(s)
  if (chars.length <= max) return s
  const cut = chars.slice(0, max - 1)
  while (cut.length > 0 && cut[cut.length - 1] === '\\') cut.pop()
  return `${cut.join('')}…`
}

export async function postJson(
  url: string,
  body: unknown,
  init?: { method?: string; headers?: Record<string, string>; timeoutMs?: number }
): Promise<Response> {
  const method = init?.method ?? 'POST'
  const upperMethod = method.toUpperCase()
  const hasBody = body !== undefined && upperMethod !== 'GET' && upperMethod !== 'HEAD'
  const timeoutMs = init?.timeoutMs ?? TIMEOUT_MS
  const controller = new AbortController()
  let host = 'unknown'
  try {
    host = new URL(url).hostname
  } catch {
    // 相对路径等非法 URL：交由 fetch 抛错，这里只保证日志不带敏感信息
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const maybeUnref = timer as unknown as { unref?: () => void }
  if (typeof maybeUnref.unref === 'function') maybeUnref.unref()
  try {
    const res = await fetch(url, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Notification request failed: ${res.status} ${res.statusText}`)
    }
    return res
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Notification to ${host} timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export interface ChannelAdapter {
  send(event: NotificationEvent): Promise<void>
}

export class TelegramAdapter implements ChannelAdapter {
  private botToken: string
  private chatId: string
  
  constructor(config: { botToken: string; chatId: string }) {
    this.botToken = config.botToken
    this.chatId = config.chatId
  }
  
  async send(event: NotificationEvent): Promise<void> {
    const { comment, url, siteName } = event.payload
    const text = this.formatMessage(comment, url, siteName)

    const res = await postJson(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      chat_id: this.chatId,
      text,
      parse_mode: 'HTML'
    })
    // Telegram 业务错误走 HTTP 200 + { ok: false, description }
    let data: { ok?: boolean; description?: string }
    try {
      data = (await res.json()) as { ok?: boolean; description?: string }
    } catch {
      throw new Error('Telegram failed: invalid JSON response')
    }
    if (!data || typeof data !== 'object' || data.ok !== true) {
      throw new Error(`Telegram failed: ${data?.description ?? 'unknown error'}`)
    }
  }
  
  private formatMessage(comment: NotificationEvent['payload']['comment'], url: string, siteName?: string): string {
    const type = comment.rid ? '回复' : '新评论'
    const safeLink = sanitizeUrl(comment.link)
    return truncateHtml(`
<b>[${escapeHtml(siteName ?? 'Twikee')}] ${type}通知</b>

<b>昵称:</b> ${escapeHtml(comment.nick)}
${comment.mail ? `<b>邮箱:</b> ${escapeHtml(comment.mail)}\n` : ''}${safeLink ? `<b>网站:</b> ${escapeHtml(safeLink)}\n` : ''}
<b>内容:</b>
${escapeHtml(comment.content)}

<b>页面:</b> ${escapeHtml(url)}
    `.trim(), 4096)
  }
}

export class WebhookAdapter implements ChannelAdapter {
  private url: string
  private method: string
  private headers: Record<string, string>
  
  constructor(config: { url: string; method?: string; headers?: Record<string, string> }) {
    this.url = config.url
    this.method = config.method ?? 'POST'
    this.headers = config.headers ?? {}
  }
  
  async send(event: NotificationEvent): Promise<void> {
    await postJson(
      this.url,
      event,
      { method: this.method, headers: this.headers }
    )
  }
}

export class EmailAdapter implements ChannelAdapter {
  private apiKey: string
  private from: string
  private to: string
  
  constructor(config: { apiKey: string; from: string; to: string }) {
    this.apiKey = config.apiKey
    this.from = config.from
    this.to = config.to
  }
  
  async send(event: NotificationEvent): Promise<void> {
    const { comment, url, siteName } = event.payload
    const subject = `[${siteName ?? 'Twikee'}] ${comment.rid ? '新回复' : '新评论'} - ${comment.nick}`.replace(/[\r\n]+/g, ' ')
    
    await postJson('https://api.resend.com/emails', {
      from: this.from,
      to: this.to,
      subject,
      html: this.formatHtml(comment, url, siteName)
    }, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    })
  }
  
  private formatHtml(comment: NotificationEvent['payload']['comment'], url: string, siteName?: string): string {
    const safeLink = sanitizeUrl(comment.link)
    const safeUrl = sanitizeUrl(url)
    return `
      <h2>${escapeHtml(siteName ?? 'Twikee')} - ${comment.rid ? '新回复' : '新评论'}</h2>
      <p><strong>昵称:</strong> ${escapeHtml(comment.nick)}</p>
      ${comment.mail ? `<p><strong>邮箱:</strong> ${escapeHtml(comment.mail)}</p>` : ''}
      ${safeLink ? `<p><strong>网站:</strong> <a href="${escapeHtml(safeLink)}">${escapeHtml(safeLink)}</a></p>` : ''}
      <p><strong>内容:</strong></p>
      <div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${escapeHtml(truncate(comment.content, 5000))}</div>
      ${safeUrl ? `<p><strong>页面:</strong> <a href="${escapeHtml(safeUrl)}">${escapeHtml(safeUrl)}</a></p>` : `<p><strong>页面:</strong> ${escapeHtml(url)}</p>`}
    `
  }
}

export class WxPusherAdapter implements ChannelAdapter {
  private appToken: string
  private uids: string[]

  constructor(config: { appToken: string; uids: string }) {
    this.appToken = config.appToken
    this.uids = config.uids.split(',').map(s => s.trim()).filter(Boolean)
  }

  async send(event: NotificationEvent): Promise<void> {
    const { comment, url, siteName } = event.payload
    const type = comment.rid ? '回复' : '新评论'
    const content = truncate(`[${siteName ?? 'Twikee'}] ${type}通知\n\n昵称: ${comment.nick}${comment.mail ? `\n邮箱: ${comment.mail}` : ''}${comment.link ? `\n网站: ${comment.link}` : ''}\n内容:\n${comment.content}\n\n页面: ${url}`, 4000)
    const summary = truncate(`[${siteName ?? 'Twikee'}] ${type} - ${comment.nick}`, 60)

    const res = await postJson('https://wxpusher.zjiecode.com/api/send/message', {
      appToken: this.appToken,
      content,
      summary,
      contentType: 1,
      uids: this.uids,
    })
    // WxPusher 业务错误走 HTTP 200 + { code, msg }，成功时 code === 1000
    let data: { code?: number; msg?: string }
    try {
      data = (await res.json()) as { code?: number; msg?: string }
    } catch {
      throw new Error('WxPusher failed: invalid JSON response')
    }
    if (!data || typeof data !== 'object') {
      throw new Error('WxPusher failed: invalid JSON response')
    }
    if (data.code !== 1000) {
      throw new Error(`WxPusher failed (code=${data.code}): ${data.msg ?? 'unknown error'}`)
    }
  }
}

export class WecomAdapter implements ChannelAdapter {
  private key: string

  constructor(config: { key: string }) {
    this.key = config.key
  }

  async send(event: NotificationEvent): Promise<void> {
    const { comment, url, siteName } = event.payload
    const type = comment.rid ? '回复' : '新评论'
    const quote = (s: string): string =>
      s.split('\n').map((line) => `> ${escapeWecomMarkdown(line)}`).join('\n')
    const mdLink = (text: string, href: string): string =>
      `[${escapeWecomMarkdown(text)}](${href.replace(/\(/g, '%28').replace(/\)/g, '%29')})`
    const safeLink = sanitizeUrl(comment.link)
    const safeUrl = sanitizeUrl(url)
    // 企业微信群机器人 markdown 上限 4096 字符
    const content = truncateWecom(
      `## ${escapeWecomMarkdown(`[${siteName ?? 'Twikee'}] ${type}通知`)}\n` +
      `${quote(`昵称: ${comment.nick}`)}\n` +
      (comment.mail ? `${quote(`邮箱: ${comment.mail}`)}\n` : '') +
      (safeLink ? `> 网站: ${mdLink(safeLink, safeLink)}\n` : '') +
      `${quote(`内容:\n${comment.content}`)}\n` +
      (safeUrl ? `> 页面: ${mdLink(url, safeUrl)}` : `> 页面: ${escapeWecomMarkdown(url)}`),
      4096
    )

    const res = await postJson(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(this.key)}`, {
      msgtype: 'markdown',
      markdown: { content },
    })
    // 企业微信业务错误走 HTTP 200 + { errcode, errmsg }，成功时 errcode === 0
    let data: { errcode?: number; errmsg?: string }
    try {
      data = (await res.json()) as { errcode?: number; errmsg?: string }
    } catch {
      throw new Error('Wecom failed: invalid JSON response')
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Wecom failed: invalid JSON response')
    }
    if (data.errcode !== 0) {
      throw new Error(`Wecom failed (errcode=${data.errcode}): ${data.errmsg ?? 'unknown error'}`)
    }
  }
}

export class NotificationService {
  private channels: Map<string, ChannelAdapter> = new Map()
  private enabledEvents: Map<string, Set<string>> = new Map()

  get channelCount(): number {
    return this.channels.size
  }
  
  addChannel(name: string, adapter: ChannelAdapter, events: string[]): void {
    this.channels.set(name, adapter)
    this.enabledEvents.set(name, new Set(events))
  }
  
  async send(event: NotificationEvent): Promise<void> {
    const promises: Promise<void>[] = []
    
    for (const [name, adapter] of this.channels) {
      const events = this.enabledEvents.get(name)
      if (events?.has(event.type)) {
        promises.push(adapter.send(event).catch(err => {
          console.error(`Notification channel ${name} failed:`, err)
        }))
      }
    }
    
    await Promise.all(promises)
  }
}
