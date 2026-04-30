<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLogin from './AdminLogin.vue'
import AdminComments from './AdminComments.vue'
import AdminConfig from './AdminConfig.vue'
import AdminImportExport from './AdminImportExport.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { MessageSquare, Settings, LogOut, BarChart3, Database } from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
}>()

const token = ref(localStorage.getItem('twikee_admin_token') || '')
const activeTab = ref('comments')
const stats = ref({ total: 0, approved: 0, pending: 0 })

const isLoggedIn = computed(() => !!token.value)

const handleLogin = (newToken: string) => {
  token.value = newToken
  localStorage.setItem('twikee_admin_token', newToken)
}

const handleLogout = () => {
  token.value = ''
  localStorage.removeItem('twikee_admin_token')
}

const fetchStats = async () => {
  if (!token.value) return
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    const data = await res.json()
    stats.value = data
  } catch (e) {
    console.error('获取统计失败', e)
  }
}

onMounted(fetchStats)

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
        <h1 class="text-xl font-bold">Twikoo 管理后台</h1>
        <div class="flex items-center gap-4">
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
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
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
        
        <Card>
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
        
        <Card>
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
        @refresh="fetchStats"
      />
      
      <AdminConfig
        v-if="activeTab === 'config'"
        :api-url="apiUrl"
        :token="token"
      />
      
      <AdminImportExport
        v-if="activeTab === 'data'"
        :api-url="apiUrl"
        :token="token"
      />
    </main>
  </div>
</template>
