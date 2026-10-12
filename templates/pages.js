// HTML das páginas. Um único <head> pra todas: as metatags são as mesmas do
// site inteiro, e cada artigo só troca título, descrição e URL.

import fs from 'node:fs';

// banner.png em ASCII, gerado por scripts/banner.py: a versão larga e uma
// mais grossa pro celular (que não fica ilegível de tão pequena)
const readBanner = (name) => {
  const f = new URL(`../src/${name}`, import.meta.url);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trimEnd() : '';
};
const BANNER = readBanner('banner.html');
const BANNER_SM = readBanner('banner-sm.html') || BANNER;

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// cores das capas provisórias (faixa sem `cover`), em pares
const COVER_TONES = [
  ['#6b4a22', '#2c3b22'], ['#3e5a34', '#16200f'], ['#c89a4b', '#5c3d18'],
  ['#24331f', '#8fa86a'], ['#8a5a2b', '#1d140b'], ['#5f7046', '#c89a4b'],
];

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h2.5v14H5zM19 5v14L8.5 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 5H19v14h-2.5zM5 5v14l10.5-7z"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5h12v2H3zM3 10.5h12v2H3zM3 15.5h8v2H3zM17 13v6.2a2.4 2.4 0 1 0 2 2.3V15h2.5v-2z"/></svg>',
};

const initials = (s) => String(s).split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

function head({ site, title, description, path, root, extraCss = [] }) {
  const abs = (p) => (site.url ? `${site.url}/${p}` : `${root}${p}`);
  const fullTitle = title ? `${title} — ${site.name}` : site.name;
  const ogTitle = title || site.name;
  const desc = description || site.tagline;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#151a10">
${site.url ? `<link rel="canonical" href="${esc(abs(path))}">\n` : ''}<meta property="og:type" content="${title ? 'article' : 'website'}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(desc)}">
${site.url ? `<meta property="og:url" content="${esc(abs(path))}">\n` : ''}<meta property="og:image" content="${esc(abs('img/og.jpg'))}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(site.name)}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(abs('img/og.jpg'))}">
<link rel="icon" href="${root}favicon.ico" sizes="16x16 32x32 48x48 64x64">
<link rel="icon" href="${root}img/favicon.png" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="${root}img/apple-touch-icon.png">
<link rel="preload" href="${root}fonts/ComicShannsMono-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}css/style.css">
${extraCss.map((c) => `<link rel="stylesheet" href="${root}${c}">`).join('\n')}
</head>`;
}

const footer = (site) => `<footer class="bottom">
  <p><span class="path">~/${esc(site.name)} $</span> ${esc(site.footer ?? site.name)}<span class="cursor" aria-hidden="true">_</span></p>
</footer>`;

// link de canto pro subsite fuckit
const cornerLink = `<a class="corner-fuckit" href="https://fuckit.kpital.xyz">fuckit</a>`;

// cabeçalho da home e do ~/setup: banner, tagline e a navegação entre os dois
const NAV = [['', '~/kpital'], ['setup/', '~/setup']];

function hero(site, root, current) {
  const nav = NAV.map(([href, label]) => href === current
    ? `<a href="${root}${href}" aria-current="page">${label}</a>`
    : `<a href="${root}${href}">${label}</a>`).join('\n    ');
  return `<header class="top">
${BANNER ? `  <pre class="banner banner-lg" aria-hidden="true">${BANNER}</pre>
  <pre class="banner banner-sm" aria-hidden="true">${BANNER_SM}</pre>\n` : ''}  <p class="tagline"><span class="comment" aria-hidden="true">#</span> ${esc(site.tagline)}</p>
  <nav class="nav" aria-label="seções">
    ${nav}
  </nav>
</header>`;
}

// ── home ────────────────────────────────────────────────────────────────────

function coverArt(t) {
  const [c1, c2] = COVER_TONES[t.index % COVER_TONES.length];
  const art = t.cover
    ? `<img src="${esc(t.cover)}" alt="" loading="lazy" decoding="async">`
    : `<span class="cover-initials">${esc(initials(t.title))}</span>`;
  return { style: `--c1:${c1};--c2:${c2}`, art };
}

// uma linha da lista de faixas; a linha inteira é o botão de tocar
function trackItem(t) {
  const { style, art } = coverArt(t);
  const label = `${t.title} — ${t.artist}`;
  // youtube tem prioridade se a faixa tiver os dois
  const source = t.youtube ? ` data-youtube="${esc(t.youtube)}"` : t.audio ? ` data-audio="${esc(t.audio)}"` : '';
  return `      <li class="track${source ? '' : ' track-silent'}" data-playlist="${esc(t.playlist)}"${source}>
        <button class="track-row" type="button" aria-label="${esc(source ? `tocar ${label}` : `${label} (sem áudio)`)}"${source ? '' : ' disabled'}>
          <span class="track-num" aria-hidden="true">${ICON.play}${ICON.pause}</span>
          <span class="cover" style="${style}">${art}</span>
          <span class="track-info">
            <span class="track-title">${esc(t.title)}</span>
            <span class="track-line"><span class="track-artist">${esc(t.artist)}</span>${t.album ? ` <span class="sep">/</span> <span class="track-album">${esc(t.album)}</span>` : ''}</span>
          </span>
          ${t.year ? `<span class="track-year">${esc(t.year)}</span>` : ''}
        </button>
      </li>`;
}

// card da playlist: tira com as 4 primeiras capas + nome + quantidade
function playlistCard([key, name], tracks, checked) {
  const own = tracks.filter((t) => t.playlist === key);
  const strip = Array.from({ length: 4 }, (_, i) => {
    if (!own[i]) return '<span class="cover cover-empty"></span>';
    const { style, art } = coverArt(own[i]);
    return `<span class="cover" style="${style}">${own[i].cover ? art : ''}</span>`;
  }).join('');
  return `      <input type="radio" name="playlist" id="p-${key}"${checked ? ' checked' : ''}>
      <label class="playlist" for="p-${key}">
        <span class="playlist-strip" aria-hidden="true">${strip}</span>
        <span class="playlist-name">${esc(name)}</span>
        <span class="playlist-count">${String(own.length).padStart(2, '0')} faixa${own.length === 1 ? '' : 's'}</span>
      </label>`;
}

function articleItem(a, site) {
  return `      <li class="article" data-cat="${esc(a.category ?? '')}">
        <a href="artigos/${a.slug}/">
          <p class="article-meta">${a.label ? `<span class="tag">${esc(a.label)}</span> ` : ''}<time datetime="${a.date}">${a.date}</time> <span class="sep">/</span> ${a.minutes} min</p>
          <h3 class="article-title">${esc(a.title)}</h3>
          ${a.description ? `<p class="article-desc">${esc(a.description)}</p>` : ''}
        </a>
      </li>`;
}

export function homePage({ site, articles, tracks, root }) {
  const cats = Object.entries(site.categories);
  const playable = tracks.some((t) => t.audio || t.youtube);
  const pad = (n) => String(n).padStart(2, '0');

  // filtro sem JS: um rádio por categoria; o CSS gerado aqui esconde os cards
  // que não são da categoria marcada e mostra o aviso quando ela está vazia
  const filterCss = cats.map(([key]) => `
.pane-articles:has(#f-${key}:checked) .article:not([data-cat="${key}"]) { display: none; }
.pane-articles:has(#f-${key}:checked):not(:has(.article[data-cat="${key}"])) .empty { display: block; }`).join('');

  // playlists: mesmo esquema do filtro dos artigos — um rádio por playlist,
  // e o CSS esconde as faixas das outras
  const playlists = Object.entries(site.playlists);
  const playlistCss = playlists.map(([key]) => `
.music:has(#p-${key}:checked) .track:not([data-playlist="${key}"]) { display: none; }`).join('');

  return `${head({ site, path: '', root })}
<body class="home">

<div class="overlay"></div>
${cornerLink}

${hero(site, root, '')}
<h1 class="visually-hidden">${esc(site.name)}</h1>

<main class="column">

  <section class="pane music" aria-label="música">
    <input class="visually-hidden" type="checkbox" id="music-open">
    <div class="player" data-state="idle"${playable ? '' : ' data-empty'}>
      <div class="player-art" aria-hidden="true"></div>
      <div class="player-video"><div id="yt-player"></div></div>
      <div class="player-info" aria-live="polite">
        <p class="player-title">${playable ? 'nada tocando' : 'nenhuma faixa com áudio ainda'}</p>
        <p class="player-artist">${playable ? 'clique numa faixa' : 'adicione em src/musica.yml'}</p>
      </div>
      <div class="player-controls">
        <button class="player-btn" type="button" data-action="prev" aria-label="faixa anterior" disabled>${ICON.prev}</button>
        <button class="player-btn player-toggle" type="button" data-action="toggle" aria-label="tocar" disabled>${ICON.play}${ICON.pause}</button>
        <button class="player-btn" type="button" data-action="next" aria-label="próxima faixa" disabled>${ICON.next}</button>
        <label class="player-btn player-list" for="music-open" title="faixas (${tracks.length})"><span class="visually-hidden">mostrar as ${tracks.length} faixas</span>${ICON.list}</label>
      </div>
      <div class="player-progress">
        <span class="player-time" data-time="current">0:00</span>
        <input class="player-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="posição na faixa" disabled>
        <span class="player-time" data-time="total">0:00</span>
      </div>
    </div>

    <div class="music-list">
      <fieldset class="playlists">
        <legend class="visually-hidden">playlists</legend>
${playlists.map((p, i) => playlistCard(p, tracks, i === 0)).join('\n')}
      </fieldset>

      <ol class="tracks">
${tracks.map(trackItem).join('\n')}
      </ol>
    </div>
  </section>

  <section class="pane pane-articles" aria-labelledby="h-articles">
    <h2 class="pane-title" id="h-articles"><span><span class="path">~/</span>artigos</span> <span class="count">[${pad(articles.length)}]</span></h2>

    <fieldset class="filters">
      <legend class="visually-hidden">filtrar por categoria</legend>
      <input type="radio" name="cat" id="f-all" checked>
      <label for="f-all">todos</label>
${cats.map(([key, label]) => `      <input type="radio" name="cat" id="f-${key}">\n      <label for="f-${key}">${esc(label)}</label>`).join('\n')}
    </fieldset>

    <ol class="articles">
${articles.map((a) => articleItem(a, site)).join('\n')}
    </ol>
    <p class="empty"${articles.length ? '' : ' style="display:block"'}>${articles.length ? 'nada nesta categoria ainda.' : 'nenhum artigo ainda.'}</p>
  </section>

</main>

${footer(site)}

<style>${filterCss}${playlistCss}
</style>
<script src="js/player.js" defer></script>
</body>
</html>
`;
}

// ── artigo ──────────────────────────────────────────────────────────────────

function navLink(a, dir, root) {
  if (!a) return '<span></span>';
  return `<a class="nav-${dir}" href="${root}artigos/${a.slug}/">
      <span class="nav-dir">${dir === 'newer' ? '← mais novo' : 'mais antigo →'}</span>
      <span class="nav-title">${esc(a.title)}</span>
    </a>`;
}

export function articlePage({ site, article: a, newer, older, root }) {
  const updated = a.updated && a.updated !== a.date
    ? ` <span class="sep">/</span> atualizado <time datetime="${a.updated}">${a.updated}</time>` : '';
  const cover = a.coverUrl
    ? `<figure class="article-cover"><img src="${esc(a.coverUrl)}" alt="${esc(a.cover_alt ?? '')}"></figure>` : '';

  return `${head({ site, title: a.title, description: a.description, path: `artigos/${a.slug}/`, root, extraCss: ['css/artigo.css'] })}
<body class="reading">

<div class="overlay"></div>
${cornerLink}

<nav class="bar" aria-label="navegação">
  <a class="back" href="${root}">← ${esc(site.name)}</a>
  <span class="bar-path">artigos/${esc(a.slug)}</span>
</nav>

<main class="reader">
  <article>
    <header class="article-head">
      <p class="article-meta">${a.label ? `<span class="tag">${esc(a.label)}</span> ` : ''}<time datetime="${a.date}">${a.date}</time> <span class="sep">/</span> ${a.minutes} min${updated}</p>
      <h1 class="article-h1">${esc(a.title)}</h1>
      ${a.description ? `<p class="article-lede">${esc(a.description)}</p>` : ''}
      ${a.author ? `<p class="article-author">por ${esc(a.author)}</p>` : ''}
    </header>
    ${cover}

    <div class="prose">
${a.html}
    </div>

    <footer class="article-foot">
      ${a.tags.length ? `<p class="article-tags">${a.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</p>` : ''}
      <nav class="article-nav" aria-label="outros artigos">
        ${navLink(newer, 'newer', root)}
        ${navLink(older, 'older', root)}
      </nav>
      <a class="back back-bottom" href="${root}">← voltar pro início</a>
    </footer>
  </article>
</main>

${footer(site)}

<script src="${root}js/artigo.js" defer></script>
</body>
</html>
`;
}

// ── setup ───────────────────────────────────────────────────────────────────

function setupItem(item) {
  const photo = item.photo
    ? `<img src="${esc(item.photo)}" alt="${esc(item.alt ?? '')}" loading="lazy" decoding="async">`
    : `<span class="setup-missing">foto: src/setup/${esc(item.wanted || `${item.title}.jpg`)}</span>`;
  const head = item.host
    ? `<p class="spec-host">${esc(item.host)}</p>\n          <p class="spec-rule" aria-hidden="true">${'-'.repeat(item.host.length)}</p>\n          ` : '';
  return `    <article class="setup-item${item.wide ? ' setup-wide' : ''}${item.vignette ? ' setup-vignette' : ''}">
      <h2 class="pane-title"><span><span class="path">~/setup/</span>${esc(item.title)}</span></h2>
      <div class="setup-body">
        <figure class="setup-photo">${photo}</figure>
        <div class="specs">
          ${head}<dl>
${item.specs.map(([k, v]) => `            <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
          </dl>
        </div>
      </div>
    </article>`;
}

export function setupPage({ site, setup, root }) {
  return `${head({ site, title: 'setup', description: `o rice e o ThinkPad por trás do ${site.name}`, path: 'setup/', root })}
<body class="home">

<div class="overlay"></div>
${cornerLink}

${hero(site, root, 'setup/')}

<main class="column">
  <h1 class="visually-hidden">setup</h1>
  <section class="pane setup">
${setup.map(setupItem).join('\n\n')}
  </section>
</main>

${footer(site)}
</body>
</html>
`;
}
