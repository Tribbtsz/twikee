import App from './App.vue'
import Admin from './Admin.vue'
import { createApp } from 'vue'
import './styles/index.css'

export { App, Admin }
export { useTwikoo } from './composables/useTwikoo'
export type { TwikooOptions } from './composables/useTwikoo'

export function init(options: { el: string | Element; envId: string; lang?: string; dark?: string }) {
  const { el, envId, lang = 'zh-CN', dark = 'auto' } = options
  const container = typeof el === 'string' ? document.querySelector(el) : el
  
  if (!container) {
    console.error('[Twikoo] Container element not found')
    return
  }
  
  const app = createApp(App, { envId, lang, dark })
  app.mount(container)
  
  return app
}

export function initAdmin(options: { el: string | Element; envId: string }) {
  const { el, envId } = options
  const container = typeof el === 'string' ? document.querySelector(el) : el
  
  if (!container) {
    console.error('[Twikoo] Container element not found')
    return
  }
  
  const app = createApp(Admin, { envId })
  app.mount(container)
  
  return app
}

if (typeof window !== 'undefined') {
  (window as any).twikee = { init, initAdmin }
}
