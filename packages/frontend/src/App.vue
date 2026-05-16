<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useTwikee } from './composables/useTwikee'
import TkComment from './components/comment/TkComment.vue'
import TkSubmit from './components/comment/TkSubmit.vue'
import Button from './components/ui/Button.vue'
import './styles/index.css'

const props = withDefaults(defineProps<{
  envId: string
  lang?: 'zh-CN' | 'en-US'
  dark?: 'auto' | 'light' | 'dark'
}>(), {
  lang: 'zh-CN',
  dark: 'auto'
})

const currentUrl = ref('')
const page = ref(1)
const total = ref(0)
const pageSize = ref(10)
const replyingTo = ref<string | null>(null)

const { loading, comments, fetchComments, submitComment } = useTwikee({
  envId: props.envId,
  el: '#twikee-comment',
  lang: props.lang,
  dark: props.dark
})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const buildCommentTree = (commentsList: any[]) => {
  if (!Array.isArray(commentsList)) return []
  const commentMap = new Map<string, any>()
  const rootComments: any[] = []

  commentsList.forEach(comment => {
    commentMap.set(comment.id, { ...comment, children: [], replyToNick: '' })
  })

  commentsList.forEach(comment => {
    const node = commentMap.get(comment.id)
    if (comment.rid) {
      const rootId = findRootId(comment.rid, commentMap)
      const root = commentMap.get(rootId)
      if (root && rootId !== comment.id) {
        const parentComment = commentMap.get(comment.rid)
        node.replyToNick = parentComment ? parentComment.nick : ''
        root.children.push(node)
      } else {
        rootComments.push(node)
      }
    } else {
      rootComments.push(node)
    }
  })

  return rootComments
}

const findRootId = (rid: string, commentMap: Map<string, any>): string => {
  let current = commentMap.get(rid)
  let currentId = rid
  while (current && current.rid) {
    currentId = current.id
    current = commentMap.get(current.rid)
  }
  return current ? current.id : rid
}

const commentTree = computed(() => buildCommentTree(comments.value))

const loadComments = async () => {
  const data = await fetchComments(currentUrl.value, page.value)
  total.value = data.total
  pageSize.value = data.pageSize
}

const handleSubmit = async (data: any) => {
  await submitComment({ ...data, url: currentUrl.value })
  replyingTo.value = null
  await loadComments()
}

const handleReply = (id: string) => {
  replyingTo.value = id
}

onMounted(() => {
  currentUrl.value = window.location.pathname
  loadComments()
})

watch(page, loadComments)
</script>

<template>
  <div id="twikee-comment" class="twikee-container max-w-3xl mx-auto">
    <div class="mb-6">
      <TkSubmit
        v-if="!replyingTo"
        :url="currentUrl"
        @submit="handleSubmit"
      />
    </div>

    <div class="space-y-4">
      <TkComment
        v-for="comment in commentTree"
        :key="comment.id"
        :comment="comment"
        :replying="replyingTo === comment.id"
        @reply="handleReply"
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
      <span class="flex items-center text-sm text-muted-foreground">
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
  </div>
</template>
