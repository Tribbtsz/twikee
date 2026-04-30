<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { Lock, User } from 'lucide-vue-next'

const props = defineProps<{
  apiUrl: string
}>()

const emit = defineEmits<{
  login: [token: string]
}>()

const password = ref('')
const loading = ref(false)
const error = ref('')

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
    <Card class="w-full max-w-md">
      <CardHeader>
        <h2 class="text-2xl font-bold text-center">Twikoo 管理后台</h2>
        <p class="text-muted-foreground text-center mt-2">请输入管理员密码登录</p>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleLogin" class="space-y-4">
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
      </CardContent>
    </Card>
  </div>
</template>
