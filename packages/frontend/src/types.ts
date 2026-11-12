export interface TwikeeAppearanceOptions {
  preset?: 'default' | 'minimal'
  submit?: 'default' | 'minimal'
  fieldsLayout?: 'responsive' | 'inline'
  headerDivider?: boolean
  inputFocusRing?: boolean
}

export interface ResolvedTwikeeAppearance {
  preset: 'default' | 'minimal'
  submit: 'default' | 'minimal'
  fieldsLayout: 'responsive' | 'inline'
  headerDivider: boolean
  inputFocusRing: boolean
}

export interface TwikeeInitOptions {
  el: string | Element
  envId: string
  appearance?: TwikeeAppearanceOptions
  /** 评论组件界面语言：'zh-CN'（默认）| 'en'；未知值回落中文 */
  lang?: string
}

export function resolveAppearance(appearance?: TwikeeAppearanceOptions): ResolvedTwikeeAppearance {
  const preset = appearance?.preset ?? 'default'
  const presetOptions: Omit<ResolvedTwikeeAppearance, 'preset'> =
    preset === 'minimal'
      ? {
          submit: 'minimal',
          fieldsLayout: 'inline',
          headerDivider: false,
          inputFocusRing: false,
        }
      : {
          submit: 'default',
          fieldsLayout: 'responsive',
          headerDivider: true,
          inputFocusRing: true,
        }

  return {
    preset,
    ...presetOptions,
    ...appearance,
  }
}
