<script setup lang="ts">
import { computed } from 'vue'
import { Blobatar } from 'blobatar/vue'
import type { Expression } from 'blobatar'
import 'blobatar/motion.css'

const props = withDefaults(defineProps<{
  nick?: string
  mail?: string
  link?: string
  size?: 'sm' | 'md' | 'lg'
  animate?: false | 'hover' | 'always'
  expression?: Expression
}>(), {
  nick: '',
  mail: '',
  link: '',
  size: 'md',
  animate: 'hover'
})

const sizeStyles = computed(() => {
  const sizes = {
    sm: 'width: 2.5rem; height: 2.5rem;',
    md: 'width: 3rem; height: 3rem;',
    lg: 'width: 3.5rem; height: 3.5rem;'
  }
  return sizes[props.size]
})

const name = computed(() => props.mail?.trim() || props.nick)

const showAvatar = computed(() => props.animate || !!name.value)
</script>

<template>
  <div :style="sizeStyles" class="relative shrink-0">
    <Blobatar
      v-if="showAvatar"
      :name="name"
      :animate="animate"
      :expression="expression"
      :title="nick || undefined"
      class="h-full w-full block"
      loading="lazy"
    />
    <div
      v-else
      style="width: 100%; height: 100%"
      class="tk-avatar__fallback rounded-full flex items-center justify-center font-medium text-sm"
    >
      {{ nick?.charAt(0)?.toUpperCase() || 'U' }}
    </div>
  </div>
</template>

<style scoped>
.tk-avatar__fallback {
  background: var(--muted);
  color: var(--muted-foreground);
}
</style>
