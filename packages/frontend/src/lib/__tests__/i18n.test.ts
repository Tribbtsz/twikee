import { describe, expect, it } from 'vitest'
import { createTranslator, isTwikeeLang, messages, resolveLang, translate } from '../i18n'

describe('i18n', () => {
  it('zh-CN 与 en 词表键完全一致（防止新增键漏翻）', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages['zh-CN']).sort())
  })

  it('translate 返回对应语言文案', () => {
    expect(translate('zh-CN', 'submit')).toBe('发送')
    expect(translate('en', 'submit')).toBe('Send')
  })

  it('未知键回落中文词表', () => {
    // @ts-expect-error 故意传不存在的键，验证运行时兜底
    expect(translate('en', 'not_a_key')).toBe('not_a_key')
  })

  it('占位符替换', () => {
    expect(translate('zh-CN', 'minutesAgo', { n: 5 })).toBe('5 分钟前')
    expect(translate('en', 'imageTooLarge', { n: 8 })).toBe('Image exceeds the size limit (8MB)')
  })

  it('resolveLang：已知语言原样返回，未知回落 zh-CN', () => {
    expect(resolveLang('en')).toBe('en')
    expect(resolveLang('zh-CN')).toBe('zh-CN')
    expect(resolveLang('fr')).toBe('zh-CN')
    expect(resolveLang(undefined)).toBe('zh-CN')
    expect(resolveLang('')).toBe('zh-CN')
  })

  it('isTwikeeLang 类型守卫', () => {
    expect(isTwikeeLang('en')).toBe(true)
    expect(isTwikeeLang('EN')).toBe(false)
    expect(isTwikeeLang(null)).toBe(false)
  })

  it('createTranslator 固定语言并支持参数', () => {
    const t = createTranslator('en')
    expect(t('cancel')).toBe('Cancel')
    expect(t('daysAgo', { n: 3 })).toBe('3 d ago')
  })
})
