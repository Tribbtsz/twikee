import type { User } from '../types'
import type { DatabaseAdapter } from '../adapters/base'
import { createHash, timingSafeEqual, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

let cachedSecret: string | null = null

function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret
  const secret = process.env.TWIKEE_SECRET
  if (secret) {
    cachedSecret = secret
    return secret
  }
  // 生产环境缺密钥必须 fail-fast：token 签名密钥不可猜是一切鉴权的前提，
  // 静默降级会让攻击者有机会预测密钥并伪造 admin token
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Twikee] TWIKEE_SECRET is required in production')
  }
  // 本地开发：随机生成（重启即失效，仅适合开发）
  console.warn('[Twikee] TWIKEE_SECRET not set, using a random per-process secret (dev only)')
  // 注意：必须用 randomBytes。旧实现是 sha256('twikee-dev-' + Date.now())，
  // 种子只有毫秒时间戳 + 固定串，可被暴力猜出。
  cachedSecret = randomBytes(32).toString('hex')
  return cachedSecret
}

/** 仅测试用：清掉模块级密钥缓存 */
export function resetCachedSecretForTest(): void {
  cachedSecret = null
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

/**
 * 常量时间字符串比较。
 * 长度不等先返回 false（不比较内容），从而永远不把不同长度的缓冲区
 * 传给 timingSafeEqual（它会直接抛错）。
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
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
    // 历史明文口令回退：用常量时间比较（=== 会因提前返回泄露前缀匹配长度），
    // 校验通过后立即升级为 bcrypt 哈希
    if (safeEqual(password, adminPassword)) {
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

  async verifyToken(token: string): Promise<{ userId: string; valid: false | true }> {
    const [userId, timestamp, hash] = token.split(':')
    // 约定：token 结构不完整 / 时间戳非法时一律返回空 userId，
    // 避免调用方在两种失败路径上拿到形态不同的 userId 后分支处理
    if (!userId || !timestamp || !hash) {
      return { userId: '', valid: false }
    }
    const ts = Number(timestamp)
    if (!Number.isFinite(ts) || ts > Date.now()) {
      return { userId: '', valid: false }
    }

    const adminHash = (await this.db.config.get('ADMIN_PASSWORD')) || ''
    const expectedHash = hashToken(userId, timestamp, adminHash)
    const valid = safeEqual(hash, expectedHash) && Date.now() - ts < getTokenTtl()
    return { userId, valid }
  }
}
