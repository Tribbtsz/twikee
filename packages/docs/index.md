---
layout: home
title: Twikee
titleTemplate: 轻量、现代化的自建评论系统
description: Twikee 是一个轻量、现代化的自建评论系统，基于 Vue 3 + Hono + Turso/libSQL 构建。一行脚本即可嵌入任意网站，自带管理后台、Markdown、点赞、回复与垃圾评论通知。
hero:
  name: Twikee
  text: 轻量、现代化的自建评论系统
  tagline: 基于 Vue 3 + Hono + Turso/libSQL，一行脚本嵌入任意网站
  image:
    src: /logo.svg
    alt: Twikee
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 在线演示
      link: https://twikee.vercel.app/demo
    - theme: alt
      text: GitHub
      link: https://github.com/Tribbtsz/twikee
features:
  - icon: 🧩
    title: 一行脚本接入
    details: 引入 CSS 与 UMD 脚本，调用 twikee.init 即可挂载评论区，不挑框架、不侵入站点。
  - icon: 🗄️
    title: 无服务器友好
    details: Hono 后端可直接部署到 Vercel 等平台，数据存 Turso/libSQL，本地用 SQLite 文件即可开发。
  - icon: 💬
    title: 完整的评论能力
    details: 支持 Markdown、嵌套回复、点赞、分页、博主标识，以及管理后台的审核与置顶。
  - icon: 🛡️
    title: 安全与反滥用
    details: HTML 协议白名单、IP 限流、Webhook SSRF 防护、可配置 CORS，垃圾评论另可推送通知。
  - icon: 🎨
    title: 可定制外观
    details: 内置 minimal 预设与细粒度外观开关，也可通过 CSS 变量覆盖主题色与边框。
  - icon: 🔔
    title: 多渠道通知
    details: 新评论可推送至 Telegram、Webhook、邮件（Resend）、WxPusher 或企业微信群机器人。
---

## 30 秒接入

在任意页面加入下面的代码，评论区就会挂载到 `#comment`：

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

> `envId` 填 Twikee 后端地址。自托管时，站点与 API 通常同域，可填同一个域名。

想先看看效果？打开[在线演示](https://twikee.vercel.app/demo)，或进入[快速开始](/guide/getting-started)把服务跑起来。
