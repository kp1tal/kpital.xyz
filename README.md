# kpital

## Uso

```sh
npm install        # uma vez
npm run build      # gera index.html, artigos/, media/ e musica/
npm run serve      # http://127.0.0.1:8080
```

Rode `npm run build` antes de cada commit: o que vai pro ar é o HTML gerado.

## Onde fica cada coisa

```
src/
├── site.yml             # nome, tagline, URL, rodapé, categorias, playlists
├── musica.yml           # faixas da galeria de música (npm run musica)
├── musica/              # capas e áudios citados no musica.yml
├── artigos/             # um .md por artigo (subpastas à vontade)
│   └── exemplos/        # artigos fictícios — apagar quando tiver os seus
└── media/               # imagens, GIFs e vídeos dos artigos

templates/pages.js       # HTML da home e da página de artigo
build.js                 # o gerador
scripts/musica.js        # adiciona faixas do YouTube (yt-dlp)
css/style.css            # estilo geral + home
css/artigo.css           # página de artigo
js/player.js             # player de música
js/artigo.js             # botão "copiar" dos blocos de código
```

Gerados pelo build (não editar à mão; são apagados e refeitos):
`index.html`, `artigos/`, `media/`, `musica/`.

## Escrevendo um artigo

Crie `src/artigos/nome-do-artigo.md`. O nome do arquivo vira o endereço
(`/artigos/nome-do-artigo/`).

```md
---
title: Título do artigo
date: 2026-10-07
description: Resumo de uma linha
category: computacao
---

Texto em Markdown.
```

O artigo `src/artigos/exemplos/guia-de-formatacao.md` mostra **todos** os
recursos (callouts, código, ASCII, imagens, GIF, vídeo, notas, tabelas,
`[[links]]`) e todos os campos do front matter. Copie de lá.

O título e a descrição de cada artigo vão pras metatags da página, então o
preview do link no Discord/WhatsApp/X mostra o artigo certo. A imagem do
preview é a mesma do site inteiro (`img/og.jpg`). Pra o preview funcionar
fora da sua máquina, preencha `url` em `src/site.yml`.

`draft: true` tira o artigo do site, mas o `.md` continua no repositório.

## Adicionando música

```sh
npm run musica -- --playlist pai-divorciado "https://www.youtube.com/watch?v=..."
npm run build
```

O script usa o `yt-dlp` só pra ler título, artista, álbum e ano e pra
baixar a thumbnail, que vira a capa (recortada em quadrado, salva em
`src/musica/<id>.jpg`). O áudio não é baixado: o player toca pelo YouTube
embutido. A faixa entra no fim de `src/musica.yml`; confira os campos lá e
reordene à vontade.

As playlists ficam em `src/site.yml` (`playlists:`) e cada faixa diz a sua
com `playlist:`. Na página, cada playlist vira um card com a tira das
primeiras capas; clicando, aparece a lista de faixas dela, e o player só anda
dentro da playlist aberta. Pra criar uma playlist nova, é só adicionar uma
linha em `playlists:`.

### Quando o YouTube bloqueia

Gravadoras grandes (Sony, Universal…) costumam bloquear a música fora do
youtube.com. Aí o player mostra "o dono do vídeo não deixa tocar fora do
YouTube". O bloqueio vale por vídeo, então muitas vezes um upload de canal de
letra (lyrics) da mesma música toca. Dá pra listar vários, em ordem de
preferência — se um for bloqueado ou removido, o player tenta o próximo
sozinho:

```yaml
  youtube: [EeeBH294v6I, FDD7O8oNoFI, hfmxO-HQ5rU]
```

Também dá pra usar um arquivo próprio em vez do YouTube:

```yaml
- title: Nome da faixa
  artist: Artista
  cover: capa.jpg
  audio: faixa.mp3     # arquivo em src/musica/
```

## Créditos

- Foto de fundo: "Cook Forest State Park River Cabin District", Wikimedia
  Commons, domínio público.
- Fonte: Comic Shanns Mono (Nerd Font), licença MIT —
  `fonts/COMICSHANNS-LICENSE.md`. Os caracteres cirílicos vêm da Fira Code,
  licença OFL — `fonts/FIRACODE-LICENSE.txt`.
