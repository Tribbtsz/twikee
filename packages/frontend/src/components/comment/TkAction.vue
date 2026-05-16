<script setup lang="ts">
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
  <div class="tk-action">
    <button
      class="tk-action__btn"
      :class="{ 'tk-action__btn--liked': liked }"
      :aria-label="liked ? '取消点赞' : '点赞'"
      :aria-pressed="liked"
      @click="emit('like')"
    >
      {{ liked ? '已赞' : '赞' }}
      <span v-if="likeCount > 0" class="tk-action__count">{{ likeCount }}</span>
    </button>

    <button
      class="tk-action__btn"
      aria-label="回复评论"
      @click="emit('reply')"
    >
      回复
      <span v-if="repliesCount > 0" class="tk-action__count">{{ repliesCount }}</span>
    </button>
  </div>
</template>

<style scoped>
.tk-action {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tk-action__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  transition: color 0.15s;
}

.tk-action__btn:hover {
  color: var(--primary);
}

.tk-action__btn--liked {
  color: var(--primary);
}

.tk-action__count {
  font-size: 0.6875rem;
}
</style>
