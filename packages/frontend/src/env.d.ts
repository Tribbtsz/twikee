import type { TwikeeInitOptions } from './types'

declare global {
  interface Window {
    TWIKEE_API_URL?: string
    twikee?: {
      init: (options: TwikeeInitOptions) => void
      initAdmin: (options: { el: string | Element; envId: string }) => void
    }
  }
}

export {}
