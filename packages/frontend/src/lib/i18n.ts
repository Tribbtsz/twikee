/**
 * 评论组件访客可见文案的多语言词表（一期范围：仅评论组件，不含管理后台与通知模板）。
 *
 * 刻意不引 vue-i18n：访客可见字符串只有几十个，一个 map + provide/inject 就够，
 * 依赖与体积都省下。管理后台（博主自用）与通知模板（core/services/notification.ts）
 * 不在此期范围，见项目 TODO。
 *
 * 用法：
 *   const t = useT()          // 组件内
 *   t('submit')               // → '发送' / 'Send'
 *   t('minutesAgo', 5)        // → '5 分钟前' / '5 min ago'（带占位符 {n}）
 */

export type TwikeeLang = 'zh-CN' | 'en'

/** 词表键与中英文案。英文由 AI 翻译，首次上线前建议人工过一遍语气。 */
export const messages = {
  'zh-CN': {
    // 通用
    cancel: '取消',
    save: '保存',
    saving: '保存中...',
    delete: '删除',
    edit: '编辑',
    preview: '预览',
    submit: '发送',
    submitting: '发送中...',
    loading: '加载中...',
    reply: '回复',
    like: '赞',
    liked: '已赞',
    unlike: '取消点赞',
    report: '举报',
    // 列表与分页
    commentsTitle: '评论',
    previousPage: '上一页',
    nextPage: '下一页',
    loadFailed: '加载评论失败',
    retry: '请重试',
    networkError: '网络错误，请重试',
    noComments: '暂无评论，来发表第一条评论吧~',
    commentsClosed: '评论已关闭',
    // 提交表单
    nickPlaceholder: '昵称 *',
    nickLabel: '昵称',
    mailPlaceholder: '邮箱 (可选)',
    mailLabel: '邮箱',
    linkPlaceholder: '网址 (可选)',
    linkLabel: '网址',
    contentPlaceholder: '说点什么吧... (支持 Markdown)',
    contentLabel: '评论内容',
    contentRequired: '内容不能为空',
    mailInvalid: '邮箱格式不正确',
    linkInvalid: '网址格式不正确，需以 http:// 或 https:// 开头',
    uploadImage: '上传图片',
    uploading: '上传中...',
    image: '图片',
    markdownSupported: '支持 Markdown',
    submitFailedKeep: '评论发表失败，请稍后重试（内容已为你保留）',
    pendingReview: '评论已提交，等待博主审核后显示',
    imageTooLarge: '图片超过大小限制（{n}MB）',
    imageInvalid: '请选择图片文件',
    imageUploadFailed: '图片上传失败，请重试',
    // 时间
    justNow: '刚刚',
    minutesAgo: '{n} 分钟前',
    hoursAgo: '{n} 小时前',
    daysAgo: '{n} 天前',
    // 徽章与状态
    masterBadgeDefault: '博主',
    pinned: '置顶',
    pendingBadge: '待审核',
    replyTo: '回复',
    pinnedFromReply: '回复自',
    pinnedFrom: '来自',
    expandFull: '展开全文',
    // 编辑自己的评论
    editComment: '编辑评论',
    editContent: '编辑评论内容',
    editTokenExpired: '编辑凭证已过期（仅创建后 30 分钟内可编辑）',
    saveFailed: '保存失败，请重试',
    deleteThisComment: '删除这条评论',
    deleteConfirm: '确定要删除这条评论吗？',
    deleteFailedLog: '删除自己的评论失败',
    likeFailedLog: '点赞失败',
    childLikeFailedLog: '子评论点赞失败',
    // 回复
    replyFailed: '回复失败，请重试',
    replyFailedLog: '回复失败',
    childReplyFailedLog: '子回复失败',
    // 举报
    reportComment: '举报评论',
    reportDesc: '请填写举报原因，管理员会尽快处理。',
    reportReasonPlaceholder: '举报原因（可选，最多 200 字）',
    reportReasonLabel: '举报原因',
    reportSubmitted: '已举报，管理员会尽快处理',
    reportFailed: '举报失败，请稍后重试',
    reportNetworkError: '网络错误，请稍后重试',
    reportSubmitting: '提交中...',
    reportSubmit: '提交举报',
  },
  en: {
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    delete: 'Delete',
    edit: 'Edit',
    preview: 'Preview',
    submit: 'Send',
    submitting: 'Sending...',
    loading: 'Loading...',
    reply: 'Reply',
    like: 'Like',
    liked: 'Liked',
    unlike: 'Unlike',
    report: 'Report',
    commentsTitle: 'Comments',
    previousPage: 'Previous',
    nextPage: 'Next',
    loadFailed: 'Failed to load comments',
    retry: 'Please try again',
    networkError: 'Network error, please try again',
    noComments: 'No comments yet. Start the conversation!',
    commentsClosed: 'Comments are closed',
    nickPlaceholder: 'Nickname *',
    nickLabel: 'Nickname',
    mailPlaceholder: 'Email (optional)',
    mailLabel: 'Email',
    linkPlaceholder: 'Website (optional)',
    linkLabel: 'Website',
    contentPlaceholder: 'Say something... (Markdown supported)',
    contentLabel: 'Comment',
    contentRequired: 'Content cannot be empty',
    mailInvalid: 'Invalid email address',
    linkInvalid: 'Invalid URL, must start with http:// or https://',
    uploadImage: 'Upload image',
    uploading: 'Uploading...',
    image: 'Image',
    markdownSupported: 'Markdown supported',
    submitFailedKeep: 'Failed to submit. Please try later (your content is kept)',
    pendingReview: 'Submitted, pending approval before it appears',
    imageTooLarge: 'Image exceeds the size limit ({n}MB)',
    imageInvalid: 'Please choose an image file',
    imageUploadFailed: 'Image upload failed, please retry',
    justNow: 'just now',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n} h ago',
    daysAgo: '{n} d ago',
    masterBadgeDefault: 'Author',
    pinned: 'Pinned',
    pendingBadge: 'Pending',
    replyTo: 'Reply to',
    pinnedFromReply: 'Reply from',
    pinnedFrom: 'From',
    expandFull: 'Show more',
    editComment: 'Edit comment',
    editContent: 'Edit comment content',
    editTokenExpired: 'Edit token expired (editable within 30 minutes after posting)',
    saveFailed: 'Failed to save, please retry',
    deleteThisComment: 'Delete this comment',
    deleteConfirm: 'Delete this comment?',
    deleteFailedLog: 'Failed to delete own comment',
    likeFailedLog: 'Like failed',
    childLikeFailedLog: 'Child comment like failed',
    replyFailed: 'Failed to reply, please retry',
    replyFailedLog: 'Reply failed',
    childReplyFailedLog: 'Child reply failed',
    reportComment: 'Report comment',
    reportDesc: 'Fill in the reason and the admin will review it soon.',
    reportReasonPlaceholder: 'Reason (optional, up to 200 characters)',
    reportReasonLabel: 'Report reason',
    reportSubmitted: 'Reported. The admin will review it soon',
    reportFailed: 'Failed to report, please retry',
    reportNetworkError: 'Network error, please retry',
    reportSubmitting: 'Submitting...',
    reportSubmit: 'Submit report',
  },
} as const

export type MessageKey = keyof (typeof messages)['zh-CN']

export function isTwikeeLang(value: unknown): value is TwikeeLang {
  return value === 'zh-CN' || value === 'en'
}

/** 未收录语言一律回落中文（词表只有两语；未知值不猜） */
export function resolveLang(lang?: string): TwikeeLang {
  return isTwikeeLang(lang) ? lang : 'zh-CN'
}

type MessageValue = (typeof messages)['zh-CN'][MessageKey]

export function translate(lang: TwikeeLang, key: MessageKey, params?: Record<string, string | number>): string {
  const dict = messages[lang] as Record<MessageKey, MessageValue>
  let text: string = dict[key] ?? messages['zh-CN'][key] ?? String(key)
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

/** t 函数类型：key 受词表约束，防止拼错键名静默渲染成键名本身 */
export type TranslateFn = <K extends MessageKey>(key: K, params?: Record<string, string | number>) => string

/** 固定语言、产出 TranslateFn 的工厂：组件树里 provide 一个即可 */
export function createTranslator(lang: TwikeeLang): TranslateFn {
  return (key, params) => translate(lang, key, params)
}
