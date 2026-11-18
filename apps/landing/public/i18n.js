// Shared Only Tools language choice. The `ot_lang` cookie is set on .onlytools.click, so a
// language picked here (or in any app) applies to every Only Tools app. Without a cookie the
// browser language decides; anything that is not Ukrainian or Russian falls back to English.
export const LANGS = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'uk', label: 'UA', name: 'Українська' },
  { code: 'ru', label: 'RU', name: 'Русский' },
]
const CODES = LANGS.map((l) => l.code)

const pick = (v) => {
  const code = String(v || '').toLowerCase().slice(0, 2)
  return CODES.includes(code) ? code : null
}

export function getLang() {
  const m = document.cookie.match(/(?:^|;\s*)ot_lang=([^;]+)/)
  return pick(m && decodeURIComponent(m[1]))
    || (navigator.languages || [navigator.language]).map(pick).find(Boolean)
    || 'en'
}

export function setLang(code) {
  const domain = location.hostname.endsWith('onlytools.click') ? '; domain=onlytools.click' : ''
  document.cookie = `ot_lang=${code}; path=/; max-age=31536000; samesite=lax${domain}`
}

/** Picks the current language's string from a {en, uk, ru} object (English as the fallback). */
export const pickText = (obj, lang) => (obj && (obj[lang] ?? obj.en)) ?? ''
