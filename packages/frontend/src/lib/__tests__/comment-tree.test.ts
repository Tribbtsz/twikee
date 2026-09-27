import { describe, it, expect } from 'vitest'
import { buildCommentTree, findRootId } from '../comment-tree'
import type { CommentNode } from '../comment-tree'

function makeComment(id: string, rid?: string, extra: Record<string, unknown> = {}) {
  return { id, rid, nick: `nick-${id}`, content: `c-${id}`, ...extra }
}

function toMap(list: ReturnType<typeof makeComment>[]) {
  const m = new Map<string, any>()
  list.forEach((c) => m.set(c.id, { ...c, children: [], replyToNick: '' }))
  return m
}

describe('findRootId', () => {
  it('returns the id itself for a top-level comment', () => {
    const map = toMap([makeComment('a'), makeComment('b', 'a')])
    expect(findRootId('a', map)).toBe('a')
  })

  it('walks the rid chain up to the root', () => {
    // a <- b <- c
    const map = toMap([makeComment('a'), makeComment('b', 'a'), makeComment('c', 'b')])
    expect(findRootId('b', map)).toBe('a')
    expect(findRootId('c', map)).toBe('a')
  })

  it('survives a self-referencing comment', () => {
    const map = toMap([makeComment('a'), makeComment('loop', 'loop')])
    expect(findRootId('loop', map)).toBe('loop')
  })

  it('terminates on a 2-cycle instead of hanging the main thread', () => {
    // A.rid=B, B.rid=A —— 无 visited 保护时 while 永不退出，
    // 浏览器主线程被占死，页面白屏且无法恢复
    const map = toMap([makeComment('a', 'b'), makeComment('b', 'a')])
    const result = findRootId('a', map)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('terminates on a longer cycle', () => {
    const map = toMap([makeComment('a', 'b'), makeComment('b', 'c'), makeComment('c', 'a')])
    expect(typeof findRootId('a', map)).toBe('string')
  })

  it('falls back to the last seen id when the chain dangles', () => {
    // b.rid 指向不存在的 'missing'，链在路上断掉
    const map = toMap([makeComment('a'), makeComment('b', 'missing')])
    expect(findRootId('b', map)).toBe('b')
  })
})

describe('buildCommentTree', () => {
  it('returns an empty array for non-array input', () => {
    expect(buildCommentTree(null as any)).toEqual([])
    expect(buildCommentTree(undefined as any)).toEqual([])
    expect(buildCommentTree({} as any)).toEqual([])
  })

  it('keeps top-level comments flat', () => {
    const tree = buildCommentTree([makeComment('a'), makeComment('b')])
    expect(tree).toHaveLength(2)
    expect(tree.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('nests replies under their root and records replyToNick', () => {
    const tree = buildCommentTree([
      makeComment('a'),
      makeComment('b', 'a'),
      makeComment('c', 'b'), // 回复的回复：仍挂到 root a 下
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('a')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children.map((n) => n.id).sort()).toEqual(['b', 'c'])
    // replyToNick 是直接父级，不是 root
    const c = tree[0].children.find((n) => n.id === 'c')!
    expect(c.replyToNick).toBe('nick-b')
  })

  it('promotes a dangling reply to top level instead of dropping it', () => {
    const tree = buildCommentTree([makeComment('a'), makeComment('b', 'ghost')])
    expect(tree.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('treats a self-referencing reply as top level', () => {
    const tree = buildCommentTree([makeComment('a'), makeComment('self', 'self')])
    expect(tree.map((n) => n.id).sort()).toEqual(['a', 'self'])
  })

  it('does not lose comments when the data contains a cycle', () => {
    // a.rid=b, b.rid=a：两者互为父子。必须都能出现在结果里（不允许静默消失），
    // 且不能死循环。这里接受两种合理结果：3 个顶层，或 2 个顶层 + 1 个子节点
    const tree = buildCommentTree([makeComment('a', 'b'), makeComment('b', 'a'), makeComment('c')])
    const flatten = (nodes: CommentNode[]): CommentNode[] =>
      nodes.flatMap((n) => [n, ...flatten(n.children)])
    expect(flatten(tree)).toHaveLength(3)
    expect(tree.some((n) => n.id === 'c')).toBe(true)
  })

  it('does not mutate the input list', () => {
    const input = [makeComment('a'), makeComment('b', 'a')]
    const snapshot = JSON.stringify(input)
    buildCommentTree(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})
