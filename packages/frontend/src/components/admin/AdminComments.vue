<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import { 
  Eye, EyeOff, Trash2, Pin, PinOff, RefreshCw, Search, 
  ArrowLeft, FileText, MessageSquare 
} from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
  token: string
}>()

const emit = defineEmits<{
  refresh: []
}>()

// 页面列表
const pages = ref<{ url: string; count: number; spamCount: number; lastComment: number }[]>([])
const loadingPages = ref(false)

// 评论列表
const comments = ref<any[]>([])
const loadingComments = ref(false)
const currentUrl = ref<string | null>(null)

// 分页和筛选
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const includeSpam = ref(false)
const searchQuery = ref('')

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

// 获取页面列表
const fetchPages = async () => {
  loadingPages.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/pages`, {
      headers: { Authorization: `Bearer ${props.token}` }
    })
    const data = await res.json()
    pages.value = data.data || []
  } catch (e) {
    console.error('获取页面列表失败', e)
  } finally {
    loadingPages.value = false
  }
}

// 获取某个页面的评论
const fetchComments = async (url: string) => {
  loadingComments.value = true
  try {
    const params = new URLSearchParams({
      url,
      pageSize: '1000',
      includeSpam: includeSpam.value.toString(),
    })
    const res = await fetch(
      `${props.apiUrl}/api/admin/comments?${params}`,
      { headers: { Authorization: `Bearer ${props.token}` } }
    )
    const data = await res.json()
    comments.value = data.data || []
    total.value = data.total || 0
  } catch (e) {
    console.error('获取评论失败', e)
  } finally {
    loadingComments.value = false
  }
}

const viewPageComments = (url: string) => {
  currentUrl.value = url
  page.value = 1
  fetchComments(url)
}

const backToPages = () => {
  currentUrl.value = null
  comments.value = []
}

const moderate = async (id: string, action: 'approve' | 'spam' | 'delete') => {
  if (action === 'delete') {
    if (!window.confirm('确定要删除这条评论吗？此操作不可恢复。')) return
  }
  try {
    await fetch(`${props.apiUrl}/api/admin/comment/${id}/moderate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action })
    })
    await fetchComments(currentUrl.value!)
    emit('refresh')
  } catch (e) {
    console.error('操作失败', e)
  }
}

const toggleTop = async (id: string, top: boolean) => {
  try {
    await fetch(`${props.apiUrl}/api/admin/comment/${id}/top`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ top })
    })
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

const filteredPages = computed(() => {
  if (!searchQuery.value) return pages.value
  return pages.value.filter(p => 
    p.url.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

onMounted(fetchPages)
watch(includeSpam, () => {
  if (currentUrl.value) fetchComments(currentUrl.value)
})
</script>

<template>
  <div class="space-y-4">
    <!-- 页面列表视图 -->
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
            <Input v-model="searchQuery" placeholder="搜索页面..." class="pl-9 w-48" />
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
          {{ searchQuery ? '未找到匹配的页面' : '暂无评论' }}
        </div>
      </div>
    </div>
    
    <!-- 评论列表视图 -->
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
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="includeSpam" class="rounded" />
            显示待审核
          </label>
          <Button variant="outline" size="sm" @click="fetchComments(currentUrl)">
            <RefreshCw class="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div v-if="loadingComments" class="text-center py-8 text-muted-foreground">加载中...</div>
      
      <div v-else class="space-y-3">
        <Card v-for="comment in comments" :key="comment.id">
          <CardContent class="p-4">
            <div class="flex justify-between items-start gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium">{{ comment.nick }}</span>
                  <span v-if="comment.mail" class="text-sm text-muted-foreground">{{ comment.mail }}</span>
                  <Badge v-if="comment.master" variant="default">博主</Badge>
                  <Badge v-if="comment.top" variant="secondary">置顶</Badge>
                  <Badge v-if="comment.isSpam" variant="destructive">待审核</Badge>
                </div>
                <div class="mt-2 text-sm break-words">{{ comment.content }}</div>
                <div class="mt-2 text-xs text-muted-foreground">
                  {{ displayTime(comment.createdAt) }}
                  <span v-if="comment.ip"> · IP: {{ comment.ip }}</span>
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
        
        <div v-if="comments.length === 0" class="text-center py-8 text-muted-foreground">该页面暂无评论</div>
      </div>
    </div>
  </div>
</template>
