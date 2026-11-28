import { currentUser, signIn, signOut } from '/auth.js'
import { LANGS, getLang, setLang, pickText } from '/i18n.js'

// Only Tools Plus and donations are paused (owner, 2026-11-27). Keep in step with scripts/site-nav.mjs.
const PAYMENTS = false
if (PAYMENTS) document.querySelector('.plus-teaser')?.removeAttribute('hidden')

const T = {
  en: {
    'foot.apps': 'Apps', 'foot.blog': 'Blog', 'foot.legal': 'Legal', 'foot.terms': 'Terms of service', 'foot.privacy': 'Privacy policy', 'foot.refunds': 'Refund policy', 'foot.contacts': 'Contacts',
    'meta.title': 'Only Tools: small apps for your car, food and freelance',
    'meta.desc': 'Small apps for everyday life: CarLog (car service book), FoodLog (calorie tracker), GigHunter (freelance job alerts). Free to start, one account for all.',
    'nav.home': 'Home', 'nav.apps': 'Apps', 'nav.support': 'Support', 'nav.account': 'Account',
    'hero.eyebrow': '3 apps · 1 account · free to start',
    'hero.title': 'Your car, your food, your gigs. Sorted.',
    'hero.text': 'Small apps that each do one job properly. Snap a garage invoice, scan a barcode, catch a freelance gig before anyone else.',
    'hero.cta': 'Pick an app', 'hero.how': 'How it works',
    'trust.made': 'Made in Ukraine by one person', 'trust.store': 'No app store needed', 'trust.langs': 'English, Ukrainian, Russian',
    'apps.title': 'Three apps, one job each',
    'carlog.kicker': 'Car service book', 'carlog.title': 'Never miss an oil change again.',
    'carlog.b1': 'Every service, repair and receipt in one timeline',
    'carlog.b2': 'Reminders by date or by mileage',
    'carlog.b3': 'Photo of the garage invoice becomes a ready entry (AI)',
    'carlog.cta': 'Start CarLog free',
    'foodlog.kicker': 'Calorie tracker', 'foodlog.title': 'Count calories in three taps.',
    'foodlog.b1': 'Barcode scanner that knows many Ukrainian products',
    'foodlog.b2': 'Photo of a label fills in the nutrition facts (AI)',
    'foodlog.b3': 'Calories, macros and weight at a glance',
    'foodlog.cta': 'Open FoodLog',
    'gighunter.kicker': 'Freelance radar', 'gighunter.title': 'Be first on the gigs that fit you.',
    'gighunter.b1': 'Checks freelance platforms as often as every 15 minutes',
    'gighunter.b2': 'AI scores every job against your profile',
    'gighunter.b3': 'Only the good matches reach your Telegram',
    'gighunter.cta': 'Request an invite',
    'moneylog.kicker': 'Personal finance', 'moneylog.title': 'See where your money goes.',
    'moneylog.b1': 'Imports your monobank transactions automatically',
    'moneylog.b2': 'Sorts spending into categories, with your own rules',
    'moneylog.b3': 'Monthly budgets show how much is left',
    'moneylog.cta': 'Request an invite',
    more: 'Learn more', open: 'Open {app}',
    'status.invite': 'Invite only', 'status.soon': 'Coming soon', 'status.free': 'Free to start',
    'access.yes': 'You have access', 'access.no': 'No access yet',
    'how.title': 'One account for every app',
    'how.1.t': 'Sign in once', 'how.1.d': 'Email or Google. The same account works in every Only Tools app.',
    'how.2.t': 'Add it to your home screen', 'how.2.d': 'Open the app in your phone\'s browser and tap "Add to Home Screen". No app store.',
    'how.3.t': 'Use it like a native app', 'how.3.d': 'Full screen, light and dark theme, three languages.',
    'guest.cta': 'Create a free account',
    'plusT.title': 'Free stays free',
    'plusT.text': 'Every app works without paying. Only Tools Plus lifts the daily limits in all of them at once and keeps the project going.',
    'plusT.cta': 'See Plus', 'plusT.coffee': 'or just say thanks with a donation',
    'acc.title': 'Your Only Tools account',
    'acc.signedIn': 'Signed in as <b>{email}</b>. This account works in every Only Tools app.',
    admin: 'Admin panel', signOut: 'Sign out', signIn: 'Sign in', plus: 'Only Tools Plus',
  },
  uk: {
    'foot.apps': 'Застосунки', 'foot.blog': 'Блог', 'foot.legal': 'Документи', 'foot.terms': 'Умови використання', 'foot.privacy': 'Політика конфіденційності', 'foot.refunds': 'Повернення коштів', 'foot.contacts': 'Контакти',
    'meta.title': 'Only Tools: маленькі застосунки для авто, їжі та фрилансу',
    'meta.desc': 'Маленькі застосунки для щоденного життя: CarLog (сервісна книжка авто), FoodLog (трекер калорій), GigHunter (фриланс-замовлення в Telegram). Безкоштовний старт, один акаунт для всіх.',
    'nav.home': 'Головна', 'nav.apps': 'Застосунки', 'nav.support': 'Підтримати', 'nav.account': 'Акаунт',
    'hero.eyebrow': '3 застосунки · 1 акаунт · безкоштовний старт',
    'hero.title': 'Авто, їжа, фриланс. Усе під контролем.',
    'hero.text': 'Маленькі застосунки, кожен з яких добре робить одну справу. Сфотографуйте рахунок із СТО, відскануйте штрихкод, отримайте фриланс-замовлення раніше за інших.',
    'hero.cta': 'Обрати застосунок', 'hero.how': 'Як це працює',
    'trust.made': 'Зроблено в Україні однією людиною', 'trust.store': 'Без App Store і Google Play', 'trust.langs': 'Українська, англійська, російська',
    'apps.title': 'Три застосунки, кожен для своєї справи',
    'carlog.kicker': 'Сервісна книжка авто', 'carlog.title': 'Більше не пропустите заміну оливи.',
    'carlog.b1': 'Кожне ТО, ремонт і чек в одній стрічці',
    'carlog.b2': 'Нагадування за датою або за пробігом',
    'carlog.b3': 'Фото рахунку з СТО перетворюється на готовий запис (AI)',
    'carlog.cta': 'Почати CarLog безкоштовно',
    'foodlog.kicker': 'Трекер калорій', 'foodlog.title': 'Рахуйте калорії за три дотики.',
    'foodlog.b1': 'Сканер штрихкодів, що знає багато українських продуктів',
    'foodlog.b2': 'Фото етикетки саме заповнює КБЖВ (AI)',
    'foodlog.b3': 'Калорії, БЖВ і вага одним поглядом',
    'foodlog.cta': 'Відкрити FoodLog',
    'gighunter.kicker': 'Фриланс-радар', 'gighunter.title': 'Будьте першим на замовленнях, що вам підходять.',
    'gighunter.b1': 'Перевіряє фриланс-біржі хоч щоп’ятнадцять хвилин',
    'gighunter.b2': 'AI оцінює кожне замовлення за вашим профілем',
    'gighunter.b3': 'У Telegram приходять лише вдалі збіги',
    'gighunter.cta': 'Попросити запрошення',
    'moneylog.kicker': 'Особисті фінанси', 'moneylog.title': 'Бачте, куди йдуть ваші гроші.',
    'moneylog.b1': 'Сам імпортує операції з monobank',
    'moneylog.b2': 'Розкладає витрати за категоріями, з вашими правилами',
    'moneylog.b3': 'Місячні бюджети показують, скільки лишилося',
    'moneylog.cta': 'Попросити запрошення',
    more: 'Детальніше', open: 'Відкрити {app}',
    'status.invite': 'За запрошенням', 'status.soon': 'Незабаром', 'status.free': 'Безкоштовний старт',
    'access.yes': 'Є доступ', 'access.no': 'Ще немає доступу',
    'how.title': 'Один акаунт для всіх застосунків',
    'how.1.t': 'Увійдіть один раз', 'how.1.d': 'Email або Google. Той самий акаунт працює в кожному застосунку Only Tools.',
    'how.2.t': 'Додайте на головний екран', 'how.2.d': 'Відкрийте застосунок у браузері телефона й натисніть «На початковий екран». Без магазину застосунків.',
    'how.3.t': 'Користуйтеся як звичайним застосунком', 'how.3.d': 'На весь екран, світла й темна теми, три мови.',
    'guest.cta': 'Створити безкоштовний акаунт',
    'plusT.title': 'Безкоштовне лишається безкоштовним',
    'plusT.text': 'Усі застосунки працюють без оплати. Only Tools Plus знімає денні ліміти одразу в усіх і допомагає проєкту жити.',
    'plusT.cta': 'Дізнатися про Plus', 'plusT.coffee': 'або просто подякувати донатом',
    'acc.title': 'Ваш акаунт Only Tools',
    'acc.signedIn': 'Ви увійшли як <b>{email}</b>. Цей акаунт працює в усіх застосунках Only Tools.',
    admin: 'Адмін-панель', signOut: 'Вийти', signIn: 'Увійти', plus: 'Only Tools Plus',
  },
  ru: {
    'foot.apps': 'Приложения', 'foot.blog': 'Блог', 'foot.legal': 'Документы', 'foot.terms': 'Условия использования', 'foot.privacy': 'Политика конфиденциальности', 'foot.refunds': 'Возврат средств', 'foot.contacts': 'Контакты',
    'meta.title': 'Only Tools: маленькие приложения для авто, еды и фриланса',
    'meta.desc': 'Маленькие приложения для повседневной жизни: CarLog (сервисная книжка авто), FoodLog (трекер калорий), GigHunter (фриланс-заказы в Telegram). Бесплатный старт, один аккаунт для всех.',
    'nav.home': 'Главная', 'nav.apps': 'Приложения', 'nav.support': 'Поддержать', 'nav.account': 'Аккаунт',
    'hero.eyebrow': '3 приложения · 1 аккаунт · бесплатный старт',
    'hero.title': 'Машина, еда, фриланс. Всё под контролем.',
    'hero.text': 'Маленькие приложения, каждое хорошо делает одно дело. Сфоткайте счёт из СТО, отсканируйте штрихкод, получите фриланс-заказ раньше других.',
    'hero.cta': 'Выбрать приложение', 'hero.how': 'Как это работает',
    'trust.made': 'Сделано в Украине одним человеком', 'trust.store': 'Без App Store и Google Play', 'trust.langs': 'Русский, украинский, английский',
    'apps.title': 'Три приложения, у каждого своё дело',
    'carlog.kicker': 'Сервисная книжка авто', 'carlog.title': 'Больше не пропустите замену масла.',
    'carlog.b1': 'Каждое ТО, ремонт и чек в одной ленте',
    'carlog.b2': 'Напоминания по дате или по пробегу',
    'carlog.b3': 'Фото счёта из СТО превращается в готовую запись (AI)',
    'carlog.cta': 'Начать CarLog бесплатно',
    'foodlog.kicker': 'Трекер калорий', 'foodlog.title': 'Считайте калории в три касания.',
    'foodlog.b1': 'Сканер штрихкодов, который знает много украинских продуктов',
    'foodlog.b2': 'Фото этикетки само заполняет КБЖУ (AI)',
    'foodlog.b3': 'Калории, БЖУ и вес одним взглядом',
    'foodlog.cta': 'Открыть FoodLog',
    'gighunter.kicker': 'Фриланс-радар', 'gighunter.title': 'Будьте первым на заказах, которые вам подходят.',
    'gighunter.b1': 'Проверяет фриланс-биржи хоть каждые 15 минут',
    'gighunter.b2': 'AI оценивает каждый заказ по вашему профилю',
    'gighunter.b3': 'В Telegram приходят только удачные совпадения',
    'gighunter.cta': 'Запросить приглашение',
    'moneylog.kicker': 'Личные финансы', 'moneylog.title': 'Видите, куда уходят ваши деньги.',
    'moneylog.b1': 'Сам импортирует операции из monobank',
    'moneylog.b2': 'Раскладывает траты по категориям, с вашими правилами',
    'moneylog.b3': 'Месячные бюджеты показывают, сколько осталось',
    'moneylog.cta': 'Запросить приглашение',
    more: 'Подробнее', open: 'Открыть {app}',
    'status.invite': 'По приглашению', 'status.soon': 'Скоро', 'status.free': 'Бесплатный старт',
    'access.yes': 'Есть доступ', 'access.no': 'Пока нет доступа',
    'how.title': 'Один аккаунт для всех приложений',
    'how.1.t': 'Войдите один раз', 'how.1.d': 'Email или Google. Один и тот же аккаунт работает в каждом приложении Only Tools.',
    'how.2.t': 'Добавьте на главный экран', 'how.2.d': 'Откройте приложение в браузере телефона и нажмите «На экран „Домой“». Без магазина приложений.',
    'how.3.t': 'Пользуйтесь как обычным приложением', 'how.3.d': 'На весь экран, светлая и тёмная темы, три языка.',
    'guest.cta': 'Создать бесплатный аккаунт',
    'plusT.title': 'Бесплатное остаётся бесплатным',
    'plusT.text': 'Все приложения работают без оплаты. Only Tools Plus снимает дневные лимиты сразу во всех и помогает проекту жить.',
    'plusT.cta': 'Узнать про Plus', 'plusT.coffee': 'или просто сказать спасибо донатом',
    'acc.title': 'Ваш аккаунт Only Tools',
    'acc.signedIn': 'Вы вошли как <b>{email}</b>. Этот аккаунт работает во всех приложениях Only Tools.',
    admin: 'Админ-панель', signOut: 'Выйти', signIn: 'Войти', plus: 'Only Tools Plus',
  },
}

const icon = (id) => `<svg class="ot-icon"><use href="#i-${id}"/></svg>`
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const $ = (id) => document.getElementById(id)

const [apps, user] = await Promise.all([
  fetch('/apps.json').then((r) => r.json()),
  currentUser().catch(() => null),
])
const has = (a) => user?.groups.includes(`${a.id}-user`)
const isAdmin = user?.groups.includes('platform-admin')

let lang = getLang()

function showcase(a, i, t, pre) {
  const live = a.status !== 'soon'
  let chip = { invite: t('status.invite'), soon: t('status.soon') }[a.status] ?? t('status.free')
  let chipCls = a.status === 'live' ? 'ot-chip ot-chip--good' : 'ot-chip'
  if (user && live) {
    chip = has(a) ? t('access.yes') : t('access.no')
    chipCls = has(a) ? 'ot-chip ot-chip--good' : 'ot-chip ot-chip--neutral'
  }
  // The invite-only app asks for an invite unless this account already has access.
  const invite = a.invite && !has(a)
  const primary = !live ? '' : invite
    ? `<a class="ot-btn" href="${esc(a.invite)}">${t(`${a.id}.cta`)}</a>`
    : `<a class="ot-btn" href="${esc(a.url)}">${user && has(a) ? t('open').replace('{app}', esc(a.name)) : t(`${a.id}.cta`)} ${icon('arrow')}</a>`
  const shots = (a.shots || []).map((src, n) =>
    `<img class="app-row__shot app-row__shot--${n}" src="${esc(src)}" alt="" width="390" height="664" loading="lazy" decoding="async">`).join('')
  return `<article class="app-row reveal${i % 2 ? ' app-row--flip' : ''}" data-app="${a.accent}">
    <div class="app-row__art" aria-hidden="true">${shots}</div>
    <div class="app-row__copy">
      <p class="app-row__kicker"><span class="ot-appicon">${icon(a.icon)}</span><b>${esc(a.name)}</b><span>${t(`${a.id}.kicker`)}</span></p>
      <h3 class="app-row__title">${t(`${a.id}.title`)}</h3>
      <ul class="app-row__list">${[1, 2, 3].map((n) => `<li>${icon('check')}<span>${t(`${a.id}.b${n}`)}</span></li>`).join('')}</ul>
      <div class="app-row__cta">${primary}<a class="ot-btn ot-btn--outline" href="${pre}/${a.id}">${t('more')}</a><span class="${chipCls}">${chip}</span></div>
    </div>
  </article>`
}

function render() {
  const t = (k) => T[lang][k] ?? T.en[k]
  const pre = { en: '', uk: '/uk', ru: '/ru' }[lang]
  document.documentElement.lang = lang
  document.title = t('meta.title')
  document.querySelector('meta[name="description"]').content = t('meta.desc')
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t) })
  // App links in the shared nav go to the app pages in the chosen language.
  document.querySelectorAll('.ot-nav__app').forEach((a) => { a.href = `${pre}/${a.dataset.id}` })

  $('lang').innerHTML = LANGS.map((l) =>
    `<button lang="${l.code}" title="${l.name}" aria-pressed="${l.code === lang}" data-lang="${l.code}">${l.label}</button>`).join('')

  $('showcase').innerHTML = apps.map((a, i) => showcase(a, i, t, pre)).join('')

  const link = (href, label) => `<a href="${href}">${esc(label)}</a>`
  $('foot').innerHTML = `
    <nav aria-label="${esc(t('foot.apps'))}"><b>${esc(t('foot.apps'))}</b>${apps.map((a) => link(`${pre}/${a.id}`, a.name)).join('')}</nav>
    <nav aria-label="${esc(t('foot.blog'))}"><b>${esc(t('foot.blog'))}</b>${link(`${pre}/blog/car-service-history`, 'CarLog')}${link(`${pre}/blog/calorie-counting-ukrainian-products`, 'FoodLog')}${link(`${pre}/blog/freelance-job-alerts-telegram`, 'GigHunter')}</nav>
    <nav aria-label="${esc(t('foot.legal'))}"><b>${esc(t('foot.legal'))}</b>${link(`${pre}/terms`, t('foot.terms'))}${link(`${pre}/privacy`, t('foot.privacy'))}${link(`${pre}/refunds`, t('foot.refunds'))}${link(`${pre}/contacts`, t('foot.contacts'))}</nav>
    <p class="ot-caption">© ${new Date().getFullYear()} Only Tools · onlytools.click</p>`

  if (user) {
    const initial = esc((user.name || user.email)[0].toUpperCase())
    $('who').innerHTML = `<a class="ot-avatar" href="#account" title="${esc(user.email)}">${initial}</a>`
    $('how-cta').innerHTML = ''
    $('account').hidden = false
    $('account').innerHTML = `
      <h2 class="ot-h3">${t('acc.title')}</h2>
      <p class="ot-text">${t('acc.signedIn').replace('{email}', esc(user.email))}</p>
      <div class="account__actions">
        ${PAYMENTS ? `<a class="ot-btn ot-btn--sm${user.groups.includes('plus') ? ' ot-btn--soft' : ''}" href="/plus/">${t('plus')}</a>` : ''}
        ${isAdmin ? `<a class="ot-btn ot-btn--sm" href="/admin">${t('admin')}</a>` : ''}
        <button class="ot-btn ot-btn--sm ot-btn--outline" id="sign-out">${t('signOut')}</button>
      </div>`
    $('sign-out').onclick = () => signOut()
  } else {
    // Signed out: the top bar button stays quiet so the hero button is the one that stands out.
    $('who').innerHTML = `<button class="ot-btn ot-btn--sm ot-btn--outline" id="sign-in-top">${t('signIn')}</button>`
    $('how-cta').innerHTML = `<button class="ot-btn" id="sign-in">${t('guest.cta')}</button>`
    // #account (the nav's Account item) still has somewhere to land: the sign-in button.
    $('account').hidden = true
    $('sign-in').onclick = $('sign-in-top').onclick = () => signIn('/')
  }
  reveal()
}

// Sections fade up as they scroll into view (skipped when the visitor prefers reduced motion).
const io = 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches
  ? new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
  }), { rootMargin: '0px 0px -8% 0px' })
  : null
function reveal() {
  document.querySelectorAll('.reveal:not(.is-in)').forEach((el) => (io ? io.observe(el) : el.classList.add('is-in')))
}
document.documentElement.classList.toggle('js-reveal', !!io)

$('lang').addEventListener('click', (e) => {
  const code = e.target.closest('button')?.dataset.lang
  if (!code || code === lang) return
  lang = code
  setLang(code)
  render()
})

render()
// The nav's "Account" item links to /#account; signed out, send it to the sign-in step instead.
if (location.hash === '#account' && !user) $('how').scrollIntoView()

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
