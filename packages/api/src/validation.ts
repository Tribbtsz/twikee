import { z } from 'zod'

export const CommentQuerySchema = z.object({
  url: z.string().min(1, 'url is required'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const CreateCommentSchema = z.object({
  url: z.string().min(1),
  nick: z.string().min(1).max(100),
  mail: z.string().email().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
  content: z.string().min(1).max(10000),
  rid: z.string().optional(),
  pid: z.string().optional(),
})

export const LoginSchema = z.object({
  password: z.string().min(1),
})

export const SetupSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const AdminConfigSchema = z.record(z.string(), z.any())

/**
 * 允许通过管理端写入的配置 key 白名单。
 * 防止手抖/恶意请求写入脏 key 进库。新增配置项需同步加到这里。
 */
export const ADMIN_CONFIG_KEYS = [
  // 基础
  'SITE_NAME',
  'SITE_URL',
  'BLOGGER_NICK',
  'BLOGGER_EMAIL',
  'MASTER_TAG',
  'COMMENT_PAGE_SIZE',
  'GRAVATAR_CDN',
  'DEFAULT_GRAVATAR',
  'COMMENT_PLACEHOLDER',
  'AUTO_APPROVE',
  'DEMO_ENABLED',
  'COMMENTS_CLOSED',
  // 通知
  'NOTIFICATION_ENABLE',
  'NOTIFICATION_TYPE',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'WEBHOOK_URL',
  'WXPUSHER_APP_TOKEN',
  'WXPUSHER_UIDS',
  'WECOM_KEY',
  // 邮件
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_TO',
  // 安全
  'ADMIN_PASSWORD',
  // 图片
  'IMAGE_CDN',
  'IMAGE_CDN_TOKEN',
  'MAX_IMAGE_SIZE',
] as const

export const ADMIN_CONFIG_KEY_SET: ReadonlySet<string> = new Set<string>(ADMIN_CONFIG_KEYS)

export const ModerateSchema = z.object({
  action: z.enum(['approve', 'spam', 'delete']),
})

export const TopSchema = z.object({
  top: z.boolean(),
})

export const AdminCommentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  url: z.string().optional(),
  includeSpam: z.coerce.boolean().default(false),
})
