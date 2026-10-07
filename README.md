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

本地访问 `http://localhost:5173`，管理后台访问 `http://localhost:5173/admin`；启动时会自动打开组件演示页 `/demo.html`。

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
packages/
├── api/         # Hono 后端
├── core/        # 领域逻辑、Turso 适配器、数据库迁移
├── frontend/    # Vue 组件、管理后台、可嵌入产物
└── docs/        # VitePress 文档站
```

## 致谢

- [Twikoo](https://github.com/twikoojs/twikoo) - 本项目参考的评论系统
- [blobatar](https://github.com/Alain00/blobatar) - 头像生成库，确定性生成几何头像，支持悬停动画

## License

MIT
