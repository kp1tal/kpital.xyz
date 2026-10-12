// Player da galeria de música. Uma faixa toca de um de dois jeitos:
//   data-audio   arquivo servido pelo próprio site (<audio>)
//   data-youtube id de vídeo, tocado pelo player oficial do YouTube embutido
// A interface (capa, play/pause, barra, anterior/próxima) é a mesma pros
// dois; cada "motor" abaixo só traduz os comandos e devolve os eventos.

(() => {
  // trocar de playlist volta a lista pro começo: a rolagem é da lista, não
  // da playlist, e sem isso a nova abria lá embaixo onde a outra parou
  const list = document.querySelector('.tracks');
  document.querySelectorAll('input[name="playlist"]').forEach((r) =>
    r.addEventListener('change', () => { if (list) list.scrollTop = 0; }));

  const player = document.querySelector('.player');
  if (!player || player.hasAttribute('data-empty')) return;

  const tracks = [...document.querySelectorAll('.track[data-audio], .track[data-youtube]')];
  const $ = (sel) => player.querySelector(sel);
  const btn = {
    prev: $('[data-action="prev"]'),
    toggle: $('[data-action="toggle"]'),
    next: $('[data-action="next"]'),
  };
  const seek = $('.player-seek');
  const art = $('.player-art');
  const title = $('.player-title');
  const artist = $('.player-artist');
  const timeNow = $('[data-time="current"]');
  const timeTotal = $('[data-time="total"]');

  let current = -1;
  let engine = null;
  let seeking = false;

  // ── eventos que os motores disparam ─────────────────────────────────────

  const on = {
    play() {
      // se um aviso de erro tomou o lugar do artista e a faixa tocou mesmo
      // assim (o YouTube às vezes reclama e depois toca), o nome volta
      if (current >= 0) artist.textContent = tracks[current].querySelector('.track-artist').textContent;
      player.dataset.state = 'playing';
      btn.toggle.setAttribute('aria-label', 'pausar');
      tracks[current]?.classList.add('is-playing');
    },
    pause() {
      player.dataset.state = 'paused';
      btn.toggle.setAttribute('aria-label', 'tocar');
      tracks[current]?.classList.remove('is-playing');
    },
    ended() {
      const i = neighbor(1, false);
      if (i >= 0) load(i);
      else on.pause();
    },
    duration(d) {
      seek.max = d || 0;
      timeTotal.textContent = fmt(d);
    },
    time(t, d) {
      if (seeking) return;
      seek.value = t;
      timeNow.textContent = fmt(t);
      seek.style.setProperty('--pct', `${d ? (t / d) * 100 : 0}%`);
    },
    error(msg) {
      artist.textContent = msg;
      on.pause();
    },
  };

  // ── motor 1: arquivo de áudio ───────────────────────────────────────────

  const audioEngine = (() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.addEventListener('play', on.play);
    audio.addEventListener('pause', () => engine === audioEngine && on.pause());
    audio.addEventListener('ended', on.ended);
    audio.addEventListener('loadedmetadata', () => on.duration(audio.duration));
    audio.addEventListener('timeupdate', () => on.time(audio.currentTime, audio.duration));
    audio.addEventListener('error', () => audio.src && on.error('não foi possível abrir este arquivo'));
    return {
      load(src, play = true) { audio.src = src; if (play) audio.play().catch(() => {}); },
      play() { audio.play().catch(() => {}); },
      pause() { audio.pause(); },
      stop() { audio.pause(); },
      seek(t) { audio.currentTime = t; },
      time: () => audio.currentTime,
      paused: () => audio.paused,
    };
  })();

  // ── motor 2: YouTube ────────────────────────────────────────────────────
  // A API é carregada já na abertura da página: assim o player está pronto
  // quando a pessoa clica, e o play acontece dentro do clique (fora dele o
  // navegador bloqueia som automático).

  const youtubeEngine = (() => {
    let yt = null;
    let ready = false;
    let pending = null;
    let cueOnly = false;
    let backups = [];
    let timer = 0;

    const tick = () => on.time(yt.getCurrentTime(), yt.getDuration());

    if (tracks.some((li) => li.dataset.youtube)) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        yt = new YT.Player('yt-player', {
          host: 'https://www.youtube-nocookie.com',
          width: 160,
          height: 90,
          playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, iv_load_policy: 3 },
          events: {
            onReady() {
              ready = true;
              // fora do Tab e dos leitores de tela: quem controla é o nosso player
              const frame = yt.getIframe();
              frame.tabIndex = -1;
              frame.setAttribute('aria-hidden', 'true');
              if (pending) (cueOnly ? yt.cueVideoById(pending) : yt.loadVideoById(pending));
              pending = null;
            },
            onStateChange({ data }) {
              if (engine !== youtubeEngine) return;
              clearInterval(timer);
              if (data === YT.PlayerState.PLAYING) {
                on.play();
                on.duration(yt.getDuration());
                timer = setInterval(tick, 250);
              } else if (data === YT.PlayerState.PAUSED) {
                on.pause();
              } else if (data === YT.PlayerState.ENDED) {
                on.ended();
              }
            },
            onError({ data }) {
              if (engine !== youtubeEngine) return;
              // 100 = vídeo removido, 101/150 = bloqueado fora do YouTube:
              // se a faixa tem outro upload reserva, tenta o próximo calado
              if ([100, 101, 150].includes(data) && backups.length) {
                yt.loadVideoById(backups.shift());
                return;
              }
              on.error(data === 101 || data === 150
                ? 'este áudio está bloqueado fora do YouTube'
                : 'não foi possível tocar este áudio');
            },
          },
        });
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.append(s);
    }

    return {
      // ids separados por espaço, em ordem de preferência
      // play = false só deixa o vídeo engatilhado (cue), sem tocar
      load(ids, play = true) {
        [pending, ...backups] = ids.split(/\s+/);
        cueOnly = !play;
        if (ready) {
          if (play) yt.loadVideoById(pending);
          else yt.cueVideoById(pending);
          pending = null;
        }
      },
      play() { ready && yt.playVideo(); },
      pause() { ready && yt.pauseVideo(); },
      stop() { clearInterval(timer); ready && yt.stopVideo(); },
      seek(t) { ready && yt.seekTo(t, true); },
      time: () => (ready ? yt.getCurrentTime() : 0),
      paused: () => !ready || yt.getPlayerState() !== YT.PlayerState.PLAYING,
    };
  })();

  // ── controle ────────────────────────────────────────────────────────────

  const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  function load(i, play = true) {
    const li = tracks[i];
    if (!li) return;
    tracks[current]?.classList.remove('is-current', 'is-playing');
    current = i;
    li.classList.add('is-current');

    const next = li.dataset.youtube ? youtubeEngine : audioEngine;
    if (engine && engine !== next) engine.stop();
    engine = next;
    player.classList.toggle('is-youtube', engine === youtubeEngine);

    title.textContent = li.querySelector('.track-title').textContent;
    artist.textContent = li.querySelector('.track-artist').textContent;
    on.duration(0);
    on.time(0, 0);

    // a miniatura do player copia a capa (imagem ou as duas cores)
    const cover = li.querySelector('.cover');
    const img = cover.querySelector('img');
    art.style.cssText = cover.getAttribute('style') ?? '';
    if (img) art.style.backgroundImage = `url("${img.src}")`;

    for (const b of Object.values(btn)) b.disabled = false;
    seek.disabled = false;
    btn.prev.disabled = btn.next.disabled = tracks.length === 1;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title.textContent,
        artist: artist.textContent,
        artwork: img ? [{ src: img.src }] : [],
      });
    }

    engine.load(li.dataset.youtube || li.dataset.audio, play);
  }

  // próxima/anterior só passam pelas faixas da playlist marcada (mesmo com a
  // lista fechada, quando nenhuma faixa está na tela)
  const visible = (li) => {
    const on = document.querySelector('input[name="playlist"]:checked');
    return !on || on.id === `p-${li.dataset.playlist}`;
  };
  function neighbor(dir, wrap = true) {
    for (let k = 1; k <= tracks.length; k++) {
      const j = current + dir * k;
      if (!wrap && (j < 0 || j >= tracks.length)) return -1;
      const i = ((j % tracks.length) + tracks.length) % tracks.length;
      if (visible(tracks[i])) return i;
    }
    return -1;
  }

  const step = (dir) => {
    const i = neighbor(dir);
    if (i >= 0) load(i);
  };

  const toggle = () => {
    if (current < 0) return step(1);
    engine.paused() ? engine.play() : engine.pause();
  };

  tracks.forEach((li, i) => {
    li.querySelector('.track-row').addEventListener('click', () => (i === current ? toggle() : load(i)));
  });

  btn.toggle.addEventListener('click', toggle);
  btn.prev.addEventListener('click', () => {
    // como em todo player: no meio da faixa, "anterior" volta pro começo dela
    if (engine && engine.time() > 3) engine.seek(0);
    else step(-1);
  });
  btn.next.addEventListener('click', () => step(1));

  // dá pra começar pelo botão grande sem escolher capa
  btn.toggle.disabled = false;

  seek.addEventListener('input', () => {
    seeking = true;
    timeNow.textContent = fmt(Number(seek.value));
    seek.style.setProperty('--pct', `${(seek.value / (seek.max || 1)) * 100}%`);
  });
  seek.addEventListener('change', () => {
    engine?.seek(Number(seek.value));
    seeking = false;
  });

  // a página abre com a primeira faixa engatilhada no player, parada: só
  // toca quando a pessoa dá play ou escolhe uma faixa
  const first = neighbor(1);
  if (first >= 0) {
    load(first, false);
    player.dataset.state = 'paused';
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => engine?.play());
    navigator.mediaSession.setActionHandler('pause', () => engine?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
  }
})();
