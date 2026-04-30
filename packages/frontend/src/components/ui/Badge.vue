<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  class?: string
}>(), {
  variant: 'default'
})

const variants: Record<string, string> = {
  default: 'bg-primary text-primary-foreground shadow hover:bg-primary/80',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive: 'bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
  outline: 'text-foreground border border-input',
}
</script>

<template>
  <div :class="cn('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', variants[variant], props.class)">
    <slot />
  </div>
</template>
