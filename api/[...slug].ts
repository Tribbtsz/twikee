import { handle } from 'hono/vercel'
import app from '../packages/api/dist/index.js'

export const GET = handle(app)
export const HEAD = handle(app)
export const OPTIONS = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
