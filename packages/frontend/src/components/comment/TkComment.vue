<script setup lang="ts">
import { computed, ref, onMounted, inject, type PropType } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import TkAvatar from './TkAvatar.vue'
import TkAction from './TkAction.vue'
import type { Comment } from '@twikoo/core'

const props = defineProps({
  comment: { type: Object as PropType<Comment>, required: true },
  replyId: { type: String, default: '' },
  replying: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false }
})

const emit = defineEmits<{
  reply: [id: string]
  load: []
  moderate: [id: string, action: 'approve' | 'spam']
  top: [id: string, top: boolean]
}>()

const isExpanded = ref(false)
const isContentExpanded = ref(false)
const liked = ref(false)
const likeCount = ref(0)

const displayTime = computed(() => {
  const now = Date.now()
  const diff = now - props.comment.createdAt
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return new Date(props.comment.createdAt).toLocaleDateString()
})

const convertedLink = computed(() => {
  const link = props.comment.link
  if (!link) return null
  if (link.startsWith('http://') || link.startsWith('https://')) return link
  return `https://${link}`
})

const onLike = () => {
  liked.value = !liked.value
  likeCount.value += liked.value ? 1 : -1
}

const onReply = () => {
  emit('reply', props.comment.id)
}

const onExpand = () => {
  isExpanded.value = true
}
</script>

<template>
  <div :id="comment.id" class="group">
    <Card class="transition-all duration-200 hover:shadow-md">
      <CardContent class="p-4">
        <div class="flex gap-3">
          <TkAvatar 
            :nick="comment.nick" 
            :mail="comment.mail" 
            :link="convertedLink"
            size="md"
          />
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <a 
                  v-if="convertedLink" 
                  :href="convertedLink" 
                  target="_blank" 
                  rel="noopener noreferrer nofollow"
                  class="font-medium hover:text-primary transition-colors"
                >
                  {{ comment.nick }}
                </a>
                <span v-else class="font-medium">{{ comment.nick }}</span>
                
                <Badge v-if="comment.master" variant="default" class="text-xs">
                  博主
                </Badge>
                <Badge v-if="comment.top" variant="secondary" class="text-xs">
                  置顶
                </Badge>
                <Badge v-if="comment.isSpam" variant="destructive" class="text-xs">
                  待审核
                </Badge>
              </div>
              
              <time class="text-xs text-muted-foreground shrink-0">
                {{ displayTime }}
              </time>
            </div>
            
            <div 
              class="mt-2 text-sm leading-relaxed break-words"
              :class="{ 'line-clamp-4': !isContentExpanded }"
              v-html="comment.content"
            />
            
            <button 
              v-if="!isContentExpanded && comment.content.length > 200"
              @click="isContentExpanded = true"
              class="mt-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              展开全文
            </button>
            
            <div class="mt-3 flex items-center justify-between">
              <TkAction
                :liked="liked"
                :like-count="likeCount"
                @like="onLike"
                @reply="onReply"
              />
              
              <div v-if="isAdmin" class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  v-if="comment.isSpam"
                  variant="ghost"
                  size="sm"
                  @click="emit('moderate', comment.id, 'approve')"
                >
                  显示
                </Button>
                <Button 
                  v-else
                  variant="ghost"
                  size="sm"
                  @click="emit('moderate', comment.id, 'spam')"
                >
                  隐藏
                </Button>
                <Button 
                  v-if="!comment.rid"
                  variant="ghost"
                  size="sm"
                  @click="emit('top', comment.id, !comment.top)"
                >
                  {{ comment.top ? '取消置顶' : '置顶' }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
