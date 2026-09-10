import type { Migration } from './runner'

/**
 * v2: 软删除 + 置顶改为 top 标记
 *
 * 1. comments 增加 deleted 列（软删除标记）
 * 2. 存量置顶副本(pinned_from_id IS NOT NULL)迁移：
 *    - 把 top=1 回写到原评论
 *    - 把「回复置顶副本」的子评论改指向原评论（避免孤儿）
 *    - 删除副本（含原评论已不存在的悬空副本）
 * 3. 此后置顶不再复制评论，直接 UPDATE comments SET top = 1
 */
export const softDeleteTop: Migration = {
  version: 2,
  name: 'soft-delete-and-top-mark',
  sql: [
    `ALTER TABLE comments ADD COLUMN deleted INTEGER DEFAULT 0`,
    // 副本存在 → 原评论置顶
    `UPDATE comments SET top = 1 WHERE id IN (SELECT pinned_from_id FROM comments WHERE pinned_from_id IS NOT NULL)`,
    // 回复了副本的子评论改指向原评论，避免副本删除后成孤儿
    `UPDATE comments SET rid = COALESCE((SELECT pinned_from_id FROM comments AS p WHERE p.id = comments.rid), rid) WHERE rid IS NOT NULL`,
    // 删除所有置顶副本（悬空的会一并被清掉）
    `DELETE FROM comments WHERE pinned_from_id IS NOT NULL`,
  ],
}
