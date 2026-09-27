import type { Comment, CreateCommentInput, UpdateCommentInput, CommentQuery, PaginatedResult } from '../types'
import type { DatabaseAdapter, LikeResult } from '../adapters/base'

export class CommentService {
  private db: DatabaseAdapter

  constructor(db: DatabaseAdapter) {
    this.db = db
  }

  async create(data: CreateCommentInput): Promise<Comment> {
    return await this.db.comments.create(data)
  }

  async getById(id: string): Promise<Comment | null> {
    return await this.db.comments.getById(id)
  }

  async getList(query: CommentQuery): Promise<PaginatedResult<Comment>> {
    return await this.db.comments.getList(query)
  }

  async update(id: string, data: UpdateCommentInput): Promise<Comment> {
    return await this.db.comments.update(id, data)
  }

  async delete(id: string): Promise<Comment> {
    // 软删除：保留记录与子评论结构，清空内容
    return await this.db.comments.softDelete(id)
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.comments.delete(id)
  }

  async like(id: string, userId: string): Promise<LikeResult> {
    return await this.db.comments.like(id, userId)
  }

  async getCount(url: string): Promise<number> {
    return await this.db.comments.getCount(url)
  }

  async moderate(id: string, action: 'approve' | 'spam' | 'delete'): Promise<void> {
    if (action === 'delete') {
      await this.db.comments.softDelete(id)
    } else {
      await this.db.comments.update(id, { isSpam: action === 'spam' })
    }
  }

  async setTop(id: string, top: boolean): Promise<Comment> {
    const comment = await this.db.comments.getById(id)
    if (!comment) throw new Error('Comment not found')
    // 直接打 top 标记，不再复制评论
    return await this.db.comments.update(id, { top })
  }
}
