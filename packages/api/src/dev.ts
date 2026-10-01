import { config } from 'dotenv'
import { resolve } from 'path'
import { serve } from '@hono/node-server'
import app from './index'

// Load .env.local（优先，gitignore）后回退到 .env，与文档里的
// `cp .env.example .env` 兼容。dotenv 数组按顺序填充且默认不覆盖，
// 因此先出现、或已存在于真实环境变量里的值优先级更高。
const rootDir = resolve(import.meta.dirname, '../../..')
config({ path: [resolve(rootDir, '.env.local'), resolve(rootDir, '.env')] })

const port = Number(process.env.PORT) || 3000

console.log(`🚀 Server is running on http://localhost:${port}`)
console.log('📝 Auto-create data directory enabled')

serve({
  fetch: app.fetch,
  port,
})
