import { defineConfig, type HeadConfig, type TransformPageContext } from 'vitepress'

const SITE_URL = 'https://twikee.vercel.app'
const GITHUB_URL = 'https://github.com/Tribbtsz/twikee'
const OG_IMAGE = `${SITE_URL}/og.jpg`

const repoEditPattern = `${GITHUB_URL}/edit/main/packages/docs/:path`

/**
 * 把 VitePress 的相对路径（如 guide/api.md）转成站点的实际 URL（/guide/api.html）。
 * 刻意不用 VitePress 的 cleanUrls：那需要 Vercel 也开 cleanUrls，属于全局行为，
 * 会改变部署里所有 .html 路由的表现，风险大于收益。
 */
function toPagePath(relativePath: string): string {
  const path = '/' + relativePath.replace(/\.md$/, '')
  if (path.endsWith('/index')) return path.slice(0, -'index'.length)
  return path.endsWith('.html') ? path : `${path}.html`
}

const zhNav = [
  { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
  { text: '在线演示', link: `${SITE_URL}/demo` },
  { text: 'English', link: '/en/' },
]

const enNav = [
  { text: 'Guide', link: '/en/guide/getting-started', activeMatch: '/en/guide/' },
  { text: 'Live demo', link: `${SITE_URL}/demo` },
  { text: '简体中文', link: '/' },
]

const zhSidebar = [
  {
    text: '指南',
    items: [
      { text: '快速开始', link: '/guide/getting-started' },
      { text: '部署', link: '/guide/deployment' },
      { text: '前端接入', link: '/guide/integration' },
      { text: '外观配置', link: '/guide/appearance' },
    ],
  },
  {
    text: '参考',
    items: [
      { text: 'API', link: '/guide/api' },
      { text: '数据库迁移', link: '/guide/migration' },
    ],
  },
]

const enSidebar = [
  {
    text: 'Guide',
    items: [
      { text: 'Getting started', link: '/en/guide/getting-started' },
      { text: 'Deployment', link: '/en/guide/deployment' },
      { text: 'Client integration', link: '/en/guide/integration' },
      { text: 'Appearance', link: '/en/guide/appearance' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'API', link: '/en/guide/api' },
      { text: 'Migrations', link: '/en/guide/migration' },
    ],
  },
]

function buildStructuredData(context: TransformPageContext): HeadConfig | null {
  const { pageData } = context
  const relativePath = pageData.relativePath
  if (relativePath !== 'index.md' && relativePath !== 'en/index.md') return null

  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Twikee',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    softwareVersion: '1.0.0',
    license: 'https://opensource.org/licenses/MIT',
    description: pageData.description,
    url: SITE_URL,
    codeRepository: GITHUB_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }

  return ['script', { type: 'application/ld+json' }, JSON.stringify(data)]
}

export default defineConfig({
  title: 'Twikee',
  description: '轻量、现代化的自建评论系统，基于 Vue 3 + Hono + Turso/libSQL。',
  lang: 'zh-CN',
  lastUpdated: true,
  sitemap: {
    hostname: SITE_URL,
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#3b82f6' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Twikee' }],
    ['meta', { property: 'og:image', content: OG_IMAGE }],
    ['meta', { property: 'og:image:width', content: '2880' }],
    ['meta', { property: 'og:image:height', content: '1800' }],
    ['meta', { property: 'og:image:alt', content: 'Twikee — 轻量、现代化的自建评论系统' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: OG_IMAGE }],
  ],
  transformHead(context) {
    const { pageData } = context
    const relativePath = pageData.relativePath
    const isEn = relativePath.startsWith('en/')
    const zhRelative = isEn ? relativePath.slice('en/'.length) : relativePath
    const enRelative = isEn ? relativePath : `en/${relativePath}`
    const canonical = SITE_URL + toPagePath(relativePath)
    const title = pageData.frontmatter.title || pageData.title || 'Twikee'
    const description = pageData.description || ''

    const head: HeadConfig[] = [
      ['link', { rel: 'canonical', href: canonical }],
      ['link', { rel: 'alternate', hreflang: 'zh-CN', href: SITE_URL + toPagePath(zhRelative) }],
      ['link', { rel: 'alternate', hreflang: 'en', href: SITE_URL + toPagePath(enRelative) }],
      ['link', { rel: 'alternate', hreflang: 'x-default', href: SITE_URL + toPagePath(zhRelative) }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { property: 'og:locale', content: isEn ? 'en_US' : 'zh_CN' }],
      ['meta', { property: 'og:locale:alternate', content: isEn ? 'zh_CN' : 'en_US' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    ]

    const structuredData = buildStructuredData(context)
    if (structuredData) head.push(structuredData)

    return head
  },
  themeConfig: {
    logo: '/logo.svg',
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    editLink: {
      pattern: repoEditPattern,
      text: '在 GitHub 上编辑此页',
    },
    footer: {
      message: '基于 MIT 许可证发布',
      copyright: 'Copyright © 2024-present Twikee',
    },
    search: {
      provider: 'local',
    },
    nav: zhNav,
    sidebar: zhSidebar,
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      description: '轻量、现代化的自建评论系统，基于 Vue 3 + Hono + Turso/libSQL。',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        editLink: {
          pattern: repoEditPattern,
          text: '在 GitHub 上编辑此页',
        },
        footer: {
          message: '基于 MIT 许可证发布',
          copyright: 'Copyright © 2024-present Twikee',
        },
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一篇', next: '下一篇' },
        darkModeSwitchLabel: '主题',
        sidebarMenuLabel: '目录',
        returnToTopLabel: '回到顶部',
        lastUpdatedText: '最后更新于',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档',
              },
              modal: {
                displayDetails: '显示详情',
                resetButtonTitle: '清除查询',
                backButtonTitle: '返回',
                noResultsText: '没有找到结果',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      description: 'A lightweight, modern self-hosted comment system built with Vue 3 + Hono + Turso/libSQL.',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        editLink: {
          pattern: repoEditPattern,
          text: 'Edit this page on GitHub',
        },
        footer: {
          message: 'Released under the MIT License',
          copyright: 'Copyright © 2024-present Twikee',
        },
        outline: { level: [2, 3], label: 'On this page' },
        docFooter: { prev: 'Previous page', next: 'Next page' },
        darkModeSwitchLabel: 'Appearance',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        lastUpdatedText: 'Last updated',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: 'Search docs',
                buttonAriaLabel: 'Search docs',
              },
              modal: {
                displayDetails: 'Display detailed list',
                resetButtonTitle: 'Reset search',
                backButtonTitle: 'Back',
                noResultsText: 'No results found',
                footer: {
                  selectText: 'Select',
                  navigateText: 'Navigate',
                  closeText: 'Close',
                },
              },
            },
          },
        },
      },
    },
  },
})
