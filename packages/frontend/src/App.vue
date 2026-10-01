<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useTwikee } from './composables/useTwikee'
import TkComment from './components/comment/TkComment.vue'
import TkSubmit from './components/comment/TkSubmit.vue'
import Button from './components/ui/Button.vue'
import { resolveAppearance } from './types'
import type { TwikeeAppearanceOptions } from './types'
import { buildCommentTree } from './lib/comment-tree'

const props = withDefaults(
  defineProps<{
    envId: string
    appearance?: TwikeeAppearanceOptions
  }>(),
  {},
)

const appearance = computed(() => resolveAppearance(props.appearance))

const apiUrl = computed(() => {
  if (!props.envId) return ''
  return props.envId.startsWith('http') ? props.envId : `https://${props.envId}`
})

const currentUrl = ref('')
const page = ref(1)
const total = ref(0)
const pageSize = ref(10)
const submitError = ref<string | null>(null)

const { loading, error, comments, fetchComments, submitComment } = useTwikee({
  envId: props.envId,
  el: '#twikee-comment',
})

const commentsClosed = ref(false)
const masterTag = ref('博主')
const commentPlaceholder = ref('')

const fetchConfig = async () => {
  try {
    const res = await fetch(`${apiUrl.value}/api/config`)
    const cfg = await res.json()
    commentsClosed.value = cfg.COMMENTS_CLOSED === true
    if (cfg.MASTER_TAG) masterTag.value = String(cfg.MASTER_TAG)
    if (cfg.COMMENT_PLACEHOLDER) commentPlaceholder.value = String(cfg.COMMENT_PLACEHOLDER)
    const configured = Number(cfg.COMMENT_PAGE_SIZE)
    if (Number.isFinite(configured) && configured > 0)
      pageSize.value = Math.min(100, Math.max(1, Math.floor(configured)))
  } catch (e) {
    // 配置读不到时界面会停在默认态，留一条日志，否则排错毫无线索
    console.error('[Twikee] failed to load public config:', e)
  }
}

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const commentTree = computed(() => buildCommentTree(comments.value))

const loadComments = async () => {
  const data = await fetchComments(currentUrl.value, page.value, pageSize.value)
  total.value = data.total
  pageSize.value = data.pageSize
}

const handleSubmit = async (data: any): Promise<boolean> => {
  submitError.value = null
  try {
    const result = await submitComment({ ...data, url: currentUrl.value })
    if (result?.isSpam) {
      submitError.value = '评论已提交，等待博主审核后显示'
    }
    await loadComments()
    return true
  } catch {
    submitError.value = '评论发表失败，请稍后重试（内容已为你保留）'
    return false
  }
}

onMounted(async () => {
  currentUrl.value = window.location.pathname
  await fetchConfig()
  await loadComments()
  // Highlight specific comment when navigating from admin
  const hlId = new URLSearchParams(window.location.search).get('hl')
  if (hlId) {
    setTimeout(() => {
      const el = document.getElementById(`comment-${hlId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('tk-comment--highlight')
        setTimeout(() => el.classList.remove('tk-comment--highlight'), 1200)
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('hl')
      window.history.replaceState({}, '', url.toString())
    }, 800)
  }
})

watch(page, loadComments)
</script>

<template>
  <div
    id="twikee-comment"
    class="twikee-container max-w-3xl mx-auto"
    :data-appearance="appearance.preset"
    :data-submit-style="appearance.submit"
    :data-fields-layout="appearance.fieldsLayout"
    :data-header-divider="appearance.headerDivider"
    :data-input-focus-ring="appearance.inputFocusRing"
  >
    <div v-if="commentsClosed" class="mb-6 p-4 rounded-lg bg-muted text-center text-muted-foreground">评论已关闭</div>
    <div v-else class="mb-6">
      <TkSubmit
        :url="currentUrl"
        :appearance="appearance"
        :placeholder="commentPlaceholder"
        :on-submit="handleSubmit"
      />
      <p v-if="submitError" class="tk-comments-submit-error">{{ submitError }}</p>
    </div>

    <div class="tk-comments-header">
      <h3 class="tk-comments-title">
        评论
        <span v-if="total > 0" class="tk-comments-count">{{ total }}</span>
      </h3>
    </div>

    <div class="tk-comments">
      <TkComment
        v-for="(comment, index) in commentTree"
        :key="comment.id"
        :comment="comment"
        :all-comments="comments"
        :api-url="apiUrl"
        :master-tag="masterTag"
        :show-divider="index < commentTree.length - 1"
        :appearance="appearance"
        @load="loadComments"
      />
    </div>

    <div v-if="!loading && !error && commentTree.length === 0" class="tk-comments-empty">
      暂无评论，来发表第一条评论吧~
    </div>

    <div v-if="totalPages > 1" class="tk-comments-pagination">
      <Button variant="outline" size="sm" :disabled="page <= 1" @click="page--"> 上一页 </Button>
      <span class="tk-comments-page"> {{ page }} / {{ totalPages }} </span>
      <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="page++"> 下一页 </Button>
    </div>

    <div v-if="loading" class="tk-comments-loading" aria-live="polite" role="status">加载中...</div>

    <div v-if="error" class="tk-comments-error">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.twikee-container {
  --twikee-background: oklch(0.9818 0.0054 95.0986);
  --twikee-foreground: oklch(0.3438 0.0269 95.7226);
  --twikee-card: oklch(0.9665 0.0067 97.3521);
  --twikee-card-foreground: oklch(0.1908 0.002 106.5859);
  --twikee-popover: oklch(1 0 0);
  --twikee-popover-foreground: oklch(0.2671 0.0196 98.939);
  --twikee-primary: oklch(0.6171 0.1375 39.0427);
  --twikee-primary-foreground: oklch(1 0 0);
  --twikee-secondary: oklch(0.9245 0.0138 92.9892);
  --twikee-secondary-foreground: oklch(0.4334 0.0177 98.6048);
  --twikee-muted: oklch(0.9341 0.0153 90.239);
  --twikee-muted-foreground: oklch(0.5341 0.0078 97.4503);
  --twikee-accent: oklch(0.9245 0.0138 92.9892);
  --twikee-accent-foreground: oklch(0.2671 0.0196 98.939);
  --twikee-destructive: oklch(0.1908 0.002 106.5859);
  --twikee-destructive-foreground: oklch(1 0 0);
  --twikee-border: oklch(0.8847 0.0069 97.3627);
  --twikee-input: oklch(0.7621 0.0156 98.3528);
  --twikee-ring: oklch(0.6171 0.1375 39.0427);
  --twikee-radius: 0.75rem;
  --background: var(--twikee-background);
  --foreground: var(--twikee-foreground);
  --card: var(--twikee-card);
  --card-foreground: var(--twikee-card-foreground);
  --popover: var(--twikee-popover);
  --popover-foreground: var(--twikee-popover-foreground);
  --primary: var(--twikee-primary);
  --primary-foreground: var(--twikee-primary-foreground);
  --secondary: var(--twikee-secondary);
  --secondary-foreground: var(--twikee-secondary-foreground);
  --muted: var(--twikee-muted);
  --muted-foreground: var(--twikee-muted-foreground);
  --accent: var(--twikee-accent);
  --accent-foreground: var(--twikee-accent-foreground);
  --destructive: var(--twikee-destructive);
  --destructive-foreground: var(--twikee-destructive-foreground);
  --border: var(--twikee-border);
  --input: var(--twikee-input);
  --ring: var(--twikee-ring);
  --radius: var(--twikee-radius);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

.tk-comments-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.twikee-container[data-header-divider='false'] .tk-comments-header {
  border-bottom: none;
}

.tk-comments-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
}

.tk-comments-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: auto;
  height: auto;
  padding: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 0;
  background: transparent;
  color: var(--muted-foreground);
}

.tk-comments {
  display: flex;
  flex-direction: column;
}

.tk-comments-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.tk-comments-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.tk-comments-page {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

.tk-comments-loading {
  text-align: center;
  padding: 2rem 0;
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.tk-comments-error {
  text-align: center;
  padding: 2rem 0;
  color: var(--destructive);
  font-size: 0.875rem;
}

.tk-comments-submit-error {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--destructive, #ef4444);
}
</style>
