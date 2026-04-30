import type { Comment, CreateCommentInput, UpdateCommentInput, CommentQuery, PaginatedResult } from '../types'
import type { DatabaseAdapter } from '../adapters/base'

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
  
  async delete(id: string): Promise<void> {
    await this.db.comments.delete(id)
  }
  
  async like(id: string, userId: string): Promise<boolean> {
    return await this.db.comments.like(id, userId)
  }
  
  async getCount(url: string): Promise<number> {
    return await this.db.comments.getCount(url)
  }
  
  async moderate(id: string, action: 'approve' | 'spam' | 'delete'): Promise<void> {
    if (action === 'delete') {
      await this.db.comments.delete(id)
    } else {
      await this.db.comments.update(id, { isSpam: action === 'spam' })
    }
  }
  
  async setTop(id: string, top: boolean): Promise<Comment> {
    return await this.db.comments.update(id, { top })
  }
}
