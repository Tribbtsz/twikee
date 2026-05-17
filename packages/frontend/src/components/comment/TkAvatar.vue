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

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
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
  <div :class="sizeClasses" class="relative shrink-0">
    <img
      v-if="avatarUrl"
      :src="avatarUrl"
      :alt="nick"
      class="w-full h-full rounded-full object-cover bg-muted"
      loading="lazy"
    />
    <div 
      v-else
      class="w-full h-full rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-medium text-sm"
    >
      {{ nick?.charAt(0)?.toUpperCase() || 'U' }}
    </div>
  </div>
</template>
