// 把站点构建产物与 VitePress 文档站、可嵌入的库文件组装到最终的 dist-site 目录。
// Vercel 的 outputDirectory 指向 packages/frontend/dist-site。
//
// 组装顺序（互不覆盖的原因）：
//   1. packages/frontend/dist-site      演示页 / 管理后台（assetsDir = demo-assets）
//   2. packages/docs/.vitepress/dist    文档站（站点根路径，assetsDir = assets）
//   3. packages/frontend/dist           可嵌入产物 twikee.umd.js / twikee.es.js / style.css
import { copyFileSync, cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  ['frontend site', resolve(rootDir, 'packages/frontend/dist-site')],
  ['docs', resolve(rootDir, 'packages/docs/.vitepress/dist')],
  ['frontend library', resolve(rootDir, 'packages/frontend/dist')],
]

const missing = targets.filter(([, dir]) => !existsSync(dir))
if (missing.length > 0) {
  for (const [label, dir] of missing) {
    console.error(`[build-site] missing ${label} output: ${dir}`)
  }
  console.error('[build-site] run the package builds before assembling the site')
  process.exit(1)
}

const siteDir = targets[0][1]

// 文档站放到站点根路径：/、/guide/*、/en/*、/assets/*、sitemap.xml、robots.txt
cpSync(targets[1][1], siteDir, { recursive: true })

// VitePress 会产出 404.html，但 Vercel 把它当普通静态文件用 200 返回，
// 未知路径就成了「软 404」（状态码 200 + 404 页面），对 SEO 不利。
// 删掉它，让 Vercel 回退到自带错误页——那样状态码才是真正的 404。
rmSync(join(siteDir, '404.html'), { force: true })

// 可嵌入产物放到根路径，供第三方站点通过 /twikee.umd.js 与 /style.css 引入
const embeddableFiles = ['twikee.umd.js', 'twikee.es.js', 'style.css', 'index.d.ts']
let copied = 0
for (const file of embeddableFiles) {
  const from = resolve(targets[2][1], file)
  if (existsSync(from)) {
    copyFileSync(from, resolve(siteDir, file))
    copied += 1
  }
}
if (copied === 0) {
  console.error('[build-site] no embeddable files (twikee.umd.js / style.css) found to copy')
  process.exit(1)
}

console.log(`[build-site] assembled site into ${siteDir}`)
