import type { Migration } from './runner'
import { initial } from './001-initial'

export const migrations: Migration[] = [
  initial,
]
