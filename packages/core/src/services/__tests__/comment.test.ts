import { describe, it, expect, beforeEach } from 'vitest'
import { CommentService } from '../comment'
import { DatabaseAdapter } from '../../adapters/base'
import type {
  CommentRepository, UserRepository, ConfigRepository,
  CommentStats,
} from '../../adapters/base'
import type {
  Comment, CreateCommentInput, CommentQuery,
} from '../../types'

class MockCommentRepo implements CommentRepository {
  comments = new Map<string, Comment>()

  async create(data: CreateCommentInput): Promise<Comment> {
    const id = crypto.randomUUID()
    const comment: Comment = {
      id, ...data, master: false, top: false, isSpam: false,
      likes: 0, createdAt: Date.now(), mail: data.mail, link: data.link,
      ua: data.ua, ip: data.ip, rid: data.rid, pid: data.pid,
    }
    this.comments.set(id, comment)
    return comment
  }

  async createPinnedCopy(original: Comment): Promise<Comment> {
    const copy = { ...original, id: crypto.randomUUID(), top: true, pinnedFromId: original.id, createdAt: Date.now() }
    this.comments.set(copy.id, copy)
    return copy
  }

  async getById(id: string): Promise<Comment | null> {
    return this.comments.get(id) || null
  }

  async getList(query: CommentQuery): Promise<{ data: Comment[]; total: number; page: number; pageSize: number; totalPages: number }> {
    let list = Array.from(this.comments.values()).filter(c => !query.url || c.url === query.url)
    if (!query.includeSpam) list = list.filter(c => !c.isSpam)
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

  async like(id: string, userId: string): Promise<boolean> {
    return true
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

  it('likes a comment', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    const ok = await service.like(c.id, 'user1')
    expect(ok).toBe(true)
  })

  it('moderates: approve', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    await service.moderate(c.id, 'spam')
    const updated = await service.getById(c.id)!
    expect(updated!.isSpam).toBe(true)
  })

  it('moderates: delete', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    await service.moderate(c.id, 'delete')
    expect(await service.getById(c.id)).toBeNull()
  })

  it('pins a comment', async () => {
    const c = await service.create({ url: '/test', nick: 'A', content: 'x' })
    const pinned = await service.setTop(c.id, true)
    expect(pinned.top).toBe(true)
    expect(pinned.pinnedFromId).toBe(c.id)
  })

  it('counts comments per url', async () => {
    await service.create({ url: '/a', nick: 'A', content: 'x' })
    await service.create({ url: '/a', nick: 'B', content: 'y' })
    await service.create({ url: '/b', nick: 'C', content: 'z' })
    expect(await service.getCount('/a')).toBe(2)
    expect(await service.getCount('/b')).toBe(1)
  })
})
