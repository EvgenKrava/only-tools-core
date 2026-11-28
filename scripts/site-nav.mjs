// The one navigation of onlytools.click. build-pages.mjs puts it on every page (the home page,
// /plus/ and the generated app, blog and legal pages) so the sidebar / tab bar keeps the same
// items in the same places everywhere; only the active item changes. Labels carry data-t so the
// JS-driven pages (home, /plus/) can re-translate them in place without moving anything.

const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const ICON = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  car: '<path d="M5 17h14v-5l-2-5H7l-2 5v5z"/><path d="M5 12h14"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
  gig: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  money: '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M16 13h2"/>',
  food: '<path d="M12 21c-5 0-8-4-8-9 0-3 2-5 4-5 1.5 0 2.5.7 4 .7S14.5 7 16 7c2 0 4 2 4 5 0 5-3 9-8 9z"/><path d="M12 7c0-2 1-4 3-4"/>',
}
const svg = (id) => `<svg class="ot-icon" viewBox="0 0 24 24" ${P} aria-hidden="true">${ICON[id]}</svg>`

const LABEL = {
  en: { home: 'Home', apps: 'Apps', plus: 'Plus', support: 'Support', account: 'Account' },
  uk: { home: 'Головна', apps: 'Застосунки', plus: 'Plus', support: 'Підтримати', account: 'Акаунт' },
  ru: { home: 'Главная', apps: 'Приложения', plus: 'Plus', support: 'Поддержать', account: 'Аккаунт' },
}
const PREFIX = { en: '', uk: '/uk', ru: '/ru' }
/** Only Tools Plus and donations. Paused by the owner (2026-11-27) until monobank production payments work.
 *  Also switch PAYMENTS in apps/landing/public/landing.js and payments_enabled in infra/main. */
export const PAYMENTS = false
const APPS = [
  { id: 'carlog', name: 'CarLog', accent: 'car', icon: 'car' },
  { id: 'foodlog', name: 'FoodLog', accent: 'food', icon: 'food' },
  { id: 'gighunter', name: 'GigHunter', accent: 'gig', icon: 'gig' },
  { id: 'moneylog', name: 'MoneyLog', accent: 'money', icon: 'money' },
]

/** active: 'home' | 'plus' | an app id | null (blog, legal). */
export function siteNav(lang = 'en', active = null) {
  const L = LABEL[lang]
  const item = (key, href, icon, label) => {
    const on = key === active
    return `<a class="ot-nav__item${on ? ' is-active' : ''}" href="${href}"${on ? ' aria-current="page"' : ''}><span class="ot-nav__pill">${svg(icon)}</span><span${label === 'plus' ? '' : ` data-t="nav.${label}"`}>${L[label]}</span></a>`
  }
  const apps = APPS.map((a) => {
    const on = a.id === active
    return `<a class="ot-nav__app${on ? ' is-current' : ''}" data-app="${a.accent}" data-id="${a.id}" href="${PREFIX[lang]}/${a.id}"${on ? ' aria-current="page"' : ''}><span class="ot-appicon">${svg(a.icon)}</span>${a.name}</a>`
  }).join('')
  return `<nav class="ot-nav" aria-label="Main">
      <a class="ot-brand ot-nav__brand" href="/"><b class="ot-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></b><span>Only Tools</span></a>
      ${item('home', '/', 'grid', 'home')}
      <div class="ot-nav__apps"><span class="ot-nav__label" data-t="nav.apps">${L.apps}</span>${apps}</div>
      ${PAYMENTS ? item('plus', '/plus/', 'star', 'plus') : ''}
      ${PAYMENTS ? item('support', '/plus/#support', 'heart', 'support') : ''}
      <span class="ot-nav__spacer"></span>
      ${item('account', '/#account', 'user', 'account')}
    </nav>`
}

/** Replaces the page's <nav class="ot-nav">…</nav> with the shared one. */
export function withSiteNav(html, active) {
  const re = /<nav class="ot-nav"[\s\S]*?<\/nav>/
  if (!re.test(html)) throw new Error('page has no <nav class="ot-nav">')
  return html.replace(re, siteNav('en', active))
}
