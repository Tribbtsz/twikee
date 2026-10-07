---
title: 外观配置
description: 通过 appearance 预设与细粒度开关调整 Twikee 评论区的布局与样式，或用 CSS 变量覆盖主题色。
---

# 外观配置

通过 `appearance` 选项调整评论区的布局与样式，无需改动组件源码。

## 预设

```js
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com',
  appearance: {
    preset: 'minimal',
  },
})
```

`minimal` 会启用：

- 发送区透明背景和虚线框
- 昵称、邮箱、网址同一行
- 输入框聚焦无高亮边框
- 评论标题无底部分隔线

## 细粒度配置

预设只是若干开关的集合，你也可以逐个指定，覆盖预设中的对应项：

```js
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com',
  appearance: {
    submit: 'minimal',
    fieldsLayout: 'inline',
    headerDivider: false,
    inputFocusRing: false,
  },
})
```

| 参数 | 可选值 | 默认值 | 说明 |
|------|--------|--------|------|
| `preset` | `default` / `minimal` | `default` | 外观预设 |
| `submit` | `default` / `minimal` | `default` | 发送区样式 |
| `fieldsLayout` | `responsive` / `inline` | `responsive` | 昵称、邮箱、网址布局 |
| `headerDivider` | `boolean` | `true` | 是否显示评论标题分隔线 |
| `inputFocusRing` | `boolean` | `true` | 输入框聚焦时是否显示高亮 |

## 自定义配色

颜色可以通过 CSS 变量覆盖，例如 `--twikee-primary`、`--twikee-border`：

```css
.twikee-container {
  --twikee-primary: #6366f1;
  --twikee-border: #e5e7eb;
  --twikee-radius: 0.75rem;
}
```
