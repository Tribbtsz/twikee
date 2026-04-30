<script setup lang="ts">
import { type PropType } from 'vue'
import Button from '@/components/ui/Button.vue'
import { Heart, MessageCircle } from 'lucide-vue-next'

const props = defineProps({
  liked: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 },
  repliesCount: { type: Number, default: 0 }
})

const emit = defineEmits<{
  like: []
  reply: []
}>()
</script>

<template>
  <div class="flex items-center gap-3">
    <Button
      variant="ghost"
      size="sm"
      class="gap-1.5 h-7 px-2"
      @click="emit('like')"
    >
      <Heart 
        :class="liked ? 'fill-destructive text-destructive' : ''" 
        class="w-4 h-4 transition-colors"
      />
      <span v-if="likeCount > 0" class="text-xs">{{ likeCount }}</span>
    </Button>
    
    <Button
      variant="ghost"
      size="sm"
      class="gap-1.5 h-7 px-2"
      @click="emit('reply')"
    >
      <MessageCircle class="w-4 h-4" />
      <span v-if="repliesCount > 0" class="text-xs">{{ repliesCount }}</span>
    </Button>
  </div>
</template>
