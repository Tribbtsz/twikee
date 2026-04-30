import type { User } from '../types'
import type { DatabaseAdapter } from '../adapters/base'
import { createHash } from 'crypto'

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
    return password === adminPassword
  }
  
  generateToken(userId: string): string {
    const timestamp = Date.now()
    const hash = createHash('sha256')
      .update(`${userId}:${timestamp}:${process.env.TWIKOO_SECRET ?? 'twikoo-secret'}`)
      .digest('hex')
    return `${userId}:${timestamp}:${hash}`
  }
  
  verifyToken(token: string): { userId: string; valid: boolean } {
    const [userId, timestamp, hash] = token.split(':')
    if (!userId || !timestamp || !hash) {
      return { userId: '', valid: false }
    }
    
    const expectedHash = createHash('sha256')
      .update(`${userId}:${timestamp}:${process.env.TWIKOO_SECRET ?? 'twikoo-secret'}`)
      .digest('hex')
    
    const valid = hash === expectedHash && Date.now() - Number(timestamp) < 7 * 24 * 60 * 60 * 1000
    return { userId, valid }
  }
}
