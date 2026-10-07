---
title: Deployment
description: "Deploy Twikee to production: import to Vercel, required and optional environment variables, CORS, and how upgrades work."
---

# Deployment

Twikee's backend is a standard Hono serverless app. Deploy it to Vercel and use Turso for the database.

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Tribbtsz/twikee&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,TWIKEE_SECRET&envDescription=Required%20environment%20variables&envLink=https://github.com/Tribbtsz/twikee/blob/main/.env.example)

Fork the repository first, then import it into Vercel — that makes syncing upstream updates easier.

## Environment variables

### Required

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
TWIKEE_SECRET=your-secret-key
```

### Optional

```bash
# CORS allow-list (comma separated). Empty = allow all origins (default).
# In production, set it to the sites that embed the widget, e.g. https://your-blog.com
CORS_ORIGIN=https://your-blog.com

# Admin token lifetime in milliseconds. Default 7 days.
TWIKEE_TOKEN_TTL=604800000
```

::: warning About TWIKEE_SECRET
`TWIKEE_SECRET` signs admin login tokens; tokens are also bound to the admin password, so changing the password invalidates every logged-in session. A missing value in production **fails fast**: signing or verifying a token throws, and login and admin endpoints return 500. There is no silent fallback and no temporary secret. Only non-production environments use a random secret, which is lost on restart.
:::

::: tip The admin password is not an environment variable
The first time you open `/admin`, set it via `POST /api/auth/setup`. It is stored in the database as the `ADMIN_PASSWORD` setting.
:::

## CORS

If the comment page and the API live on different origins (for example the blog on `blog.example.com` and the API on `twikee.vercel.app`), add the blog origin to `CORS_ORIGIN`. With a same-origin deployment you can leave it empty.

## Updating from upstream

In your fork, click `Sync fork → Update branch` and Vercel redeploys automatically.

## Database migrations

If a merged change includes a schema change, the migration runs automatically on the **first API request after deployment** — no manual step required. Back up your Turso database before upgrading.

See [Migrations](/en/guide/migration) for details.
