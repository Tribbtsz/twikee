import { z } from 'zod'

/**
 * 评论 id（rid/pid 指向的目标）。
 * 长度上限用于挡住垃圾数据：comments.id 是 UUID 或导入保留的 id，
 * 正常情况下不可能超过 64 字符。
 */
const CommentIdSchema = z.string().min(1).max(64)

/**
 * 只允许 http/https 的链接字段。
 * z.string().url() 走 WHATWG 标准，会接受 javascript:alert(1) 和
 * data:text/html,... —— 这两个都能在点击时执行脚本。原始 link 会落库，
 * 安全性不能只依赖各前端渲染方。
 */
const SafeUrlSchema = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), { message: 'link must be an http(s) URL' })

export const CommentQuerySchema = z.object({
  url: z.string().min(1, 'url is required'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const CreateCommentSchema = z.object({
  url: z.string().min(1),
  nick: z.string().min(1).max(100),
  mail: z.string().email().optional().or(z.literal('')),
  link: SafeUrlSchema.optional().or(z.literal('')),
  content: z.string().min(1).max(10000),
  rid: CommentIdSchema.optional(),
  pid: CommentIdSchema.optional(),
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

/**
 * 管理端评论查询。
 *
 * includeSpam 不能用 z.coerce.boolean()：coerce 走 Boolean('false') === true，
 * 前台传 ?includeSpam=false 反而会包含垃圾评论。查询串只可能是字符串，
 * 这里显式解析。
 */
export const AdminCommentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  url: z.string().optional(),
  includeSpam: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // 审核状态过滤：由服务端在 SQL 层过滤，避免「客户端只过滤当前页」造成的
  // 计数/分页错位
  status: z.enum(['all', 'approved', 'spam']).default('all'),
})

/** 更新评论：仅允许这几个字段，master 只能由公开端点按邮箱匹配设置 */
export const AdminUpdateCommentSchema = z
  .object({
    content: z.string().min(1).max(10000).optional(),
    isSpam: z.boolean().optional(),
    top: z.boolean().optional(),
  })
  // 默认行为会静默剥离未知字段，调用方无法察觉自己传了无效字段。
  // 管理端接口应该显式报错，而不是悄悄忽略。
  .strict()

/**
 * 单条导入评论。保留 id/createdAt 等字段，导入后才能维持原有的回复层级
 * （rid 指向的必须还是同一个 id，否则所有回复都会变成顶层孤儿）。
 */
export const ImportCommentSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  url: z.string().min(1).max(2000),
  nick: z.string().min(1).max(100),
  mail: z.string().email().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
  content: z.string().max(10000),
  rid: z.string().max(64).nullish(),
  pid: z.string().max(64).nullish(),
  createdAt: z.coerce.number().int().positive().optional(),
  updatedAt: z.coerce.number().int().positive().nullish(),
  likes: z.coerce.number().int().min(0).optional(),
  isSpam: z.boolean().optional(),
  master: z.boolean().optional(),
  top: z.boolean().optional(),
  deleted: z.boolean().optional(),
  ua: z.string().max(500).nullish(),
  ip: z.string().max(64).nullish(),
})

/** 一次导入的条数上限，避免超大数组把请求拖到平台超时 */
export const MAX_IMPORT_COUNT = 1000

export const ImportSchema = z.array(ImportCommentSchema).max(MAX_IMPORT_COUNT)
