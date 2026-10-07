---
title: Client integration
description: "Embed the Twikee comment widget on any website: add the stylesheet and script, call twikee.init, options reference, and how pages are keyed."
---

# Client integration

Twikee ships a framework-agnostic UMD build, so any site — plain HTML, Vue, React, Hexo, Hugo — can integrate it with a few lines.

## Basic usage

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

- `style.css`: the widget styles — required.
- `twikee.umd.js`: the components and the `twikee.init` entry point.
- `el`: the mount container, either a selector string or a DOM element.
- `envId`: your Twikee backend URL. A missing protocol is treated as `https://`. When the site and the API share a domain, use the same value for both.

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `el` | `string \| Element` | Yes | Mount container for the widget |
| `envId` | `string` | Yes | Twikee backend URL |
| `appearance` | `object` | No | Appearance options, see [Appearance](/en/guide/appearance) |

## Admin entry point (initAdmin)

The same `twikee.umd.js` also exports an admin entry point, so you can embed the panel elsewhere. The bundled admin page lives at `/admin` and usually needs no manual setup:

```html
<div id="admin"></div>
<script>
  twikee.initAdmin({
    el: '#admin',
    envId: 'https://your-api-domain.com',
  })
</script>
```

## How comments are keyed to a page

The client uses `window.location.pathname` as the comment `url` key. That means:

- Visits to the same path show the same set of comments.
- Different articles do not share a thread as long as their paths differ.
- In a single-page app, call `twikee.init` again after navigation to switch to the comments of the new route.

::: tip Per-article threads
As long as your blog gives each article a distinct URL path, Twikee stores their comments separately with no extra configuration.
:::

## Admin panel

Open `/admin` on your deployment to reach the admin panel. The first visit walks you through setting the password. From there you can moderate and pin comments, configure appearance and notifications, and import from other comment systems.

## Self-hosted assets

Point `style.css` and `twikee.umd.js` at your own deployment — no dependency on the official demo. If the comment page and the API use different origins, remember to configure [`CORS_ORIGIN`](/en/guide/deployment#cors).
