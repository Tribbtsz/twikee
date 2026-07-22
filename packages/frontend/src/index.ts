import App from './App.vue'
import Admin from './Admin.vue'
import { createApp } from 'vue'
import './styles/widget.css'
import type { TwikeeInitOptions } from './types'

export { App, Admin }
export { useTwikee } from './composables/useTwikee'
export type { TwikeeOptions } from './composables/useTwikee'
export type { TwikeeAppearanceOptions, TwikeeInitOptions } from './types'

export function init(options: TwikeeInitOptions) {
  const { el, envId, appearance } = options
  const container = typeof el === 'string' ? document.querySelector(el) : el

  if (!container) {
    console.error('[Twikee] Container element not found')
    return
  }

  const app = createApp(App, { envId, appearance })
  app.mount(container)

  return app
}

export function initAdmin(options: { el: string | Element; envId: string }) {
  const { el, envId } = options
  const container = typeof el === 'string' ? document.querySelector(el) : el
  
  if (!container) {
    console.error('[Twikee] Container element not found')
    return
  }
  
  const app = createApp(Admin, { envId })
  app.mount(container)
  
  return app
}

if (typeof window !== 'undefined') {
  (window as any).twikee = { init, initAdmin }
}
