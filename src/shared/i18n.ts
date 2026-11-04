// Translations. English is the source language in the code; German lives in i18n.de.ts.
// Usage: t('Open Folder'), t('{count} ports', { count: 3 })
import { de } from './i18n.de'

export type Lang = 'en' | 'de'
/** 'auto' follows the system language */
export type LangSetting = 'auto' | Lang

export function resolveLang(setting: LangSetting | undefined, systemLocale: string): Lang {
  if (setting === 'en' || setting === 'de') return setting
  return systemLocale.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function translate(lang: Lang, text: string, params?: Record<string, string | number>): string {
  let out = lang === 'de' ? (de[text] ?? text) : text
  if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v))
  return out
}
