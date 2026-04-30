<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import TkComment from './components/comment/TkComment.vue'
import TkSubmit from './components/comment/TkSubmit.vue'
import Button from './components/ui/Button.vue'
import Card from './components/ui/Card.vue'
import CardHeader from './components/ui/CardHeader.vue'
import CardContent from './components/ui/CardContent.vue'
import { useTwikoo } from './composables/useTwikoo'
import { MessageSquare, Calendar, Eye } from 'lucide-vue-next'

const envId = ref((window as any).TWIKOO_API_URL || 'http://localhost:3001')
const currentUrl = ref('')
const page = ref(1)
const total = ref(0)
const pageSize = ref(10)
const replyingTo = ref<string | null>(null)

const { loading, error, comments, fetchComments, submitComment } = useTwikoo({
  envId: envId.value,
  el: '#twikee-comment',
  lang: 'zh-CN',
  dark: 'auto'
})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const buildCommentTree = (commentsList: any[]) => {
  if (!Array.isArray(commentsList)) return []
  
  const commentMap = new Map<string, any>()
  const rootComments: any[] = []
  
  commentsList.forEach(comment => {
    commentMap.set(comment.id, { ...comment, children: [] })
  })
  
  commentsList.forEach(comment => {
    const node = commentMap.get(comment.id)
    if (comment.rid) {
      const parent = commentMap.get(comment.rid)
      if (parent) {
        parent.children.push(node)
      } else {
        rootComments.push(node)
      }
    } else {
      rootComments.push(node)
    }
  })
  
  return rootComments
}

const commentTree = computed(() => buildCommentTree(comments.value))

const loadComments = async () => {
  const data = await fetchComments(currentUrl.value, page.value)
  total.value = data.total
  pageSize.value = data.pageSize
}

const handleSubmit = async (data: any) => {
  await submitComment({ ...data, url: currentUrl.value })
  await loadComments()
}

onMounted(() => {
  currentUrl.value = window.location.pathname
  loadComments()
})

watch(page, loadComments)
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="border-b bg-card sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <h1 class="text-xl font-bold text-center">Twikee 评论系统</h1>
        <p class="text-sm text-muted-foreground text-center mt-1">
          基于 Vue 3 + Hono + Turso 构建的现代化评论系统
        </p>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-6">
      <Card class="mb-6">
        <CardHeader>
          <h2 class="text-lg font-semibold">欢迎使用 Twikee 评论系统</h2>
        </CardHeader>
        <CardContent>
          <p class="text-muted-foreground leading-relaxed mb-4">
            这是一个现代化的评论系统，支持实时评论、点赞、回复、Markdown 语法、代码高亮等功能。
            采用 Vue 3 + Vite + Tailwind CSS 4 构建前端，Hono.js 构建后端 API，
            Turso 作为数据库存储。
          </p>
          <p class="text-sm text-muted-foreground mb-4">
            技术栈：Vue 3、Vite、Tailwind CSS 4、shadcn/ui 风格组件、Hono.js、Turso (libSQL)
          </p>
          <div class="flex gap-4 text-sm text-muted-foreground">
            <span class="flex items-center gap-1">
              <Calendar class="w-4 h-4" />
              2025-04-30
            </span>
            <span class="flex items-center gap-1">
              <Eye class="w-4 h-4" />
              1.2k 阅读
            </span>
            <span class="flex items-center gap-1">
              <MessageSquare class="w-4 h-4" />
              评论系统演示
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="p-4">
          <div id="twikee-comment" class="twikee-container">
            <div class="mb-6">
              <TkSubmit
                :url="currentUrl"
                @submit="handleSubmit"
              />
            </div>
            
            <div class="space-y-4">
              <TkComment
                v-for="comment in commentTree"
                :key="comment.id"
                :comment="comment"
                :all-comments="comments"
                @load="loadComments"
              />
            </div>
            
            <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                :disabled="page <= 1"
                @click="page--"
              >
                上一页
              </Button>
              <span class="flex items-center text-sm text-muted-foreground px-2">
                {{ page }} / {{ totalPages }}
              </span>
              <Button
                variant="outline"
                size="sm"
                :disabled="page >= totalPages"
                @click="page++"
              >
                下一页
              </Button>
            </div>
            
            <div v-if="loading" class="text-center py-8 text-muted-foreground">
              加载中...
            </div>
            
            <div v-if="error" class="text-center py-8 text-destructive">
              {{ error }}
              <div class="text-sm mt-2">请确保后端服务运行在 {{ envId }}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>

    <footer class="border-t py-6 mt-8">
      <div class="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
        <a 
          href="https://github.com/twikoojs/twikoo" 
          target="_blank"
          class="text-primary hover:underline"
        >
          GitHub
        </a>
        <span class="mx-2">·</span>
        <span>由 Twikee 驱动</span>
        <span class="mx-2">·</span>
        <span>MIT License</span>
      </div>
    </footer>
  </div>
</template>
