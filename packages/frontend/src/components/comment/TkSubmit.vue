<script setup lang="ts">
import { ref, computed } from 'vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import TkAvatar from './TkAvatar.vue'
import { marked } from 'marked'
import { sanitizeHtml } from '@/lib/utils'

const props = defineProps<{
  url: string
  rid?: string
  pid?: string
}>()

const emit = defineEmits<{
  submit: [data: {
    nick: string
    mail?: string
    link?: string
    content: string
    rid?: string
    pid?: string
  }]
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
  return sanitizeHtml(marked(content.value) as string)
})

const handleSubmit = async () => {
  mailTouched.value = true
  linkTouched.value = true
  const mailValid = validateMail()
  const linkValid = validateLink()
  if (!nick.value.trim() || !content.value.trim() || !mailValid || !linkValid) return

  isSending.value = true
  try {
    emit('submit', {
      nick: nick.value.trim(),
      mail: mail.value.trim() || undefined,
      link: link.value.trim() || undefined,
      content: content.value.trim(),
      rid: props.rid,
      pid: props.pid
    })
    content.value = ''
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <div class="tk-submit">
    <div class="flex gap-3">
      <TkAvatar :nick="nick || '用户'" :mail="mail" size="md" />

      <div class="flex-1 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            v-model="nick"
            placeholder="昵称 *"
          />
          <div class="tk-submit__field">
            <Input
              v-model="mail"
              type="email"
              placeholder="邮箱 (可选)"
              @blur="onMailBlur"
            />
            <span v-if="mailTouched && mailError" class="tk-submit__error">{{ mailError }}</span>
          </div>
          <div class="tk-submit__field">
            <Input
              v-model="link"
              type="url"
              placeholder="网址 (可选)"
              @blur="onLinkBlur"
            />
            <span v-if="linkTouched && linkError" class="tk-submit__error">{{ linkError }}</span>
          </div>
        </div>

        <div v-if="isPreview" class="tk-submit__preview" v-html="previewHtml" />
        <Textarea
          v-else
          v-model="content"
          placeholder="说点什么吧... (支持 Markdown)"
          :rows="4"
        />

        <div class="flex items-center justify-between gap-2">
          <div class="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              @click="isPreview = !isPreview"
            >
              {{ isPreview ? '编辑' : '预览' }}
            </Button>
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
            <Button
              v-if="rid"
              variant="outline"
              size="sm"
              @click="emit('cancel')"
            >
              取消
            </Button>
            <Button
              size="sm"
              :disabled="!canSend || isSending"
              @click="handleSubmit"
            >
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

.tk-submit :deep(input),
.tk-submit :deep(textarea) {
  border: none;
  background: var(--card);
  box-shadow: none;
}

.tk-submit :deep(input:focus),
.tk-submit :deep(textarea:focus) {
  outline: none;
  box-shadow: 0 0 0 1px var(--ring);
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
</style>
