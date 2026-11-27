// Only Tools Plus: pricing, the signed-in user's subscription, and donations. Payments run through
// monobank (plata by mono); the API lives at /api/billing/*.
import { currentUser, signIn } from '/auth.js'
import { LANGS, getLang, setLang } from '/i18n.js'

const T = {
  en: {
    'meta.desc': 'Only Tools Plus: higher limits in every Only Tools app. Monthly, yearly or once for life. Or support the author with any amount.',
    'nav.home': 'Home', 'nav.apps': 'Apps', 'nav.support': 'Support', 'nav.account': 'Account', loading: 'Loading…', signIn: 'Sign in',
    'hero.title': 'Only Tools Plus',
    'hero.text': 'Every app stays free to use. Plus lifts the daily limits in all Only Tools apps at once and keeps the project going.',
    'plans.title': 'Plans',
    'plan.monthly': 'Monthly', 'plan.yearly': 'Yearly', 'plan.lifetime': 'Founding, for life',
    'per.monthly': '/ month', 'per.yearly': '/ year', 'per.lifetime': 'once',
    'plan.yearlyHint': '{m} a month, about two months free', 'plan.monthlyHint': 'Cancel any time',
    'plan.lifetimeHint': 'Pay once, Plus forever. {n} of 100 left.', 'plan.soldOut': 'Sold out',
    'plan.cta': 'Get Plus', 'plan.ctaSignIn': 'Sign in to get Plus', 'plan.current': 'Your plan', 'plan.best': 'Best value',
    'plans.note': 'Monthly and yearly plans renew automatically from the same card until you cancel. You can pay in hryvnia or dollars.',
    'cmp.title': 'Free and Plus', 'cmp.free': 'Free', 'cmp.plus': 'Plus', 'unlimited': 'Unlimited',
    'lim.foodlog.labelScansPerDay': 'AI label scans a day', 'lim.foodlog.historyDays': 'Diary history',
    'lim.carlog.cars': 'Cars', 'lim.carlog.ocrScansPerMonth': 'Receipt scans a month',
    days: '{n} days', forever: 'Kept forever',
    'mine.title': 'Your Plus', 'mine.renews': 'Renews on {date} for {amount} from card {card}.',
    'mine.ends': 'Plus is active until {date}. It will not renew.', 'mine.lifetime': 'Plus for life. Thank you!',
    'mine.pastDue': 'We could not charge your card on {date}. We will try again; Plus stays on until {grace}.',
    'mine.cancel': 'Cancel renewal', 'mine.resume': 'Turn renewal back on', 'mine.forget': 'Remove saved card',
    'mine.cancelConfirm': 'Stop renewing Plus? You keep it until the end of the paid period.',
    'mine.forgetConfirm': 'Remove the saved card? Renewal stops; Plus stays until the end of the paid period.',
    'mine.expired': 'Your Plus has ended. Pick a plan to get it back.',
    'pay.checking': 'Checking your payment…', 'pay.ok': 'Payment received. Plus is on: it may take a minute to show up in the apps.',
    'pay.failed': 'The payment did not go through. You were not charged; you can try again.',
    'pay.pending': 'The payment is still processing. This page will update when it is done.',
    'thanks': 'Thank you for the support! It really helps.',
    'support.title': 'Support the author',
    'support.text': 'Only Tools is made by one person in Ukraine. If an app helps you, you can say thanks with any amount, no subscription.',
    'support.amount': 'Amount, {cur}', 'support.name': 'Your name (optional)', 'support.note': 'A few words (optional)',
    'support.cta': 'Support', 'support.range': 'Enter an amount from {min} to {max} {cur}.',
    'legal': 'Payments are processed by monobank (plata by mono); we never see your card number. By paying you accept the <a href="{terms}">terms</a> and <a href="{refunds}">refund policy</a>.',
    'err': 'Something went wrong. Please try again.',
    'paused': 'Only Tools Plus and donations are not available yet. Every app stays free to use.',
  },
  uk: {
    'meta.desc': 'Only Tools Plus: вищі ліміти в усіх застосунках Only Tools. Щомісяця, щороку або раз назавжди. Або підтримайте автора будь-якою сумою.',
    'nav.home': 'Головна', 'nav.apps': 'Застосунки', 'nav.support': 'Підтримати', 'nav.account': 'Акаунт', loading: 'Завантаження…', signIn: 'Увійти',
    'hero.title': 'Only Tools Plus',
    'hero.text': 'Усі застосунки лишаються безкоштовними. Plus знімає денні ліміти одразу в усіх застосунках Only Tools і допомагає проєкту жити.',
    'plans.title': 'Тарифи',
    'plan.monthly': 'Щомісяця', 'plan.yearly': 'Щороку', 'plan.lifetime': 'Засновницький, назавжди',
    'per.monthly': '/ міс', 'per.yearly': '/ рік', 'per.lifetime': 'один раз',
    'plan.yearlyHint': '{m} на місяць, близько двох місяців безкоштовно', 'plan.monthlyHint': 'Скасувати можна будь-коли',
    'plan.lifetimeHint': 'Платите раз, Plus назавжди. Лишилось {n} зі 100.', 'plan.soldOut': 'Розпродано',
    'plan.cta': 'Отримати Plus', 'plan.ctaSignIn': 'Увійдіть, щоб отримати Plus', 'plan.current': 'Ваш тариф', 'plan.best': 'Найвигідніше',
    'plans.note': 'Місячний і річний тарифи продовжуються автоматично з тієї ж картки, доки ви не скасуєте. Платити можна в гривнях або доларах.',
    'cmp.title': 'Безкоштовно і Plus', 'cmp.free': 'Безкоштовно', 'cmp.plus': 'Plus', 'unlimited': 'Без обмежень',
    'lim.foodlog.labelScansPerDay': 'AI-сканувань етикеток на день', 'lim.foodlog.historyDays': 'Історія щоденника',
    'lim.carlog.cars': 'Автомобілів', 'lim.carlog.ocrScansPerMonth': 'Сканувань чеків на місяць',
    days: '{n} днів', forever: 'Зберігається назавжди',
    'mine.title': 'Ваш Plus', 'mine.renews': 'Продовжиться {date} на {amount} з картки {card}.',
    'mine.ends': 'Plus діє до {date} і не продовжиться.', 'mine.lifetime': 'Plus назавжди. Дякуємо!',
    'mine.pastDue': 'Не вдалося списати оплату з картки {date}. Ми спробуємо ще; Plus діє до {grace}.',
    'mine.cancel': 'Скасувати продовження', 'mine.resume': 'Увімкнути продовження', 'mine.forget': 'Видалити збережену картку',
    'mine.cancelConfirm': 'Скасувати продовження Plus? Він діятиме до кінця оплаченого періоду.',
    'mine.forgetConfirm': 'Видалити збережену картку? Продовження зупиниться; Plus діятиме до кінця оплаченого періоду.',
    'mine.expired': 'Ваш Plus закінчився. Оберіть тариф, щоб повернути його.',
    'pay.checking': 'Перевіряємо оплату…', 'pay.ok': 'Оплату отримано. Plus увімкнено: у застосунках він з’явиться за хвилину.',
    'pay.failed': 'Оплата не пройшла. Гроші не списано, можна спробувати ще раз.',
    'pay.pending': 'Оплата ще обробляється. Сторінка оновиться, щойно вона завершиться.',
    'thanks': 'Дякую за підтримку! Це справді допомагає.',
    'support.title': 'Підтримати автора',
    'support.text': 'Only Tools робить одна людина в Україні. Якщо застосунок вам допомагає, можна подякувати будь-якою сумою, без підписки.',
    'support.amount': 'Сума, {cur}', 'support.name': 'Ваше ім’я (необов’язково)', 'support.note': 'Кілька слів (необов’язково)',
    'support.cta': 'Підтримати', 'support.range': 'Введіть суму від {min} до {max} {cur}.',
    'legal': 'Платежі обробляє monobank (plata by mono); ми не бачимо номера вашої картки. Оплачуючи, ви погоджуєтеся з <a href="{terms}">умовами</a> і <a href="{refunds}">правилами повернення</a>.',
    'err': 'Щось пішло не так. Спробуйте ще раз.',
    'paused': 'Only Tools Plus і донати поки недоступні. Усі застосунки лишаються безкоштовними.',
  },
  ru: {
    'meta.desc': 'Only Tools Plus: больше лимитов во всех приложениях Only Tools. Ежемесячно, ежегодно или один раз навсегда. Или поддержите автора любой суммой.',
    'nav.home': 'Главная', 'nav.apps': 'Приложения', 'nav.support': 'Поддержать', 'nav.account': 'Аккаунт', loading: 'Загрузка…', signIn: 'Войти',
    'hero.title': 'Only Tools Plus',
    'hero.text': 'Все приложения остаются бесплатными. Plus снимает дневные лимиты сразу во всех приложениях Only Tools и помогает проекту жить.',
    'plans.title': 'Тарифы',
    'plan.monthly': 'Ежемесячно', 'plan.yearly': 'Ежегодно', 'plan.lifetime': 'Основательский, навсегда',
    'per.monthly': '/ мес', 'per.yearly': '/ год', 'per.lifetime': 'один раз',
    'plan.yearlyHint': '{m} в месяц, около двух месяцев бесплатно', 'plan.monthlyHint': 'Отменить можно в любой момент',
    'plan.lifetimeHint': 'Платите один раз, Plus навсегда. Осталось {n} из 100.', 'plan.soldOut': 'Распродано',
    'plan.cta': 'Получить Plus', 'plan.ctaSignIn': 'Войдите, чтобы получить Plus', 'plan.current': 'Ваш тариф', 'plan.best': 'Выгоднее всего',
    'plans.note': 'Месячный и годовой тарифы продлеваются автоматически с той же карты, пока вы не отмените. Платить можно в гривнах или долларах.',
    'cmp.title': 'Бесплатно и Plus', 'cmp.free': 'Бесплатно', 'cmp.plus': 'Plus', 'unlimited': 'Без ограничений',
    'lim.foodlog.labelScansPerDay': 'AI-сканирований этикеток в день', 'lim.foodlog.historyDays': 'История дневника',
    'lim.carlog.cars': 'Автомобилей', 'lim.carlog.ocrScansPerMonth': 'Сканирований чеков в месяц',
    days: '{n} дней', forever: 'Хранится всегда',
    'mine.title': 'Ваш Plus', 'mine.renews': 'Продлится {date} на {amount} с карты {card}.',
    'mine.ends': 'Plus действует до {date} и не продлится.', 'mine.lifetime': 'Plus навсегда. Спасибо!',
    'mine.pastDue': 'Не удалось списать оплату с карты {date}. Мы попробуем ещё; Plus действует до {grace}.',
    'mine.cancel': 'Отменить продление', 'mine.resume': 'Включить продление', 'mine.forget': 'Удалить сохранённую карту',
    'mine.cancelConfirm': 'Отменить продление Plus? Он будет действовать до конца оплаченного периода.',
    'mine.forgetConfirm': 'Удалить сохранённую карту? Продление остановится; Plus действует до конца оплаченного периода.',
    'mine.expired': 'Ваш Plus закончился. Выберите тариф, чтобы вернуть его.',
    'pay.checking': 'Проверяем оплату…', 'pay.ok': 'Оплата получена. Plus включён: в приложениях он появится через минуту.',
    'pay.failed': 'Оплата не прошла. Деньги не списаны, можно попробовать ещё раз.',
    'pay.pending': 'Оплата ещё обрабатывается. Страница обновится, как только она завершится.',
    'thanks': 'Спасибо за поддержку! Это правда помогает.',
    'support.title': 'Поддержать автора',
    'support.text': 'Only Tools делает один человек в Украине. Если приложение вам помогает, можно поблагодарить любой суммой, без подписки.',
    'support.amount': 'Сумма, {cur}', 'support.name': 'Ваше имя (необязательно)', 'support.note': 'Пару слов (необязательно)',
    'support.cta': 'Поддержать', 'support.range': 'Введите сумму от {min} до {max} {cur}.',
    'legal': 'Платежи обрабатывает monobank (plata by mono); мы не видим номер вашей карты. Оплачивая, вы соглашаетесь с <a href="{terms}">условиями</a> и <a href="{refunds}">правилами возврата</a>.',
    'err': 'Что-то пошло не так. Попробуйте ещё раз.',
    'paused': 'Only Tools Plus и донаты пока недоступны. Все приложения остаются бесплатными.',
  },
}
const LOCALE = { en: 'en-GB', uk: 'uk-UA', ru: 'ru-UA' }
const PREFIX = { en: '', uk: '/uk', ru: '/ru' }
const PRESETS = { UAH: [50, 100, 250, 500], USD: [3, 5, 10, 25] }
const CUR_LABEL = { UAH: '₴ UAH', USD: '$ USD' }
const CUR_UNIT = { en: { UAH: 'UAH', USD: 'USD' }, uk: { UAH: 'грн', USD: 'дол.' }, ru: { UAH: 'грн', USD: 'долл.' } }

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
let lang = getLang()
const t = (k, vars = {}) => Object.entries(vars).reduce((s, [a, b]) => s.replaceAll(`{${a}}`, b), T[lang][k] ?? T.en[k] ?? k)
// Hryvnia for Ukraine, dollars for everyone else; the visitor can switch, and the choice is remembered here.
const saved = { get: (k) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } }
const KYIV_TZ = ['Europe/Kyiv', 'Europe/Kiev', 'Europe/Uzhgorod', 'Europe/Zaporozhye', 'Europe/Simferopol']
const inUkraine = () => KYIV_TZ.includes(Intl.DateTimeFormat().resolvedOptions().timeZone) || getLang() === 'uk'
let cur = ['UAH', 'USD'].includes(saved.get('ot.currency')) ? saved.get('ot.currency') : inUkraine() ? 'UAH' : 'USD'
const money = (minor, c = cur) => c === 'USD'
  ? `$${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
  : `${(minor / 100).toLocaleString(LOCALE[lang], { maximumFractionDigits: minor % 100 ? 2 : 0 })} ₴`
const day = (iso) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' })

async function api(path, init = {}, auth = true) {
  const headers = { 'content-type': 'application/json' }
  if (auth) {
    const u = await currentUser()
    if (!u) { await signIn('/plus/'); throw new Error('sign-in') }
    headers.authorization = `Bearer ${u.accessToken}`
  }
  const res = await fetch(`/api/billing${path}`, { ...init, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || t('err'))
  return body
}

$('year').textContent = new Date().getFullYear()
const params = new URLSearchParams(location.search)
const [info, user] = await Promise.all([
  api('/plans', {}, false).catch(() => null),
  currentUser().catch(() => null),
])
let mine = user ? await api('/me').catch(() => null) : null
// A subscriber sees prices in the currency they pay in.
if (mine?.plus && mine.subscription?.currency) cur = mine.subscription.currency
let notice = null // { kind: 'good' | 'bad' | 'neutral', key }

function render() {
  document.documentElement.lang = lang
  document.querySelector('meta[name="description"]').content = t('meta.desc')
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t) })
  // App links in the shared nav go to the app pages in the chosen language.
  document.querySelectorAll('.ot-nav__app').forEach((a) => { a.href = `${lang === 'en' ? '' : `/${lang}`}/${a.dataset.id}` })
  $('lang').innerHTML = LANGS.map((l) =>
    `<button lang="${l.code}" title="${l.name}" aria-pressed="${l.code === lang}" data-lang="${l.code}">${l.label}</button>`).join('')
  $('who').innerHTML = user
    ? `<a class="ot-avatar" href="/#account" title="${esc(user.email)}">${esc((user.name || user.email)[0].toUpperCase())}</a>`
    : `<button class="ot-btn ot-btn--sm" id="sign-in-top">${t('signIn')}</button>`
  if (!user) $('sign-in-top').onclick = () => signIn('/plus/')

  $('notice').innerHTML = notice ? `<div class="ot-card ot-card--flat notice notice--${notice.kind}"><p class="ot-text">${t(notice.key)}</p></div>` : ''
  renderMine()
  // Payments paused: only a note (and the subscriber's own Plus, if any) stays on the page.
  const paused = info?.enabled === false
  // .block sets display, which beats the hidden attribute, so hide with an inline style.
  const hide = (el) => { el.style.display = paused ? 'none' : '' }
  for (const id of ['plans', 'cmp', 'support']) hide($(id).closest('section') ?? $(id))
  hide($('legal'))
  hide(document.querySelector('[data-t="hero.text"]'))
  if (paused) {
    if (!notice) $('notice').innerHTML = `<div class="ot-card ot-card--flat notice notice--neutral"><p class="ot-text">${t('paused')}</p></div>`
    return
  }
  renderPlans()
  renderCompare()
  renderDonate()
  $('legal').innerHTML = t('legal', { terms: `${PREFIX[lang]}/terms/`, refunds: `${PREFIX[lang]}/refunds/` })
}

function renderMine() {
  const s = mine?.subscription
  const el = $('mine')
  el.hidden = !s
  if (!s) return
  let text, actions = ''
  if (!mine.plus) text = t('mine.expired')
  else if (s.plan === 'lifetime') text = t('mine.lifetime')
  else if (s.status === 'past_due') text = t('mine.pastDue', { date: day(s.periodEnd), grace: day(new Date(Date.parse(s.periodEnd) + 7 * 86_400_000).toISOString()) })
  else if (s.autoRenew) text = t('mine.renews', { date: day(s.periodEnd), amount: money(s.amount, s.currency), card: esc(s.maskedPan ?? '…') })
  else text = t('mine.ends', { date: day(s.periodEnd) })
  if (mine.plus && s.plan !== 'lifetime') {
    if (s.autoRenew) actions += `<button class="ot-btn ot-btn--sm ot-btn--outline" data-act="cancel">${t('mine.cancel')}</button>`
    else if (s.status === 'canceled' && s.maskedPan) actions += `<button class="ot-btn ot-btn--sm" data-act="resume">${t('mine.resume')}</button>`
    if (s.maskedPan) actions += `<button class="ot-btn ot-btn--sm ot-btn--ghost" data-act="forget">${t('mine.forget')}</button>`
  }
  el.innerHTML = `<div class="ot-card" data-app="hub">
    <div class="inline"><h2 class="ot-h3">${t('mine.title')}</h2>
      ${mine.plus ? `<span class="ot-chip ot-chip--good">${t('plan.' + s.plan)}</span>` : ''}</div>
    <p class="ot-text">${text}</p>
    ${actions ? `<div class="inline">${actions}</div>` : ''}</div>`
}

function renderPlans() {
  if (!info) { $('plans').innerHTML = `<p class="ot-text">${t('err')}</p>`; return }
  const current = mine?.plus ? mine.subscription?.plan : null
  const blocked = current === 'lifetime' || (current && mine.subscription.autoRenew)
  $('plans').innerHTML = info.plans.map((p) => {
    const soldOut = p.id === 'lifetime' && info.lifetimeLeft <= 0
    const amount = p.amount[cur]
    const hint = p.id === 'yearly' ? t('plan.yearlyHint', { m: money(Math.round(amount / 12)) })
      : p.id === 'lifetime' ? (soldOut ? t('plan.soldOut') : t('plan.lifetimeHint', { n: info.lifetimeLeft }))
      : t('plan.monthlyHint')
    const isMine = current === p.id
    const disabled = soldOut || isMine || blocked && !(p.id === 'lifetime' && current !== 'lifetime')
    const label = isMine ? t('plan.current') : user ? t('plan.cta') : t('plan.ctaSignIn')
    return `<div class="ot-card plan${p.id === 'yearly' ? ' plan--best' : ''}" data-app="${p.id === 'lifetime' ? 'gig' : 'hub'}">
      <div class="inline" style="justify-content:space-between"><span class="ot-label">${t('plan.' + p.id)}</span>
        ${p.id === 'yearly' ? `<span class="ot-chip ot-chip--good">${t('plan.best')}</span>` : ''}</div>
      <div class="ot-stat"><span class="ot-stat__value">${money(amount)}</span><span class="ot-stat__unit">${t('per.' + p.id)}</span></div>
      <p class="ot-caption">${hint}</p>
      <button class="ot-btn ot-btn--block${p.id === 'yearly' ? '' : ' ot-btn--outline'}" data-plan="${p.id}"${disabled ? ' disabled' : ''}>${label}</button>
    </div>`
  }).join('')
  $('plans-note').textContent = t('plans.note')
  $('currency').innerHTML = ['UAH', 'USD'].map((c) => `<button type="button" aria-pressed="${c === cur}" data-cur="${c}">${CUR_LABEL[c]}</button>`).join('')
}

function renderCompare() {
  if (!info?.limits) return
  const fmt = (key, v) => v === null ? (key === 'historyDays' ? t('forever') : t('unlimited')) : key === 'historyDays' ? t('days', { n: v }) : String(v)
  const names = { foodlog: 'FoodLog', carlog: 'CarLog' }
  $('cmp').innerHTML = `<table class="cmp-table"><thead><tr><th></th><th>${t('cmp.free')}</th><th>${t('cmp.plus')}</th></tr></thead><tbody>${
    Object.entries(info.limits).map(([app, lims]) =>
      `<tr class="cmp-app"><th colspan="3">${names[app] ?? app}</th></tr>` +
      Object.entries(lims).map(([k, v]) => `<tr><td>${t(`lim.${app}.${k}`)}</td><td>${fmt(k, v.free)}</td><td><b>${fmt(k, v.plus)}</b></td></tr>`).join('')
    ).join('')}</tbody></table>`
}

function renderDonate() {
  const v = Number($('d-amount').value)
  const { min, max } = info?.donation?.[cur] ?? { min: 100, max: 100_000 }
  Object.assign($('d-amount'), { min: min / 100, max: max / 100 })
  document.querySelector('[data-t="support.amount"]').textContent = t('support.amount', { cur: CUR_UNIT[lang][cur] })
  $('amounts').innerHTML = PRESETS[cur].map((a) => `<button type="button" aria-pressed="${a === v}" data-amount="${a}">${money(a * 100)}</button>`).join('')
}

$('lang').addEventListener('click', (e) => {
  const code = e.target.closest('button')?.dataset.lang
  if (!code || code === lang) return
  lang = code; setLang(code); render()
})

$('plans').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-plan]')
  if (!b) return
  if (!user) return signIn('/plus/')
  b.disabled = true
  try { location.assign((await api('/checkout', { method: 'POST', body: JSON.stringify({ plan: b.dataset.plan, currency: cur }) })).pageUrl) }
  catch (err) { b.disabled = false; if (err.message !== 'sign-in') alert(err.message) }
})

$('mine').addEventListener('click', async (e) => {
  const act = e.target.closest('button[data-act]')?.dataset.act
  if (!act) return
  if (act === 'cancel' && !confirm(t('mine.cancelConfirm'))) return
  if (act === 'forget' && !confirm(t('mine.forgetConfirm'))) return
  try { mine = await api(act === 'forget' ? '/card/forget' : `/${act}`, { method: 'POST' }); render() }
  catch (err) { alert(err.message) }
})

$('currency').addEventListener('click', (e) => {
  const c = e.target.closest('button')?.dataset.cur
  if (!c || c === cur) return
  cur = c; saved.set('ot.currency', c)
  $('d-amount').value = PRESETS[c][1]
  render()
})

$('amounts').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.amount
  if (!v) return
  $('d-amount').value = v; renderDonate()
})
$('d-amount').addEventListener('input', renderDonate)

$('donate').addEventListener('submit', async (e) => {
  e.preventDefault()
  const amount = Number($('d-amount').value)
  const lim = info?.donation?.[cur] ?? { min: 100, max: 100_000 }
  const min = lim.min / 100, max = lim.max / 100
  const err = $('d-err')
  if (!(amount >= min && amount <= max)) { err.hidden = false; err.textContent = t('support.range', { min, max, cur: CUR_UNIT[lang][cur] }); return }
  err.hidden = true
  $('d-go').disabled = true
  try {
    const r = await api('/donate', { method: 'POST', body: JSON.stringify({ amount, currency: cur, donor: $('d-name').value, note: $('d-note').value }) }, false)
    location.assign(r.pageUrl)
  } catch (e2) { $('d-go').disabled = false; err.hidden = false; err.textContent = e2.message }
})

/** After monobank redirects back: poll the order until it settles. */
async function watchOrder(id, isDonation) {
  notice = { kind: 'neutral', key: 'pay.checking' }; render()
  for (let i = 0; i < 20; i++) {
    const r = await api(`/order/${encodeURIComponent(id)}`, {}, false).catch(() => null)
    if (r?.status === 'success') {
      notice = { kind: 'good', key: isDonation ? 'thanks' : 'pay.ok' }
      if (!isDonation) { await currentUser(true).catch(() => null); mine = await api('/me').catch(() => mine) }
      break
    }
    if (r && ['failure', 'expired', 'reversed'].includes(r.status)) { notice = { kind: 'bad', key: 'pay.failed' }; break }
    notice = { kind: 'neutral', key: 'pay.pending' }
    render()
    await new Promise((res) => setTimeout(res, Math.min(1000 * 2 ** i, 8000)))
  }
  history.replaceState(null, '', location.pathname + location.hash)
  render()
}

if (cur === 'USD') $('d-amount').value = PRESETS.USD[1]
render()
const orderId = params.get('order') || params.get('thanks')
if (orderId && /^[\w-]{1,80}$/.test(orderId)) watchOrder(orderId, params.has('thanks'))
