# 外观配置

## 预设

```js
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com',
  appearance: {
    preset: 'minimal'
  }
})
```

`minimal` 会启用：

- 发送区透明背景和虚线框
- 昵称、邮箱、网址同一行
- 输入框聚焦无高亮边框
- 评论标题无底部分隔线

## 细粒度配置

```js
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com',
  appearance: {
    submit: 'minimal',
    fieldsLayout: 'inline',
    headerDivider: false,
    inputFocusRing: false
  }
})
```

| 参数 | 可选值 | 默认值 | 说明 |
|------|--------|--------|------|
| `preset` | `default` / `minimal` | `default` | 外观预设 |
| `submit` | `default` / `minimal` | `default` | 发送区样式 |
| `fieldsLayout` | `responsive` / `inline` | `responsive` | 昵称、邮箱、网址布局 |
| `headerDivider` | `boolean` | `true` | 是否显示评论标题分隔线 |
| `inputFocusRing` | `boolean` | `true` | 输入框聚焦时是否显示高亮 |

颜色仍然可以通过 CSS variables 覆盖，例如 `--twikee-primary`、`--twikee-border`。
