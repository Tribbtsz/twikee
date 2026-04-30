<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { Upload, Download, CheckCircle } from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
  token: string
}>()

const importing = ref(false)
const exporting = ref(false)
const importResult = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const handleExport = async () => {
  exporting.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/comments/all?pageSize=10000`, {
      headers: { Authorization: `Bearer ${props.token}` }
    })
    const data = await res.json()
    
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `twikee-comments-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('导出失败', e)
  } finally {
    exporting.value = false
  }
}

const handleImport = () => {
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  importing.value = true
  importResult.value = ''
  
  try {
    const text = await file.text()
    const comments = JSON.parse(text)
    
    if (!Array.isArray(comments)) {
      throw new Error('Invalid format')
    }
    
    let success = 0
    let failed = 0
    
    for (const comment of comments) {
      try {
        await fetch(`${props.apiUrl}/api/comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: comment.url,
            nick: comment.nick,
            mail: comment.mail,
            link: comment.link,
            content: comment.content,
            rid: comment.rid,
            pid: comment.pid
          })
        })
        success++
      } catch {
        failed++
      }
    }
    
    importResult.value = `导入完成：成功 ${success} 条，失败 ${failed} 条`
  } catch (e) {
    importResult.value = '导入失败：文件格式错误'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">数据管理</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <h3 class="font-medium flex items-center gap-2">
            <Download class="w-4 h-4" />
            导出评论
          </h3>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground mb-4">
            将所有评论导出为 JSON 文件，可用于备份或迁移。
          </p>
          <Button @click="handleExport" :disabled="exporting">
            {{ exporting ? '导出中...' : '导出评论' }}
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <h3 class="font-medium flex items-center gap-2">
            <Upload class="w-4 h-4" />
            导入评论
          </h3>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground mb-4">
            从 JSON 文件导入评论数据，支持从旧版 Twikoo 迁移。
          </p>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleFileChange"
          />
          <Button @click="handleImport" :disabled="importing">
            {{ importing ? '导入中...' : '选择文件' }}
          </Button>
          <div v-if="importResult" class="mt-4 text-sm flex items-center gap-2">
            <CheckCircle class="w-4 h-4 text-green-500" />
            {{ importResult }}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
