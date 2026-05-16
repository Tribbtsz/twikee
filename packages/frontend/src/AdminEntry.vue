<script setup lang="ts">
import { ref, provide } from 'vue'
import AdminPanel from './components/admin/AdminPanel.vue'

const apiUrl = ref(window.TWIKEE_API_URL || 'http://localhost:3000')
provide('apiUrl', apiUrl)
</script>

<template>
  <AdminPanel :api-url="apiUrl" />
</template>
