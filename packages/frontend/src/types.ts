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
}

export function resolveAppearance(
  appearance?: TwikeeAppearanceOptions
): ResolvedTwikeeAppearance {
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
