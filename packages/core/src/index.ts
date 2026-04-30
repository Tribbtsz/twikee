export * from './types'
export { DatabaseAdapter } from './adapters/base'
export { TursoAdapter } from './adapters/turso'
export { CommentService } from './services/comment'
export { AuthService } from './services/auth'
export { NotificationService, TelegramAdapter, WebhookAdapter, EmailAdapter } from './services/notification'
export type { ChannelAdapter } from './services/notification'

import type { DbConfig, DbType, TursoConfig } from './types'
import { TursoAdapter } from './adapters/turso'
import type { DatabaseAdapter } from './adapters/base'

export function createDatabaseAdapter(type: DbType, config: DbConfig): DatabaseAdapter {
  switch (type) {
    case 'turso':
      return new TursoAdapter(config as TursoConfig)
    default:
      throw new Error(`Unsupported database type: ${type}`)
  }
}
