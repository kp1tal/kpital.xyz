# Gera src/banner.html: o banner.png em arte ASCII, colorida com as cores do
# próprio banner. Rodar de novo só quando o banner mudar:
#
#   python3 scripts/banner.py [colunas] [arquivo]
#
# O site usa duas versões: 150 colunas (banner.html) e uma mais grossa pro
# celular (python3 scripts/banner.py 64 banner-sm.html).
#
# Em vez de trocar brilho por caractere (o jeito clássico, que deixa as letras
# borradas), cada célula é comparada com o desenho de todos os caracteres
# ASCII na fonte do site, e fica o que tiver o formato mais parecido. Assim as
# bordas das letras saem com / \ | _ ( ) nos lugares certos.
#
# A conta assume a célula da ComicShannsMono Bold com line-height 1:
# 0.55em de largura por 1em de altura (é o que o .banner do style.css usa).
# Precisa de Pillow, numpy e fontTools (pra ler a fonte .woff2 do site).

import html, io, sys
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
COLS = int(sys.argv[1]) if len(sys.argv) > 1 else 150
OUT = sys.argv[2] if len(sys.argv) > 2 else 'banner.html'
CW, CH = 11, 20          # célula de comparação, em px (0.55 : 1)
CHARS = [chr(c) for c in range(32, 127) if chr(c) not in '`']
COLORS = 7               # tons da paleta tirada do banner

# ── desenho de cada caractere ────────────────────────────────────────────────

font = TTFont(ROOT / 'fonts' / 'ComicShannsMono-Bold.woff2')
font.flavor = None
buf = io.BytesIO()
font.save(buf)
buf.seek(0)
SCALE = 4  # desenha grande e reduz, pra suavizar
pil_font = ImageFont.truetype(buf, CH * SCALE)

def glyph(ch):
    im = Image.new('L', (CW * SCALE, CH * SCALE), 0)
    # line-height 1 com ascent .85 e descent .35: a linha de base cai em .75em
    ImageDraw.Draw(im).text((0, CH * SCALE * 0.75), ch, font=pil_font, fill=255, anchor='ls')
    im = im.resize((CW, CH), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.7))
    return np.asarray(im, dtype=np.float32) / 255

glyphs = np.stack([glyph(c) for c in CHARS])          # (n, CH, CW)
flat = glyphs.reshape(len(CHARS), -1)

# ── imagem ───────────────────────────────────────────────────────────────────

img = Image.open(ROOT / 'banner.png').convert('RGBA')
img = img.crop(img.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox())
rows = round(img.height / img.width * COLS * CW / CH)
big = img.resize((COLS * CW, rows * CH), Image.LANCZOS)

rgba = np.asarray(big, dtype=np.float32) / 255
rgb, alpha = rgba[..., :3], rgba[..., 3]
lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
# "tinta": a parte clara e opaca. O contorno escuro do banner vira fundo,
# é ele que separa uma letra da outra
ink = np.clip((lum - 0.13) / 0.17, 0, 1) * alpha
ink = np.asarray(Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)),
                 dtype=np.float32) / 255

# paleta: os tons mais comuns da parte com tinta
mask = ink > 0.5
px = (rgb[mask] * 255).astype(np.uint8)
pal_img = Image.fromarray(px.reshape(1, -1, 3)).quantize(COLORS, method=Image.Quantize.MEDIANCUT)
palette = np.array(pal_img.getpalette()[:COLORS * 3], dtype=np.float32).reshape(-1, 3)

# ── célula por célula ────────────────────────────────────────────────────────

lines = []
for y in range(rows):
    out, run, cur = [], '', None

    def flush():
        if not run:
            return
        out.append(f'<i style="color:#{cur}">{html.escape(run)}</i>' if cur else run)

    for x in range(COLS):
        sl = np.s_[y * CH:(y + 1) * CH, x * CW:(x + 1) * CW]
        cell = ink[sl]
        if cell.mean() < 0.04:
            ch, color = ' ', None
        else:
            ch = CHARS[int(((flat - cell.reshape(-1)) ** 2).sum(1).argmin())]
            w = cell.reshape(-1, 1)
            avg = (rgb[sl].reshape(-1, 3) * w).sum(0) / w.sum() * 255
            # um pouco mais claro que a média: o caractere é fino, a tinta
            # ocupa só parte da célula
            avg = np.clip(avg * 1.12, 0, 255)
            p = palette[((palette - avg) ** 2).sum(1).argmin()]
            color = '%02x%02x%02x' % tuple(int(v) for v in np.clip(p * 1.12, 0, 255))
            if ch == ' ':
                color = None
        if color != cur and ch != ' ':
            flush()
            run, cur = '', color
        run += ch
    flush()
    lines.append(''.join(out).rstrip())

while lines and not lines[0].strip():
    lines.pop(0)
while lines and not lines[-1].strip():
    lines.pop()

(ROOT / 'src' / OUT).write_text('\n'.join(lines) + '\n')
print(f'src/{OUT}: {COLS}x{len(lines)}')
