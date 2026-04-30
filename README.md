# Twikoo V3

一个现代化的评论系统，基于 Vue 3 + Hono + Turso 构建。

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS 4 + shadcn/ui 风格组件
- **后端**: Hono.js (轻量级跨平台框架)
- **数据库**: Turso (libSQL/SQLite 兼容)
- **部署**: Vercel (主) / Netlify / Cloudflare Workers (预留)

## 项目结构

```
twikoo-v3/
├── packages/
│   ├── core/           # 核心业务逻辑
│   ├── frontend/       # Vue 3 前端
│   └── api/            # Hono API
├── pnpm-workspace.yaml
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

在 Vercel 中设置以下环境变量:

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
TWIKOO_ADMIN_PASSWORD=your-admin-password
```

### 3. 本地开发

```bash
pnpm dev
```

### 4. 部署到 Vercel

```bash
cd packages/api
pnpm deploy
```

## 前端使用

在网站中引入:

```html
<script src="https://your-vercel-app.vercel.app/twikoo.es.js"></script>
<link rel="stylesheet" href="https://your-vercel-app.vercel.app/style.css">
<script>
twikoo.init({
  el: '#comment',
  envId: 'https://your-vercel-app.vercel.app',
  lang: 'zh-CN'
})
</script>
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/comment | 获取评论列表 |
| POST | /api/comment | 创建评论 |
| GET | /api/comment/:id | 获取单条评论 |
| POST | /api/comment/:id/like | 点赞 |
| POST | /api/auth/login | 管理员登录 |
| GET | /api/admin/comments | 管理评论列表 |
| POST | /api/admin/moderate | 审核评论 |

## 通知推送 (可选)

支持以下通知渠道:

- Telegram Bot
- Webhook
- Email (Resend)

在管理面板中配置即可启用。 

## License

MIT
