const STATUS = { invite: 'Invite only', soon: 'Coming soon' }
const icon = (id) => `<svg class="ot-icon"><use href="#i-${id}"/></svg>`
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

document.getElementById('year').textContent = new Date().getFullYear()

const apps = await fetch('/apps.json').then((r) => r.json())

document.getElementById('tiles').innerHTML = apps.map((a) => {
  const live = a.status !== 'soon'
  const tag = live ? 'a' : 'div'
  const href = live ? ` href="${esc(a.url)}"` : ''
  const chip = STATUS[a.status] ? `<span class="ot-chip">${STATUS[a.status]}</span>` : ''
  const go = live ? `<span class="ot-tile__go">Open ${icon('arrow')}</span>` : ''
  return `<${tag} class="ot-tile" data-app="${a.accent}"${href}>
    <span class="ot-tile__icon">${icon(a.icon)}</span>
    <span class="ot-tile__name">${esc(a.name)}</span>
    <span class="ot-tile__desc">${esc(a.desc)}</span>
    <span class="ot-tile__stat">${chip}${go}</span>
  </${tag}>`
}).join('')

document.getElementById('nav-apps').insertAdjacentHTML('beforeend', apps.map((a) =>
  `<a class="ot-nav__app" data-app="${a.accent}" href="${a.status === 'soon' ? '#' : esc(a.url)}">
    <span class="ot-appicon">${icon(a.icon)}</span>${esc(a.name)}</a>`).join(''))

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
