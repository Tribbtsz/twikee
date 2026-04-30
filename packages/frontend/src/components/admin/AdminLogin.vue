<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { Lock, ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
}>()

const emit = defineEmits<{
  login: [token: string]
}>()

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const isInitialized = ref(true)
const checking = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`${props.apiUrl}/api/auth/status`)
    const data = await res.json()
    isInitialized.value = data.initialized
  } catch (e) {
    console.error('检查状态失败', e)
  } finally {
    checking.value = false
  }
})

const handleSetup = async () => {
  if (!password.value || password.value.length < 6) {
    error.value = '密码至少需要 6 个字符'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const res = await fetch(`${props.apiUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })

    const data = await res.json()

    if (data.error) {
      error.value = data.error === 'Password already set' ? '密码已设置，请登录' : data.error
      isInitialized.value = true
    } else {
      emit('login', data.token)
    }
  } catch (e) {
    error.value = '设置失败，请检查网络'
  } finally {
    loading.value = false
  }
}

const handleLogin = async () => {
  if (!password.value) return

  loading.value = true
  error.value = ''

  try {
    const res = await fetch(`${props.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })

    const data = await res.json()

    if (data.error) {
      error.value = '密码错误'
    } else {
      emit('login', data.token)
    }
  } catch (e) {
    error.value = '登录失败，请检查网络'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <Card v-if="!checking" class="w-full max-w-md">
      <CardHeader>
        <div class="flex items-center justify-center gap-2 mb-2">
          <ShieldCheck class="w-6 h-6 text-primary" />
          <h2 class="text-2xl font-bold">Twikee 管理后台</h2>
        </div>
        <p class="text-muted-foreground text-center mt-2">
          {{ isInitialized ? '请输入管理员密码登录' : '首次使用，请设置管理员密码' }}
        </p>
      </CardHeader>
      <CardContent>
        <form v-if="isInitialized" @submit.prevent="handleLogin" class="space-y-4">
          <div class="relative">
            <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="password"
              type="password"
              placeholder="管理员密码"
              class="pl-10"
            />
          </div>

          <div v-if="error" class="text-sm text-destructive">
            {{ error }}
          </div>

          <Button
            type="submit"
            class="w-full"
            :disabled="!password || loading"
          >
            {{ loading ? '登录中...' : '登录' }}
          </Button>
        </form>

        <form v-else @submit.prevent="handleSetup" class="space-y-4">
          <div class="relative">
            <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="password"
              type="password"
              placeholder="设置密码 (至少 6 位)"
              class="pl-10"
            />
          </div>

          <div class="relative">
            <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="confirmPassword"
              type="password"
              placeholder="确认密码"
              class="pl-10"
            />
          </div>

          <div v-if="error" class="text-sm text-destructive">
            {{ error }}
          </div>

          <Button
            type="submit"
            class="w-full"
            :disabled="!password || !confirmPassword || loading"
          >
            {{ loading ? '设置中...' : '设置密码并登录' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
