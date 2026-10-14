<script setup lang="ts">
import { ref, computed } from 'vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import TkAvatar from './TkAvatar.vue'
import { marked } from 'marked'
import { sanitizeHtml } from '@/lib/utils'
import { ImagePlus } from 'lucide-vue-next'
import type { ResolvedTwikeeAppearance } from '@/types'

// marked 的 options 是全局副作用：TkComment 在模块顶层调过 setOptions，
// TkSubmit 的预览不能依赖"恰好 TkComment 先被 import"，自己调一次。
marked.setOptions({ breaks: true, gfm: true })

const props = defineProps<{
  url: string
  rid?: string
  pid?: string
  appearance?: ResolvedTwikeeAppearance
  /** 评论内容输入框占位符（来自 COMMENT_PLACEHOLDER 配置） */
  placeholder?: string
  /**
   * 图床上传配置（来自公开配置 IMAGE_CDN / MAX_IMAGE_SIZE）。
   * 未配置（url 为空）时不显示上传按钮。
   * 图床接口约定：POST multipart，文件字段名为 `file`，返回 JSON 含 `url` 字段。
   */
  imageUpload?: { url: string; maxSizeMb: number }
  /**
   * 真正的提交函数。返回 false 或抛错表示失败，此时保留输入内容；
   * 只有明确成功（返回非 false）才清空。
   */
  onSubmit?: (data: {
    nick: string
    mail?: string
    link?: string
    content: string
    rid?: string
    pid?: string
  }) => boolean | void | Promise<boolean | void>
}>()

const emit = defineEmits<{
  cancel: []
}>()

const nick = ref('')
const mail = ref('')
const link = ref('')
const content = ref('')
const isPreview = ref(false)
const isSending = ref(false)
const mailError = ref('')
const linkError = ref('')

const mailTouched = ref(false)
const linkTouched = ref(false)
const imageInput = ref<HTMLInputElement | null>(null)
const contentInput = ref<unknown>(null)
const isUploading = ref(false)
const uploadError = ref('')

const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const urlReg = /^https?:\/\/.+\..+/

const validateMail = () => {
  if (!mail.value.trim()) {
    mailError.value = ''
    return true
  }
  if (!emailReg.test(mail.value.trim())) {
    mailError.value = '邮箱格式不正确'
    return false
  }
  mailError.value = ''
  return true
}

const validateLink = () => {
  if (!link.value.trim()) {
    linkError.value = ''
    return true
  }
  if (!urlReg.test(link.value.trim())) {
    linkError.value = '网址格式不正确，需以 http:// 或 https:// 开头'
    return false
  }
  linkError.value = ''
  return true
}

const onMailBlur = () => {
  mailTouched.value = true
  validateMail()
}

const onLinkBlur = () => {
  linkTouched.value = true
  validateLink()
}

const canSend = computed(() => {
  if (!nick.value.trim() || !content.value.trim()) return false
  if (mailTouched.value && mailError.value) return false
  if (linkTouched.value && linkError.value) return false
  return true
})

const previewHtml = computed(() => {
  return sanitizeHtml(marked.parse(content.value) as string)
})

const submitClasses = computed(() => ({
  'tk-submit--minimal': props.appearance?.submit === 'minimal',
  'tk-submit--fields-inline': props.appearance?.fieldsLayout === 'inline',
  'tk-submit--no-focus-ring': props.appearance?.inputFocusRing === false,
}))

const handleSubmit = async () => {
  mailTouched.value = true
  linkTouched.value = true
  const mailValid = validateMail()
  const linkValid = validateLink()
  if (!nick.value.trim() || !content.value.trim() || !mailValid || !linkValid) return

  isSending.value = true
  try {
    const ok = await props.onSubmit?.({
      nick: nick.value.trim(),
      mail: mail.value.trim() || undefined,
      link: link.value.trim() || undefined,
      content: content.value.trim(),
      rid: props.rid,
      pid: props.pid,
    })
    // 只有明确成功才清空；失败（false）或抛错时保留内容，避免用户白写
    if (ok !== false) content.value = ''
  } catch (e) {
    console.error('[Twikee] submit failed:', e)
  } finally {
    isSending.value = false
  }
}

/** 图床是否可用：配置了上传地址才显示按钮 */
const imageUploadEnabled = computed(() => !!props.imageUpload?.url)

/**
 * 图片直传图床（不经过 Twikee 服务端，避免 Vercel 函数超时和流量费）。
 * 接口约定：POST multipart，文件字段名为 `file`，成功返回 JSON 含 `url` 字段。
 */
const onPickImage = () => {
  uploadError.value = ''
  imageInput.value?.click()
}

const insertImageMarkdown = (imageUrl: string) => {
  const snippet = `![](${imageUrl})`
  // 尽量插在光标处；拿不到 textarea 引用时退回追加到末尾
  const el = (contentInput.value as { $el?: HTMLTextAreaElement } | null)?.$el
  if (el && typeof el.selectionStart === 'number') {
    const start = el.selectionStart
    const end = el.selectionEnd ?? start
    content.value = `${content.value.slice(0, start)}${snippet}${content.value.slice(end)}`
  } else {
    content.value = content.value ? `${content.value}\n${snippet}` : snippet
  }
}

const onImageSelected = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  // 重置 input，保证选同一文件也能再次触发 change
  if (imageInput.value) imageInput.value.value = ''
  if (!file || !props.imageUpload?.url) return

  const maxBytes = Math.max(1, props.imageUpload.maxSizeMb || 5) * 1024 * 1024
  if (file.size > maxBytes) {
    uploadError.value = `图片超过大小限制（${props.imageUpload.maxSizeMb || 5}MB）`
    return
  }
  if (!file.type.startsWith('image/')) {
    uploadError.value = '请选择图片文件'
    return
  }

  isUploading.value = true
  uploadError.value = ''
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(props.imageUpload.url, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json().catch(() => null)
    // 约定返回 JSON 含 url 字段；兼容包一层 data 的图床
    const imageUrl: unknown = data?.url ?? data?.data?.url
    if (typeof imageUrl !== 'string' || !imageUrl) throw new Error('bad response')
    insertImageMarkdown(imageUrl)
  } catch (err) {
    console.error('[Twikee] image upload failed:', err)
    uploadError.value = '图片上传失败，请重试'
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div class="tk-submit" :class="submitClasses">
    <div class="flex gap-3">
      <TkAvatar :nick="nick || '用户'" :mail="mail" size="md" />

      <div class="flex-1 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input v-model="nick" placeholder="昵称 *" aria-label="昵称" />
          <div class="tk-submit__field">
            <Input v-model="mail" type="email" placeholder="邮箱 (可选)" aria-label="邮箱" @blur="onMailBlur" />
            <span v-if="mailTouched && mailError" class="tk-submit__error">{{ mailError }}</span>
          </div>
          <div class="tk-submit__field">
            <Input v-model="link" type="url" placeholder="网址 (可选)" aria-label="网址" @blur="onLinkBlur" />
            <span v-if="linkTouched && linkError" class="tk-submit__error">{{ linkError }}</span>
          </div>
        </div>

        <div v-if="isPreview" class="tk-submit__preview" v-html="previewHtml" />
        <Textarea
          v-else
          ref="contentInput"
          v-model="content"
          :placeholder="placeholder || '说点什么吧... (支持 Markdown)'"
          aria-label="评论内容"
          :rows="4"
        />
        <span v-if="uploadError" class="tk-submit__error">{{ uploadError }}</span>

        <div class="flex items-center justify-between gap-2">
          <div class="flex gap-2 items-center">
            <Button variant="ghost" size="sm" @click="isPreview = !isPreview">
              {{ isPreview ? '编辑' : '预览' }}
            </Button>
            <Button
              v-if="imageUploadEnabled"
              variant="ghost"
              size="sm"
              :disabled="isUploading"
              aria-label="上传图片"
              title="上传图片"
              @click="onPickImage"
            >
              <ImagePlus class="w-4 h-4 mr-1" />
              {{ isUploading ? '上传中...' : '图片' }}
            </Button>
            <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="onImageSelected" />
            <a
              href="https://guides.github.com/features/mastering-markdown/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-muted-foreground hover:text-primary flex items-center"
            >
              支持 Markdown
            </a>
          </div>

          <div class="flex gap-2">
            <Button v-if="rid" variant="ghost" size="sm" @click="emit('cancel')"> 取消 </Button>
            <Button size="sm" :disabled="!canSend || isSending" @click="handleSubmit">
              {{ isSending ? '发送中...' : '发送' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tk-submit {
  padding: 1rem;
  border-radius: 0.5rem;
  background: var(--muted);
}

.tk-submit--minimal {
  background: transparent;
  border: 1px dashed var(--border);
}

.tk-submit--fields-inline .grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tk-submit :deep(input),
.tk-submit :deep(textarea) {
  border: none;
  background: var(--card);
  box-shadow: none;
}

.tk-submit--minimal :deep(input),
.tk-submit--minimal :deep(textarea),
.tk-submit--minimal .tk-submit__preview {
  background: transparent;
}

.tk-submit :deep(input:focus),
.tk-submit :deep(textarea:focus) {
  outline: none;
  box-shadow: 0 0 0 1px var(--ring);
}

.tk-submit--no-focus-ring :deep(input:focus),
.tk-submit--no-focus-ring :deep(textarea:focus),
.tk-submit--no-focus-ring :deep(input:focus-visible),
.tk-submit--no-focus-ring :deep(textarea:focus-visible) {
  outline: none;
  box-shadow: none;
}

.tk-submit__field {
  position: relative;
}

.tk-submit__error {
  display: block;
  font-size: 0.6875rem;
  color: var(--destructive);
  margin-top: 0.125rem;
  line-height: 1.2;
}

.tk-submit__preview {
  padding: 0.75rem;
  border-radius: 0.375rem;
  min-height: 100px;
  background: var(--card);
  font-size: 0.875rem;
  line-height: 1.625;
}
.tk-submit__preview :deep(p) {
  margin: 0 0 0.5rem;
}
.tk-submit__preview :deep(p:last-child) {
  margin-bottom: 0;
}
.tk-submit__preview :deep(code) {
  font-size: 0.8125rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--muted);
}
.tk-submit__preview :deep(pre) {
  margin: 0.5rem 0;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: var(--muted);
  overflow-x: auto;
}
.tk-submit__preview :deep(pre code) {
  padding: 0;
  background: none;
}
.tk-submit__preview :deep(blockquote) {
  margin: 0.5rem 0;
  padding: 0.25rem 0.75rem;
  border-left: 3px solid var(--primary);
  color: var(--muted-foreground);
}
.tk-submit__preview :deep(ul),
.tk-submit__preview :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.tk-submit__preview :deep(h1),
.tk-submit__preview :deep(h2),
.tk-submit__preview :deep(h3),
.tk-submit__preview :deep(h4),
.tk-submit__preview :deep(h5),
.tk-submit__preview :deep(h6) {
  font-weight: 600;
  margin: 0.5rem 0;
}
</style>
