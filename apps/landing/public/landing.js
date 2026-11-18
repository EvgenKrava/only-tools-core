import { currentUser, signIn, signOut } from '/auth.js'
import { LANGS, getLang, setLang, pickText } from '/i18n.js'

const T = {
  en: {
    'meta.title': 'Only Tools',
    'meta.desc': 'Small, simple tools for everyday life: CarLog, GigHunter, FoodLog. One account for all of them.',
    'nav.apps': 'Apps', 'nav.account': 'Account',
    'hero.title': 'Small tools that do one thing well',
    'hero.text': "Simple apps for everyday life. Add them to your phone's home screen and they open like native apps.",
    'status.invite': 'Invite only', 'status.soon': 'Coming soon',
    'access.yes': 'You have access', 'access.no': 'No access', open: 'Open',
    'acc.title': 'Your Only Tools account',
    'acc.signedIn': 'Signed in as <b>{email}</b>. This account works in every Only Tools app.',
    admin: 'Admin panel', signOut: 'Sign out', signIn: 'Sign in', plus: 'Only Tools Plus', support: 'Support the author',
    'guest.title': 'One account for every app',
    'guest.text': 'Sign in once with email or Google and every Only Tools app lets you in.',
    'guest.cta': 'Sign in or create account',
  },
  uk: {
    'meta.title': 'Only Tools',
    'meta.desc': 'Маленькі прості інструменти для щоденного життя: CarLog, GigHunter, FoodLog. Один акаунт для всіх.',
    'nav.apps': 'Застосунки', 'nav.account': 'Акаунт',
    'hero.title': 'Маленькі інструменти, що добре роблять одну справу',
    'hero.text': 'Прості застосунки для щоденного життя. Додайте їх на головний екран телефона, і вони відкриватимуться як звичайні застосунки.',
    'status.invite': 'За запрошенням', 'status.soon': 'Незабаром',
    'access.yes': 'Є доступ', 'access.no': 'Немає доступу', open: 'Відкрити',
    'acc.title': 'Ваш акаунт Only Tools',
    'acc.signedIn': 'Ви увійшли як <b>{email}</b>. Цей акаунт працює в усіх застосунках Only Tools.',
    admin: 'Адмін-панель', signOut: 'Вийти', signIn: 'Увійти', plus: 'Only Tools Plus', support: 'Підтримати автора',
    'guest.title': 'Один акаунт для всіх застосунків',
    'guest.text': 'Увійдіть один раз через email або Google, і кожен застосунок Only Tools вас впустить.',
    'guest.cta': 'Увійти або створити акаунт',
  },
  ru: {
    'meta.title': 'Only Tools',
    'meta.desc': 'Маленькие простые инструменты для повседневной жизни: CarLog, GigHunter, FoodLog. Один аккаунт для всех.',
    'nav.apps': 'Приложения', 'nav.account': 'Аккаунт',
    'hero.title': 'Маленькие инструменты, которые хорошо делают одно дело',
    'hero.text': 'Простые приложения для повседневной жизни. Добавьте их на главный экран телефона, и они будут открываться как обычные приложения.',
    'status.invite': 'По приглашению', 'status.soon': 'Скоро',
    'access.yes': 'Есть доступ', 'access.no': 'Нет доступа', open: 'Открыть',
    'acc.title': 'Ваш аккаунт Only Tools',
    'acc.signedIn': 'Вы вошли как <b>{email}</b>. Этот аккаунт работает во всех приложениях Only Tools.',
    admin: 'Админ-панель', signOut: 'Выйти', signIn: 'Войти', plus: 'Only Tools Plus', support: 'Поддержать автора',
    'guest.title': 'Один аккаунт для всех приложений',
    'guest.text': 'Войдите один раз через email или Google, и каждое приложение Only Tools вас впустит.',
    'guest.cta': 'Войти или создать аккаунт',
  },
}

const icon = (id) => `<svg class="ot-icon"><use href="#i-${id}"/></svg>`
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const $ = (id) => document.getElementById(id)

$('year').textContent = new Date().getFullYear()

const [apps, user] = await Promise.all([
  fetch('/apps.json').then((r) => r.json()),
  currentUser().catch(() => null),
])
const has = (a) => user?.groups.includes(`${a.id}-user`)
const isAdmin = user?.groups.includes('platform-admin')

let lang = getLang()

function render() {
  const t = (k) => T[lang][k] ?? T.en[k]
  document.documentElement.lang = lang
  document.title = t('meta.title')
  document.querySelector('meta[name="description"]').content = t('meta.desc')
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t) })

  $('lang').innerHTML = LANGS.map((l) =>
    `<button lang="${l.code}" title="${l.name}" aria-pressed="${l.code === lang}" data-lang="${l.code}">${l.label}</button>`).join('')

  $('tiles').innerHTML = apps.map((a) => {
    const live = a.status !== 'soon'
    const tag = live ? 'a' : 'div'
    const href = live ? ` href="${esc(a.url)}"` : ''
    const status = { invite: t('status.invite'), soon: t('status.soon') }[a.status]
    let chip = status ? `<span class="ot-chip">${status}</span>` : ''
    if (user && live) chip = has(a) ? `<span class="ot-chip ot-chip--good">${t('access.yes')}</span>` : `<span class="ot-chip ot-chip--neutral">${t('access.no')}</span>`
    const go = live ? `<span class="ot-tile__go">${t('open')} ${icon('arrow')}</span>` : ''
    return `<${tag} class="ot-tile" data-app="${a.accent}"${href}>
      <span class="ot-tile__icon">${icon(a.icon)}</span>
      <span class="ot-tile__name">${esc(a.name)}</span>
      <span class="ot-tile__desc">${esc(pickText(a.desc, lang))}</span>
      <span class="ot-tile__stat">${chip}${go}</span>
    </${tag}>`
  }).join('')

  if (user) {
    const initial = esc((user.name || user.email)[0].toUpperCase())
    $('who').innerHTML = `<a class="ot-avatar" href="#account" title="${esc(user.email)}">${initial}</a>`
    $('account').innerHTML = `
      <h2 class="ot-h3">${t('acc.title')}</h2>
      <p class="ot-text">${t('acc.signedIn').replace('{email}', esc(user.email))}</p>
      <div class="ot-row" style="box-shadow:none;padding:0;background:none;gap:8px;flex-wrap:wrap">
        <a class="ot-btn ot-btn--sm${user.groups.includes('plus') ? ' ot-btn--soft' : ''}" href="/plus/">${t('plus')}</a>
        ${isAdmin ? `<a class="ot-btn ot-btn--sm" href="/admin">${t('admin')}</a>` : ''}
        <button class="ot-btn ot-btn--sm ot-btn--outline" id="sign-out">${t('signOut')}</button>
      </div>`
    $('sign-out').onclick = () => signOut()
  } else {
    $('who').innerHTML = `<button class="ot-btn ot-btn--sm" id="sign-in-top">${t('signIn')}</button>`
    $('account').innerHTML = `
      <h2 class="ot-h3">${t('guest.title')}</h2>
      <p class="ot-text">${t('guest.text')}</p>
      <div class="ot-row" style="box-shadow:none;padding:0;background:none;gap:8px;flex-wrap:wrap">
        <button class="ot-btn" id="sign-in">${t('guest.cta')}</button>
        <a class="ot-btn ot-btn--outline" href="/plus/#support">${t('support')}</a>
      </div>`
    $('sign-in').onclick = $('sign-in-top').onclick = () => signIn('/')
  }
}

$('lang').addEventListener('click', (e) => {
  const code = e.target.closest('button')?.dataset.lang
  if (!code || code === lang) return
  lang = code
  setLang(code)
  render()
})

$('nav-apps').insertAdjacentHTML('beforeend', apps.map((a) =>
  `<a class="ot-nav__app" data-app="${a.accent}" href="${a.status === 'soon' ? '#' : esc(a.url)}">
    <span class="ot-appicon">${icon(a.icon)}</span>${esc(a.name)}</a>`).join(''))

render()

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
