export interface Comment {
  id: string
  url: string
  nick: string
  mail?: string
  link?: string
  content: string
  ua?: string
  ip?: string
  master: boolean
  top: boolean
  rid?: string
  pid?: string
  pinnedFromId?: string
  isSpam: boolean
  likes: number
  createdAt: number
  updatedAt?: number
}

export interface User {
  id: string
  nick: string
  mail?: string
  link?: string
  avatar?: string
  createdAt: number
}

export interface Config {
  key: string
  value: string
  updatedAt: number
}

export interface CreateCommentInput {
  url: string
  nick: string
  mail?: string
  link?: string
  content: string
  ua?: string
  ip?: string
  rid?: string
  pid?: string
}

export interface UpdateCommentInput {
  content?: string
  isSpam?: boolean
  top?: boolean
  master?: boolean
}

export interface CommentQuery {
  url: string
  page?: number
  pageSize?: number
  includeSpam?: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type DbType = 'turso' | 'postgres'

export interface TursoConfig {
  url: string
  authToken: string
}

export interface PostgresConfig {
  connectionString: string
}

export type DbConfig = TursoConfig | PostgresConfig

export interface NotificationEvent {
  type: 'comment.new' | 'comment.reply' | 'admin.report'
  payload: {
    comment: Comment
    url: string
    siteName?: string
  }
}

export interface NotificationChannel {
  type: 'telegram' | 'webhook' | 'email' | 'wxpusher' | 'wecom'
  config: Record<string, string>
  events: string[]
}
