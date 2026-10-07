import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    'process.env': {},
  },
  build: {
    outDir: 'dist-site',
    // 与 VitePress 的 /assets 分开，避免两个构建产物在同一目录下互相覆盖
    assetsDir: 'demo-assets',
    rollupOptions: {
      input: {
        // 站点根路径由 VitePress 文档站占用；演示页对外是 /demo，管理后台是 /admin
        demo: resolve(__dirname, 'demo.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
