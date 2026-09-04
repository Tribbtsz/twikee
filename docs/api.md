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
| `SMTP_FROM` / `SMTP_TO` / `SMTP_PASS`（密钥） | 邮件（Resend） |

标记为密钥的键不会经 `GET /api/admin/config` 返回；保存时留空表示不修改。
