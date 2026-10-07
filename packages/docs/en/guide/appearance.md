---
title: Appearance
description: Tune the layout and styling of the Twikee comment widget with the appearance preset, fine-grained switches, and CSS variables.
---

# Appearance

Use the `appearance` option to tune the widget's layout and styling without touching component source.

## Preset

```js
twikee.init({
  el: '#comment',
  envId: 'https://your-api-domain.com',
  appearance: {
    preset: 'minimal',
  },
})
```

`minimal` turns on:

- Transparent, dashed-border submit area
- Nickname, email and website on a single row
- No focus ring on inputs
- No divider under the comments heading

## Fine-grained options

A preset is just a set of switches. You can set them individually; each overrides the corresponding preset value:

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

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `preset` | `default` / `minimal` | `default` | Appearance preset |
| `submit` | `default` / `minimal` | `default` | Submit area style |
| `fieldsLayout` | `responsive` / `inline` | `responsive` | Nickname/email/website layout |
| `headerDivider` | `boolean` | `true` | Show the heading divider |
| `inputFocusRing` | `boolean` | `true` | Show the input focus ring |

## Custom colors

Override colors with CSS variables such as `--twikee-primary` and `--twikee-border`:

```css
.twikee-container {
  --twikee-primary: #6366f1;
  --twikee-border: #e5e7eb;
  --twikee-radius: 0.75rem;
}
```
