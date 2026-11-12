import { inject } from 'vue'
import { createTranslator, type TranslateFn } from '../lib/i18n'

/**
 * 组件树里取 App.vue provide 的翻译函数。
 * 默认值兜底（不依赖宿主 provide）：DemoEntry、单测、独立渲染都不产生
 * "injection not found" 警告，且回落中文与旧行为一致。
 */
export function useT(): TranslateFn {
  return inject<TranslateFn>('twikeeT', createTranslator('zh-CN'))
}
