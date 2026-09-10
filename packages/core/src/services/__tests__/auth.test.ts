import { describe, it, expect, beforeEach } from 'vitest'
import { AuthService } from '../auth'
import { createHash } from 'crypto'
import { DatabaseAdapter } from '../../adapters/base'
import type { UserRepository, ConfigRepository } from '../../adapters/base'

class MockConfigRepo implements ConfigRepository {
  store = new Map<string, string>()
  async get(key: string) { return this.store.get(key) || null }
  async set(key: string, value: string) { this.store.set(key, value) }
  async getAll() { return Object.fromEntries(this.store) }
}

class MockUserRepo implements UserRepository {
  users: any[] = []
  async getById(id: string) { return this.users.find(u => u.id === id) || null }
  async getByMail(mail: string) { return this.users.find(u => u.mail === mail) || null }
  async create(data: any) { const u = { ...data, id: crypto.randomUUID(), createdAt: Date.now() }; this.users.push(u); return u }
  async update(id: string, data: any) { return null as any }
}

class MockAdapter extends DatabaseAdapter {
  comments: any = null
  users = new MockUserRepo()
  config = new MockConfigRepo()
  async init() {}
  async close() {}
  async transaction(fn: () => Promise<any>) { return fn() }
}

describe('AuthService', () => {
  let service: AuthService
  let adapter: MockAdapter

  beforeEach(() => {
    process.env.TWIKEE_SECRET = 'test-secret-123'
    adapter = new MockAdapter()
    service = new AuthService(adapter)
  })

  it('verifies admin password with bcrypt hash', async () => {
    const hashed = await AuthService.hashPassword('admin123')
    await adapter.config.set('ADMIN_PASSWORD', hashed)
    expect(await service.verifyAdminPassword('admin123')).toBe(true)
    expect(await service.verifyAdminPassword('wrong')).toBe(false)
  })

  it('generates and verifies tokens', async () => {
    await adapter.config.set('ADMIN_PASSWORD', 'admin-hash')
    const token = await service.generateToken('admin')
    expect(token).toBeTruthy()
    const result = await service.verifyToken(token)
    expect(result.valid).toBe(true)
    expect(result.userId).toBe('admin')
  })

  it('invalidates tokens after password change', async () => {
    await adapter.config.set('ADMIN_PASSWORD', 'old-hash')
    const token = await service.generateToken('admin')
    await adapter.config.set('ADMIN_PASSWORD', 'new-hash')
    const result = await service.verifyToken(token)
    expect(result.valid).toBe(false)
  })

  it('rejects malformed tokens', async () => {
    await adapter.config.set('ADMIN_PASSWORD', 'admin-hash')
    expect((await service.verifyToken('')).valid).toBe(false)
    expect((await service.verifyToken('a:b')).valid).toBe(false)
    expect((await service.verifyToken('a:b:c')).valid).toBe(false)
  })

  it('rejects expired tokens', async () => {
    await adapter.config.set('ADMIN_PASSWORD', 'admin-hash')
    const past = Date.now() - 8 * 24 * 60 * 60 * 1000
    const hash = createHash('sha256')
      .update(`admin:${past}:test-secret-123:admin-hash`)
      .digest('hex')
    const token = `admin:${past}:${hash}`
    expect((await service.verifyToken(token)).valid).toBe(false)
  })

  it('rejects future-dated tokens', async () => {
    await adapter.config.set('ADMIN_PASSWORD', 'admin-hash')
    const future = Date.now() + 60 * 60 * 1000
    const hash = createHash('sha256')
      .update(`admin:${future}:test-secret-123:admin-hash`)
      .digest('hex')
    const token = `admin:${future}:${hash}`
    expect((await service.verifyToken(token)).valid).toBe(false)
  })

  it('creates or gets user by mail', async () => {
    const u1 = await service.getOrCreateUser('Alice', 'alice@test.com')
    expect(u1.nick).toBe('Alice')
    const u2 = await service.getOrCreateUser('Alice2', 'alice@test.com')
    expect(u2.id).toBe(u1.id)
  })
})
