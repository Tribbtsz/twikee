---
title: Getting started
description: "Run the Twikee comment system locally: requirements, install, start, project layout and next steps."
---

# Getting started

This page walks you through running Twikee locally from scratch.

## Requirements

- Node.js >= 20 (22 / 24 LTS recommended)
- [pnpm](https://pnpm.io/) 10.x

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Once it is running:

- Demo page: `http://localhost:5173` (opens `/demo.html` automatically)
- Admin panel: `http://localhost:5173/admin`

Local development uses a SQLite file database by default — no cloud accounts needed. On the first API request Twikee creates the database, the tables and applies every migration.

::: tip No manual setup needed
`.env.example` defaults to `TURSO_DATABASE_URL=file:./data/twikee.db`. The data file is written under `data/`, which is already in `.gitignore`.
:::

## Create the admin password

The first time you open `/admin`, Twikee guides you through `POST /api/auth/setup` to set an admin password. It is stored in the database as the `ADMIN_PASSWORD` setting — **not** in an environment variable.

After that you can moderate comments and configure appearance and notifications from the panel.

## Project layout

```
twikee/
├── packages/
│   ├── api/         # Hono backend, Vercel serverless entry
│   ├── core/        # Domain logic, Turso/libSQL adapter, migrations
│   ├── frontend/    # Vue 3 components, admin panel, embeddable UMD build
│   └── docs/        # This site (VitePress) sources
├── scripts/         # Local dev and site build scripts
└── vercel.json      # Deployment config and route rewrites
```

| Package | Responsibility |
|---------|----------------|
| `@twikee/api` | HTTP layer: comments, likes, auth, config, notifications |
| `@twikee/core` | Database-agnostic business logic + `TursoAdapter` + migrations |
| `@twikee/frontend` | Comment widget, admin panel, `twikee.umd.js` / `style.css` |
| `@twikee/docs` | VitePress documentation site (this page) |

## Common commands

```bash
pnpm dev            # start API and frontend together
pnpm build          # build every package
pnpm test           # run all tests
pnpm typecheck      # type check
pnpm lint           # ESLint
pnpm format         # Prettier
```

## Next steps

- [Deploy to production](/en/guide/deployment)
- [Embed comments on your site](/en/guide/integration)
- [Customize the appearance](/en/guide/appearance)
- [Read the API reference](/en/guide/api)
