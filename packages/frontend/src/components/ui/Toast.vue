<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open?: boolean
  message?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}>(), {
  open: false,
  message: '',
  type: 'info',
  duration: 2000
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = ref(props.open)
let timer: ReturnType<typeof setTimeout> | null = null

watch(() => props.open, (v) => {
  isOpen.value = v
  if (v && props.duration > 0) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      isOpen.value = false
      emit('update:open', false)
    }, props.duration)
  }
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})

const icons: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

const iconColors: Record<string, string> = {
  success: 'text-green-500',
  error: 'text-destructive',
  warning: 'text-yellow-500',
  info: 'text-blue-500'
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="isOpen" class="fixed top-4 left-1/2 -translate-x-1/2 z-[100]">
        <div class="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg">
          <component :is="icons[type]" :class="cn('w-4 h-4 shrink-0', iconColors[type])" />
          <span class="text-sm">{{ message }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
