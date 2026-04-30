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
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Twikoo',
      formats: ['es', 'umd'],
      fileName: (format) => `twikee.${format}.js`
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
        assetFileNames: 'style.[ext]'
      }
    }
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  }
})
