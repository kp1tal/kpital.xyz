// Adiciona faixas do YouTube à galeria de música.
//
//   npm run musica -- --playlist <chave> <link> [<link> ...]
//
// A chave da playlist é uma das listadas em src/site.yml (playlists:).
//
// Usa o yt-dlp só pra ler os metadados (faixa, artista, álbum, ano) e baixar
// a thumbnail, que vira a capa: recortada no quadrado do meio (é onde o
// YouTube põe a arte do álbum) e salva em src/musica/. O áudio NÃO é baixado:
// o player do site toca pelo YouTube. A faixa entra no fim do musica.yml —
// confira os campos lá depois, o YouTube às vezes erra o nome do álbum.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { load as loadYaml } from 'js-yaml';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const YML = path.join(ROOT, 'src', 'musica.yml');
const COVERS = path.join(ROOT, 'src', 'musica');

// aspas sempre: título de música tem ':' e '#' demais pra arriscar YAML puro
const q = (s) => JSON.stringify(String(s));

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const args = process.argv.slice(2);
const flag = args.indexOf('--playlist');
const playlist = flag >= 0 ? args.splice(flag, 2)[1] : '';
const links = args;

const siteText = fs.readFileSync(path.join(ROOT, 'src', 'site.yml'), 'utf8');
const playlists = Object.keys(loadYaml(siteText)?.playlists ?? {});
if (!links.length || !playlists.includes(playlist)) {
  console.error('uso: npm run musica -- --playlist <chave> <link do YouTube> [<link> ...]');
  console.error(`playlists (src/site.yml): ${playlists.join(', ') || '(nenhuma)'}`);
  process.exit(1);
}

// o js-yaml 5 recusa um arquivo só de comentários; lista vazia, então
const text = fs.existsSync(YML) ? fs.readFileSync(YML, 'utf8') : '';
const existing = /^\s*[^#\s]/m.test(text) ? loadYaml(text) ?? [] : [];
const known = new Set(existing.flatMap((t) => [t.youtube ?? []].flat().map(String)));
fs.mkdirSync(COVERS, { recursive: true });

let added = 0;
for (const link of links) {
  let info;
  try {
    info = JSON.parse(run('yt-dlp', ['--no-playlist', '--dump-single-json', '--skip-download', link]));
  } catch (err) {
    console.error(`! não consegui ler ${link}:\n${err.stderr || err.message}`);
    continue;
  }
  if (known.has(info.id)) {
    console.log(`- já está na lista: ${info.title} (${info.id})`);
    continue;
  }

  const title = info.track || info.title;
  const artist = info.artist || info.creator || info.uploader?.replace(/ - Topic$/, '') || '';
  const album = info.album || '';
  // O YouTube dá dois anos, e cada um erra num caso diferente:
  //   release_date ("Released on")  Kino: 1988 certo   / Pearl Jam: 2013 relançamento digital
  //   release_year (o ano do ℗)     Kino: 2024 remaster / Pearl Jam: 1991 certo
  // O ano de verdade é o mais antigo dos dois. upload_date (quando o vídeo
  // subiu) nunca entra.
  const years = [info.release_date?.slice(0, 4), info.release_year].map(Number).filter(Boolean);
  const year = years.length ? Math.min(...years) : '';
  // nome pelo id do vídeo: sempre ASCII, sempre único
  const name = `${info.id}.jpg`;

  // thumbnail -> quadrado central -> 600x600
  const tmp = path.join(COVERS, `.${info.id}`);
  let cover = '';
  try {
    run('yt-dlp', ['-q', '--no-playlist', '--skip-download', '--write-thumbnail', '--convert-thumbnails', 'jpg', '-o', tmp, link]);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${tmp}.jpg`, '-vf', 'crop=min(iw\\,ih):min(iw\\,ih),scale=600:600', '-q:v', '3', path.join(COVERS, name)]);
    cover = name;
  } catch (err) {
    console.error(`! capa de ${title} falhou, a faixa entra sem capa:\n${err.stderr || err.message}`);
  } finally {
    fs.rmSync(`${tmp}.jpg`, { force: true });
  }

  const entry = [
    '',
    `- title: ${q(title)}`,
    `  artist: ${q(artist)}`,
    album && `  album: ${q(album)}`,
    year && `  year: ${year}`,
    `  playlist: ${playlist}`,
    cover && `  cover: ${cover}`,
    `  youtube: ${info.id}`,
  ].filter((l, i) => i === 0 || l).join('\n');

  fs.appendFileSync(YML, entry + '\n');
  known.add(info.id);
  added++;
  console.log(`+ ${title} — ${artist}${album ? ` (${album}${year ? `, ${year}` : ''})` : ''}`);
}

console.log(added ? `\n${added} faixa(s) adicionada(s) em src/musica.yml. Rode npm run build.` : '\nnada novo.');
