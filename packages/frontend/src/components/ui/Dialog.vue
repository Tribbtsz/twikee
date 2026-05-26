<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}>(), {
  open: false,
  title: '确认操作',
  description: '确定要执行此操作吗？',
  confirmText: '确定',
  cancelText: '取消',
  variant: 'default'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const isOpen = ref(props.open)

watch(() => props.open, (v) => { isOpen.value = v })
watch(isOpen, (v) => { emit('update:open', v) })

const handleConfirm = () => {
  emit('confirm')
  isOpen.value = false
}

const handleCancel = () => {
  isOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="handleCancel" />
      <div class="relative z-50 w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h3 class="text-lg font-semibold">{{ title }}</h3>
        <p class="mt-2 text-sm text-muted-foreground">{{ description }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" @click="handleCancel">{{ cancelText }}</Button>
          <Button :variant="variant === 'destructive' ? 'destructive' : 'default'" size="sm" @click="handleConfirm">{{ confirmText }}</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
