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
| `GET` | `/api/config` | Read public config (MASTER_TAG, COMMENT_PLACEHOLDER, COMMENT_PAGE_SIZE, DEMO_ENABLED, COMMENTS_CLOSED, IMAGE_CDN, MAX_IMAGE_SIZE) |
| `GET` | `/api/comment` | List comments |
| `POST` | `/api/comment` | Create a comment (returns an `editToken`, valid for editing/deleting within 30 minutes) |
| `POST` | `/api/comment/:id/like` | Like / unlike (calling again toggles back) |
| `GET` | `/api/comment/count?urls=/a,/b` | Batch comment counts (up to 20 urls, returns `{ counts }`) |
| `POST` | `/api/comment/:id/report` | Report a comment (`{ reason? }`, notifies the admin) |
| `PUT` | `/api/comment/:id` | Edit your own comment (`{ content, editToken }`, within 30 minutes) |
| `DELETE` | `/api/comment/:id` | Delete your own comment (`{ editToken }`, soft delete) |
| `GET` | `/api/auth/status` | Whether the admin password is set: `{ initialized }` |
| `POST` | `/api/auth/setup` | Set the admin password for the first time (400 if already set) |
| `POST` | `/api/auth/login` | Admin login, returns a token |
| `POST` | `/api/auth/verify` | Verify that a token is still valid |

### Admin (`Authorization: Bearer <token>` required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/comments` | Comment list (filter by url / status / include-spam / keyword, paginated) |
| `GET` | `/api/admin/comments/all` | Same, but across all pages when no `url` is given — for export/overview |
| `GET` | `/api/admin/pages` | Pages that have comments (count, spam count, last comment time) |
| `PUT` | `/api/admin/comment/:id` | Edit a comment (field allow-list to prevent mass assignment) |
| `DELETE` | `/api/admin/comment/:id` | Delete a comment (soft delete) |
| `DELETE` | `/api/admin/comment/:id/permanent` | Permanently delete (removes the row and likes, wipes mail/IP etc., irreversible) |
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
| `WEBHOOK_METHOD` | Webhook HTTP method: `GET` / `POST` (default) / `PUT` / `PATCH` / `DELETE` |
| `WEBHOOK_HEADERS` | Custom webhook headers as a JSON object, e.g. `{"Authorization": "Bearer xxx"}`; empty means none |
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
- Rate limits: likes 60 requests per IP per minute; `POST /api/comment` 10 per minute; `GET /api/comment` and `GET /api/config` 120 per IP per minute; batch counts `GET /api/comment/count` 120 per IP per minute; reports `POST /api/comment/:id/report` and editing/deleting your own comment 10 per IP per minute; login / setup 10 per IP per 5 minutes. Exceeding them returns 429 with `Retry-After`. On serverless, limits are counted per instance — use external storage if you need globally accurate limiting.

### Webhook notifications `WEBHOOK_URL`

- Only `http`/`https` are allowed, and the target must not be a private, loopback or link-local address (including the cloud metadata address `169.254.169.254`). This is validated on save; invalid values return 400.
- Redirects are not followed (so a public URL cannot 302 into the private network to bypass validation).
- The payload never includes the commenter's `ip` / `ua`.

### Import `POST /api/admin/import`

- Accepts an array of comments, up to 1000 per request, each validated against the schema.
- Original `id`s are preserved: only by keeping `id`s can `rid` reply relationships survive the import (otherwise every reply becomes a top-level comment). Fields like `createdAt`/`isSpam`/`top`/`master` are preserved too. Note: `likes` is not preserved — like counts are authoritative from the `likes` table, so imported likes would be overwritten on the first like; they are normalized to 0 on import.
- Entries whose `id` collides with an existing comment are reported as failures, with a per-entry reason in `failedItems`.

### Batch comment counts `GET /api/comment/count`

- The `urls` query string is a comma-separated list of page urls, up to 20: `GET /api/comment/count?urls=/post/a,/post/b`. More than 20 returns 400 (no silent truncation).
- Returns `{ counts: { "/post/a": 3, "/post/b": 0 } }`, using the same counting rules as the comment list (spam and deleted comments excluded).
- Built for blog index / archive pages that need a per-article comment count without pulling full lists.

### Reporting `POST /api/comment/:id/report`

- Visitors can report an inappropriate comment: `POST /api/comment/:id/report` with body `{ "reason": "spam" }` (optional, max 200 chars).
- A missing or deleted comment returns 404.
- On success, an `admin.report` event is sent to the admin's configured notification channels (including the reported comment, the reason and the page link).
- Limited to 10 requests per IP per minute; unavailable in demo mode (403).

### Editing / deleting your own comment

- When a comment is created, the server returns an `editToken` (HMAC-signed, bound to the comment id) alongside the comment.
- Within 30 minutes it can be used to edit or delete that comment:
  - `PUT /api/comment/:id` with body `{ "content": "new content", "editToken": "..." }`
  - `DELETE /api/comment/:id` with body `{ "editToken": "..." }` (soft delete)
- A wrong or expired token returns 403; a missing / deleted comment returns 404.
- The frontend keeps the `editToken` in `localStorage` (keyed by comment id) and shows an "Edit" button on comments with a valid token.
- Unavailable in demo mode (403).

### Permanent delete `DELETE /api/admin/comment/:id/permanent`

- Unlike the soft delete (`DELETE /api/admin/comment/:id`), this removes the comment row and its like records from the database, wiping the commenter's mail, IP, UA and everything else — irreversible.
- Intended for privacy compliance (right-to-be-forgotten) cases. A missing id returns 404; demo mode returns 403.

### Admin keyword search

- `GET /api/admin/comments` and `/api/admin/comments/all` accept a `keyword` query parameter that matches comment content or nick via a parameterized `LIKE` (wildcards escaped).
- The `status` parameter additionally accepts `deleted`: shows only soft-deleted comments (the admin "Deleted" tab), handy for recovering accidental deletions.
- It composes with the `status` tab and pagination; the admin comment list has a search box (fires 400ms after typing stops).

### IP blocklist `BLOCKED_IPS`

- Configure a comma-separated IP list (e.g. `1.2.3.4, 5.6.7.8`) under "Security settings" in the admin panel.
- Requests from a blocked IP to `POST /api/comment` are rejected with 403.

### Image upload (image host)

- Configure the image host upload URL `IMAGE_CDN` (public) and the size limit `MAX_IMAGE_SIZE` (MB, default 5) under "Image settings" in the admin panel.
- Once configured, the comment box shows an "Image" button: files are uploaded **directly to the image host** (never through the Twikee server, avoiding function timeouts and bandwidth costs), and on success the URL is inserted as Markdown `![](url)`. The button is hidden when no host is configured.
- Image host contract: `POST multipart`, file field named `file`, success response is JSON containing a `url` field (a nested `data.url` is also accepted). If the host needs auth, embed the token in the `IMAGE_CDN` URL (e.g. `?token=xxx`) — `IMAGE_CDN_TOKEN` is a secret and is never sent to the frontend.
