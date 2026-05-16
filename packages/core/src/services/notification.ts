import type { NotificationEvent, NotificationChannel } from '../types'

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
    
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML'
      })
    })
  }
  
  private formatMessage(comment: NotificationEvent['payload']['comment'], url: string, siteName?: string): string {
    const type = comment.rid ? '回复' : '新评论'
    return `
<b>[${siteName ?? 'Twikee'}] ${type}通知</b>

<b>昵称:</b> ${comment.nick}
${comment.mail ? `<b>邮箱:</b> ${comment.mail}\n` : ''}${comment.link ? `<b>网站:</b> ${comment.link}\n` : ''}
<b>内容:</b>
${comment.content}

<b>页面:</b> ${url}
    `.trim()
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
    await fetch(this.url, {
      method: this.method,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(event)
    })
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
    const subject = `[${siteName ?? 'Twikee'}] ${comment.rid ? '新回复' : '新评论'} - ${comment.nick}`
    
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.from,
        to: this.to,
        subject,
        html: this.formatHtml(comment, url, siteName)
      })
    })
  }
  
  private formatHtml(comment: NotificationEvent['payload']['comment'], url: string, siteName?: string): string {
    return `
      <h2>${siteName ?? 'Twikee'} - ${comment.rid ? '新回复' : '新评论'}</h2>
      <p><strong>昵称:</strong> ${comment.nick}</p>
      ${comment.mail ? `<p><strong>邮箱:</strong> ${comment.mail}</p>` : ''}
      ${comment.link ? `<p><strong>网站:</strong> <a href="${comment.link}">${comment.link}</a></p>` : ''}
      <p><strong>内容:</strong></p>
      <div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${comment.content}</div>
      <p><strong>页面:</strong> <a href="${url}">${url}</a></p>
    `
  }
}

export class NotificationService {
  private channels: Map<string, ChannelAdapter> = new Map()
  private enabledEvents: Map<string, Set<string>> = new Map()
  
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
