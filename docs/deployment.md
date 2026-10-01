# 部署

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev
```

本地 SQLite 默认配置即可运行。首次启动会自动创建数据库文件。

## 生产环境

建议先 Fork 仓库，再导入 Vercel 部署，方便后续同步更新。

必填环境变量：

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
TWIKEE_SECRET=your-secret-key
```

> 管理员密码不在环境变量里设置：首次打开 `/admin` 时按提示通过 `POST /api/auth/setup` 设置，保存在数据库 `ADMIN_PASSWORD` 中。

可选环境变量：

```bash
# CORS 白名单（逗号分隔）。留空 = 允许所有来源（默认）。
# 生产建议配置为实际嵌入评论的站点来源，例如 https://your-blog.com
CORS_ORIGIN=https://your-blog.com

# 管理 token 有效期（毫秒），默认 7 天
TWIKEE_TOKEN_TTL=604800000
```

> 注意：`TWIKEE_SECRET` 用于签名管理端登录 token；token 同时绑定管理员密码，改密后所有已登录会话自动失效。若 `TWIKEE_SECRET` 缺失，服务会临时自动生成——生产环境务必显式设置，否则重启后所有登录态失效。

上游有更新时，在 Fork 仓库点击 `Sync fork -> Update branch`，Vercel 会自动部署。

代码合入后若包含数据库结构变更，部署完成后**首次访问 API 时会自动执行迁移**，详见[数据库迁移](./migration.md)。升级前建议先备份 Turso 库。
