import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// 与 vercel.json 的 rewrite 对齐：本地也能用 /admin、/demo 访问对应页面
const servePrettyUrls: Plugin = {
  name: 'serve-pretty-urls',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const raw = req.url ?? ''
      const queryAt = raw.indexOf('?')
      const path = queryAt === -1 ? raw : raw.slice(0, queryAt)
      const query = queryAt === -1 ? '' : raw.slice(queryAt)
      if (path === '/admin') req.url = `/admin.html${query}`
      else if (path === '/demo') req.url = `/demo.html${query}`
      next()
    })
  },
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), dts({ include: ['src/**/*.ts', 'src/**/*.vue'] }), servePrettyUrls],
  define: {
    'process.env': {},
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Twikee',
      formats: ['es', 'umd'],
      fileName: (format) => `twikee.${format}.js`,
    },
    rollupOptions: {
      output: {
        assetFileNames: 'style.[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    open: '/demo.html',
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
