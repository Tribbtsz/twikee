---
layout: home
title: Twikee
titleTemplate: A lightweight, modern self-hosted comment system
description: Twikee is a lightweight, modern self-hosted comment system built with Vue 3 + Hono + Turso/libSQL. Embed it anywhere with a single script tag and get an admin panel, Markdown, likes, replies and spam notifications out of the box.
hero:
  name: Twikee
  text: A lightweight, modern comment system
  tagline: Built with Vue 3 + Hono + Turso/libSQL — embed it anywhere with one script tag
  image:
    src: /logo.svg
    alt: Twikee
  actions:
    - theme: brand
      text: Get started
      link: /en/guide/getting-started
    - theme: alt
      text: Live demo
      link: https://twikee.vercel.app/demo
    - theme: alt
      text: GitHub
      link: https://github.com/Tribbtsz/twikee
features:
  - icon: 🧩
    title: One script tag
    details: Add a stylesheet and a UMD script, call twikee.init, and the comment widget mounts into your page. No framework required.
  - icon: 🗄️
    title: Serverless friendly
    details: The Hono backend deploys to Vercel and friends, stores data in Turso/libSQL, and runs locally on a SQLite file.
  - icon: 💬
    title: Full comment features
    details: Markdown, threaded replies, likes, pagination and author badges, plus moderation and pinning in the admin panel.
  - icon: 🛡️
    title: Safe by default
    details: HTML protocol allow-listing, per-IP rate limits, Webhook SSRF protection and configurable CORS.
  - icon: 🎨
    title: Customizable appearance
    details: A built-in minimal preset, fine-grained layout switches, and CSS variables for colors and borders.
  - icon: 🔔
    title: Multi-channel notifications
    details: New comments can be pushed to Telegram, a custom Webhook, email (Resend), WxPusher or WeCom.
---

## Embed in 30 seconds

Add this to any page and the comment widget mounts into `#comment`:

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

> `envId` is the URL of your Twikee backend. For a self-hosted setup the site and API usually share a domain, so you can use the same value.

Want to see it first? Open the [live demo](https://twikee.vercel.app/demo), or jump into [Getting started](/en/guide/getting-started) and run it yourself.
