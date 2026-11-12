# Twikee

一个轻量评论系统，基于 Vue 3 + Hono + Turso/libSQL 构建。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Tribbtsz/twikee&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,TWIKEE_SECRET&envDescription=Required%20environment%20variables&envLink=https://github.com/Tribbtsz/twikee/blob/main/.env.example)

- 📖 文档：<https://twikee.vercel.app>
- 🧪 在线演示：<https://twikee.vercel.app/demo>
- 🛠️ 管理后台：<https://twikee.vercel.app/admin>

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm dev
```

本地访问 `http://localhost:5173`（启动时会自动打开组件演示页），在线演示 `http://localhost:5173/demo`，管理后台 `http://localhost:5173/admin`。后端 API 跑在 `http://localhost:3000`，前端 dev server 已代理 `/api`。

## 前端接入

```html
<link rel="stylesheet" href="https://your-domain.com/style.css" />
<script src="https://your-domain.com/twikee.umd.js"></script>
<script>
  twikee.init({
    el: '#comment',
    envId: 'https://your-api-domain.com',
  })
</script>
```

`init` 还支持可选的 `appearance` 外观配置（预设、提交按钮、字段布局等）；管理后台通过 `twikee.initAdmin({ el, envId })` 单独挂载。完整参数见[前端接入](https://twikee.vercel.app/guide/integration.html)。

## 文档

文档站使用 [VitePress](https://vitepress.dev/) 构建（支持中英双语、全文搜索与 SEO），源文件位于 [`packages/docs`](./packages/docs)：

- 在线文档：<https://twikee.vercel.app>
- [快速开始](https://twikee.vercel.app/guide/getting-started.html)
- [部署](https://twikee.vercel.app/guide/deployment.html)
- [前端接入](https://twikee.vercel.app/guide/integration.html)
- [外观配置](https://twikee.vercel.app/guide/appearance.html)
- [API](https://twikee.vercel.app/guide/api.html)
- [数据库迁移](https://twikee.vercel.app/guide/migration.html)

本地预览文档站：

```bash
pnpm dev:docs
```

## 项目结构

```
api/                    # Vercel Serverless 入口：把 /api 请求转发给 Hono 应用
packages/
├── api/                # Hono 后端
├── core/               # 领域逻辑、Turso 适配器、数据库迁移
├── frontend/           # Vue 组件、管理后台、可嵌入产物
└── docs/               # VitePress 文档站
scripts/
├── dev.ts              # 本地开发入口：同时启动 API 与前端
└── build-site.mjs      # Vercel 构建时组装文档站、演示页与可嵌入产物
```

生产部署由 `vercel.json` 把 `/api/*` 重写到 `api/[...slug].ts`、`/demo` 与 `/admin` 重写到对应页面；`scripts/build-site.mjs` 再把文档站、演示页和 `twikee.umd.js` / `style.css` 组装进同一个站点目录。

## 致谢

- [Twikoo](https://github.com/twikoojs/twikoo) - 本项目参考的评论系统
- [blobatar](https://github.com/Alain00/blobatar) - 头像生成库，确定性生成几何头像，支持悬停动画

## License

MIT
