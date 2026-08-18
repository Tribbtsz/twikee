<script setup lang="ts">
import { computed } from 'vue'
import { blobatarUri } from 'blobatar/uri'
import { _parts } from 'blobatar/_parts'
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

const animated = computed(() =>
  props.animate
    ? _parts(name.value, {
        animate: props.animate,
        expression: props.expression
      })
    : null
)

const staticUri = computed(() =>
  props.animate ? '' : name.value ? blobatarUri(name.value) : ''
)
</script>

<template>
  <div :style="sizeStyles" class="relative shrink-0">
    <svg
      v-if="animated"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      style="width: 100%; height: 100%; display: block"
      :style="animated.vars"
      role="img"
      :aria-label="nick"
    >
      <title v-if="nick">{{ nick }}</title>
      <path v-if="animated.bg" :d="animated.bg.d" :fill="animated.bg.fill" />
      <g :class="animated.cls" v-html="animated.inner" />
    </svg>
    <img
      v-else-if="staticUri"
      :src="staticUri"
      :alt="nick"
      style="width: 100%; height: 100%"
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
