#!/usr/bin/env node
// Builds the public content pages of onlytools.click (app pages, blog, legal) from
// apps/landing/content/<lang>/<path>.md into <out>/<path>/index.html (English at the root,
// Ukrainian under /uk/, Russian under /ru/), and writes <out>/sitemap.xml with hreflang links.
//
// Markdown subset: frontmatter (title, description, app, kind, image), # / ## / ### headings, paragraphs,
// "- " and "1. " lists, **bold**, [links](/path). A paragraph made only of ![caption](/shots/x.webp)
// lines becomes a screenshot gallery (one image = a single wide shot). Frontmatter `image` is og:image. A paragraph made only of **[label](url)** items
// becomes a row of buttons. A list whose items all start with **bold** becomes feature cards.
// Internal links ("/carlog") point to the same language version of that page.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteNav, withSiteNav } from './site-nav.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'apps/landing/content')
const OUT = process.argv[2] ?? join(ROOT, 'apps/landing/dist')
const SITE = 'https://onlytools.click'
const LANGS = ['en', 'uk', 'ru']
const PREFIX = { en: '', uk: '/uk', ru: '/ru' }
const LASTMOD = new Date().toISOString().slice(0, 10)
const BUSINESS = JSON.parse(readFileSync(join(CONTENT, 'business.json'), 'utf8'))
const TO_FILL = { en: '[to be filled]', uk: '[буде заповнено]', ru: '[будет заполнено]' }
const missing = new Set()
/** {{name}} → business.json value: "name_<lang>" first, then "name"; empty values render a visible marker. */
const fill = (md, lang) => md.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  const v = BUSINESS[`${k}_${lang}`] ?? BUSINESS[k]
  if (v === undefined) throw new Error(`unknown placeholder {{${k}}}`)
  if (!v) { missing.add(k); return TO_FILL[lang] }
  return v
})

const UI = {
  en: { apps: 'Apps', blog: 'Blog', legal: 'Legal', terms: 'Terms of service', privacy: 'Privacy policy', refunds: 'Refund policy', contacts: 'Contacts', home: 'Only Tools', language: 'Language' },
  uk: { apps: 'Застосунки', blog: 'Блог', legal: 'Документи', terms: 'Умови використання', privacy: 'Політика конфіденційності', refunds: 'Повернення коштів', contacts: 'Контакти', home: 'Only Tools', language: 'Мова' },
  ru: { apps: 'Приложения', blog: 'Блог', legal: 'Документы', terms: 'Условия использования', privacy: 'Политика конфиденциальности', refunds: 'Возврат средств', contacts: 'Контакты', home: 'Only Tools', language: 'Язык' },
}
const LANG_LABEL = { en: 'EN', uk: 'UA', ru: 'RU' }
const APP_PAGES = ['carlog', 'foodlog', 'gighunter']

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : []
  })
}

function parse(file) {
  const raw = readFileSync(file, 'utf8')
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) throw new Error(`${file}: missing frontmatter`)
  const meta = Object.fromEntries(m[1].split('\n').filter(Boolean).map((l) => {
    const i = l.indexOf(':')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  }))
  for (const k of ['title', 'description']) if (!meta[k]) throw new Error(`${file}: no ${k}`)
  if (/ПРОВЕРИТЬ/.test(raw)) throw new Error(`${file}: unresolved [ПРОВЕРИТЬ]`)
  return { meta, body: m[2] }
}

const localHref = (href, lang) =>
  // The home page "/" is one page for every language (it switches in place), so it keeps no prefix.
  href.startsWith('/') && href !== '/' && !href.startsWith('//') && !/\.\w+$/.test(href) ? `${PREFIX[lang]}${href}` : href

function inline(text, lang) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const h = localHref(href.replace(/&amp;/g, '&'), lang)
      const ext = /^https?:/.test(h) ? ' rel="noopener"' : ''
      return `<a href="${esc(h)}"${ext}>${label}</a>`
    })
}

function render(md, lang) {
  const blocks = md.trim().split(/\n{2,}/)
  let html = ''
  let firstH1 = true
  for (const b of blocks) {
    const lines = b.split('\n')
    const h = b.match(/^(#{1,3}) (.+)$/)
    if (h && lines.length === 1) {
      const level = h[1].length
      const cls = level === 1 ? 'ot-h1' : level === 2 ? 'ot-h2' : 'ot-h3'
      const idm = h[2].match(/^(.*?)\s*\{#([\w-]+)\}$/)
      const id = idm ? idm[2] : level === 1 && firstH1 ? 'top' : ''
      html += `<h${level} class="${cls}"${id ? ` id="${id}"` : ''}>${inline(idm ? idm[1] : h[2], lang)}</h${level}>\n`
      if (level === 1) firstH1 = false
      continue
    }
    if (lines.every((l) => /^- /.test(l))) {
      const items = lines.map((l) => l.slice(2))
      const cards = items.every((i) => /^\*\*/.test(i))
      html += `<ul class="${cards ? 'features' : 'list'}">${items.map((i) => `<li>${inline(i, lang)}</li>`).join('')}</ul>\n`
      continue
    }
    if (lines.every((l) => /^\d+\. /.test(l))) {
      html += `<ol class="steps">${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''), lang)}</li>`).join('')}</ol>\n`
      continue
    }
    if (lines.every((l) => /^!\[[^\]]*\]\([^)]+\)$/.test(l.trim()))) {
      const shots = lines.map((l) => l.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/))
      const figs = shots.map(([, alt, src]) => {
        const wide = /-desktop\.\w+$/.test(src)
        return `<figure class="shot${wide ? ' shot--wide' : ''}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">${alt ? `<figcaption>${inline(alt, lang)}</figcaption>` : ''}</figure>`
      })
      html += `<div class="shots${shots.length === 1 ? ' shots--one' : ''}">${figs.join('')}</div>\n`
      continue
    }
    const ctas = b.trim().match(/^(\*\*\[[^\]]+\]\([^)]+\)\*\*\s*)+$/)
    if (ctas) {
      const btns = [...b.matchAll(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g)].map(([, label, href], i) =>
        `<a class="ot-btn${i ? ' ot-btn--outline' : ''}" href="${esc(localHref(href, lang))}">${esc(label)}</a>`)
      html += `<p class="cta">${btns.join('')}</p>\n`
      continue
    }
    html += `<p>${inline(lines.join(' '), lang)}</p>\n`
  }
  return html
}

function page({ lang, path, meta, body, alternates }) {
  const ui = UI[lang]
  const url = `${SITE}${PREFIX[lang]}/${path}`
  const app = meta.app || 'hub'
  const hreflang = LANGS.filter((l) => alternates.includes(l))
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${PREFIX[l]}/${path}">`).join('\n  ')
  const switcher = LANGS.filter((l) => alternates.includes(l)).map((l) =>
    `<a href="${PREFIX[l]}/${path}" lang="${l}" data-lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${LANG_LABEL[l]}</a>`).join('')
  const home = '/'
  const link = (p, label) => `<a href="${PREFIX[lang]}/${p}">${esc(label)}</a>`
  return `<!doctype html>
<html lang="${lang}" data-app="${esc(app)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}">
  <link rel="canonical" href="${url}">
  ${hreflang}
  <link rel="alternate" hreflang="x-default" href="${SITE}/${path}">
  <meta property="og:type" content="${meta.kind === 'post' ? 'article' : 'website'}">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.description)}">
  <meta property="og:url" content="${url}">${meta.image ? `\n  <meta property="og:image" content="${SITE}${esc(meta.image)}">\n  <meta name="twitter:card" content="summary_large_image">` : ''}
  <meta property="og:site_name" content="Only Tools">
  <meta name="theme-color" content="#fff8f1">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icon-180.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&display=swap">
  <link rel="stylesheet" href="/only-tools.css">
  <link rel="stylesheet" href="/landing.css">
  <link rel="stylesheet" href="/pages.css">
</head>
<body class="ot-root page page--${esc(meta.kind || 'page')}">
<div class="ot-shell">
  <div class="ot-layout">
    ${siteNav(lang, APP_PAGES.includes(path) ? path : null)}
    <main class="ot-main">
      <header class="ot-header">
        <a class="ot-brand" href="${home}"><span class="ot-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Only Tools</a>
        <div class="top-actions"><nav class="ot-segment page-lang" aria-label="${esc(ui.language)}">${switcher}</nav></div>
      </header>
      <div class="ot-content">
        <article class="page-body">
${render(fill(body, lang), lang)}        </article>
        <footer class="page-foot">
          <nav aria-label="${esc(ui.apps)}"><b>${esc(ui.apps)}</b>${link('carlog', 'CarLog')}${link('foodlog', 'FoodLog')}${link('gighunter', 'GigHunter')}</nav>
          <nav aria-label="${esc(ui.blog)}"><b>${esc(ui.blog)}</b>${link('blog/car-service-history', 'CarLog')}${link('blog/calorie-counting-ukrainian-products', 'FoodLog')}${link('blog/freelance-job-alerts-telegram', 'GigHunter')}</nav>
          <nav aria-label="${esc(ui.legal)}"><b>${esc(ui.legal)}</b>${link('terms', ui.terms)}${link('privacy', ui.privacy)}${link('refunds', ui.refunds)}${link('contacts', ui.contacts)}</nav>
          <p class="ot-caption">© ${new Date().getFullYear()} Only Tools · onlytools.click</p>
        </footer>
      </div>
    </main>
  </div>
</div>
  <script>
    // Remember the language picked here for every Only Tools app (same cookie the apps read).
    document.querySelectorAll('[data-lang]').forEach(function (a) {
      a.addEventListener('click', function () {
        document.cookie = 'ot_lang=' + a.dataset.lang + '; path=/; max-age=31536000; samesite=lax' + (location.hostname.endsWith('onlytools.click') ? '; domain=onlytools.click' : '')
      })
    })
  </script>
</body>
</html>
`
}

// Collect pages: path -> { lang -> parsed }
const pages = new Map()
for (const lang of LANGS) {
  const dir = join(CONTENT, lang)
  for (const file of walk(dir)) {
    const path = relative(dir, file).replace(/\.md$/, '')
    if (!pages.has(path)) pages.set(path, {})
    pages.get(path)[lang] = parse(file)
  }
}

// The hand-written home page and /plus/ get the same shared nav as the generated pages.
for (const [file, active] of [['index.html', 'home'], [join('plus', 'index.html'), 'plus']]) {
  const f = join(OUT, file)
  if (existsSync(f)) writeFileSync(f, withSiteNav(readFileSync(f, 'utf8'), active))
}

const sitemap = [`  <url><loc>${SITE}/</loc><lastmod>${LASTMOD}</lastmod></url>`]
// Hand-written pages that ship from apps/landing/public (e.g. /plus/) go in the sitemap when present.
for (const extra of ['plus']) {
  if (existsSync(join(OUT, extra, 'index.html'))) sitemap.push(`  <url><loc>${SITE}/${extra}/</loc><lastmod>${LASTMOD}</lastmod></url>`)
}
for (const [path, byLang] of [...pages].sort()) {
  const alternates = LANGS.filter((l) => byLang[l])
  for (const lang of alternates) {
    const out = join(OUT, PREFIX[lang], path, 'index.html')
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, page({ lang, path, ...byLang[lang], alternates }))
    const links = alternates.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${PREFIX[l]}/${path}"/>`).join('')
    sitemap.push(`  <url><loc>${SITE}${PREFIX[lang]}/${path}</loc><lastmod>${LASTMOD}</lastmod>${links}</url>`)
  }
}
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap.join('\n')}
</urlset>
`)
console.log(`built ${sitemap.length - 1} pages into ${OUT}`)
if (missing.size) console.warn(`business.json still has empty values: ${[...missing].join(', ')}`)
