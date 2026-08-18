import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    dts({ include: ['src/**/*.ts', 'src/**/*.vue'] })
  ],
  define: {
    'process.env': {}
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Twikee',
      formats: ['es', 'umd'],
      fileName: (format) => `twikee.${format}.js`
    },
    rollupOptions: {
      output: {
        assetFileNames: 'style.[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'blobatar/_parts': resolve(__dirname, 'node_modules/blobatar/src/blobatar.ts')
    }
  },
  server: {
    open: '/demo.html',
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
