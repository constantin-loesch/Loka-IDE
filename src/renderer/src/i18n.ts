// Language of the UI. Fixed for the lifetime of the window – changing it reloads the window.
import { translate, type Lang } from '../../shared/i18n'

export const lang: Lang = window.api.lang

export function t(text: string, params?: Record<string, string | number>): string {
  return translate(lang, text, params)
}

/** Locale for numbers and dates */
export const locale = lang === 'de' ? 'de-DE' : 'en-US'
