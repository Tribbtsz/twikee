import type { Comment } from '@twikee/core'

/** 带层级的评论节点 */
export interface CommentNode extends Comment {
  children: CommentNode[]
  /** 被回复者的昵称（直接父级，不一定是 root） */
  replyToNick: string
}

/**
 * 沿 rid 链向上找到顶层评论的 id。
 *
 * visited 集合是必须的：脏数据可能构成环（A.rid=B, B.rid=A），
 * 没有它 while 会无限循环，直接占死浏览器主线程且无恢复手段。
 * 这也是把本函数从 App.vue / DemoEntry.vue 各存一份改为共享的原因——
 * 两份副本已经漂移过，其中一份就缺了这个保护。
 */
export function findRootId(rid: string, commentMap: Map<string, any>): string {
  let current = commentMap.get(rid)
  let fallback = rid
  const visited = new Set<string>()

  while (current && current.rid && !visited.has(current.id)) {
    visited.add(current.id)
    fallback = current.id
    current = commentMap.get(current.rid)
  }
  return current ? (current.id as string) : fallback
}
/**
 * 把扁平的评论列表组装成树。
 *
 * 后端返回的是扁平列表（含回复），且没有 pid IS NULL 过滤，
 * 顶层/回复都混在一起；这里按 rid 重建层级。
 * rid 指向不存在（或指向自己）的评论时按顶层处理，避免孤儿丢失。
 */
export function buildCommentTree(commentsList: any[]): CommentNode[] {
  if (!Array.isArray(commentsList)) return []

  const commentMap = new Map<string, any>()
  const rootComments: CommentNode[] = []
  /** 已被挂到别人 children 下的节点 id，防止同一节点既进树又留顶层 */
  const attached = new Set<string>()

  commentsList.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, children: [], replyToNick: '' })
  })

  commentsList.forEach((comment) => {
    const node = commentMap.get(comment.id)
    if (comment.rid) {
      const rootId = findRootId(comment.rid, commentMap)
      const root = commentMap.get(rootId)
      if (root && rootId !== comment.id && !attached.has(rootId)) {
        const parentComment = commentMap.get(comment.rid)
        node.replyToNick = parentComment ? parentComment.nick : ''
        root.children.push(node)
        attached.add(comment.id)
        return
      }
    }
    // rid 悬空（父评论不存在/指向自己）或 root 已被挂走：按顶层展示，
    // 否则这条评论会从界面上彻底消失
    rootComments.push(node)
  })

  return rootComments
}
