import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Same language choice as the landing and every Only Tools app: the `ot_lang` cookie on
// .onlytools.click, else the browser language, else English.
export type Lang = 'en' | 'uk' | 'ru'
export const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'uk', label: 'UA', name: 'Українська' },
  { code: 'ru', label: 'RU', name: 'Русский' },
]
const pick = (v: string | null | undefined): Lang | null => {
  const c = String(v ?? '').toLowerCase().slice(0, 2)
  return c === 'en' || c === 'uk' || c === 'ru' ? c : null
}
function initialLang(): Lang {
  const m = document.cookie.match(/(?:^|;\s*)ot_lang=([^;]+)/)
  return pick(m?.[1]) ?? (navigator.languages ?? [navigator.language]).map(pick).find((x): x is Lang => !!x) ?? 'en'
}
function saveLang(code: Lang) {
  const domain = location.hostname.endsWith('onlytools.click') ? '; domain=onlytools.click' : ''
  document.cookie = `ot_lang=${code}; path=/; max-age=31536000; samesite=lax${domain}`
}

const en = {
  loading: 'Loading…', noAccess: 'No access', noAccessText: 'The admin panel is for Only Tools administrators.',
  backHome: 'Back to Only Tools', overview: 'Overview', users: 'Users', errors: 'Errors', settings: 'Settings',
  language: 'Language',
  // Overview
  refresh: 'Refresh', refreshing: 'Refreshing…', updated: 'Updated {when} · refreshes daily',
  awsMonth: 'AWS this month', ofBudget: 'of {budget} budget', forecast: 'Forecast {v}', lastMonth: 'Last month {v}',
  dailyCost: 'Daily cost, this month', dailyCostAria: 'Daily AWS cost this month', costLag: 'AWS cost data lags by up to a day.',
  accounts: 'Only Tools accounts', accountsUnit: 'app accesses in the shared account',
  accountsHint: 'Until an app moves to the shared sign-in, its own user count is shown on its card.',
  apps: 'Apps', errors7d: '{n} errors / 7d', noErrors: 'No errors', usersUnit: 'users', ownSignIn: 'in its own sign-in',
  requests7d: 'requests / 7d', thisMonth: 'this month', requestsAria: '{app} requests per day, last 30 days',
  requestsDaily: 'Requests per day, last 30 days', shared: 'Shared and untagged',
  sharedUnit: 'this month (DNS, tax, untagged resources)',
  // Users
  invite: 'Invite', searchEmail: 'Search by email', userCount: '{n} users', userCountOne: '1 user', disabled: 'disabled',
  noUsers: 'No users found.', back: 'Back', active: 'Active', disabledChip: 'Disabled', joined: 'Joined {date}',
  roles: 'Roles', app: 'App', access: 'Access', admin: 'Admin', platformAdmin: 'Only Tools admin',
  rolesHint: 'Changes reach the user\'s apps within an hour, or right away after "Sign out everywhere".',
  account: 'Account', signOutAll: 'Sign out everywhere', disable: 'Disable account', enable: 'Enable account',
  disableConfirm: 'Disable {email}? They lose access to every app.', accessOf: '{app} access', adminOf: '{app} admin',
  email: 'Email', inviteHint: 'They get an email with a temporary password for onlytools.click.',
  sending: 'Sending…', sendInvite: 'Send invite',
  // Errors
  timeWindow: 'Time window', h1: '1 h', h24: '24 h', d7: '7 days', searching: 'Searching the logs…', alarms: 'Alarms',
  firing: '{n} firing', allOk: 'All OK', noAlarms: 'No alarms are set up.', logLines: 'Error log lines',
  updating: 'Updating…', inWindow: '{n} in the last {window}', noErrorsWindow: 'No errors in this window.',
  // Billing
  billing: 'Plus & donations', subsActive: 'Plus subscribers', subsSplit: '{m} monthly · {y} yearly · {l} lifetime',
  mrr: 'Monthly recurring', mrrUnit: 'from subscriptions that renew', revenueMonth: 'Paid this month',
  revenueTotal: 'All time {v}', donationsTotal: 'Donations {v}', feesTotal: 'monobank fees {v}',
  canceling: '{n} canceling', pastDue: '{n} card failed', byMonth: 'Revenue by month', plusLegend: 'Plus', donationsLegend: 'Donations',
  subscribers: 'Subscribers', noSubscribers: 'No subscribers yet.', recentPayments: 'Recent payments', noPayments: 'No payments yet.',
  planMonthly: 'Monthly', planYearly: 'Yearly', planLifetime: 'Lifetime', until: 'until {date}', forLife: 'for life',
  stActive: 'Active', stCanceled: 'Canceling', stPast_due: 'Card failed', stExpired: 'Ended',
  kindPlus: 'Plus', kindRenewal: 'Renewal', kindDonation: 'Donation', anonymous: 'Anonymous',
}
type Key = keyof typeof en

const uk: Record<Key, string> = {
  loading: 'Завантаження…', noAccess: 'Немає доступу', noAccessText: 'Адмін-панель доступна лише адміністраторам Only Tools.',
  backHome: 'Назад до Only Tools', overview: 'Огляд', users: 'Користувачі', errors: 'Помилки', settings: 'Налаштування',
  language: 'Мова',
  refresh: 'Оновити', refreshing: 'Оновлення…', updated: 'Оновлено {when} · оновлюється щодня',
  awsMonth: 'AWS цього місяця', ofBudget: 'з бюджету {budget}', forecast: 'Прогноз {v}', lastMonth: 'Минулий місяць {v}',
  dailyCost: 'Витрати по днях, цей місяць', dailyCostAria: 'Щоденні витрати AWS цього місяця', costLag: 'Дані про витрати AWS запізнюються до доби.',
  accounts: 'Акаунти Only Tools', accountsUnit: 'доступів до застосунків у спільному акаунті',
  accountsHint: 'Поки застосунок не перейшов на спільний вхід, його власна кількість користувачів показана на картці.',
  apps: 'Застосунки', errors7d: '{n} помилок / 7 дн', noErrors: 'Без помилок', usersUnit: 'користувачів', ownSignIn: 'у власному вході',
  requests7d: 'запитів / 7 дн', thisMonth: 'цього місяця', requestsAria: '{app}: запити по днях, останні 30 днів',
  requestsDaily: 'Запити по днях, останні 30 днів', shared: 'Спільне й без тегів',
  sharedUnit: 'цього місяця (DNS, податки, ресурси без тегів)',
  invite: 'Запросити', searchEmail: 'Пошук за email', userCount: 'Користувачів: {n}', userCountOne: '1 користувач', disabled: 'вимкнено',
  noUsers: 'Нікого не знайдено.', back: 'Назад', active: 'Активний', disabledChip: 'Вимкнений', joined: 'З нами з {date}',
  roles: 'Ролі', app: 'Застосунок', access: 'Доступ', admin: 'Адмін', platformAdmin: 'Адмін Only Tools',
  rolesHint: 'Зміни дійдуть до застосунків користувача протягом години або одразу після «Вийти всюди».',
  account: 'Акаунт', signOutAll: 'Вийти всюди', disable: 'Вимкнути акаунт', enable: 'Увімкнути акаунт',
  disableConfirm: 'Вимкнути {email}? Користувач втратить доступ до всіх застосунків.', accessOf: 'Доступ до {app}', adminOf: 'Адмін {app}',
  email: 'Email', inviteHint: 'Користувач отримає лист із тимчасовим паролем для onlytools.click.',
  sending: 'Надсилаємо…', sendInvite: 'Надіслати запрошення',
  timeWindow: 'Період', h1: '1 год', h24: '24 год', d7: '7 днів', searching: 'Шукаємо в логах…', alarms: 'Тривоги',
  firing: 'Спрацювало: {n}', allOk: 'Усе гаразд', noAlarms: 'Тривоги не налаштовані.', logLines: 'Рядки з помилками',
  updating: 'Оновлення…', inWindow: '{n} за {window}', noErrorsWindow: 'За цей період помилок немає.',
  // Billing
  billing: 'Plus і донати', subsActive: 'Підписники Plus', subsSplit: '{m} щомісяця · {y} щороку · {l} назавжди',
  mrr: 'Щомісячний дохід', mrrUnit: 'з підписок, що продовжуються', revenueMonth: 'Оплачено цього місяця',
  revenueTotal: 'За весь час {v}', donationsTotal: 'Донати {v}', feesTotal: 'комісія monobank {v}',
  canceling: '{n} скасовують', pastDue: '{n} картка не пройшла', byMonth: 'Дохід за місяцями', plusLegend: 'Plus', donationsLegend: 'Донати',
  subscribers: 'Підписники', noSubscribers: 'Поки немає підписників.', recentPayments: 'Останні платежі', noPayments: 'Поки немає платежів.',
  planMonthly: 'Щомісяця', planYearly: 'Щороку', planLifetime: 'Назавжди', until: 'до {date}', forLife: 'назавжди',
  stActive: 'Активна', stCanceled: 'Скасовується', stPast_due: 'Картка не пройшла', stExpired: 'Закінчилась',
  kindPlus: 'Plus', kindRenewal: 'Продовження', kindDonation: 'Донат', anonymous: 'Анонімно',
}

const ru: Record<Key, string> = {
  loading: 'Загрузка…', noAccess: 'Нет доступа', noAccessText: 'Админ-панель доступна только администраторам Only Tools.',
  backHome: 'Назад в Only Tools', overview: 'Обзор', users: 'Пользователи', errors: 'Ошибки', settings: 'Настройки',
  language: 'Язык',
  refresh: 'Обновить', refreshing: 'Обновление…', updated: 'Обновлено {when} · обновляется ежедневно',
  awsMonth: 'AWS в этом месяце', ofBudget: 'из бюджета {budget}', forecast: 'Прогноз {v}', lastMonth: 'Прошлый месяц {v}',
  dailyCost: 'Расходы по дням, этот месяц', dailyCostAria: 'Ежедневные расходы AWS в этом месяце', costLag: 'Данные о расходах AWS запаздывают до суток.',
  accounts: 'Аккаунты Only Tools', accountsUnit: 'доступов к приложениям в общем аккаунте',
  accountsHint: 'Пока приложение не перешло на общий вход, его собственное число пользователей показано на карточке.',
  apps: 'Приложения', errors7d: '{n} ошибок / 7 дн', noErrors: 'Без ошибок', usersUnit: 'пользователей', ownSignIn: 'в собственном входе',
  requests7d: 'запросов / 7 дн', thisMonth: 'в этом месяце', requestsAria: '{app}: запросы по дням, последние 30 дней',
  requestsDaily: 'Запросы по дням, последние 30 дней', shared: 'Общее и без тегов',
  sharedUnit: 'в этом месяце (DNS, налоги, ресурсы без тегов)',
  invite: 'Пригласить', searchEmail: 'Поиск по email', userCount: 'Пользователей: {n}', userCountOne: '1 пользователь', disabled: 'отключён',
  noUsers: 'Никого не найдено.', back: 'Назад', active: 'Активен', disabledChip: 'Отключён', joined: 'С нами с {date}',
  roles: 'Роли', app: 'Приложение', access: 'Доступ', admin: 'Админ', platformAdmin: 'Админ Only Tools',
  rolesHint: 'Изменения дойдут до приложений пользователя в течение часа или сразу после «Выйти везде».',
  account: 'Аккаунт', signOutAll: 'Выйти везде', disable: 'Отключить аккаунт', enable: 'Включить аккаунт',
  disableConfirm: 'Отключить {email}? Пользователь потеряет доступ ко всем приложениям.', accessOf: 'Доступ к {app}', adminOf: 'Админ {app}',
  email: 'Email', inviteHint: 'Пользователь получит письмо с временным паролем для onlytools.click.',
  sending: 'Отправляем…', sendInvite: 'Отправить приглашение',
  timeWindow: 'Период', h1: '1 ч', h24: '24 ч', d7: '7 дней', searching: 'Ищем в логах…', alarms: 'Тревоги',
  firing: 'Сработало: {n}', allOk: 'Всё в порядке', noAlarms: 'Тревоги не настроены.', logLines: 'Строки с ошибками',
  updating: 'Обновление…', inWindow: '{n} за {window}', noErrorsWindow: 'За этот период ошибок нет.',
  // Billing
  billing: 'Plus и донаты', subsActive: 'Подписчики Plus', subsSplit: '{m} ежемесячно · {y} ежегодно · {l} навсегда',
  mrr: 'Ежемесячный доход', mrrUnit: 'с продлевающихся подписок', revenueMonth: 'Оплачено в этом месяце',
  revenueTotal: 'За всё время {v}', donationsTotal: 'Донаты {v}', feesTotal: 'комиссия monobank {v}',
  canceling: '{n} отменяют', pastDue: '{n} карта не прошла', byMonth: 'Доход по месяцам', plusLegend: 'Plus', donationsLegend: 'Донаты',
  subscribers: 'Подписчики', noSubscribers: 'Пока нет подписчиков.', recentPayments: 'Последние платежи', noPayments: 'Пока нет платежей.',
  planMonthly: 'Ежемесячно', planYearly: 'Ежегодно', planLifetime: 'Навсегда', until: 'до {date}', forLife: 'навсегда',
  stActive: 'Активна', stCanceled: 'Отменяется', stPast_due: 'Карта не прошла', stExpired: 'Закончилась',
  kindPlus: 'Plus', kindRenewal: 'Продление', kindDonation: 'Донат', anonymous: 'Анонимно',
}

const DICT: Record<Lang, Record<Key, string>> = { en, uk, ru }
export const LOCALE: Record<Lang, string> = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' }

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string }
const I18n = createContext<Ctx | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const setLang = (l: Lang) => { saveLang(l); setLangState(l) }
  const t: Ctx['t'] = (k, vars) =>
    DICT[lang][k].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`))
  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>
}

export function useT(): Ctx {
  const ctx = useContext(I18n)
  if (!ctx) throw new Error('useT outside LangProvider')
  return ctx
}

export function LangSwitch() {
  const { lang, setLang, t } = useT()
  return (
    <div className="ot-segment lang-switch" role="group" aria-label={t('language')}>
      {LANGS.map((l) => (
        <button key={l.code} lang={l.code} title={l.name} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</button>
      ))}
    </div>
  )
}
