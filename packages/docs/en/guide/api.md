---
title: API reference
description: Twikee's public and admin HTTP endpoints, plus the behavior of likes, Webhook notifications and imports.
---

# API reference

## Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (deploy smoke test) |
| `GET` | `/api/config` | Read public config (only 5 public keys are returned) |
| `GET` | `/api/comment` | List comments |
| `POST` | `/api/comment` | Create a comment |
| `POST` | `/api/comment/:id/like` | Like / unlike (calling again toggles back) |
| `GET` | `/api/auth/status` | Whether the admin password is set: `{ initialized }` |
| `POST` | `/api/auth/setup` | Set the admin password for the first time (400 if already set) |
| `POST` | `/api/auth/login` | Admin login, returns a token |
| `POST` | `/api/auth/verify` | Verify that a token is still valid |

### Admin (`Authorization: Bearer <token>` required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/comments` | Comment list (filter by url / status / include-spam, paginated) |
| `GET` | `/api/admin/comments/all` | Same, but across all pages when no `url` is given — for export/overview |
| `GET` | `/api/admin/pages` | Pages that have comments (count, spam count, last comment time) |
| `PUT` | `/api/admin/comment/:id` | Edit a comment (field allow-list to prevent mass assignment) |
| `DELETE` | `/api/admin/comment/:id` | Delete a comment (soft delete) |
| `POST` | `/api/admin/comment/:id/moderate` | Moderate: approve / flag as spam via `action` |
| `POST` | `/api/admin/comment/:id/top` | Pin / unpin (`{ top: boolean }`) |
| `POST` | `/api/admin/import` | Import comments (validated one by one, max 1000 per request) |
| `GET` | `/api/admin/config` | Read all config (secret fields are not returned) |
| `POST` | `/api/admin/config` | Update config (a blank secret means "keep unchanged") |
| `GET` | `/api/admin/stats` | Comment stats (total / approved / pending review) |

Notifications support Telegram bots, Webhooks, email, WxPusher and WeCom group bots, all configurable from the admin panel.

## Notification config keys

Set through `POST /api/admin/config`:

| Key | Description |
|-----|-------------|
| `NOTIFICATION_ENABLE` | Enable comment notifications (`true`/`false`) |
| `NOTIFICATION_TYPE` | Channel: `telegram` / `webhook` / `email` / `wxpusher` / `wecom` |
| `TELEGRAM_BOT_TOKEN` (secret) / `TELEGRAM_CHAT_ID` | Telegram bot |
| `WEBHOOK_URL` | Custom notification endpoint |
| `WXPUSHER_APP_TOKEN` (secret) / `WXPUSHER_UIDS` | WxPusher; multiple UIDs comma separated |
| `WECOM_KEY` (secret) | Key from a WeCom group bot webhook URL |
| `SMTP_FROM` / `SMTP_TO` | Email (Resend) sender / recipient |
| `SMTP_PASS` (secret) | Email (Resend) API key |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | Reserved; unused by the email channel today |

Keys marked as secret are never returned by `GET /api/admin/config`; sending an empty value on save means "keep unchanged".

## Behavior

### Likes `POST /api/comment/:id/like`

- Visitor identity is resolved in priority order: the server-issued `tk_uid` cookie (HttpOnly) → the `x-user-id` request header (must be a UUID) → generated on the spot and written to a cookie. Repeated calls from the same identity toggle between like and unlike.
- With a cross-origin deployment (comment page and API on different origins) the browser will not send cookies with fetch, so the frontend persists `x-user-id` to keep identity stable; the server also tries to persist the identity into a cookie.
- The response is authoritative: `{ success, liked, likes }`. The client updates optimistically on click (local like state and count immediately, rapid clicks collapse into one request, requests run serially), and corrects itself once the server answers. The count always comes from the `likes` table in the database — the client never does its own bookkeeping.
- A missing comment (including soft-deleted ones) returns 404.
- Rate limits: 60 requests per IP per minute; `POST /api/comment` 10 per minute; login / setup 10 per IP per 5 minutes. Exceeding them returns 429 with `Retry-After`. On serverless, limits are counted per instance — use external storage if you need globally accurate limiting.

### Webhook notifications `WEBHOOK_URL`

- Only `http`/`https` are allowed, and the target must not be a private, loopback or link-local address (including the cloud metadata address `169.254.169.254`). This is validated on save; invalid values return 400.
- Redirects are not followed (so a public URL cannot 302 into the private network to bypass validation).
- The payload never includes the commenter's `ip` / `ua`.

### Import `POST /api/admin/import`

- Accepts an array of comments, up to 1000 per request, each validated against the schema.
- Original `id`s are preserved: only by keeping `id`s can `rid` reply relationships survive the import (otherwise every reply becomes a top-level comment). Fields like `createdAt`/`likes`/`isSpam`/`top`/`master` are preserved too.
- Entries whose `id` collides with an existing comment are reported as failures, with a per-entry reason in `failedItems`.
