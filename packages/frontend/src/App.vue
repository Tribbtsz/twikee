<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useTwikee } from './composables/useTwikee'
import TkComment from './components/comment/TkComment.vue'
import TkSubmit from './components/comment/TkSubmit.vue'
import Button from './components/ui/Button.vue'
import { resolveAppearance } from './types'
import type { TwikeeAppearanceOptions } from './types'
import { buildCommentTree } from './lib/comment-tree'
import { saveEditToken } from './lib/edit-token'

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
const imageCdnUrl = ref('')
const imageMaxSizeMb = ref(5)

/**
 * 每页条数由服务端 COMMENT_PAGE_SIZE 决定，但列表请求不能排队等配置：
 * 这里把上一次从配置里读到的值记住（按 API 域分桶，同页嵌多个 widget 时
 * 互不干扰），首屏直接用记住的值发列表，配置回来后只有不一致才补一次。
 * 非首访（绝大多数）只发一次列表请求，也不会出现「先渲染 10 条再被换成
 * 配置条数」的闪烁。
 */
const PAGE_SIZE_KEY = 'twikee_page_size'

function pageSizeKey(apiUrl: string): string {
  return `${PAGE_SIZE_KEY}_${encodeURIComponent(apiUrl)}`
}

function readRememberedPageSize(apiUrl: string): number | null {
  try {
    const raw = localStorage.getItem(pageSizeKey(apiUrl))
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 1 && n <= 100 ? Math.floor(n) : null
  } catch {
    return null // 隐私模式 / 禁用存储：退化成每次都按默认值请求
  }
}

function rememberPageSize(apiUrl: string, size: number): void {
  try {
    localStorage.setItem(pageSizeKey(apiUrl), String(size))
  } catch {
    // 写不进去只是下次首屏多一次列表请求，不影响功能
  }
}

const fetchConfig = async (): Promise<number | null> => {
  try {
    const res = await fetch(`${apiUrl.value}/api/config`)
    const cfg = await res.json()
    commentsClosed.value = cfg.COMMENTS_CLOSED === true
    if (cfg.MASTER_TAG) masterTag.value = String(cfg.MASTER_TAG)
    if (cfg.COMMENT_PLACEHOLDER) commentPlaceholder.value = String(cfg.COMMENT_PLACEHOLDER)
    if (cfg.IMAGE_CDN) imageCdnUrl.value = String(cfg.IMAGE_CDN)
    const maxSize = Number(cfg.MAX_IMAGE_SIZE)
    if (Number.isFinite(maxSize) && maxSize > 0) imageMaxSizeMb.value = Math.floor(maxSize)
    const configured = Number(cfg.COMMENT_PAGE_SIZE)
    if (Number.isFinite(configured) && configured > 0) return Math.min(100, Math.max(1, Math.floor(configured)))
    return null
  } catch (e) {
    // 配置读不到时界面会停在默认态，留一条日志，否则排错毫无线索
    console.error('[Twikee] failed to load public config:', e)
    return null
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
    // 服务端随创建响应返回 editToken：30 分钟内可凭它编辑/删除这条评论
    if (result?.id && result?.editToken) saveEditToken(result.id, result.editToken)
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
  // 先用本地记住的每页条数，配置和列表并发发出去，先到的那个触发函数冷启动
  const remembered = readRememberedPageSize(apiUrl.value)
  if (remembered) pageSize.value = remembered
  const configuredPageSize = fetchConfig()
  await loadComments()
  // 配置里的每页条数跟这次列表用的不一致（首访，或博主刚改过）才补一次；
  // 记住之后同一访问者再来就只发一次列表请求
  const size = await configuredPageSize
  if (size && size !== pageSize.value) {
    pageSize.value = size
    rememberPageSize(apiUrl.value, size)
    await loadComments()
  }
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
  <!-- 根节点只挂 .twikee-container（主题变量 + 外观 data-* 的载体）。
       布局类放在里面这层 div 上：widget.css 把工具类输出成
       .twikee-container .xxx 的前缀选择器（避免覆盖宿主页面的同名类），
       作用不到根元素自己身上。 -->
  <div
    id="twikee-comment"
    class="twikee-container"
    :data-appearance="appearance.preset"
    :data-submit-style="appearance.submit"
    :data-fields-layout="appearance.fieldsLayout"
    :data-header-divider="appearance.headerDivider"
    :data-input-focus-ring="appearance.inputFocusRing"
  >
    <div class="max-w-3xl mx-auto">
      <div v-if="commentsClosed" class="mb-6 p-4 rounded-lg bg-muted text-center text-muted-foreground">评论已关闭</div>
      <div v-else class="mb-6">
        <TkSubmit
          :url="currentUrl"
          :appearance="appearance"
          :placeholder="commentPlaceholder"
          :image-upload="{ url: imageCdnUrl, maxSizeMb: imageMaxSizeMb }"
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
  </div>
</template>

<style scoped>
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
