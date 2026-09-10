import type { User } from '../types'
import type { DatabaseAdapter } from '../adapters/base'
import { createHash, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'

let cachedSecret: string | null = null

function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret
  const secret = process.env.TWIKEE_SECRET
  if (secret) {
    cachedSecret = secret
    return secret
  }
  // Local dev: auto-generate a random secret
  console.warn('[Twikee] TWIKEE_SECRET not set, using auto-generated secret (not suitable for production)')
  cachedSecret = createHash('sha256').update(`twikee-dev-${Date.now()}`).digest('hex')
  return cachedSecret
}

const DEFAULT_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000 // 7 天

function getTokenTtl(): number {
  const raw = Number(process.env.TWIKEE_TOKEN_TTL)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TOKEN_TTL
}

function hashToken(userId: string, timestamp: string, adminPasswordHash: string): string {
  return createHash('sha256')
    .update(`${userId}:${timestamp}:${getJwtSecret()}:${adminPasswordHash}`)
    .digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

export class AuthService {
  private db: DatabaseAdapter
  
  constructor(db: DatabaseAdapter) {
    this.db = db
  }
  
  async getOrCreateUser(nick: string, mail?: string, link?: string): Promise<User> {
    if (mail) {
      const existing = await this.db.users.getByMail(mail)
      if (existing) return existing
    }
    
    return await this.db.users.create({ nick, mail, link })
  }
  
  async getUserById(id: string): Promise<User | null> {
    return await this.db.users.getById(id)
  }
  
  async verifyAdminPassword(password: string): Promise<boolean> {
    const adminPassword = await this.db.config.get('ADMIN_PASSWORD')
    if (!adminPassword) return false
    if (adminPassword.startsWith('$2')) {
      return bcrypt.compare(password, adminPassword)
    }
    // Legacy plaintext fallback: verify and upgrade to bcrypt hash
    if (password === adminPassword) {
      const hashed = await bcrypt.hash(password, 10)
      await this.db.config.set('ADMIN_PASSWORD', hashed)
      return true
    }
    return false
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }
  
  /**
   * 生成绑定当前 ADMIN_PASSWORD 哈希的 token。
   * 改密后哈希变化 → 旧 token 全部失效，无需服务端黑名单。
   */
  async generateToken(userId: string): Promise<string> {
    const timestamp = Date.now()
    const adminHash = (await this.db.config.get('ADMIN_PASSWORD')) || ''
    const hash = hashToken(userId, String(timestamp), adminHash)
    return `${userId}:${timestamp}:${hash}`
  }

  async verifyToken(token: string): Promise<{ userId: string; valid: boolean }> {
    const [userId, timestamp, hash] = token.split(':')
    if (!userId || !timestamp || !hash) {
      return { userId: '', valid: false }
    }
    const ts = Number(timestamp)
    if (!Number.isFinite(ts) || ts > Date.now()) {
      return { userId, valid: false }
    }

    const adminHash = (await this.db.config.get('ADMIN_PASSWORD')) || ''
    const expectedHash = hashToken(userId, timestamp, adminHash)
    const valid = safeEqualHex(hash, expectedHash) && Date.now() - ts < getTokenTtl()
    return { userId, valid }
  }
}
