---
title: 部署
description: 把 Twikee 部署到生产环境：Vercel 导入、必填与可选环境变量、CORS 配置，以及升级流程。
---

# 部署

Twikee 的后端是标准的 Hono Serverless 应用，推荐部署到 Vercel，数据库使用 Turso。

## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Tribbtsz/twikee&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,TWIKEE_SECRET&envDescription=Required%20environment%20variables&envLink=https://github.com/Tribbtsz/twikee/blob/main/.env.example)

建议先 Fork 仓库，再导入 Vercel 部署，方便后续同步上游更新。

## 环境变量

### 必填

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
TWIKEE_SECRET=your-secret-key
```

### 可选

```bash
# CORS 白名单（逗号分隔）。留空 = 允许所有来源（默认）。
# 生产建议配置为实际嵌入评论的站点来源，例如 https://your-blog.com
CORS_ORIGIN=https://your-blog.com

# 管理 token 有效期（毫秒），默认 7 天
TWIKEE_TOKEN_TTL=604800000
```

::: warning 关于 TWIKEE_SECRET
`TWIKEE_SECRET` 用于签名管理端登录 token；token 同时绑定管理员密码，改密后所有已登录会话自动失效。生产环境缺这个变量会 **fail-fast**：签发/校验 token 时直接抛错，登录与管理接口返回 500，不会静默降级、也不会「临时自动生成」。只有非生产环境才用随机密钥，且进程重启即失效。
:::

::: tip 管理员密码不在环境变量里
首次打开 `/admin` 时按提示通过 `POST /api/auth/setup` 设置，保存在数据库的 `ADMIN_PASSWORD` 配置项中。
:::

## CORS

如果评论页与 API 不同域（例如博客在 `blog.example.com`、API 在 `twikee.vercel.app`），需要把博客来源加入 `CORS_ORIGIN`。同域部署则留空即可。

## 上游更新

在 Fork 仓库点击 `Sync fork → Update branch`，Vercel 会自动重新部署。

## 数据库迁移

代码合入后若包含数据库结构变更，部署完成后**首次访问 API 时会自动执行迁移**，无需手动操作。升级前建议先备份 Turso 库。

详见[数据库迁移](/guide/migration)。
