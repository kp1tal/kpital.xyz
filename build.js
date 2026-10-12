// Gerador do kpital.
//
//   src/site.yml          nome, tagline, url, rodapé, categorias
//   src/musica.yml        faixas da galeria de música
//   src/musica/           capas e áudios citados no musica.yml
//   src/artigos/**/*.md   artigos (front matter + Markdown estilo Obsidian)
//   src/media/            imagens, GIFs e vídeos citados nos artigos
//   src/setup.yml         página ~/setup (fotos em src/setup/)
//
// Saída, na raiz do repositório (é o que o GitHub Pages serve):
//
//   index.html            home: música à esquerda, artigos à direita
//   artigos/<slug>/       uma página por artigo
//   setup/                página ~/setup + as fotos dela
//   media/  musica/       cópia dos arquivos citados
//
// `npm run build` antes de cada commit. Tudo em artigos/, media/, musica/ e setup/
// é apagado e refeito a cada build — não edite nada lá dentro.

import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import markedFootnote from 'marked-footnote';
import hljs from 'highlight.js';
import { load as loadYaml } from 'js-yaml';
import { homePage, articlePage, setupPage, esc } from './templates/pages.js';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const OUT_DIRS = ['artigos', 'media', 'musica', 'setup'];

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;
const AUDIO_EXT = /\.(mp3|ogg|oga|opus|m4a|wav|flac)$/i;

// ── utilidades ──────────────────────────────────────────────────────────────

const slugify = (s) =>
  String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// o js-yaml 5 recusa um arquivo vazio ou só de comentários
const parseYaml = (text, fallback) => (/^\s*[^#\s]/m.test(text) ? loadYaml(text) ?? fallback : fallback);
const readYaml = (file, fallback = {}) => (fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8'), fallback) : fallback);

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p, ext);
    return e.name.endsWith(ext) ? [p] : [];
  });
}

function parseFrontMatter(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  try {
    return { meta: parseYaml(m[1], {}), body: raw.slice(m[0].length) };
  } catch (err) {
    // falhar alto: o motor antigo engolia o erro e publicava sem título
    throw new Error(`front matter inválido em ${path.relative(ROOT, file)}:\n${err.message}`);
  }
}

const isoDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d) : '');

// ── mídia ───────────────────────────────────────────────────────────────────
// Um artigo pode citar `foto.png`, `pasta/foto.png` ou `![[foto.png]]`. Procura
// ao lado do .md, depois em src/media/ pelo caminho, depois em src/media/
// pelo nome (o "caminho mais curto" do Obsidian). Achou: copia pra media/.

let mediaIndex = null;
const copied = new Map();

function findMedia(ref, mdFile) {
  const clean = decodeURI(ref.split(/[?#]/)[0]);
  const direct = [path.resolve(path.dirname(mdFile), clean), path.join(SRC, 'media', clean)];
  for (const p of direct) if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  mediaIndex ??= walk(path.join(SRC, 'media'), '');
  return mediaIndex.find((p) => path.basename(p) === path.basename(clean));
}

function mediaUrl(ref, mdFile, root) {
  if (/^([a-z]+:)?\/\//i.test(ref) || ref.startsWith('data:')) return ref;
  const found = findMedia(ref, mdFile);
  if (!found) {
    console.warn(`  ! mídia não encontrada: ${ref} (em ${path.relative(ROOT, mdFile)})`);
    return ref;
  }
  const name = path.basename(found);
  const prev = copied.get(name);
  if (prev && prev !== found) console.warn(`  ! dois arquivos chamados ${name}; ficou ${path.relative(ROOT, prev)}`);
  if (!prev) {
    copied.set(name, found);
    fs.mkdirSync(path.join(ROOT, 'media'), { recursive: true });
    fs.copyFileSync(found, path.join(ROOT, 'media', name));
  }
  return `${root}media/${encodeURIComponent(name)}`;
}

// ── callouts do Obsidian ────────────────────────────────────────────────────
//   > [!note] Título opcional
//   > corpo
// `[!tip]-` nasce fechado, `[!tip]+` nasce aberto (os dois viram <details>).
// Convertido antes do Markdown: o corpo sai do blockquote e vai pra dentro de
// um <div>, separado por linhas em branco — assim o marked continua lendo o
// corpo como Markdown (listas, código, imagens, callout dentro de callout).

const CALLOUTS = {
  note: ['note', 'i'], info: ['note', 'i'], todo: ['note', '-'],
  abstract: ['abstract', '='], summary: ['abstract', '='], tldr: ['abstract', '='],
  tip: ['tip', '*'], hint: ['tip', '*'], important: ['tip', '*'],
  success: ['success', '+'], check: ['success', '+'], done: ['success', '+'],
  question: ['question', '?'], help: ['question', '?'], faq: ['question', '?'],
  warning: ['warning', '!'], caution: ['warning', '!'], attention: ['warning', '!'],
  failure: ['danger', 'x'], fail: ['danger', 'x'], missing: ['danger', 'x'],
  danger: ['danger', 'x'], error: ['danger', 'x'], bug: ['danger', '#'],
  example: ['example', '>'], quote: ['quote', '"'], cite: ['quote', '"'],
};

function convertCallouts(md, renderTitle) {
  const lines = md.split('\n');
  const out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1];
      else if (line.trim().startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    const head = !fence && line.match(/^>\s*\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/);
    if (!head) { out.push(line); continue; }

    const body = [];
    while (i + 1 < lines.length && /^>/.test(lines[i + 1])) body.push(lines[++i].replace(/^>\s?/, ''));

    const kind = head[1].toLowerCase();
    const [variant, mark] = CALLOUTS[kind] ?? ['note', 'i'];
    const title = renderTitle(head[3] || kind.charAt(0).toUpperCase() + kind.slice(1));
    const inner = convertCallouts(body.join('\n'), renderTitle);
    const titleHtml = `<span class="callout-mark" aria-hidden="true">[${esc(mark)}]</span> <span class="callout-title-text">${title}</span>`;
    const [open, titleTag, close] = head[2]
      ? [`<details class="callout callout-${variant}"${head[2] === '+' ? ' open' : ''}>`, 'summary', '</details>']
      : [`<div class="callout callout-${variant}">`, 'div', '</div>'];

    out.push('', open, `<${titleTag} class="callout-title">${titleHtml}</${titleTag}>`, '<div class="callout-body">', '',
      inner, '', '</div>', close, '');
  }
  return out.join('\n');
}

// ── Markdown ────────────────────────────────────────────────────────────────

function makeMarkdown(ctx) {
  const md = new Marked({ gfm: true });
  const usedIds = new Map();

  const embed = (src, alt, title, width) => {
    const url = mediaUrl(src, ctx.file, ctx.root);
    const w = width ? ` width="${esc(width)}"` : '';
    const caption = title || (alt && !/^\d+$/.test(alt) ? alt : '');
    const cap = caption ? `<figcaption>${esc(caption)}</figcaption>` : '';

    const yt = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    if (yt) {
      return `<figure class="media media-embed"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="${esc(caption || 'vídeo')}" loading="lazy" allowfullscreen></iframe>${cap}</figure>`;
    }
    if (VIDEO_EXT.test(src)) {
      return `<figure class="media"><video src="${esc(url)}" controls preload="metadata" playsinline${w}></video>${cap}</figure>`;
    }
    if (AUDIO_EXT.test(src)) {
      return `<figure class="media media-audio"><audio src="${esc(url)}" controls preload="metadata"></audio>${cap}</figure>`;
    }
    return `<figure class="media"><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async"${w}>${cap}</figure>`;
  };

  md.use(markedFootnote({ description: 'Notas', refMarkers: true }));

  md.use({
    extensions: [
      {
        // ![[arquivo.png]]  ![[arquivo.png|400]]  ![[video.mp4|legenda]]
        name: 'obsidianEmbed', level: 'inline',
        start: (s) => s.indexOf('![['),
        tokenizer(s) {
          const m = s.match(/^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/);
          if (m) return { type: 'obsidianEmbed', raw: m[0], src: m[1].trim(), opt: (m[2] ?? '').trim() };
        },
        renderer: (t) => /^\d+(x\d+)?$/.test(t.opt)
          ? embed(t.src, '', '', t.opt.split('x')[0])
          : embed(t.src, t.opt, '', ''),
      },
      {
        // [[slug-do-artigo]]  [[slug-do-artigo|texto]]
        name: 'wikilink', level: 'inline',
        start: (s) => s.indexOf('[['),
        tokenizer(s) {
          const m = s.match(/^\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/);
          if (m) return { type: 'wikilink', raw: m[0], target: m[1].trim(), hash: m[2] ?? '', label: m[3] };
        },
        renderer(t) {
          const target = ctx.articles.find((a) => a.slug === slugify(t.target) || a.title === t.target);
          const label = esc(t.label ?? target?.title ?? t.target);
          if (!target) {
            console.warn(`  ! [[${t.target}]] não aponta pra nenhum artigo (em ${path.relative(ROOT, ctx.file)})`);
            return `<span class="wikilink-missing">${label}</span>`;
          }
          return `<a href="${ctx.root}artigos/${target.slug}/${t.hash ? '#' + slugify(t.hash) : ''}">${label}</a>`;
        },
      },
      {
        // ==destaque==
        name: 'mark', level: 'inline',
        start: (s) => s.indexOf('=='),
        tokenizer(s) {
          const m = s.match(/^==(?!\s)([^=\n]+?)==/);
          if (m) return { type: 'mark', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(t) { return `<mark>${this.parser.parseInline(t.tokens)}</mark>`; },
      },
    ],
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        let id = slugify(html) || 'secao';
        const n = usedIds.get(id) ?? 0;
        usedIds.set(id, n + 1);
        if (n) id += `-${n}`;
        // h1 do corpo vira h2: o título do artigo já é o h1 da página
        const level = Math.min(Math.max(depth, 2), 6);
        return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${html}</h${level}>\n`;
      },
      paragraph({ tokens }) {
        // parágrafo que é só uma imagem/embed vira <figure> solta, sem <p> em volta
        const real = tokens.filter((t) => !(t.type === 'text' && !t.raw.trim()) && t.type !== 'br');
        if (real.length && real.every((t) => t.type === 'image' || t.type === 'obsidianEmbed')) {
          return this.parser.parseInline(real) + '\n';
        }
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
      },
      image({ href, title, text }) {
        // ![legenda|300](foto.png) — largura no estilo Obsidian
        const m = text.match(/^(.*?)\|(\d+)(?:x\d+)?$/);
        return embed(href, m ? m[1] : text, title, m ? m[2] : '');
      },
      code({ text, lang }) {
        // em blocos sem realce de sintaxe, `termo` vira destaque âmbar
        // (some a crase). Usado nos diagramas ascii pra marcar nós/termos.
        const hl = (t) => t.replace(/`([^`\n]+)`/g, '<span class="tok">$1</span>');
        const l = (lang || '').trim().split(/\s+/)[0].toLowerCase();
        // ascii/art: arte solta, sem caixa (herdado do motor antigo)
        if (l === 'ascii' || l === 'art') return `<pre class="ascii">${hl(esc(text))}</pre>\n`;
        const plain = ['', 'text', 'txt', 'plain', 'plaintext'].includes(l);
        const known = !plain && hljs.getLanguage(l);
        const body = known ? hljs.highlight(text, { language: l, ignoreIllegals: true }).value : plain ? hl(esc(text)) : esc(text);
        const label = plain ? '' : `<span class="code-lang">${esc(l)}</span>`;
        return `<div class="code${plain ? ' code-plain' : ''}">${label}<button class="code-copy" type="button" hidden>copiar</button>`
          + `<pre><code class="hljs${known ? ' language-' + l : ''}">${body}</code></pre></div>\n`;
      },
      table({ header, rows }) {
        const cell = (c, tag) => `<${tag}${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        return `<div class="table-wrap"><table><thead><tr>${header.map((c) => cell(c, 'th')).join('')}</tr></thead>`
          + `<tbody>${rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody></table></div>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const ext = /^https?:\/\//.test(href);
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' rel="noopener"' : ''}>${text}</a>`;
      },
    },
  });

  return (body) => md.parse(convertCallouts(body, (t) => md.parseInline(t)));
}

// ── leitura ─────────────────────────────────────────────────────────────────

function readArticles(site) {
  const files = walk(path.join(SRC, 'artigos'), '.md');
  const articles = [];
  for (const file of files) {
    const { meta, body } = parseFrontMatter(fs.readFileSync(file, 'utf8'), file);
    if (meta.draft) continue;
    const rel = path.relative(ROOT, file);
    if (!meta.title) throw new Error(`${rel}: falta \`title\` no front matter`);
    if (!meta.date) throw new Error(`${rel}: falta \`date\` no front matter`);
    if (meta.category && !site.categories[meta.category]) {
      throw new Error(`${rel}: category "${meta.category}" não existe em src/site.yml (${Object.keys(site.categories).join(', ')})`);
    }
    const words = body.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length;
    articles.push({
      ...meta,
      file, body,
      slug: meta.slug ? slugify(meta.slug) : slugify(path.basename(file, '.md')),
      date: isoDate(meta.date),
      updated: isoDate(meta.updated),
      tags: [meta.tags ?? []].flat().map(String),
      label: meta.subject || site.categories[meta.category] || '',
      minutes: Math.max(1, Math.round(words / 200)),
    });
  }
  articles.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  const dup = articles.find((a, i) => articles.findIndex((b) => b.slug === a.slug) !== i);
  if (dup) throw new Error(`dois artigos com o mesmo slug: ${dup.slug}`);
  return articles;
}

function readTracks(playlists) {
  const file = path.join(SRC, 'musica.yml');
  const list = readYaml(file, []);
  return list.map((t, i) => {
    const asset = (name) => {
      if (!name) return '';
      const from = path.join(SRC, 'musica', name);
      if (!fs.existsSync(from)) {
        console.warn(`  ! musica.yml: arquivo não encontrado: src/musica/${name}`);
        return '';
      }
      const to = path.join(ROOT, 'musica', name);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      return 'musica/' + name.split('/').map(encodeURIComponent).join('/');
    };
    // youtube: id puro ou qualquer formato de link — ou uma lista deles, em
    // ordem de preferência: se o primeiro for bloqueado, o player tenta o
    // próximo
    const ids = [t.youtube ?? []].flat().map((v) => {
      const m = String(v).match(/(?:v=|youtu\.be\/|shorts\/|embed\/|^)([\w-]{11})(?:[?&#]|$)/);
      if (!m) console.warn(`  ! musica.yml: youtube inválido em "${t.title}": ${v}`);
      return m?.[1];
    }).filter(Boolean);
    if (!playlists[t.playlist]) {
      throw new Error(`src/musica.yml: "${t.title}" está na playlist "${t.playlist ?? '(nenhuma)'}", `
        + `que não existe em src/site.yml (${Object.keys(playlists).join(', ')})`);
    }
    return { ...t, index: i, cover: asset(t.cover), audio: asset(t.audio), youtube: ids.join(' ') };
  });
}

// fotos e specs da página ~/setup. Specs vêm como lista de { chave: valor }
// pra manter a ordem do arquivo
function readSetup() {
  const list = readYaml(path.join(SRC, 'setup.yml'), []);
  return list.map((item) => {
    if (!item.title) throw new Error('src/setup.yml: item sem `title`');
    let photo = '';
    if (item.photo) {
      const from = path.join(SRC, 'setup', item.photo);
      if (fs.existsSync(from)) {
        fs.mkdirSync(path.join(ROOT, 'setup'), { recursive: true });
        fs.copyFileSync(from, path.join(ROOT, 'setup', path.basename(item.photo)));
        photo = encodeURIComponent(path.basename(item.photo));
      } else {
        console.warn(`  ! setup.yml: foto não encontrada: src/setup/${item.photo}`);
      }
    }
    const specs = [item.specs ?? []].flat().flatMap((s) => Object.entries(s ?? {}))
      .map(([k, v]) => [String(k), String(v ?? '')]);
    return { ...item, photo, wanted: item.photo ?? '', specs };
  });
}

// ── build ───────────────────────────────────────────────────────────────────

function main() {
  const site = readYaml(path.join(SRC, 'site.yml'));
  site.categories ??= {};
  site.playlists ??= {};
  site.url = (site.url || '').replace(/\/+$/, '');

  for (const d of OUT_DIRS) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });

  const articles = readArticles(site);
  const tracks = readTracks(site.playlists);

  articles.forEach((a, i) => {
    const root = '../../';
    a.html = makeMarkdown({ file: a.file, root, articles })(a.body);
    if (a.cover) a.coverUrl = mediaUrl(String(a.cover), a.file, root);
    const outDir = path.join(ROOT, 'artigos', a.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'),
      articlePage({ site, article: a, newer: articles[i - 1], older: articles[i + 1], root }));
  });

  fs.writeFileSync(path.join(ROOT, 'index.html'), homePage({ site, articles, tracks, root: '' }));

  const setup = readSetup();
  fs.mkdirSync(path.join(ROOT, 'setup'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'setup', 'index.html'), setupPage({ site, setup, root: '../' }));

  console.log(`kpital: ${articles.length} artigo(s), ${tracks.length} faixa(s), ${copied.size} arquivo(s) de mídia`);
}

try {
  main();
} catch (err) {
  console.error(`\nerro: ${err.message}\n`);
  process.exit(1);
}
