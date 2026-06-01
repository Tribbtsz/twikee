# 前端接入

## 基础用法

```html
<div id="comment"></div>
<link rel="stylesheet" href="https://your-domain.com/style.css">
<script src="https://your-domain.com/twikee.umd.js"></script>
<script>
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com'
})
</script>
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `el` | `string \| Element` | 评论挂载容器 |
| `envId` | `string` | Twikee API 地址 |
| `appearance` | `object` | 外观配置，见 [外观配置](./appearance.md) |
