import type { Ref } from 'vue'
import { ref, computed } from 'vue'

export interface TwikooOptions {
  envId: string
  el: string | Element
  lang?: 'zh-CN' | 'en-US'
  dark?: 'auto' | 'light' | 'dark'
}

export function useTwikoo(options: TwikooOptions) {
  const loading = ref(true)
  const error = ref<string | null>(null)
  const comments = ref<any[]>([])
  const config = ref<Record<string, any>>({})
  
  const baseUrl = computed(() => {
    let url = options.envId
    if (!url.startsWith('http')) {
      url = `https://${url}`
    }
    return url
  })
  
  const fetchComments = async (url: string, page = 1) => {
    try {
      loading.value = true
      const res = await fetch(`${baseUrl.value}/api/comment?url=${encodeURIComponent(url)}&page=${page}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      comments.value = data.data || []
      return {
        data: data.data || [],
        total: data.total || 0,
        page: data.page || 1,
        pageSize: data.pageSize || 10
      }
    } catch (e) {
      error.value = '加载评论失败'
      console.error('[Twikoo] Failed to fetch comments:', e)
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10
      }
    } finally {
      loading.value = false
    }
  }
  
  const submitComment = async (data: {
    url: string
    nick: string
    mail?: string
    link?: string
    content: string
    rid?: string
  }) => {
    try {
      const res = await fetch(`${baseUrl.value}/api/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const result = await res.json()
      return result
    } catch (e) {
      console.error('[Twikoo] Failed to submit comment:', e)
      throw e
    }
  }
  
  return {
    loading,
    error,
    comments,
    config,
    fetchComments,
    submitComment
  }
}
