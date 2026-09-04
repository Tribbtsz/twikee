import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // @vercel/functions 仅在 Vercel 运行时动态 import，禁止打进 bundle（保持 CF 可移植）
  external: ['@vercel/functions'],
})
