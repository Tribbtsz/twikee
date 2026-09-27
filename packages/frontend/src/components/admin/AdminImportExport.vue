<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
  token: string
}>()

const emit = defineEmits<{
  logout: []
}>()

const importing = ref(false)
const exporting = ref(false)
const importResult = ref('')
const importFailed = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const checkAuth = (res: Response) => {
  if (res.status === 401) {
    emit('logout')
    return false
  }
  return true
}

/** 服务端单页上限是 100，超出的 pageSize 会直接被 zod 拒掉 */
const EXPORT_PAGE_SIZE = 100

const handleExport = async () => {
  exporting.value = true
  importFailed.value = false
  try {
    // 分页拉全量：pageSize=10000 会被 validation.ts 的 max(100) 拒绝（400），
    // 旧代码不检查 res.ok，最终导出内容就是字符串 "undefined"
    const all: unknown[] = []
    let page = 1
    let totalPages = 1
    do {
      const res = await fetch(
        `${props.apiUrl}/api/admin/comments/all?page=${page}&pageSize=${EXPORT_PAGE_SIZE}&includeSpam=true`,
        { headers: { Authorization: `Bearer ${props.token}` } }
      )
      if (!checkAuth(res)) return
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data.data)) all.push(...data.data)
      totalPages = Number(data.totalPages) || 1
      page++
    } while (page <= totalPages)

    if (all.length === 0) {
      importResult.value = '导出失败：没有可导出的评论'
      importFailed.value = true
      return
    }

    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `twikee-comments-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    // 部分浏览器会在同一 tick revoke 时取消下载
    setTimeout(() => {
      a.remove()
      URL.revokeObjectURL(url)
    }, 0)
    importResult.value = `已导出 ${all.length} 条评论`
  } catch (e) {
    console.error('导出失败', e)
    importResult.value = '导出失败：请重试或查看控制台'
    importFailed.value = true
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
  importFailed.value = false
  
  try {
    const text = await file.text()
    const comments = JSON.parse(text)
    
    if (!Array.isArray(comments)) {
      throw new Error('Invalid format')
    }
    
    const res = await fetch(`${props.apiUrl}/api/admin/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${props.token}`
      },
      body: JSON.stringify(comments)
    })
    if (!checkAuth(res)) return
    const result = await res.json()
    if (!res.ok) {
      // 服务端会返回 error/issues（如超过 1000 条上限或字段不合法）
      const detail = result.issues ? `：${result.issues.map((i: any) => `#${i.index} ${i.message}`).join('；')}` : ''
      throw new Error(`${result.error || '导入被拒绝'}${detail}`)
    }
    // 401 时旧代码走到这里会把「成功 0 条，失败 0 条」当成导入完成
    const parts = [`导入完成：成功 ${result.success ?? 0} 条，失败 ${result.failed ?? 0} 条`]
    if (result.failed > 0 && Array.isArray(result.failedItems)) {
      const reasons = result.failedItems.slice(0, 3).map((i: any) => `#${i.index}: ${i.reason}`)
      parts.push(reasons.join('；'))
    }
    importResult.value = parts.join('，')
  } catch (e) {
    importResult.value = `导入失败：${(e as Error).message || '文件格式错误'}`
    importFailed.value = true
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
            <CheckCircle v-if="!importFailed" class="w-4 h-4 text-green-500" />
            <AlertCircle v-else class="w-4 h-4 text-destructive" />
            <span :class="importFailed ? 'text-destructive' : ''">{{ importResult }}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
