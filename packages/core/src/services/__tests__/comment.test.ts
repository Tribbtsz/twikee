import { describe, it, expect, beforeEach } from 'vitest'
import { CommentService } from '../comment'
import { DatabaseAdapter } from '../../adapters/base'
import type {
  CommentRepository, UserRepository, ConfigRepository,
  CommentStats, LikeResult,
} from '../../adapters/base'
import type {
  Comment, CreateCommentInput, CommentQuery,
} from '../../types'

class MockCommentRepo implements CommentRepository {
  comments = new Map<string, Comment>()
  /** commentId -> userId，模拟 likes 行 */
  likedBy = new Map<string, string>()

  async create(data: CreateCommentInput): Promise<Comment> {
    const id = crypto.randomUUID()
    const comment: Comment = {
      id, ...data, master: false, top: false, isSpam: false, deleted: false,
      likes: 0, createdAt: Date.now(), mail: data.mail, link: data.link,
      ua: data.ua, ip: data.ip, rid: data.rid, pid: data.pid,
    }
    this.comments.set(id, comment)
    return comment
  }

  async getById(id: string): Promise<Comment | null> {
    return this.comments.get(id) || null
  }

  async getList(query: CommentQuery): Promise<{ data: Comment[]; total: number; page: number; pageSize: number; totalPages: number }> {
    let list = Array.from(this.comments.values()).filter(c => !query.url || c.url === query.url)
    if (!query.includeSpam) list = list.filter(c => !c.isSpam)
    if (!query.includeDeleted) list = list.filter(c => !c.deleted)
    const total = list.length
    const page = query.page || 1
    const pageSize = query.pageSize || 10
    return { data: list.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async update(id: string, data: any): Promise<Comment> {
    const existing = this.comments.get(id)
    if (!existing) throw new Error('Not found')
    const updated = { ...existing, ...data, updatedAt: Date.now() }
    this.comments.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.comments.delete(id)
  }

  async softDelete(id: string): Promise<Comment> {
    const existing = this.comments.get(id)
    if (!existing) throw new Error('Not found')
    const updated = { ...existing, deleted: true, top: false, content: '', updatedAt: Date.now() }
    this.comments.set(id, updated)
    return updated
  }

  async like(id: string, userId: string): Promise<LikeResult> {
    const liked = this.likedBy.get(id) !== userId
    if (liked) {
      this.likedBy.set(id, userId)
    } else {
      this.likedBy.delete(id)
    }
    const comment = this.comments.get(id)
    if (comment) comment.likes += liked ? 1 : -1
    return { liked, likes: comment?.likes ?? 0 }
  }

  async getCount(url: string): Promise<number> {
    return Array.from(this.comments.values()).filter(c => c.url === url && !c.isSpam).length
  }

  async getStats(): Promise<CommentStats> {
    const all = Array.from(this.comments.values())
    return { total: all.length, approved: all.filter(c => !c.isSpam).length, pending: all.filter(c => c.isSpam).length }
  }
}

class MockUserRepo implements UserRepository {
  async getById() { return null }
  async getByMail() { return null }
  async create(data: any) { return { ...data, id: '1', createdAt: Date.now() } }
  async update() { return null as any }
}

class MockConfigRepo implements ConfigRepository {
  store = new Map<string, string>()
  async get(key: string) { return this.store.get(key) || null }
  async set(key: string, value: string) { this.store.set(key, value) }
  async getAll() { return Object.fromEntries(this.store) }
}

class MockAdapter extends DatabaseAdapter {
  comments = new MockCommentRepo()
  users = new MockUserRepo()
  config = new MockConfigRepo()
  async init() {}
  async close() {}
  async transaction(fn: () => Promise<any>) { return fn() }
}

describe('CommentService', () => {
  let service: CommentService
  let adapter: MockAdapter

  beforeEach(() => {
    adapter = new MockAdapter()
    service = new CommentService(adapter)
  })

  it('creates a comment', async () => {
    const comment = await service.create({ url: '/test', nick: 'Alice', content: 'Hello' })
    expect(comment.id).toBeTruthy()
    expect(comment.nick).toBe('Alice')
    expect(comment.content).toBe('Hello')
  })

  it('lists comments for a url', async () => {
    await service.create({ url: '/a', nick: 'A', content: 'c1' })
    await service.create({ url: '/a', nick: 'B', content: 'c2' })
    await service.create({ url: '/b', nick: 'C', content: 'c3' })
    const result = await service.getList({ url: '/a' })
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(2)
  })

  it('excludes spam by default', async () => {
    await service.create({ url: '/test', nick: 'A', content: 'ok' })
    const c2 = await service.create({ url: '/test', nick: 'B', content: 'spam' })
    await service.update(c2.id, { isSpam: true })
    const result = await service.getList({ url: '/test' })
    expect(result.total).toBe(1)
  })

  it('likes a comment and toggles back', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    const first = await service.like(c.id, 'user1')
    expect(first.liked).toBe(true)
    expect(first.likes).toBe(1)
    // 同一用户再次调用 = 取消赞，而不是再 +1
    const second = await service.like(c.id, 'user1')
    expect(second.liked).toBe(false)
    expect(second.likes).toBe(0)
  })

  it('keeps per-user like counts independent', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    await service.like(c.id, 'user1')
    const other = await service.like(c.id, 'user2')
    expect(other.liked).toBe(true)
    expect(other.likes).toBe(2)
  })

  it('moderates: approve', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    await service.moderate(c.id, 'spam')
    const updated = await service.getById(c.id)!
    expect(updated!.isSpam).toBe(true)
  })

  it('moderates: delete (soft delete keeps row, blanks content)', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    await service.moderate(c.id, 'delete')
    const updated = await service.getById(c.id)
    expect(updated).not.toBeNull()
    expect(updated!.deleted).toBe(true)
    expect(updated!.content).toBe('')
  })

  it('hard delete removes the row', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    await service.hardDelete(c.id)
    expect(await service.getById(c.id)).toBeNull()
  })

  it('service.delete is a soft delete', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    await service.delete(c.id)
    const updated = await service.getById(c.id)
    expect(updated!.deleted).toBe(true)
  })

  it('getList excludes deleted comments by default', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'ok' })
    await service.delete(c.id)
    const result = await service.getList({ url: '/test' })
    expect(result.total).toBe(0)
  })

  it('pins a comment with top flag without duplicating', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    const pinned = await service.setTop(c.id, true)
    expect(pinned.top).toBe(true)
    expect(pinned.pinnedFromId).toBeUndefined()
    // 不再复制评论
    const all = await service.getList({ url: '/test', pageSize: 100 })
    expect(all.data).toHaveLength(1)
    const unpinned = await service.setTop(c.id, false)
    expect(unpinned.top).toBe(false)
  })

  it('counts comments per url', async () => {
    await service.create({ url: '/a', nick: 'A', content: 'x' })
    await service.create({ url: '/a', nick: 'B', content: 'y' })
    await service.create({ url: '/b', nick: 'C', content: 'z' })
    expect(await service.getCount('/a')).toBe(2)
    expect(await service.getCount('/b')).toBe(1)
  })
})
