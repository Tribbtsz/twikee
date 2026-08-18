# Twikee

一个轻量评论系统，基于 Vue 3 + Hono + Turso/libSQL 构建。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Tribbtsz/twikee&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,TWIKEE_ADMIN_PASSWORD,TWIKEE_SECRET&envDescription=Required%20environment%20variables&envLink=https://github.com/Tribbtsz/twikee/blob/main/.env.example)

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm dev
```

本地访问 `http://localhost:5173`，管理后台访问 `http://localhost:5173/admin`。

## 前端接入

```html
<link rel="stylesheet" href="https://your-domain.com/style.css">
<script src="https://your-domain.com/twikee.umd.js"></script>
<script>
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com'
})
</script>
```

## 文档

- [部署](./docs/deployment.md)
- [前端接入](./docs/frontend.md)
- [外观配置](./docs/appearance.md)
- [API](./docs/api.md)

## 致谢

- [Twikoo](https://github.com/twikoojs/twikoo) - 本项目参考的评论系统
- [blobatar](https://github.com/Alain00/blobatar) - 头像生成库，确定性生成几何头像，支持悬停动画

## License

MIT
