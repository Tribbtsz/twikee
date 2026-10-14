import type { Comment, User, CreateCommentInput, UpdateCommentInput, CommentQuery, PaginatedResult } from '../types'

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

/** 批量创建的单条结果：成功带 comment，失败带 error（与输入等长、一一对应） */
export interface BulkCreateResult {
  comment?: Comment
  error?: string
}

export interface CommentRepository {
  create(data: CreateCommentInput): Promise<Comment>
  /**
   * 批量创建（导入用）。实现应分批写入以减少远程 round-trip；
   * 某批整体失败时退回逐条，保证每条的失败原因可定位。
   */
  createMany(data: CreateCommentInput[]): Promise<BulkCreateResult[]>
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
}
