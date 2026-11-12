<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Switch from '@/components/ui/Switch.vue'
import Select from '@/components/ui/Select.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Toast from '@/components/ui/Toast.vue'
import { Save, RotateCcw, Mail, Bell, Shield, Globe, Image as ImageIcon } from 'lucide-vue-next'

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
const showResetDialog = ref(false)
const toast = ref({ open: false, message: '', type: 'info' as 'success' | 'error' | 'warning' | 'info' })

const isDirty = computed(() => {
  const keys = new Set([...Object.keys(config.value), ...Object.keys(savedConfig.value)])
  for (const key of keys) {
    if ((config.value[key] || '') !== (savedConfig.value[key] || '')) return true
  }
  return false
})

const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
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

const allItems = computed(() => settings.flatMap((g) => g.items))

const itemByKey = computed(() => new Map(allItems.value.map((item) => [item.key, item])))

const buildDefaults = (): Record<string, string> => {
  const defaults: Record<string, string> = {}
  for (const item of allItems.value) {
    if (item.default !== undefined && item.default !== '') {
      defaults[item.key] = item.default
    }
  }
  return defaults
}

// 保存时只回传本界面声明的字段：DB 里可能残留已下线的旧配置键
// （如已移除的 SMTP_HOST/GRAVATAR_CDN），原样回传会被后端白名单拒绝
const knownKeys = new Set(allItems.value.map((item) => item.key))
const filterKnown = (source: Record<string, string>): Record<string, string> => {
  const filtered: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (knownKeys.has(key)) filtered[key] = value
  }
  return filtered
}

const settings: ConfigGroup[] = [
  {
    icon: Globe,
    name: '基础设置',
    items: [
      { key: 'SITE_NAME', label: '站点名称', placeholder: '我的博客', desc: '用于通知邮件中显示', default: '' },
      { key: 'SITE_URL', label: '站点 URL', placeholder: 'https://example.com', desc: '用于生成评论链接', default: '' },
      {
        key: 'BLOGGER_EMAIL',
        label: '博主邮箱',
        placeholder: 'admin@example.com',
        desc: '匹配后自动标记为博主',
        default: '',
      },
      { key: 'MASTER_TAG', label: '博主标识', placeholder: '博主', desc: '博主昵称旁显示的标签', default: '博主' },
      { key: 'COMMENT_PAGE_SIZE', label: '每页评论数', placeholder: '10', desc: '评论列表分页大小', default: '10' },
      {
        key: 'COMMENT_PLACEHOLDER',
        label: '评论占位符',
        placeholder: '说点什么吧...',
        desc: '评论框提示文字',
        default: '说点什么吧...',
      },
      {
        key: 'AUTO_APPROVE',
        label: '自动通过评论',
        placeholder: 'true',
        desc: '开启后新评论无需审核直接发布',
        type: 'boolean',
        default: 'true',
      },
      {
        key: 'DEMO_ENABLED',
        label: '启用 Demo 页面',
        placeholder: 'true',
        desc: '是否允许访问 Demo 页面',
        type: 'boolean',
        default: 'true',
      },
    ],
  },
  {
    icon: Bell,
    name: '通知设置',
    items: [
      {
        key: 'NOTIFICATION_ENABLE',
        label: '启用通知',
        placeholder: 'true',
        desc: '是否启用评论通知',
        type: 'boolean',
        default: 'false',
      },
      {
        key: 'NOTIFICATION_TYPE',
        label: '通知方式',
        placeholder: 'telegram',
        desc: '选择通知渠道',
        type: 'select',
        options: ['telegram', 'webhook', 'email', 'wxpusher', 'wecom'],
        default: 'telegram',
      },
      {
        key: 'TELEGRAM_BOT_TOKEN',
        label: 'Telegram Bot Token',
        placeholder: '123456:ABC-DEF',
        desc: '从 @BotFather 获取，留空不修改',
        secret: true,
        default: '',
      },
      {
        key: 'TELEGRAM_CHAT_ID',
        label: 'Telegram Chat ID',
        placeholder: '-100123456789',
        desc: '群组或频道 ID',
        default: '',
      },
      { key: 'WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://...', desc: '自定义通知接口', default: '' },
      {
        key: 'WEBHOOK_METHOD',
        label: 'Webhook 请求方法',
        placeholder: 'POST',
        desc: '通知请求使用的 HTTP 方法',
        type: 'select',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        default: 'POST',
      },
      {
        key: 'WEBHOOK_HEADERS',
        label: 'Webhook 自定义请求头',
        placeholder: '{"Authorization": "Bearer xxx"}',
        desc: 'JSON 对象，如 {"Authorization": "Bearer xxx"}，留空不发送',
        default: '',
      },
      {
        key: 'WXPUSHER_APP_TOKEN',
        label: 'WxPusher AppToken',
        placeholder: 'AT_xxx',
        desc: '在 wxpusher 控制台获取，留空不修改',
        secret: true,
        default: '',
      },
      {
        key: 'WXPUSHER_UIDS',
        label: 'WxPusher UID',
        placeholder: 'UID_xxx,UID_yyy',
        desc: '接收用户 UID，多个用逗号分隔',
        default: '',
      },
      {
        key: 'WECOM_KEY',
        label: '企业微信机器人 Key',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        desc: '群机器人 Webhook 地址中的 key，留空不修改',
        secret: true,
        default: '',
      },
    ],
  },
  {
    icon: Mail,
    name: '邮件设置（Resend）',
    items: [
      {
        key: 'SMTP_PASS',
        label: 'Resend API Key',
        placeholder: 're_xxxxxxxxxx',
        desc: '在 resend.com/api-keys 创建；仅支持 Resend，不支持 SMTP 密码。留空不修改',
        secret: true,
        default: '',
      },
      {
        key: 'SMTP_FROM',
        label: '发件人地址',
        placeholder: 'noreply@your-domain.com',
        desc: '须为 Resend 已验证的域名下的地址',
        default: '',
      },
      { key: 'SMTP_TO', label: '收件人地址', placeholder: 'admin@example.com', desc: '接收通知的邮箱', default: '' },
    ],
  },
  {
    icon: Shield,
    name: '安全设置',
    items: [
      { key: 'ADMIN_PASSWORD', label: '管理员密码', placeholder: '', desc: '留空则不修改', secret: true, default: '' },
      {
        key: 'BLOCKED_IPS',
        label: 'IP 黑名单',
        placeholder: '1.2.3.4, 5.6.7.8',
        desc: '逗号分隔，被拉黑的 IP 无法发表评论',
        default: '',
      },
    ],
  },
  {
    icon: ImageIcon,
    name: '图片设置',
    items: [
      {
        key: 'IMAGE_CDN',
        label: '图床上传地址',
        placeholder: 'https://img.example.com/upload',
        desc: '评论框图片直传地址。接口约定：POST multipart，文件字段名为 file，返回 JSON 含 url 字段；需鉴权请把 token 拼在 URL 里',
        default: '',
      },
      {
        key: 'IMAGE_CDN_TOKEN',
        label: '图床 Token',
        placeholder: '',
        desc: '服务端预留，留空不修改（前端直传不使用此 token）',
        secret: true,
        default: '',
      },
      {
        key: 'MAX_IMAGE_SIZE',
        label: '图片大小上限（MB）',
        placeholder: '5',
        desc: '前端上传时的大小限制，默认 5MB',
        default: '5',
      },
    ],
  },
]

const fetchConfig = async () => {
  loading.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      headers: { Authorization: `Bearer ${props.token}` },
    })
    if (!checkAuth(res)) return
    const data = await res.json()
    config.value = { ...buildDefaults(), ...data }
    savedConfig.value = { ...config.value }
  } catch (e) {
    console.error('[Twikee] failed to load admin config:', e)
    showToast('获取配置失败', 'error')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  const missing = missingForChannel()
  if (missing.length > 0) {
    showToast(
      `通知渠道未配全：缺少 ${missing.map((key) => LABEL_BY_KEY[key] || key).join('、')}，保存后通知不会发出`,
      'warning',
    )
  }
  loading.value = true
  try {
    const res = await fetch(`${props.apiUrl}/api/admin/config`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filterKnown(config.value)),
    })
    if (!checkAuth(res)) return
    showToast('配置已保存', 'success')
    // 密钥类不会经 GET 返回，后端空值表示不修改：保存后清零，避免明文驻留内存。
    // 本次真实填写的密钥把 <KEY>_SET 标记同步置位（本地与已保存态），"已配置"徽章即时生效，
    // 否则要等刷新页面才看得到状态。
    for (const group of settings) {
      for (const item of group.items) {
        if (item.secret) {
          if ((config.value[item.key] || '').trim()) config.value[`${item.key}_SET`] = 'true'
          config.value[item.key] = ''
        }
      }
    }
    savedConfig.value = { ...config.value }
  } catch (e) {
    console.error('[Twikee] failed to save admin config:', e)
    showToast('保存配置失败', 'error')
  } finally {
    loading.value = false
  }
}

const resetConfig = () => {
  // 恢复为已保存的配置（放弃未保存的修改），而不是写成默认值：
  // 写成默认值后点保存会把全部配置清空，是个 footgun。
  config.value = { ...savedConfig.value }
  showToast('已恢复为已保存的配置', 'info')
}

// 与 api/src/lib/notification.ts buildFromConfig 的构建条件一一对应：
// 渠道启用但必填键缺失时，服务端只会 console.warn 并静默不发通知，
// 这里在保存前给出 warning，避免"看起来配好了、实际一条都发不出"。
const NOTIFICATION_REQUIRED: Record<string, string[]> = {
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
  webhook: ['WEBHOOK_URL'],
  email: ['SMTP_PASS', 'SMTP_FROM', 'SMTP_TO'],
  wxpusher: ['WXPUSHER_APP_TOKEN', 'WXPUSHER_UIDS'],
  wecom: ['WECOM_KEY'],
}

const LABEL_BY_KEY: Record<string, string> = {}
for (const group of settings) {
  for (const item of group.items) {
    LABEL_BY_KEY[item.key] = item.label
  }
}

const missingForChannel = (): string[] => {
  if ((config.value['NOTIFICATION_ENABLE'] || '') !== 'true') return []
  const type = (config.value['NOTIFICATION_TYPE'] || '').trim()
  const required = NOTIFICATION_REQUIRED[type]
  if (!required) return []
  return required.filter((key) => !isFilled(key))
}

/** secret 键的值不回传，只下发 <KEY>_SET 标记：已配置过即视为已填，否则会误报"缺 token" */
const isFilled = (key: string): boolean => {
  if ((config.value[key] || '').trim()) return true
  return config.value[`${key}_SET`] === 'true'
}

const isSecretSet = (key: string): boolean => {
  return !!itemByKey.value.get(key)?.secret && config.value[`${key}_SET`] === 'true'
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
              <span
                v-if="isItemDirty(item)"
                class="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                style="color: #ef4444; background: #fef2f2"
                >未保存</span
              >
              <span
                v-if="isSecretSet(item.key)"
                class="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                style="color: #16a34a; background: #f0fdf4"
                >已配置</span
              >
            </div>
            <div v-if="item.type === 'boolean'" class="md:col-span-2 flex items-center gap-3">
              <Switch
                :model-value="getConfigValue(item) === 'true'"
                :aria-label="item.label"
                @update:model-value="setConfigValue(item, $event ? 'true' : 'false')"
              />
              <span class="text-sm text-muted-foreground">{{ getConfigValue(item) === 'true' ? '开启' : '关闭' }}</span>
            </div>
            <div v-else-if="item.type === 'select'" class="md:col-span-2">
              <Select
                :model-value="getConfigValue(item)"
                :options="(item.options || []).map((o) => ({ value: o, label: o }))"
                :placeholder="item.placeholder"
                :aria-label="item.label"
                @update:model-value="setConfigValue(item, $event)"
              />
            </div>
            <div v-else class="md:col-span-2">
              <Input
                :model-value="getConfigValue(item)"
                :type="item.secret ? 'password' : 'text'"
                :autocomplete="item.secret ? 'new-password' : undefined"
                :placeholder="item.placeholder"
                :aria-label="item.label"
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
      description="确定要放弃所有未保存的修改，恢复为已保存的配置吗？"
      confirm-text="恢复"
      @confirm="resetConfig"
    />

    <Toast v-model:open="toast.open" :message="toast.message" :type="toast.type" />
  </div>
</template>
