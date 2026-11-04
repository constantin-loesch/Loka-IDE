// Language of the main process (menus, dialogs, error messages).
import { app } from 'electron'
import { resolveLang, translate, type Lang } from '../shared/i18n'
import { getSettings } from './settings'

let lang: Lang | null = null

export function currentLang(): Lang {
  lang ??= resolveLang(getSettings().language, app.getLocale())
  return lang
}

/** Call after the language setting changed. */
export function resetLang(): void {
  lang = null
}

export function t(text: string, params?: Record<string, string | number>): string {
  return translate(currentLang(), text, params)
}
