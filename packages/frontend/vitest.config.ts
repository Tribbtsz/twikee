import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    // sanitizeHtml 依赖真实 DOM 解析（template.innerHTML）
    environment: 'happy-dom',
  },
})
