import { currentUser, signIn, signOut } from '/auth.js'
import { LANGS, getLang, setLang, pickText } from '/i18n.js'

const T = {
  en: {
    'foot.blog': 'Blog', 'foot.terms': 'Terms of service', 'foot.privacy': 'Privacy policy', 'foot.refunds': 'Refund policy', 'foot.contacts': 'Contacts', more: 'About {app}',
    'meta.title': 'Only Tools',
    'meta.desc': 'Small, simple tools for everyday life: CarLog, GigHunter, FoodLog. One account for all of them.',
    'nav.apps': 'Apps', 'nav.account': 'Account',
    'hero.title': 'Small tools that do one thing well',
    'hero.text': "Simple apps for everyday life. Add them to your phone's home screen and they open like native apps.",
    'status.invite': 'Invite only', 'status.soon': 'Coming soon',
    'access.yes': 'You have access', 'access.no': 'No access', open: 'Open',
    'acc.title': 'Your Only Tools account',
    'acc.signedIn': 'Signed in as <b>{email}</b>. This account works in every Only Tools app.',
    admin: 'Admin panel', signOut: 'Sign out', signIn: 'Sign in',
    'guest.title': 'One account for every app',
    'guest.text': 'Sign in once with email or Google and every Only Tools app lets you in.',
    'guest.cta': 'Sign in or create account',
  },
  uk: {
    'foot.blog': 'Блог', 'foot.terms': 'Умови використання', 'foot.privacy': 'Політика конфіденційності', 'foot.refunds': 'Повернення коштів', 'foot.contacts': 'Контакти', more: 'Про {app}',
    'meta.title': 'Only Tools',
    'meta.desc': 'Маленькі прості інструменти для щоденного життя: CarLog, GigHunter, FoodLog. Один акаунт для всіх.',
    'nav.apps': 'Застосунки', 'nav.account': 'Акаунт',
    'hero.title': 'Маленькі інструменти, що добре роблять одну справу',
    'hero.text': 'Прості застосунки для щоденного життя. Додайте їх на головний екран телефона, і вони відкриватимуться як звичайні застосунки.',
    'status.invite': 'За запрошенням', 'status.soon': 'Незабаром',
    'access.yes': 'Є доступ', 'access.no': 'Немає доступу', open: 'Відкрити',
    'acc.title': 'Ваш акаунт Only Tools',
    'acc.signedIn': 'Ви увійшли як <b>{email}</b>. Цей акаунт працює в усіх застосунках Only Tools.',
    admin: 'Адмін-панель', signOut: 'Вийти', signIn: 'Увійти',
    'guest.title': 'Один акаунт для всіх застосунків',
    'guest.text': 'Увійдіть один раз через email або Google, і кожен застосунок Only Tools вас впустить.',
    'guest.cta': 'Увійти або створити акаунт',
  },
  ru: {
    'foot.blog': 'Блог', 'foot.terms': 'Условия использования', 'foot.privacy': 'Политика конфиденциальности', 'foot.refunds': 'Возврат средств', 'foot.contacts': 'Контакты', more: 'О {app}',
    'meta.title': 'Only Tools',
    'meta.desc': 'Маленькие простые инструменты для повседневной жизни: CarLog, GigHunter, FoodLog. Один аккаунт для всех.',
    'nav.apps': 'Приложения', 'nav.account': 'Аккаунт',
    'hero.title': 'Маленькие инструменты, которые хорошо делают одно дело',
    'hero.text': 'Простые приложения для повседневной жизни. Добавьте их на главный экран телефона, и они будут открываться как обычные приложения.',
    'status.invite': 'По приглашению', 'status.soon': 'Скоро',
    'access.yes': 'Есть доступ', 'access.no': 'Нет доступа', open: 'Открыть',
    'acc.title': 'Ваш аккаунт Only Tools',
    'acc.signedIn': 'Вы вошли как <b>{email}</b>. Этот аккаунт работает во всех приложениях Only Tools.',
    admin: 'Админ-панель', signOut: 'Выйти', signIn: 'Войти',
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

  const pre = { en: '', uk: '/uk', ru: '/ru' }[lang]
  $('foot-links').innerHTML = [
    ...apps.map((a) => [`${pre}/${a.id}`, t('more').replace('{app}', a.name)]),
    [`${pre}/blog/car-service-history`, t('foot.blog')],
    [`${pre}/terms`, t('foot.terms')], [`${pre}/privacy`, t('foot.privacy')],
    [`${pre}/refunds`, t('foot.refunds')], [`${pre}/contacts`, t('foot.contacts')],
  ].map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('')

  if (user) {
    const initial = esc((user.name || user.email)[0].toUpperCase())
    $('who').innerHTML = `<a class="ot-avatar" href="#account" title="${esc(user.email)}">${initial}</a>`
    $('account').innerHTML = `
      <h2 class="ot-h3">${t('acc.title')}</h2>
      <p class="ot-text">${t('acc.signedIn').replace('{email}', esc(user.email))}</p>
      <div class="ot-row" style="box-shadow:none;padding:0;background:none;gap:8px;flex-wrap:wrap">
        ${isAdmin ? `<a class="ot-btn ot-btn--sm" href="/admin">${t('admin')}</a>` : ''}
        <button class="ot-btn ot-btn--sm ot-btn--outline" id="sign-out">${t('signOut')}</button>
      </div>`
    $('sign-out').onclick = () => signOut()
  } else {
    $('who').innerHTML = `<button class="ot-btn ot-btn--sm" id="sign-in-top">${t('signIn')}</button>`
    $('account').innerHTML = `
      <h2 class="ot-h3">${t('guest.title')}</h2>
      <p class="ot-text">${t('guest.text')}</p>
      <button class="ot-btn" style="align-self:flex-start" id="sign-in">${t('guest.cta')}</button>`
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
