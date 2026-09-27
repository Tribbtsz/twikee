import type { Comment, User, Config, CreateCommentInput, UpdateCommentInput, CommentQuery, PaginatedResult } from '../types'

export interface CommentStats {
  total: number
  approved: number
  pending: number
}

export interface LikeResult {
  /** 操作后该用户是否处于「已赞」状态 */
  liked: boolean
  /** 操作后评论的赞总数（以 likes 表为权威源重新统计） */
  likes: number
}

export interface CommentRepository {
  create(data: CreateCommentInput): Promise<Comment>
  getById(id: string): Promise<Comment | null>
  getList(query: CommentQuery): Promise<PaginatedResult<Comment>>
  update(id: string, data: UpdateCommentInput): Promise<Comment>
  /** 硬删除：从表中移除（彻底清理用） */
  delete(id: string): Promise<void>
  /** 软删除：标记 deleted + 清空内容，保留结构供子评论挂靠 */
  softDelete(id: string): Promise<Comment>
  /** 点赞/取消点赞（同一用户重复调用即切换），返回操作后的权威状态 */
  like(id: string, userId: string): Promise<LikeResult>
  getCount(url: string): Promise<number>
  getStats(): Promise<CommentStats>
}

export interface UserRepository {
  getById(id: string): Promise<User | null>
  getByMail(mail: string): Promise<User | null>
  create(data: Omit<User, 'id' | 'createdAt'>): Promise<User>
  update(id: string, data: Partial<User>): Promise<User>
}

export interface ConfigRepository {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  getAll(): Promise<Record<string, string>>
}

export abstract class DatabaseAdapter {
  abstract init(): Promise<void>
  abstract close(): Promise<void>
  
  abstract comments: CommentRepository
  abstract users: UserRepository
  abstract config: ConfigRepository
  
  abstract transaction<T>(fn: () => Promise<T>): Promise<T>
}
