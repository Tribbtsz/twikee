import type { Migration } from './runner'
import { initial } from './001-initial'
import { softDeleteTop } from './002-soft-delete-top'

export const migrations: Migration[] = [
  initial,
  softDeleteTop,
]
