<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import { 
  Eye, EyeOff, Trash2, Pin, PinOff, RefreshCw, Search, 
  ArrowLeft, FileText, MessageSquare, ExternalLink 
} from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
  token: string
  siteUrl?: string
}>()

const emit = defineEmits<{
  refresh: []
  logout: []
}>()

const checkAuth = (res: Response) => {
  if (res.status === 401) {
    emit('logout')
    return false
  }
  return true
}

const pages = ref<{ url: string; count: number; spamCount: number; lastComment: number }[]>([])
const loadingPages = ref(false)

const comments = ref<any[]>([])
const loadingComments = ref(false)
const currentUrl = ref<string | null>(null)

const pagesPage = ref(1)
const pagesPageSize = ref(20)
const pagesTotal = ref(0)
const pagesTotalPages = computed(() => Math.ceil(pagesTotal.value / pagesPageSize.value))
const pagesSearchQuery = ref('')

const commentsPage = ref(1)
const commentsPageSize = ref(20)
const commentsTotal = ref(0)
const commentsTotalPages = computed(() => Math.ceil(commentsTotal.value / commentsPageSize.value))

type StatusTab = 'all' | 'approved' | 'spam'
const activeTab = ref<StatusTab>('all')
const tabs: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'approved', label: '已发布' },
  { key: 'spam', label: '待审核' },
]

const fetchPages = async () => {
  loadingPages.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/pages`, {
      headers: { Authorization: `Bearer ${props.token}` }
    })
    if (!checkAuth(res)) return
    const data = await res.json()
    pages.value = data.data || []
    pagesTotal.value = data.total || pages.value.length
  } catch (e) {
    console.error('获取页面列表失败', e)
  } finally {
    loadingPages.value = false
  }
}

const fetchComments = async (url: string) => {
  loadingComments.value = true
  try {
    const params = new URLSearchParams({
      url,
      page: commentsPage.value.toString(),
      pageSize: commentsPageSize.value.toString(),
      includeSpam: 'true',
    })
    const res = await fetch(
      `${props.apiUrl}/api/admin/comments?${params}`,
      { headers: { Authorization: `Bearer ${props.token}` } }
    )
    if (!checkAuth(res)) return
    const data = await res.json()
    comments.value = data.data || []
    commentsTotal.value = data.total || 0
  } catch (e) {
    console.error('获取评论失败', e)
  } finally {
    loadingComments.value = false
  }
}

const viewPageComments = (url: string) => {
  currentUrl.value = url
  commentsPage.value = 1
  activeTab.value = 'all'
  fetchComments(url)
}

const backToPages = () => {
  currentUrl.value = null
  comments.value = []
}

const switchTab = (tab: StatusTab) => {
  activeTab.value = tab
  commentsPage.value = 1
  if (currentUrl.value) fetchComments(currentUrl.value)
}

const filteredComments = computed(() => {
  if (activeTab.value === 'all') return comments.value
  if (activeTab.value === 'spam') return comments.value.filter(c => c.isSpam)
  return comments.value.filter(c => !c.isSpam)
})

const tabCounts = computed(() => {
  const all = comments.value.length
  const spam = comments.value.filter(c => c.isSpam).length
  const approved = all - spam
  return { all, approved, spam }
})

const moderate = async (id: string, action: 'approve' | 'spam' | 'delete') => {
  if (action === 'delete') {
    if (!window.confirm('确定要删除这条评论吗？此操作不可恢复。')) return
  }
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/comment/${id}/moderate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action })
    })
    if (!checkAuth(res)) return
    await fetchComments(currentUrl.value!)
    emit('refresh')
  } catch (e) {
    console.error('操作失败', e)
  }
}

const toggleTop = async (id: string, top: boolean) => {
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/comment/${id}/top`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ top })
    })
    if (!checkAuth(res)) return
    await fetchComments(currentUrl.value!)
  } catch (e) {
    console.error('操作失败', e)
  }
}

const displayTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const displayUrl = (url: string) => {
  return url.length > 50 ? url.substring(0, 50) + '...' : url
}

const getPageUrl = (comment: any) => {
  if (!comment.url) return null
  if (props.siteUrl) {
    return `${props.siteUrl}${comment.url}`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${comment.url}`
  }
  return comment.url
}

const filteredPages = computed(() => {
  if (!pagesSearchQuery.value) {
    const start = (pagesPage.value - 1) * pagesPageSize.value
    return pages.value.slice(start, start + pagesPageSize.value)
  }
  const filtered = pages.value.filter(p => 
    p.url.toLowerCase().includes(pagesSearchQuery.value.toLowerCase())
  )
  const start = (pagesPage.value - 1) * pagesPageSize.value
  return filtered.slice(start, start + pagesPageSize.value)
})

const filteredPagesTotal = computed(() => {
  if (!pagesSearchQuery.value) return pages.value.length
  return pages.value.filter(p => 
    p.url.toLowerCase().includes(pagesSearchQuery.value.toLowerCase())
  ).length
})

const filteredPagesTotalPages = computed(() => Math.ceil(filteredPagesTotal.value / pagesPageSize.value))

onMounted(fetchPages)
watch(commentsPage, () => {
  if (currentUrl.value) fetchComments(currentUrl.value)
})
watch(pagesPage, () => {}, { flush: 'post' })
</script>

<template>
  <div class="space-y-4">
    <div v-if="!currentUrl">
      <div class="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div>
          <h2 class="text-xl font-semibold">页面管理</h2>
          <p class="text-sm text-muted-foreground mt-1">
            共 {{ pages.length }} 个页面，{{ pages.reduce((sum, p) => sum + p.count, 0) }} 条评论
          </p>
        </div>
        <div class="flex gap-2 items-center">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input v-model="pagesSearchQuery" placeholder="搜索页面..." class="pl-9 w-48" />
          </div>
          <Button variant="outline" size="sm" @click="fetchPages">
            <RefreshCw class="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div v-if="loadingPages" class="text-center py-8 text-muted-foreground">加载中...</div>
      
      <div v-else class="space-y-2">
        <Card 
          v-for="p in filteredPages" 
          :key="p.url"
          class="cursor-pointer hover:shadow-md transition-shadow"
          @click="viewPageComments(p.url)"
        >
          <CardContent class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="p-2 bg-primary/10 rounded-lg shrink-0">
                  <FileText class="w-5 h-5 text-primary" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate" :title="p.url">{{ displayUrl(p.url) }}</div>
                  <div class="text-xs text-muted-foreground mt-1">
                    最后评论: {{ displayTime(p.lastComment) }}
                  </div>
                </div>
              </div>
              
              <div class="flex items-center gap-4 shrink-0">
                <div class="text-center">
                  <div class="text-lg font-bold">{{ p.count }}</div>
                  <div class="text-xs text-muted-foreground">评论</div>
                </div>
                <Badge v-if="p.spamCount > 0" variant="destructive">{{ p.spamCount }} 待审核</Badge>
                <MessageSquare class="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div v-if="filteredPages.length === 0" class="text-center py-8 text-muted-foreground">
          {{ pagesSearchQuery ? '未找到匹配的页面' : '暂无评论' }}
        </div>

        <div v-if="filteredPagesTotalPages > 1" class="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" :disabled="pagesPage <= 1" @click="pagesPage--">
            上一页
          </Button>
          <span class="text-sm text-muted-foreground">
            {{ pagesPage }} / {{ filteredPagesTotalPages }}
          </span>
          <Button variant="outline" size="sm" :disabled="pagesPage >= filteredPagesTotalPages" @click="pagesPage++">
            下一页
          </Button>
        </div>
      </div>
    </div>
    
    <div v-else>
      <div class="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="sm" @click="backToPages">
            <ArrowLeft class="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h2 class="text-xl font-semibold">评论列表</h2>
            <p class="text-sm text-muted-foreground">{{ currentUrl }}</p>
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <Button variant="outline" size="sm" @click="fetchComments(currentUrl!)">
            <RefreshCw class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div class="flex gap-1 border-b">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
          :class="activeTab === tab.key 
            ? 'border-primary text-primary' 
            : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'spam' && tabCounts.spam > 0" class="ml-1 text-xs">({{ tabCounts.spam }})</span>
        </button>
      </div>
      
      <div v-if="loadingComments" class="text-center py-8 text-muted-foreground">加载中...</div>
      
      <div v-else class="space-y-3 mt-3">
        <Card v-for="comment in filteredComments" :key="comment.id">
          <CardContent class="p-4">
            <div class="flex justify-between items-start gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium">{{ comment.nick }}</span>
                  <span v-if="comment.mail" class="text-sm text-muted-foreground">{{ comment.mail }}</span>
                  <Badge v-if="comment.master" variant="default">博主</Badge>
                  <Badge v-if="comment.top" variant="secondary">置顶</Badge>
                  <span v-if="comment.pinnedFromId" class="text-xs text-muted-foreground">回复自评论</span>
                  <Badge v-if="comment.isSpam" variant="destructive">待审核</Badge>
                </div>
                <div class="mt-2 text-sm break-words">{{ comment.content }}</div>
                <div class="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  {{ displayTime(comment.createdAt) }}
                  <span v-if="comment.ip"> · IP: {{ comment.ip }}</span>
                  <a
                    v-if="getPageUrl(comment)"
                    :href="getPageUrl(comment)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink class="w-3 h-3" />
                    查看页面
                  </a>
                </div>
              </div>
              
              <div class="flex gap-1 shrink-0">
                <Button v-if="comment.isSpam" variant="ghost" size="sm" @click="moderate(comment.id, 'approve')">
                  <Eye class="w-4 h-4" />
                </Button>
                <Button v-else variant="ghost" size="sm" @click="moderate(comment.id, 'spam')">
                  <EyeOff class="w-4 h-4" />
                </Button>
                <Button v-if="!comment.top" variant="ghost" size="sm" @click="toggleTop(comment.id, true)">
                  <Pin class="w-4 h-4" />
                </Button>
                <Button v-else variant="ghost" size="sm" @click="toggleTop(comment.id, false)">
                  <PinOff class="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" @click="moderate(comment.id, 'delete')">
                  <Trash2 class="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div v-if="filteredComments.length === 0" class="text-center py-8 text-muted-foreground">
          {{ activeTab === 'spam' ? '暂无待审核评论' : activeTab === 'approved' ? '暂无已发布评论' : '暂无评论' }}
        </div>

        <div v-if="commentsTotalPages > 1" class="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" :disabled="commentsPage <= 1" @click="commentsPage--">
            上一页
          </Button>
          <span class="text-sm text-muted-foreground">
            {{ commentsPage }} / {{ commentsTotalPages }}
          </span>
          <Button variant="outline" size="sm" :disabled="commentsPage >= commentsTotalPages" @click="commentsPage++">
            下一页
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
