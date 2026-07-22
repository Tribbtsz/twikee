<script setup lang="ts">
import { computed } from 'vue'
import AdminPanel from './components/admin/AdminPanel.vue'

const props = withDefaults(defineProps<{
  envId: string
}>(), {})

const apiUrl = computed(() => {
  let url = props.envId
  if (!url.startsWith('http')) {
    url = `https://${url}`
  }
  return url
})
</script>

<template>
  <AdminPanel :api-url="apiUrl" />
</template>
