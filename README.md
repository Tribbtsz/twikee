# Twikee

一个现代化的评论系统，基于 Vue 3 + Hono + Turso/libSQL 构建。

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS 4 + shadcn/ui 风格组件
- **后端**: Hono.js (轻量级跨平台框架)
- **数据库**: Turso (libSQL/SQLite 兼容)
- **部署**: Vercel / Netlify / Cloudflare Workers (预留)

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 本地开发（使用本地 SQLite）

复制环境变量模板:

```bash
cp .env.example .env
```

编辑 `.env`，设置以下变量:

```bash
# 本地 SQLite（默认即可，无需修改）
TURSO_DATABASE_URL=file:./data/twikee.db
TURSO_AUTH_TOKEN=

# 必填：管理员密码和 JWT 密钥
TWIKOO_ADMIN_PASSWORD=your-password
TWIKOO_SECRET=your-secret-key
```

启动开发服务器:

```bash
pnpm dev
```

启动后访问 `http://localhost:5173` 查看 Demo 页面，`http://localhost:5173/admin` 进入管理面板。

API 服务运行在 `http://localhost:3000`，首次启动会自动创建 SQLite 数据库文件。

### 3. 生产部署（Turso 云数据库）

在 Vercel 或其他平台设置以下环境变量:

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
TWIKOO_ADMIN_PASSWORD=your-admin-password
TWIKOO_SECRET=your-secret-key
```

## 前端使用

在网站中引入:

```html
<script src="https://your-domain.com/twikee.es.js"></script>
<link rel="stylesheet" href="https://your-domain.com/style.css">
<script>
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com',
  lang: 'zh-CN'
})
</script>
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/comment | 获取评论列表 |
| POST | /api/comment | 创建评论 |
| POST | /api/comment/:id/like | 点赞 |
| GET | /api/config | 获取公开配置 |
| POST | /api/auth/setup | 初始化密码 |
| POST | /api/auth/login | 管理员登录 |
| GET | /api/admin/comments | 管理评论列表 |
| POST | /api/admin/config | 更新配置 |

## 通知推送 (可选)

支持以下通知渠道，在管理面板中配置:

- Telegram Bot
- Webhook
- Email (Resend)

## 项目结构

```
twikee/
├── packages/
│   ├── core/           # 核心业务逻辑（数据库适配、认证、评论服务）
│   ├── frontend/       # Vue 3 前端（评论组件 + 管理面板）
│   └── api/            # Hono API 服务
├── .env.example        # 环境变量模板
└── pnpm-workspace.yaml
```

## License

MIT
