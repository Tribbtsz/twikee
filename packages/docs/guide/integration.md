---
title: 前端接入
description: 在任意网站中嵌入 Twikee 评论区：引入样式与脚本、调用 twikee.init、参数说明，以及按文章分页备注。
---

# 前端接入

Twikee 提供一个与框架无关的 UMD 产物，任何站点（纯 HTML、Vue、React、Hexo、Hugo……）都能用几行代码接入。

## 基础用法

```html
<div id="comment"></div>

<link rel="stylesheet" href="https://your-domain.com/style.css" />
<script src="https://your-domain.com/twikee.umd.js"></script>
<script>
  twikee.init({
    el: '#comment',
    envId: 'https://your-api-domain.com',
  })
</script>
```

- `style.css`：评论区的样式，必须引入。
- `twikee.umd.js`：组件与 `twikee.init` 入口。
- `el`：评论挂载容器，可以是选择器字符串或 DOM 元素。
- `envId`：Twikee 后端地址。缺省协议时按 `https://` 处理。站点与 API 同域时填同一个域名即可。

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `el` | `string \| Element` | 是 | 评论挂载容器 |
| `envId` | `string` | 是 | Twikee 后端地址 |
| `appearance` | `object` | 否 | 外观配置，见[外观配置](/guide/appearance) |

## 管理端入口（initAdmin）

同一份 `twikee.umd.js` 还导出管理端入口，可以把后台嵌到别处。自带的后台页面在 `/admin`，通常不需要手动调：

```html
<div id="admin"></div>
<script>
  twikee.initAdmin({
    el: '#admin',
    envId: 'https://your-api-domain.com',
  })
</script>
```

## 评论如何归属页面

客户端以 `window.location.pathname` 作为评论的 `url` 键。也就是说：

- 同一路径的访问会显示同一组评论；
- 不同文章只要路径不同，评论区互不干扰；
- 单页应用切换路径后重新调用 `twikee.init` 即可切换到对应文章的评论。

::: tip 按文章区分
只要你的博客为每篇文章生成不同的 URL 路径，Twikee 就会自动为它们分别保存评论，无需额外配置。
:::

## 管理后台

部署后访问 `/admin` 进入管理后台。首次访问会引导设置管理员密码。后台提供评论审核、置顶、外观与通知配置，并支持从其他评论系统导入。

## 自托管资源

把 `style.css` 与 `twikee.umd.js` 指向你自己的部署域名即可，无需依赖官方演示站。若评论页与 API 不同域，记得配置 [`CORS_ORIGIN`](/guide/deployment#cors)。
