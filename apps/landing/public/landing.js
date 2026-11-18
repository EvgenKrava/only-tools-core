import { currentUser, signIn, signOut } from '/auth.js'

const STATUS = { invite: 'Invite only', soon: 'Coming soon' }
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

$('tiles').innerHTML = apps.map((a) => {
  const live = a.status !== 'soon'
  const tag = live ? 'a' : 'div'
  const href = live ? ` href="${esc(a.url)}"` : ''
  let chip = STATUS[a.status] ? `<span class="ot-chip">${STATUS[a.status]}</span>` : ''
  if (user && live) chip = has(a) ? '<span class="ot-chip ot-chip--good">You have access</span>' : '<span class="ot-chip ot-chip--neutral">No access</span>'
  const go = live ? `<span class="ot-tile__go">Open ${icon('arrow')}</span>` : ''
  return `<${tag} class="ot-tile" data-app="${a.accent}"${href}>
    <span class="ot-tile__icon">${icon(a.icon)}</span>
    <span class="ot-tile__name">${esc(a.name)}</span>
    <span class="ot-tile__desc">${esc(a.desc)}</span>
    <span class="ot-tile__stat">${chip}${go}</span>
  </${tag}>`
}).join('')

$('nav-apps').insertAdjacentHTML('beforeend', apps.map((a) =>
  `<a class="ot-nav__app" data-app="${a.accent}" href="${a.status === 'soon' ? '#' : esc(a.url)}">
    <span class="ot-appicon">${icon(a.icon)}</span>${esc(a.name)}</a>`).join(''))

if (user) {
  const initial = esc((user.name || user.email)[0].toUpperCase())
  $('who').innerHTML = `<a class="ot-avatar" href="#account" title="${esc(user.email)}">${initial}</a>`
  $('account').innerHTML = `
    <h2 class="ot-h3">Your Only Tools account</h2>
    <p class="ot-text">Signed in as <b>${esc(user.email)}</b>. This account works in every Only Tools app.</p>
    <div class="ot-row" style="box-shadow:none;padding:0;background:none;gap:8px;flex-wrap:wrap">
      ${isAdmin ? '<a class="ot-btn ot-btn--sm" href="/admin">Admin panel</a>' : ''}
      <button class="ot-btn ot-btn--sm ot-btn--outline" id="sign-out">Sign out</button>
    </div>`
  $('sign-out').onclick = () => signOut()
} else {
  $('who').innerHTML = '<button class="ot-btn ot-btn--sm" id="sign-in-top">Sign in</button>'
  $('account').innerHTML = `
    <h2 class="ot-h3">One account for every app</h2>
    <p class="ot-text">Sign in once with email or Google and every Only Tools app lets you in.</p>
    <button class="ot-btn" style="align-self:flex-start" id="sign-in">Sign in or create account</button>`
  $('sign-in').onclick = $('sign-in-top').onclick = () => signIn('/')
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
