<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type { PropType } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import TkAvatar from './TkAvatar.vue'
import TkAction from './TkAction.vue'
import TkSubmit from './TkSubmit.vue'
import { marked } from 'marked'
import { sanitizeHtml } from '@/lib/utils'
import type { Comment } from '@twikee/core'

marked.setOptions({ breaks: true, gfm: true })

type CommentNode = Comment & { children?: CommentNode[], replyToNick?: string }

const props = defineProps({
  comment: { type: Object as PropType<CommentNode>, required: true },
  allComments: { type: Array as PropType<Comment[]>, default: () => [] },
  replyId: { type: String, default: '' },
  replying: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  apiUrl: { type: String, default: '' },
  isReply: { type: Boolean, default: false },
  showDivider: { type: Boolean, default: false }
})

const emit = defineEmits<{
  reply: [id: string]
  load: []
  moderate: [id: string, action: 'approve' | 'spam']
  top: [id: string, top: boolean]
}>()

const publicConfig = ref<Record<string, string>>({})

onMounted(async () => {
  try {
    const res = await fetch(`${props.apiUrl}/api/config`)
    if (res.ok) publicConfig.value = await res.json()
  } catch {}
})

const isContentExpanded = ref(false)
const likeCount = ref(props.comment.likes || 0)
const liked = ref(false)
const replyingToId = ref<string | null>(null)
const childLikeStates = ref<Record<string, { liked: boolean; count: number }>>({})
const liking = ref(false)
const childLiking = ref<Record<string, boolean>>({})
const replyError = ref<string | null>(null)

const likeStorageKey = computed(() => `twikee_liked_${props.comment.id}`)

const pinnedFromInfo = computed(() => {
  if (!props.comment.pinnedFromId) return null
  const original = props.allComments.find(c => c.id === props.comment.pinnedFromId)
  if (!original) return null
  // For replies: show parent's nick. For top-level: show original's nick
  const parent = original.rid ? props.allComments.find(c => c.id === original.rid) : null
  return {
    targetId: original.id,
    nick: parent?.nick || original.nick,
    isReply: !!original.rid
  }
})

if (typeof window !== 'undefined') {
  liked.value = localStorage.getItem(likeStorageKey.value) === '1'
}

const getChildLikeState = (childId: string, likes?: number) => {
  if (!childLikeStates.value[childId]) {
    const storageLiked = typeof window !== 'undefined' && localStorage.getItem(`twikee_liked_${childId}`) === '1'
    childLikeStates.value[childId] = { liked: storageLiked, count: likes || 0 }
  }
  return childLikeStates.value[childId]
}

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

const onLike = async () => {
  if (liking.value) return
  liking.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/comment/${props.comment.id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        liked.value = !liked.value
        likeCount.value += liked.value ? 1 : -1
        if (liked.value) {
          localStorage.setItem(likeStorageKey.value, '1')
        } else {
          localStorage.removeItem(likeStorageKey.value)
        }
      }
    }
  } catch (e) {
    console.error('点赞失败:', e)
  } finally {
    liking.value = false
  }
}

const onChildLike = async (childId: string) => {
  const state = childLikeStates.value[childId]
  if (!state || childLiking.value[childId]) return
  childLiking.value[childId] = true
  try {
    const res = await fetch(`${props.apiUrl}/api/comment/${childId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        state.liked = !state.liked
        state.count += state.liked ? 1 : -1
        if (state.liked) {
          localStorage.setItem(`twikee_liked_${childId}`, '1')
        } else {
          localStorage.removeItem(`twikee_liked_${childId}`)
        }
      }
    }
  } catch (e) {
    console.error('子评论点赞失败:', e)
  } finally {
    childLiking.value[childId] = false
  }
}

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

const handleReplySubmit = async (data: any) => {
  replyError.value = null
  try {
    const res = await fetch(`${props.apiUrl}/api/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        url: props.comment.url,
        rid: props.comment.id
      })
    })
    if (res.ok) {
      replyingToId.value = null
      emit('load')
    } else {
      const err = await res.json().catch(() => null)
      replyError.value = err?.error || '回复失败，请重试'
    }
  } catch (e) {
    replyError.value = '网络错误，请重试'
  }
}

const handleChildReplySubmit = async (data: any, childId: string) => {
  replyError.value = null
  try {
    const res = await fetch(`${props.apiUrl}/api/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        url: props.comment.url,
        rid: childId
      })
    })
    if (res.ok) {
      replyingToId.value = null
      emit('load')
    } else {
      const err = await res.json().catch(() => null)
      replyError.value = err?.error || '回复失败，请重试'
    }
  } catch (e) {
    replyError.value = '网络错误，请重试'
  }
}
</script>

<template>
  <div :id="`comment-${comment.id}`" class="tk-comment" :class="{ 'tk-comment--reply': isReply, 'tk-comment--divider': showDivider, 'tk-comment--pinned-copy': comment.pinnedFromId }">
    <div class="tk-comment__inner">
      <div class="tk-comment__avatar">
        <TkAvatar
          :nick="comment.nick"
          :mail="comment.mail"
          :link="convertedLink"
          :size="isReply ? 'sm' : 'md'"
          :gravatar-cdn="publicConfig.GRAVATAR_CDN"
        />
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

            <Badge v-if="comment.master" variant="default" class="tk-badge">博主</Badge>
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

        <div
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
            @submit="handleReplySubmit"
            @cancel="replyingToId = null"
          />
        </div>

        <div class="tk-comment__actions">
          <TkAction
            :liked="liked"
            :like-count="likeCount"
            @like="onLike"
            @reply="onReply"
          />

          <div v-if="isAdmin" class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              v-if="comment.isSpam"
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              @click="emit('moderate', comment.id, 'approve')"
            >
              显示
            </Button>
            <Button
              v-else
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              @click="emit('moderate', comment.id, 'spam')"
            >
              隐藏
            </Button>
            <Button
              v-if="!comment.rid"
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              @click="emit('top', comment.id, !comment.top)"
            >
              {{ comment.top ? '取消置顶' : '置顶' }}
            </Button>
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
            <TkAvatar
              :nick="child.nick"
              :mail="child.mail"
              :link="convertLink(child.link)"
              size="sm"
              :gravatar-cdn="publicConfig.GRAVATAR_CDN"
            />
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

                <Badge v-if="child.master" variant="default" class="tk-badge">博主</Badge>
                <Badge v-if="child.isSpam" variant="destructive" class="tk-badge">待审核</Badge>
              </div>

              <time class="tk-comment__time">{{ formatTime(child.createdAt) }}</time>
            </div>

            <div class="tk-comment__content" v-html="renderChildContent(child.content)" />

            <div v-if="replyingToId === child.id" class="tk-comment__reply-box" @focusout="handleReplyBoxFocusOut">
              <div v-if="replyError" class="tk-comment__error">{{ replyError }}</div>
              <TkSubmit
                :url="comment.url"
                :rid="child.id"
                @submit="(data: any) => handleChildReplySubmit(data, child.id)"
                @cancel="replyingToId = null"
              />
            </div>

            <div class="tk-comment__actions">
              <TkAction
                :liked="getChildLikeState(child.id, child.likes).liked"
                :like-count="getChildLikeState(child.id, child.likes).count"
                @like="onChildLike(child.id)"
                @reply="onChildReply(child.id)"
              />
            </div>
          </div>
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
  background: var(--border);
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
  0%, 100% { background: transparent; }
  50% { background: var(--primary); opacity: 0.15; }
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

.tk-comment__replies {
  margin-left: 2.5rem;
}

.tk-comment--reply .tk-comment__content {
  font-size: 0.8125rem;
}
</style>
