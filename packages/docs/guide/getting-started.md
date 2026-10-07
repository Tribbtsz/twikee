---
title: 快速开始
description: 在本地把 Twikee 评论系统跑起来：环境要求、安装、启动、目录结构与下一步。
---

# 快速开始

本页带你从零把 Twikee 跑在本地。

## 环境要求

- Node.js >= 20（推荐 22 / 24 LTS）
- [pnpm](https://pnpm.io/) 10.x

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev
```

启动后：

- 演示页：`http://localhost:5173`（自动打开 `/demo.html`）
- 管理后台：`http://localhost:5173/admin`

本地开发默认使用 SQLite 文件数据库，无需任何云端配置。首次访问 API 时会自动建库、建表并应用全部迁移。

::: tip 无需手动建库
`.env.example` 里默认是 `TURSO_DATABASE_URL=file:./data/twikee.db`，数据文件会写到 `data/` 下（已在 `.gitignore` 中忽略）。
:::

## 首次设置管理员

首次打开 `/admin` 会引导你通过 `POST /api/auth/setup` 设置管理员密码。密码保存在数据库的 `ADMIN_PASSWORD` 配置项中，**不在环境变量里**。

设置完成后即可在后台管理评论、配置外观、配置通知渠道。

## 目录结构

```
twikee/
├── packages/
│   ├── api/         # Hono 后端，Vercel Serverless 入口
│   ├── core/        # 领域逻辑、Turso/libSQL 适配器、数据库迁移
│   ├── frontend/    # Vue 3 组件、管理后台、可嵌入的 UMD 产物
│   └── docs/        # 本站（VitePress）文档源
├── scripts/         # 本地开发与站点构建脚本
└── vercel.json      # 部署配置与路由重写
```

| 包 | 作用 |
|----|------|
| `@twikee/api` | HTTP 层：评论、点赞、鉴权、配置、通知接口 |
| `@twikee/core` | 与数据库无关的业务逻辑 + `TursoAdapter` + migration |
| `@twikee/frontend` | 评论区组件、管理后台、`twikee.umd.js` / `style.css` |
| `@twikee/docs` | VitePress 文档站（本页） |

## 常用命令

```bash
pnpm dev            # 同时启动 API 与前端
pnpm build          # 构建所有包
pnpm test           # 运行所有测试
pnpm typecheck      # 类型检查
pnpm lint           # ESLint
pnpm format         # Prettier 格式化
```

## 下一步

- [部署到生产环境](/guide/deployment)
- [在网站中接入评论](/guide/integration)
- [定制外观](/guide/appearance)
- [阅读 API 参考](/guide/api)
