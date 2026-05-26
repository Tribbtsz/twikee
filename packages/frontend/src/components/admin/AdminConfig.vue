<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Switch from '@/components/ui/Switch.vue'
import Select from '@/components/ui/Select.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Toast from '@/components/ui/Toast.vue'
import { Save, RotateCcw, Mail, Bell, Shield, Image, Globe } from 'lucide-vue-next'

type ConfigItem = {
  key: string
  label: string
  placeholder: string
  desc: string
  type?: 'boolean' | 'select'
  options?: string[]
  secret?: boolean
  default?: string
}

type ConfigGroup = {
  icon: typeof Globe
  name: string
  items: ConfigItem[]
}

const props = defineProps<{
  apiUrl: string
  token: string
}>()

const emit = defineEmits<{
  logout: []
}>()

const config = ref<Record<string, string>>({})
const savedConfig = ref<Record<string, string>>({})
const loading = ref(false)
const saved = ref(false)
const showResetDialog = ref(false)
const toast = ref({ open: false, message: '', type: 'info' as 'success' | 'error' | 'info' })

const isDirty = computed(() => {
  const keys = new Set([...Object.keys(config.value), ...Object.keys(savedConfig.value)])
  for (const key of keys) {
    if ((config.value[key] || '') !== (savedConfig.value[key] || '')) return true
  }
  return false
})

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  toast.value = { open: true, message, type }
}

const checkAuth = (res: Response) => {
  if (res.status === 401) {
    emit('logout')
    return false
  }
  return true
}

const getConfigValue = (item: ConfigItem): string => {
  if (config.value[item.key] !== undefined && config.value[item.key] !== '') {
    return config.value[item.key]
  }
  return item.default ?? ''
}

const setConfigValue = (item: ConfigItem, value: string) => {
  config.value[item.key] = value
}

const isItemDirty = (item: ConfigItem): boolean => {
  return (config.value[item.key] || '') !== (savedConfig.value[item.key] || '')
}

const allItems = computed(() => settings.flatMap(g => g.items))

const buildDefaults = (): Record<string, string> => {
  const defaults: Record<string, string> = {}
  for (const item of allItems.value) {
    if (item.default !== undefined && item.default !== '') {
      defaults[item.key] = item.default
    }
  }
  return defaults
}

const settings: ConfigGroup[] = [
  {
    icon: Globe,
    name: '基础设置',
    items: [
      { key: 'SITE_NAME', label: '站点名称', placeholder: '我的博客', desc: '用于通知邮件中显示', default: '' },
      { key: 'SITE_URL', label: '站点 URL', placeholder: 'https://example.com', desc: '用于生成评论链接', default: '' },
      { key: 'BLOGGER_NICK', label: '博主昵称', placeholder: 'Admin', desc: '匹配后显示博主标识', default: '' },
      { key: 'BLOGGER_EMAIL', label: '博主邮箱', placeholder: 'admin@example.com', desc: '匹配后自动标记为博主', default: '' },
      { key: 'MASTER_TAG', label: '博主标识', placeholder: '博主', desc: '博主昵称旁显示的标签', default: '博主' },
      { key: 'COMMENT_PAGE_SIZE', label: '每页评论数', placeholder: '10', desc: '评论列表分页大小', default: '10' },
      { key: 'GRAVATAR_CDN', label: 'Gravatar CDN', placeholder: 'cravatar.cn', desc: '头像 CDN 地址', default: 'cravatar.cn' },
      { key: 'DEFAULT_GRAVATAR', label: '默认头像', placeholder: 'identicon', desc: '无头像时的默认样式', type: 'select', options: ['identicon', 'monsterid', 'wavatar', 'retro', 'robohash', 'blank'], default: 'identicon' },
      { key: 'COMMENT_PLACEHOLDER', label: '评论占位符', placeholder: '说点什么吧...', desc: '评论框提示文字', default: '说点什么吧...' },
      { key: 'AUTO_APPROVE', label: '自动通过评论', placeholder: 'true', desc: '开启后新评论无需审核直接发布', type: 'boolean', default: 'true' },
      { key: 'DEMO_ENABLED', label: '启用 Demo 页面', placeholder: 'true', desc: '是否允许访问 Demo 页面', type: 'boolean', default: 'true' },
    ]
  },
  {
    icon: Bell,
    name: '通知设置',
    items: [
      { key: 'NOTIFICATION_ENABLE', label: '启用通知', placeholder: 'true', desc: '是否启用评论通知', type: 'boolean', default: 'false' },
      { key: 'NOTIFICATION_TYPE', label: '通知方式', placeholder: 'telegram', desc: '选择通知渠道', type: 'select', options: ['telegram', 'webhook', 'email'], default: 'telegram' },
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram Bot Token', placeholder: '123456:ABC-DEF', desc: '从 @BotFather 获取', default: '' },
      { key: 'TELEGRAM_CHAT_ID', label: 'Telegram Chat ID', placeholder: '-100123456789', desc: '群组或频道 ID', default: '' },
      { key: 'WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://...', desc: '自定义通知接口', default: '' },
    ]
  },
  {
    icon: Mail,
    name: '邮件设置',
    items: [
      { key: 'SMTP_HOST', label: 'SMTP 服务器', placeholder: 'smtp.example.com', desc: '邮件服务器地址', default: '' },
      { key: 'SMTP_PORT', label: 'SMTP 端口', placeholder: '587', desc: '邮件服务器端口', default: '587' },
      { key: 'SMTP_USER', label: 'SMTP 用户名', placeholder: 'user@example.com', desc: '邮箱账号', default: '' },
      { key: 'SMTP_PASS', label: 'SMTP 密码', placeholder: '', desc: '邮箱密码或授权码', secret: true, default: '' },
      { key: 'SMTP_FROM', label: '发件人地址', placeholder: 'noreply@example.com', desc: '发件人邮箱', default: '' },
      { key: 'SMTP_TO', label: '收件人地址', placeholder: 'admin@example.com', desc: '接收通知的邮箱', default: '' },
    ]
  },
  {
    icon: Shield,
    name: '安全设置',
    items: [
      { key: 'ADMIN_PASSWORD', label: '管理员密码', placeholder: '', desc: '留空则不修改', secret: true, default: '' },
    ]
  },
  {
    icon: Image,
    name: '图片设置',
    items: [
      { key: 'IMAGE_CDN', label: '图床类型', placeholder: '', desc: 'qcloud / smms / custom', default: '' },
      { key: 'IMAGE_CDN_TOKEN', label: '图床 Token', placeholder: '', desc: '图床 API Token', default: '' },
      { key: 'MAX_IMAGE_SIZE', label: '最大图片大小', placeholder: '5', desc: '单位 MB', default: '5' },
    ]
  },
]

const fetchConfig = async () => {
  loading.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      headers: { Authorization: `Bearer ${props.token}` }
    })
    if (!checkAuth(res)) return
    const data = await res.json()
    config.value = { ...buildDefaults(), ...data }
    savedConfig.value = { ...config.value }
  } catch (e) {
    showToast('获取配置失败', 'error')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  loading.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.value)
    })
    if (!checkAuth(res)) return
    showToast('配置已保存', 'success')
    savedConfig.value = { ...config.value }
  } catch (e) {
    showToast('保存配置失败', 'error')
  } finally {
    loading.value = false
  }
}

const resetConfig = () => {
  config.value = buildDefaults()
  showToast('已重置为默认值', 'info')
}

onMounted(fetchConfig)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold">系统配置</h2>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="showResetDialog = true">
          <RotateCcw class="w-4 h-4 mr-2" />
          重置
        </Button>
        <Button size="sm" @click="saveConfig" :disabled="loading || !isDirty">
          <Save class="w-4 h-4 mr-2" />
          {{ loading ? '保存中...' : '保存配置' }}
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
            <div class="flex items-start justify-between gap-2">
              <div>
                <label class="text-sm font-medium">{{ item.label }}</label>
                <p class="text-xs text-muted-foreground">{{ item.desc }}</p>
              </div>
              <span v-if="isItemDirty(item)" class="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5" style="color:#ef4444;background:#fef2f2">未保存</span>
            </div>
            <div v-if="item.type === 'boolean'" class="md:col-span-2 flex items-center gap-3">
              <Switch
                :model-value="getConfigValue(item) === 'true'"
                @update:model-value="setConfigValue(item, $event ? 'true' : 'false')"
              />
              <span class="text-sm text-muted-foreground">{{ getConfigValue(item) === 'true' ? '开启' : '关闭' }}</span>
            </div>
            <div v-else-if="item.type === 'select'" class="md:col-span-2">
              <Select
                :model-value="getConfigValue(item)"
                :options="(item.options || []).map(o => ({ value: o, label: o }))"
                :placeholder="item.placeholder"
                @update:model-value="setConfigValue(item, $event)"
              />
            </div>
            <div v-else class="md:col-span-2">
              <Input
                :model-value="getConfigValue(item)"
                :type="item.secret ? 'password' : 'text'"
                :autocomplete="item.secret ? 'new-password' : undefined"
                :placeholder="item.placeholder"
                @update:model-value="setConfigValue(item, $event)"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <Dialog
      v-model:open="showResetDialog"
      title="重置配置"
      description="确定要重置所有配置为默认值吗？已保存的配置不会丢失，只是页面上显示为默认值。"
      confirm-text="重置"
      @confirm="resetConfig"
    />

    <Toast
      v-model:open="toast.open"
      :message="toast.message"
      :type="toast.type"
    />
  </div>
</template>
