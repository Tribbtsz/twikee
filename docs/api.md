# API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/comment` | 获取评论列表 |
| `POST` | `/api/comment` | 创建评论 |
| `POST` | `/api/comment/:id/like` | 点赞 |
| `GET` | `/api/config` | 获取公开配置 |
| `POST` | `/api/auth/setup` | 初始化密码 |
| `POST` | `/api/auth/login` | 管理员登录 |
| `GET` | `/api/admin/comments` | 管理评论列表 |
| `POST` | `/api/admin/config` | 更新配置 |

通知推送支持 Telegram Bot、Webhook、Email、WxPusher、企业微信群机器人，可在管理后台配置。

通知配置键（`POST /api/admin/config`）：

| 键 | 说明 |
|----|------|
| `NOTIFICATION_ENABLE` | 是否启用评论通知（`true`/`false`） |
| `NOTIFICATION_TYPE` | 通知渠道：`telegram` / `webhook` / `email` / `wxpusher` / `wecom` |
| `TELEGRAM_BOT_TOKEN`（密钥） / `TELEGRAM_CHAT_ID` | Telegram Bot |
| `WEBHOOK_URL` | 自定义通知接口 |
| `WXPUSHER_APP_TOKEN`（密钥） / `WXPUSHER_UIDS` | WxPusher，UID 多个用逗号分隔 |
| `WECOM_KEY`（密钥） | 企业微信群机器人 Webhook 地址中的 key |
| `SMTP_FROM` / `SMTP_TO` | 邮件（Resend）发件人 / 收件人 |
| `SMTP_PASS`（密钥） | 邮件（Resend）API Key |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | 预留字段，当前邮件通道未使用 |

标记为密钥的键不会经 `GET /api/admin/config` 返回；保存时留空表示不修改。

## 行为约定

### 点赞 `POST /api/comment/:id/like`

- 访客身份按优先级取：服务端签发的 `tk_uid` Cookie（HttpOnly）→ 请求头 `x-user-id`（须为 UUID）→ 现场生成并写 Cookie。同一身份重复调用即在「赞 / 取消赞」之间切换。
- 跨域部署（评论页与 API 不同域）时浏览器不会随 fetch 发送 Cookie，由前端持久化的 `x-user-id` 保证身份稳定；服务端会同时尝试把身份固化进 Cookie。
- 响应以服务端为准：`{ success, liked, likes }`。前端点击时先做乐观更新（立刻改本地点赞态与计数、
  连点合并成一个请求、请求串行不并发），服务端结果回来后按它校正；计数始终由库里的 `likes` 表决定，
  前端不自己记账。
- 评论不存在（含已软删除）返回 404。
- 限流：每 IP 每分钟 60 次；`POST /api/comment` 每分钟 10 次；登录/初始化密码每 IP 每 5 分钟 10 次。超限返回 429 + `Retry-After`。serverless 多实例下限流按实例计数，如需全局精确定位请接外部存储。

### Webhook 通知 `WEBHOOK_URL`

- 仅允许 `http`/`https`，且不允许指向内网、环回、链路本地（含云 metadata `169.254.169.254`）地址；保存时会校验，不合法返回 400。
- 请求不跟随重定向（防止公网地址 302 跳转到内网绕过校验）。
- payload 中不会携带评论者的 `ip` / `ua`。

### 导入 `POST /api/admin/import`

- 接受评论数组，单次最多 1000 条，逐条按 schema 校验。
- 保留原 `id`：只有保留 id，`rid` 指向的回复关系才能在导入后继续成立（否则所有回复都会变成顶层评论）。`createdAt`/`likes`/`isSpam`/`top`/`master` 等字段同样会保留。
- id 与库中现有评论冲突的条会计入失败，响应中的 `failedItems` 给出每条失败原因。
