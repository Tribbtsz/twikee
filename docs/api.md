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

通知推送支持 Telegram Bot、Webhook、Email，可在管理后台配置。
