<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import { Save, RotateCcw, Mail, Bell, Shield, Image, Globe } from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
  token: string
}>()

const config = ref<Record<string, string>>({})
const loading = ref(false)
const saved = ref(false)

const settings = [
  {
    icon: Globe,
    name: '基础设置',
    items: [
      { key: 'SITE_NAME', label: '站点名称', placeholder: '我的博客', desc: '用于通知邮件中显示' },
      { key: 'SITE_URL', label: '站点 URL', placeholder: 'https://example.com', desc: '用于生成评论链接' },
      { key: 'BLOGGER_NICK', label: '博主昵称', placeholder: 'Admin', desc: '匹配后显示博主标识' },
      { key: 'BLOGGER_EMAIL', label: '博主邮箱', placeholder: 'admin@example.com', desc: '匹配后自动标记为博主' },
      { key: 'MASTER_TAG', label: '博主标识', placeholder: '博主', desc: '博主昵称旁显示的标签' },
      { key: 'COMMENT_PAGE_SIZE', label: '每页评论数', placeholder: '10', desc: '评论列表分页大小' },
      { key: 'GRAVATAR_CDN', label: 'Gravatar CDN', placeholder: 'cravatar.cn', desc: '头像 CDN 地址' },
      { key: 'DEFAULT_GRAVATAR', label: '默认头像', placeholder: 'identicon', desc: '无头像时的默认样式' },
      { key: 'COMMENT_PLACEHOLDER', label: '评论占位符', placeholder: '说点什么吧...', desc: '评论框提示文字' },
    ]
  },
  {
    icon: Bell,
    name: '通知设置',
    items: [
      { key: 'NOTIFICATION_ENABLE', label: '启用通知', placeholder: 'true', desc: '是否启用评论通知' },
      { key: 'NOTIFICATION_TYPE', label: '通知方式', placeholder: 'telegram', desc: 'telegram / webhook / email' },
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram Bot Token', placeholder: '123456:ABC-DEF', desc: '从 @BotFather 获取' },
      { key: 'TELEGRAM_CHAT_ID', label: 'Telegram Chat ID', placeholder: '-100123456789', desc: '群组或频道 ID' },
      { key: 'WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://...', desc: '自定义通知接口' },
    ]
  },
  {
    icon: Mail,
    name: '邮件设置',
    items: [
      { key: 'SMTP_HOST', label: 'SMTP 服务器', placeholder: 'smtp.example.com', desc: '邮件服务器地址' },
      { key: 'SMTP_PORT', label: 'SMTP 端口', placeholder: '587', desc: '邮件服务器端口' },
      { key: 'SMTP_USER', label: 'SMTP 用户名', placeholder: 'user@example.com', desc: '邮箱账号' },
      { key: 'SMTP_PASS', label: 'SMTP 密码', placeholder: '', desc: '邮箱密码或授权码', secret: true },
      { key: 'SMTP_FROM', label: '发件人地址', placeholder: 'noreply@example.com', desc: '发件人邮箱' },
      { key: 'SMTP_TO', label: '收件人地址', placeholder: 'admin@example.com', desc: '接收通知的邮箱' },
    ]
  },
  {
    icon: Shield,
    name: '安全设置',
    items: [
      { key: 'ADMIN_PASSWORD', label: '管理员密码', placeholder: '', desc: '留空则不修改', secret: true },
      { key: 'RECAPTCHA_SITE_KEY', label: 'reCAPTCHA Site Key', placeholder: '', desc: 'Google reCAPTCHA' },
      { key: 'RECAPTCHA_SECRET_KEY', label: 'reCAPTCHA Secret', placeholder: '', desc: 'Google reCAPTCHA', secret: true },
      { key: 'TURNSTILE_SITE_KEY', label: 'Turnstile Site Key', placeholder: '', desc: 'Cloudflare Turnstile' },
      { key: 'TURNSTILE_SECRET_KEY', label: 'Turnstile Secret', placeholder: '', desc: 'Cloudflare Turnstile', secret: true },
      { key: 'AKISMET_KEY', label: 'Akismet Key', placeholder: '', desc: '垃圾评论过滤服务' },
      { key: 'FORBIDDEN_WORDS', label: '违禁词', placeholder: '敏感词1,敏感词2', desc: '用逗号分隔' },
      { key: 'IP_BLACKLIST', label: 'IP 黑名单', placeholder: '1.2.3.4,5.6.7.8', desc: '用逗号分隔' },
    ]
  },
  {
    icon: Image,
    name: '图片设置',
    items: [
      { key: 'GRAVATAR_CDN', label: '头像 CDN', placeholder: 'https://gravatar.com/avatar/', desc: 'Gravatar 头像服务地址' },
      { key: 'IMAGE_CDN', label: '图床类型', placeholder: '', desc: 'qcloud / smms / custom' },
      { key: 'IMAGE_CDN_TOKEN', label: '图床 Token', placeholder: '', desc: '图床 API Token' },
      { key: 'MAX_IMAGE_SIZE', label: '最大图片大小', placeholder: '5', desc: '单位 MB' },
    ]
  },
]

const fetchConfig = async () => {
  loading.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      headers: { Authorization: `Bearer ${props.token}` }
    })
    const data = await res.json()
    config.value = data
  } catch (e) {
    console.error('获取配置失败', e)
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  loading.value = true
  saved.value = false
  try {
    await fetch(`${props.apiUrl}/api/admin/config`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.value)
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch (e) {
    console.error('保存配置失败', e)
  } finally {
    loading.value = false
  }
}

const resetConfig = () => {
  config.value = {}
}

onMounted(fetchConfig)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold">系统配置</h2>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="resetConfig">
          <RotateCcw class="w-4 h-4 mr-2" />
          重置
        </Button>
        <Button size="sm" @click="saveConfig" :disabled="loading">
          <Save class="w-4 h-4 mr-2" />
          {{ saved ? '已保存' : '保存配置' }}
        </Button>
      </div>
    </div>
    
    <div v-for="group in settings" :key="group.name" class="space-y-4">
      <Card>
        <CardHeader>
          <h3 class="font-medium flex items-center gap-2">
            <component :is="group.icon" class="w-4 h-4" />
            {{ group.name }}
          </h3>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-for="item in group.items" :key="item.key" class="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <div>
              <label class="text-sm font-medium">{{ item.label }}</label>
              <p class="text-xs text-muted-foreground">{{ item.desc }}</p>
            </div>
            <Input
              v-model="config[item.key]"
              :type="item.secret ? 'password' : 'text'"
              :placeholder="item.placeholder"
              class="md:col-span-2"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
