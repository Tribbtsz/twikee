import { inject } from 'vue'
import { createTranslator, type TranslateFn } from '../lib/i18n'

/**
 * 组件树里取 App.vue provide 的翻译函数；脱离 App（单测/独立渲染）时回落中文。
 */
export function useT(): TranslateFn {
  return inject<TranslateFn>('twikeeT') ?? createTranslator('zh-CN')
}
