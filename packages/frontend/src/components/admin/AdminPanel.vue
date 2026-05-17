<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLogin from './AdminLogin.vue'
import AdminComments from './AdminComments.vue'
import AdminConfig from './AdminConfig.vue'
import AdminImportExport from './AdminImportExport.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { MessageSquare, Settings, LogOut, BarChart3, Database, ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
}>()

const token = ref(localStorage.getItem('twikee_admin_token') || '')
const activeTab = ref('comments')
const stats = ref({ total: 0, approved: 0, pending: 0 })
const siteUrl = ref('')
const commentsClosed = ref(false)

const isLoggedIn = computed(() => !!token.value)

const handleLogin = (newToken: string) => {
  token.value = newToken
  localStorage.setItem('twikee_admin_token', newToken)
}

const handleLogout = () => {
  token.value = ''
  localStorage.removeItem('twikee_admin_token')
}

const checkAuth = (res: Response) => {
  if (res.status === 401) {
    handleLogout()
    return false
  }
  return true
}

const fetchCommentsClosed = async () => {
  if (!token.value) return
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    if (!checkAuth(res)) return
    const data = await res.json()
    commentsClosed.value = data.COMMENTS_CLOSED === 'true'
  } catch {}
}

const toggleCommentsClosed = async () => {
  const newValue = !commentsClosed.value
  if (newValue && !window.confirm('确定要关闭评论吗？所有新评论将被拒绝。')) return
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ COMMENTS_CLOSED: newValue.toString() })
    })
    if (!checkAuth(res)) return
    commentsClosed.value = newValue
  } catch {}
}

const fetchStats = async () => {
  if (!token.value) return
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    if (!checkAuth(res)) return
    const data = await res.json()
    stats.value = data
  } catch (e) {
    console.error('获取统计失败', e)
  }
}

const fetchSiteUrl = async () => {
  if (!token.value) return
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    siteUrl.value = window.location.origin
    return
  }
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    if (!checkAuth(res)) return
    const data = await res.json()
    siteUrl.value = (data.SITE_URL || '').replace(/\/$/, '')
  } catch (e) {
    console.error('获取配置失败', e)
  }
}

onMounted(() => {
  fetchStats()
  fetchSiteUrl()
  fetchCommentsClosed()
})

const tabs = [
  { key: 'comments', label: '评论管理', icon: MessageSquare },
  { key: 'config', label: '系统配置', icon: Settings },
  { key: 'data', label: '数据管理', icon: Database },
]
</script>

<template>
  <div v-if="!isLoggedIn" class="min-h-screen bg-background">
    <AdminLogin :api-url="apiUrl" @login="handleLogin" />
  </div>
  
  <div v-else class="min-h-screen bg-background">
    <header class="border-b bg-card sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 class="text-xl font-bold">Twikee 管理后台 <span v-if="commentsClosed" class="text-base  font-bold text-red-500 ml-6 bg-red-200 py-2 px-4 rounded-full">已关停</span></h1>
        <div class="flex items-center gap-4">
          <a href="/demo.html" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
            <ArrowLeft class="w-4 h-4" />
            返回演示
          </a>
          <span class="text-sm text-muted-foreground">{{ stats.total }} 条评论</span>
          <Button variant="ghost" size="sm" @click="handleLogout">
            <LogOut class="w-4 h-4 mr-2" />
            退出
          </Button>
        </div>
      </div>
    </header>
    
    <main class="max-w-6xl mx-auto px-4 py-6">
      <!-- 统计卡片 -->
      <div class="flex gap-4 mb-6 items-stretch">
        <Card class="flex-1">
          <CardContent class="p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-primary/10 rounded-lg">
                <MessageSquare class="w-5 h-5 text-primary" />
              </div>
              <div>
                <div class="text-2xl font-bold">{{ stats.total }}</div>
                <div class="text-sm text-muted-foreground">总评论数</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="flex-1">
          <CardContent class="p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-green-500/10 rounded-lg">
                <BarChart3 class="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div class="text-2xl font-bold">{{ stats.approved }}</div>
                <div class="text-sm text-muted-foreground">已通过</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="flex-1">
          <CardContent class="p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-yellow-500/10 rounded-lg">
                <BarChart3 class="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <div class="text-2xl font-bold">{{ stats.pending }}</div>
                <div class="text-sm text-muted-foreground">待审核</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div
          class="w-24 shrink-0 cursor-pointer transition-all rounded-lg flex flex-col items-center justify-center gap-1"
          :class="commentsClosed
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-destructive text-destructive-foreground hover:opacity-90'"
          @click="toggleCommentsClosed"
        >
          <ShieldCheck v-if="commentsClosed" class="w-5 h-5" />
          <ShieldAlert v-else class="w-5 h-5" />
          <div class="text-xs font-medium">{{ commentsClosed ? '一键开启' : '一键关停' }}</div>
        </div>
      </div>
      
      <!-- 标签页 -->
      <div class="flex gap-2 mb-4 border-b pb-4">
        <Button
          v-for="tab in tabs"
          :key="tab.key"
          :variant="activeTab === tab.key ? 'default' : 'ghost'"
          size="sm"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" class="w-4 h-4 mr-2" />
          {{ tab.label }}
        </Button>
      </div>
      
      <!-- 内容区域 -->
      <AdminComments
        v-if="activeTab === 'comments'"
        :api-url="apiUrl"
        :token="token"
        :site-url="siteUrl"
        @refresh="fetchStats"
        @logout="handleLogout"
      />
      
      <AdminConfig
        v-if="activeTab === 'config'"
        :api-url="apiUrl"
        :token="token"
        @logout="handleLogout"
      />
      
      <AdminImportExport
        v-if="activeTab === 'data'"
        :api-url="apiUrl"
        :token="token"
      />
    </main>
  </div>
</template>
