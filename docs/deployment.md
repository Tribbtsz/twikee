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
TWIKEE_ADMIN_PASSWORD=your-admin-password
TWIKEE_SECRET=your-secret-key
```

上游有更新时，在 Fork 仓库点击 `Sync fork -> Update branch`，Vercel 会自动部署。
