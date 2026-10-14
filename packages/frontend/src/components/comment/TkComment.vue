<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import TkAvatar from './TkAvatar.vue'
import TkAction from './TkAction.vue'
import TkSubmit from './TkSubmit.vue'
import { marked } from 'marked'
import { sanitizeHtml } from '@/lib/utils'
import { createLikeController } from '@/lib/like'
import type { LikeController } from '@/lib/like'
import type { Comment } from '@twikee/core'
import type { ResolvedTwikeeAppearance } from '@/types'
import { getEditToken, saveEditToken, clearEditToken } from '@/lib/edit-token'

marked.setOptions({ breaks: true, gfm: true })

type CommentNode = Comment & { children?: CommentNode[]; replyToNick?: string }

const props = defineProps({
  comment: { type: Object as PropType<CommentNode>, required: true },
  allComments: { type: Array as PropType<Comment[]>, default: () => [] },
  apiUrl: { type: String, default: '' },
  isReply: { type: Boolean, default: false },
  showDivider: { type: Boolean, default: false },
  masterTag: { type: String, default: '博主' },
  appearance: {
    type: Object as PropType<ResolvedTwikeeAppearance>,
    default: undefined,
  },
})

const emit = defineEmits<{
  load: []
}>()

const isContentExpanded = ref(false)
const likeCount = ref(props.comment.likes || 0)
const liked = ref(false)
const replyingToId = ref<string | null>(null)
const childLikeStates = ref<Record<string, { liked: boolean; count: number }>>({})
const replyError = ref<string | null>(null)

// 举报
const reportTargetId = ref<string | null>(null)
const reportReason = ref('')
const reportSending = ref(false)
const reportFeedback = ref<string | null>(null)

// 编辑/删除自己的评论（30 分钟内，凭 localStorage 里的 editToken）
const editingId = ref<string | null>(null)
const editContent = ref('')
const editSaving = ref(false)
const editError = ref<string | null>(null)

/** 是否显示"编辑"按钮：本地有未过期的 editToken 即为本人 */
const canEdit = (id: string): boolean => getEditToken(id) !== null

const likeStorageKey = computed(() => `twikee_liked_${props.comment.id}`)

const pinnedFromInfo = computed(() => {
  if (!props.comment.pinnedFromId) return null
  const original = props.allComments.find((c) => c.id === props.comment.pinnedFromId)
  if (!original) return null
  // For replies: show parent's nick. For top-level: show original's nick
  const parent = original.rid ? props.allComments.find((c) => c.id === original.rid) : null
  return {
    targetId: original.id,
    nick: parent?.nick || original.nick,
    isReply: !!original.rid,
  }
})

if (typeof window !== 'undefined') {
  liked.value = localStorage.getItem(likeStorageKey.value) === '1'
}

// 点赞：本地先动、请求合并，服务端结果回来再校正（实现见 lib/like.ts）
const likeController = createLikeController({
  apiUrl: props.apiUrl,
  commentId: props.comment.id,
  read: () => ({ liked: liked.value, count: likeCount.value }),
  apply: (next) => {
    liked.value = next.liked
    likeCount.value = next.count
  },
  persist: (isLiked) => {
    if (isLiked) localStorage.setItem(likeStorageKey.value, '1')
    else localStorage.removeItem(likeStorageKey.value)
  },
  onError: (err) => console.error('[Twikee] 点赞失败:', err),
})

// 后台审核/删除后重新拉取列表时，组件因 :key="comment.id" 被复用、不会重新 setup，
// 不同步就会一直显示陈旧计数。但本地有未确认的乐观值时不能覆盖，否则连点会被旧值打断。
watch(
  () => props.comment.likes,
  (value) => {
    if (typeof value === 'number' && !likeController.isBusy()) likeCount.value = value
  },
)

// 子评论的点赞状态：由 watch 从 props 播种，控制器只负责乐观改写
const childLikeControllers = new Map<string, LikeController>()

const getChildLikeState = (childId: string, likes?: number) =>
  childLikeStates.value[childId] ?? { liked: false, count: likes || 0 }

const childController = (childId: string, likes = 0): LikeController => {
  let controller = childLikeControllers.get(childId)
  if (!controller) {
    controller = createLikeController({
      apiUrl: props.apiUrl,
      commentId: childId,
      read: () => childLikeStates.value[childId] ?? { liked: false, count: likes },
      apply: (next) => {
        childLikeStates.value = { ...childLikeStates.value, [childId]: next }
      },
      persist: (isLiked) => {
        const key = `twikee_liked_${childId}`
        if (isLiked) localStorage.setItem(key, '1')
        else localStorage.removeItem(key)
      },
      onError: (err) => console.error('[Twikee] 子评论点赞失败:', err),
    })
    childLikeControllers.set(childId, controller)
  }
  return controller
}

watch(
  () => props.comment.children,
  (children) => {
    if (!children || children.length === 0) return
    const next = { ...childLikeStates.value }
    for (const child of children) {
      const current = next[child.id]
      if (!current) {
        const storageLiked = typeof window !== 'undefined' && localStorage.getItem(`twikee_liked_${child.id}`) === '1'
        next[child.id] = { liked: storageLiked, count: child.likes || 0 }
      } else if (typeof child.likes === 'number' && !childLikeControllers.get(child.id)?.isBusy()) {
        next[child.id] = { ...current, count: child.likes }
      }
    }
    childLikeStates.value = next
  },
  { immediate: true },
)

onUnmounted(() => {
  likeController.dispose()
  for (const controller of childLikeControllers.values()) controller.dispose()
})

const showReplyBox = computed(() => replyingToId.value === props.comment.id)

const formatTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString()
}

const displayTime = computed(() => formatTime(props.comment.createdAt))

const convertLink = (link?: string): string | undefined => {
  if (!link) return undefined
  if (link.startsWith('http://') || link.startsWith('https://')) return link
  return `https://${link}`
}

const convertedLink = computed(() => convertLink(props.comment.link))

const renderedContent = computed(() => {
  return sanitizeHtml(marked.parse(props.comment.content) as string)
})

const renderChildContent = (content: string) => {
  return sanitizeHtml(marked.parse(content) as string)
}

// 点击只改本地（乐观）；请求由控制器合并后发出
const onLike = () => likeController.toggle()

const onChildLike = (childId: string, likes = 0) => childController(childId, likes).toggle()

const onReply = () => {
  replyingToId.value = replyingToId.value === props.comment.id ? null : props.comment.id
}

const onChildReply = (childId: string) => {
  replyingToId.value = replyingToId.value === childId ? null : childId
}

const handleReplyBoxFocusOut = (e: FocusEvent) => {
  const currentTarget = e.currentTarget as HTMLElement
  const relatedTarget = e.relatedTarget as HTMLElement | null
  if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
    replyingToId.value = null
  }
}

const scrollToComment = (id: string) => {
  const el = document.getElementById(`comment-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('tk-comment--highlight')
    setTimeout(() => el.classList.remove('tk-comment--highlight'), 1200)
  }
}

const handleReplySubmit = async (data: any): Promise<boolean> => {
  replyError.value = null
  try {
    const res = await fetch(`${props.apiUrl}/api/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        url: props.comment.url,
        rid: props.comment.id,
      }),
    })
    if (res.ok) {
      // 服务端随创建响应返回 editToken：30 分钟内可凭它编辑/删除这条回复
      const created = await res.json().catch(() => null)
      if (created?.id && created?.editToken) saveEditToken(created.id, created.editToken)
      replyingToId.value = null
      emit('load')
      return true
    }
    const err = await res.json().catch(() => null)
    replyError.value = err?.error || '回复失败，请重试'
    return false
  } catch (e) {
    console.error('[Twikee] reply failed:', e)
    replyError.value = '网络错误，请重试'
    return false
  }
}

const handleChildReplySubmit = async (data: any, childId: string): Promise<boolean> => {
  replyError.value = null
  try {
    const res = await fetch(`${props.apiUrl}/api/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        url: props.comment.url,
        rid: childId,
      }),
    })
    if (res.ok) {
      const created = await res.json().catch(() => null)
      if (created?.id && created?.editToken) saveEditToken(created.id, created.editToken)
      replyingToId.value = null
      emit('load')
      return true
    }
    const err = await res.json().catch(() => null)
    replyError.value = err?.error || '回复失败，请重试'
    return false
  } catch (e) {
    console.error('[Twikee] child reply failed:', e)
    replyError.value = '网络错误，请重试'
    return false
  }
}

// 举报：打开弹窗
const openReport = (id: string) => {
  reportTargetId.value = id
  reportReason.value = ''
  reportFeedback.value = null
}

const closeReport = () => {
  reportTargetId.value = null
  reportReason.value = ''
}

const submitReport = async () => {
  if (!reportTargetId.value || reportSending.value) return
  reportSending.value = true
  reportFeedback.value = null
  try {
    const res = await fetch(`${props.apiUrl}/api/comment/${reportTargetId.value}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reportReason.value.trim().slice(0, 200) || undefined }),
    })
    if (res.ok) {
      reportFeedback.value = '已举报，管理员会尽快处理'
      setTimeout(closeReport, 1500)
    } else {
      reportFeedback.value = '举报失败，请稍后重试'
    }
  } catch {
    reportFeedback.value = '网络错误，请稍后重试'
  } finally {
    reportSending.value = false
  }
}

// 编辑自己的评论
const startEdit = (id: string, content: string) => {
  editingId.value = id
  editContent.value = content
  editError.value = null
}

const cancelEdit = () => {
  editingId.value = null
  editContent.value = ''
  editError.value = null
}

const saveEdit = async () => {
  const id = editingId.value
  if (!id || editSaving.value) return
  const token = getEditToken(id)
  if (!token) {
    editError.value = '编辑凭证已过期（仅创建后 30 分钟内可编辑）'
    return
  }
  const content = editContent.value.trim()
  if (!content) {
    editError.value = '内容不能为空'
    return
  }
  editSaving.value = true
  editError.value = null
  try {
    const res = await fetch(`${props.apiUrl}/api/comment/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, editToken: token }),
    })
    if (res.ok) {
      cancelEdit()
      emit('load')
    } else {
      const err = await res.json().catch(() => null)
      editError.value = err?.error || '保存失败，请重试'
    }
  } catch {
    editError.value = '网络错误，请重试'
  } finally {
    editSaving.value = false
  }
}

// 删除自己的评论（软删除）
const deleteOwn = async (id: string) => {
  const token = getEditToken(id)
  if (!token) return
  if (!window.confirm('确定要删除这条评论吗？')) return
  try {
    const res = await fetch(`${props.apiUrl}/api/comment/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editToken: token }),
    })
    if (res.ok) {
      clearEditToken(id)
      cancelEdit()
      emit('load')
    }
  } catch (e) {
    console.error('[Twikee] delete own comment failed:', e)
  }
}
</script>

<template>
  <div
    :id="`comment-${comment.id}`"
    class="tk-comment"
    :class="{
      'tk-comment--reply': isReply,
      'tk-comment--divider': showDivider,
      'tk-comment--pinned-copy': comment.pinnedFromId,
    }"
  >
    <div class="tk-comment__inner">
      <div class="tk-comment__avatar">
        <TkAvatar :nick="comment.nick" :mail="comment.mail" :link="convertedLink" :size="isReply ? 'sm' : 'md'" />
      </div>

      <div class="tk-comment__body">
        <div class="tk-comment__header">
          <div class="tk-comment__meta">
            <a
              v-if="convertedLink"
              :href="convertedLink"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="tk-comment__nick tk-comment__nick--link"
            >
              {{ comment.nick }}
            </a>
            <span v-else class="tk-comment__nick">{{ comment.nick }}</span>

            <span v-if="comment.replyToNick" class="tk-comment__reply-to">
              回复 <span class="tk-comment__reply-to-name">@{{ comment.replyToNick }}</span>
            </span>

            <Badge v-if="comment.master" variant="default" class="tk-badge">{{ masterTag }}</Badge>
            <Badge v-if="comment.top" variant="secondary" class="tk-badge">置顶</Badge>
            <a
              v-if="comment.pinnedFromId && pinnedFromInfo"
              :href="`#comment-${pinnedFromInfo.targetId}`"
              class="tk-comment__pinned-from"
              @click.prevent="scrollToComment(pinnedFromInfo.targetId)"
            >
              {{ pinnedFromInfo.isReply ? '回复自' : '来自' }} @{{ pinnedFromInfo.nick }}
            </a>
            <Badge v-if="comment.isSpam" variant="destructive" class="tk-badge">待审核</Badge>
          </div>

          <time class="tk-comment__time">{{ displayTime }}</time>
        </div>

        <div v-if="editingId === comment.id" class="tk-comment__edit">
          <textarea
            v-model="editContent"
            class="tk-comment__edit-input"
            rows="4"
            maxlength="10000"
            aria-label="编辑评论内容"
          />
          <div v-if="editError" class="tk-comment__error">{{ editError }}</div>
          <div class="tk-comment__edit-actions">
            <button class="tk-comment__edit-btn tk-comment__edit-btn--primary" :disabled="editSaving" @click="saveEdit">
              {{ editSaving ? '保存中...' : '保存' }}
            </button>
            <button class="tk-comment__edit-btn" @click="cancelEdit">取消</button>
            <button class="tk-comment__edit-btn tk-comment__edit-btn--danger" @click="deleteOwn(comment.id)">
              删除这条评论
            </button>
          </div>
        </div>
        <div
          v-else
          class="tk-comment__content"
          :class="{ 'tk-comment__content--collapsed': !isContentExpanded }"
          v-html="renderedContent"
        />

        <button
          v-if="!isContentExpanded && comment.content.length > 200"
          @click="isContentExpanded = true"
          class="tk-comment__expand"
          aria-expanded="false"
          aria-label="展开完整评论内容"
        >
          展开全文
        </button>

        <div v-if="showReplyBox" class="tk-comment__reply-box">
          <div v-if="replyError" class="tk-comment__error">{{ replyError }}</div>
          <TkSubmit
            :url="comment.url"
            :rid="comment.id"
            :appearance="appearance"
            :on-submit="handleReplySubmit"
            @cancel="replyingToId = null"
          />
        </div>

        <div class="tk-comment__actions">
          <TkAction :liked="liked" :like-count="likeCount" @like="onLike" @reply="onReply" />
          <div class="tk-comment__more-actions">
            <button
              v-if="canEdit(comment.id)"
              class="tk-action__btn"
              aria-label="编辑评论"
              @click="startEdit(comment.id, comment.content)"
            >
              编辑
            </button>
            <button class="tk-action__btn" aria-label="举报评论" @click="openReport(comment.id)">举报</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="comment.children && comment.children.length > 0" class="tk-comment__replies">
      <div
        v-for="child in comment.children"
        :key="child.id"
        :id="`comment-${child.id}`"
        class="tk-comment tk-comment--reply"
      >
        <div class="tk-comment__inner">
          <div class="tk-comment__avatar">
            <TkAvatar :nick="child.nick" :mail="child.mail" :link="convertLink(child.link)" size="sm" />
          </div>

          <div class="tk-comment__body">
            <div class="tk-comment__header">
              <div class="tk-comment__meta">
                <a
                  v-if="child.link"
                  :href="convertLink(child.link)!"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  class="tk-comment__nick tk-comment__nick--link"
                >
                  {{ child.nick }}
                </a>
                <span v-else class="tk-comment__nick">{{ child.nick }}</span>

                <span v-if="child.replyToNick" class="tk-comment__reply-to">
                  回复 <span class="tk-comment__reply-to-name">@{{ child.replyToNick }}</span>
                </span>

                <Badge v-if="child.master" variant="default" class="tk-badge">{{ masterTag }}</Badge>
                <Badge v-if="child.isSpam" variant="destructive" class="tk-badge">待审核</Badge>
              </div>

              <time class="tk-comment__time">{{ formatTime(child.createdAt) }}</time>
            </div>

            <div v-if="editingId === child.id" class="tk-comment__edit">
              <textarea
                v-model="editContent"
                class="tk-comment__edit-input"
                rows="4"
                maxlength="10000"
                aria-label="编辑评论内容"
              />
              <div v-if="editError" class="tk-comment__error">{{ editError }}</div>
              <div class="tk-comment__edit-actions">
                <button
                  class="tk-comment__edit-btn tk-comment__edit-btn--primary"
                  :disabled="editSaving"
                  @click="saveEdit"
                >
                  {{ editSaving ? '保存中...' : '保存' }}
                </button>
                <button class="tk-comment__edit-btn" @click="cancelEdit">取消</button>
                <button class="tk-comment__edit-btn tk-comment__edit-btn--danger" @click="deleteOwn(child.id)">
                  删除这条评论
                </button>
              </div>
            </div>
            <div v-else class="tk-comment__content" v-html="renderChildContent(child.content)" />

            <div v-if="replyingToId === child.id" class="tk-comment__reply-box" @focusout="handleReplyBoxFocusOut">
              <div v-if="replyError" class="tk-comment__error">{{ replyError }}</div>
              <TkSubmit
                :url="comment.url"
                :rid="child.id"
                :appearance="appearance"
                :on-submit="(data: any) => handleChildReplySubmit(data, child.id)"
                @cancel="replyingToId = null"
              />
            </div>

            <div class="tk-comment__actions">
              <TkAction
                :liked="getChildLikeState(child.id, child.likes).liked"
                :like-count="getChildLikeState(child.id, child.likes).count"
                @like="onChildLike(child.id, child.likes)"
                @reply="onChildReply(child.id)"
              />
              <div class="tk-comment__more-actions">
                <button
                  v-if="canEdit(child.id)"
                  class="tk-action__btn"
                  aria-label="编辑评论"
                  @click="startEdit(child.id, child.content)"
                >
                  编辑
                </button>
                <button class="tk-action__btn" aria-label="举报评论" @click="openReport(child.id)">举报</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 举报弹窗 -->
    <div v-if="reportTargetId" class="tk-report__overlay" @click.self="closeReport">
      <div class="tk-report__dialog" role="dialog" aria-modal="true" aria-label="举报评论">
        <h4 class="tk-report__title">举报评论</h4>
        <p class="tk-report__desc">请填写举报原因，管理员会尽快处理。</p>
        <textarea
          v-model="reportReason"
          class="tk-report__input"
          rows="3"
          maxlength="200"
          placeholder="举报原因（可选，最多 200 字）"
          aria-label="举报原因"
        />
        <div v-if="reportFeedback" class="tk-report__feedback">{{ reportFeedback }}</div>
        <div class="tk-report__actions">
          <button class="tk-comment__edit-btn" @click="closeReport">取消</button>
          <button
            class="tk-comment__edit-btn tk-comment__edit-btn--primary"
            :disabled="reportSending"
            @click="submitReport"
          >
            {{ reportSending ? '提交中...' : '提交举报' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tk-comment {
  position: relative;
}

.tk-comment--divider {
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  position: relative;
}

.tk-comment--divider::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 3.25rem;
  right: 0;
  height: 1px;
  border-bottom: 1px dashed var(--border);
  opacity: 0.65;
}

.tk-comment__inner {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0;
}

.tk-comment--reply .tk-comment__inner {
  padding: 0.5rem 0;
}

.tk-comment__avatar {
  flex-shrink: 0;
}

.tk-comment__body {
  flex: 1;
  min-width: 0;
}

.tk-comment__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.tk-comment__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tk-badge {
  font-size: 10px;
  padding: 0 6px;
  height: 16px;
}

.tk-comment__pinned-from {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s;
}
.tk-comment__pinned-from:hover {
  color: var(--foreground);
}

.tk-comment--highlight {
  animation: highlight-flash 0.6s ease-in-out 2;
}
@keyframes highlight-flash {
  0%,
  100% {
    background: transparent;
  }
  50% {
    background: var(--primary);
    opacity: 0.15;
  }
}

.tk-comment__nick {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--foreground);
}

.tk-comment__nick--link {
  color: var(--foreground);
  text-decoration: none;
  transition: color 0.15s;
}

.tk-comment__nick--link:hover {
  color: var(--primary);
}

.tk-comment__reply-to {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.tk-comment__reply-to-name {
  color: var(--primary);
  font-weight: 500;
}

.tk-comment__time {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.tk-comment__content {
  font-size: 0.875rem;
  line-height: 1.625;
  color: var(--foreground);
  word-break: break-word;
}

.tk-comment__content--collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tk-comment__content :deep(p) {
  margin: 0 0 0.5rem;
}

.tk-comment__content :deep(p:last-child) {
  margin-bottom: 0;
}

.tk-comment__content :deep(code) {
  font-size: 0.8125rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--muted);
}

.tk-comment__content :deep(pre) {
  margin: 0.5rem 0;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: var(--muted);
  overflow-x: auto;
}

.tk-comment__content :deep(pre code) {
  padding: 0;
  background: none;
}

.tk-comment__content :deep(blockquote) {
  margin: 0.5rem 0;
  padding: 0.25rem 0.75rem;
  border-left: 3px solid var(--primary);
  color: var(--muted-foreground);
}

.tk-comment__expand {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.15s;
  background: none;
  border: none;
  padding: 0;
}

.tk-comment__expand:hover {
  color: var(--primary);
}

.tk-comment__reply-box {
  margin-top: 0.75rem;
}

.tk-comment__error {
  font-size: 0.8125rem;
  color: var(--destructive, #ef4444);
  margin-bottom: 0.5rem;
}

.tk-comment__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
}

.tk-comment__more-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* 编辑/举报按钮：与 TkAction 的赞/回复同一样式。
 * 注意：tk-action__btn 的样式定义在 TkAction.vue 的 scoped 块里，
 * 作用不到这里的按钮，所以这里要再定义一遍（否则是大黑字默认样式）。 */
.tk-comment__more-actions .tk-action__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  transition: color 0.15s;
}

.tk-comment__more-actions .tk-action__btn:hover {
  color: var(--primary);
}

/* 编辑自己的评论 */
.tk-comment__edit {
  margin: 0.5rem 0;
}

.tk-comment__edit-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.625;
  color: var(--foreground);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  resize: vertical;
}

.tk-comment__edit-input:focus {
  outline: none;
  border-color: var(--primary);
}

.tk-comment__edit-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tk-comment__edit-btn {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
  transition: opacity 0.15s;
}

.tk-comment__edit-btn:hover {
  opacity: 0.85;
}

.tk-comment__edit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tk-comment__edit-btn--primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: transparent;
}

.tk-comment__edit-btn--danger {
  color: var(--destructive, #ef4444);
}

/* 举报弹窗 */
.tk-report__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.tk-report__dialog {
  width: 100%;
  max-width: 24rem;
  background: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.tk-report__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.tk-report__desc {
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  margin: 0 0 0.75rem;
}

.tk-report__input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--foreground);
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  resize: vertical;
}

.tk-report__input:focus {
  outline: none;
  border-color: var(--primary);
}

.tk-report__feedback {
  font-size: 0.8125rem;
  color: var(--primary);
  margin-top: 0.5rem;
}

.tk-report__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.tk-comment__replies {
  margin-left: 2.5rem;
}

.tk-comment--reply .tk-comment__content {
  font-size: 0.8125rem;
}
</style>
