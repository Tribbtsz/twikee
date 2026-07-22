<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { md5 } from '@/lib/utils'

const props = defineProps({
  nick: { type: String, default: '' },
  mail: { type: String, default: '' },
  link: { type: String, default: '' },
  size: { type: String as PropType<'sm' | 'md' | 'lg'>, default: 'md' },
  gravatarCdn: { type: String, default: 'https://gravatar.com/avatar/' }
})

const sizeStyles = computed(() => {
  const sizes = {
    sm: 'width: 2rem; height: 2rem;',
    md: 'width: 2.5rem; height: 2.5rem;',
    lg: 'width: 3rem; height: 3rem;'
  }
  return sizes[props.size]
})

const avatarUrl = computed(() => {
  if (props.mail) {
    const hash = md5(props.mail.toLowerCase().trim())
    const base = props.gravatarCdn || 'https://gravatar.com/avatar/'
    const cdn = base.endsWith('/') ? base : `${base}/`
    return `${cdn}${hash}?d=identicon&s=80`
  }
  return null
})
</script>

<template>
  <div :style="sizeStyles" class="relative shrink-0">
    <img
      v-if="avatarUrl"
      :src="avatarUrl"
      :alt="nick"
      class="w-full h-full rounded-full object-cover bg-muted"
      loading="lazy"
    />
    <div 
      v-else
      class="tk-avatar__fallback w-full h-full rounded-full flex items-center justify-center font-medium text-sm"
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
