# Imprime o banner ASCII do site no terminal, com as mesmas cores (ANSI
# truecolor — kitty, alacritty, wezterm, foot...).
#
#   python3 scripts/banner-ansi.py           escolhe a versão pela largura do terminal
#   python3 scripts/banner-ansi.py sm        versão de 64 colunas
#   python3 scripts/banner-ansi.py lg        versão de 150 colunas
#   python3 scripts/banner-ansi.py sm > kpital.ansi   salva pra usar com `cat`
#
# Lê src/banner.html e src/banner-sm.html (gerados por scripts/banner.py).

import html, re, shutil, sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / 'src'
FILES = {'lg': 'banner.html', 'sm': 'banner-sm.html'}

which = sys.argv[1] if len(sys.argv) > 1 else None
if which not in FILES:
    which = 'lg' if shutil.get_terminal_size((80, 24)).columns >= 150 else 'sm'

text = (SRC / FILES[which]).read_text()
span = re.compile(r'<i style="color:#([0-9a-f]{6})">(.*?)</i>')

def ansi(m):
    r, g, b = (int(m.group(1)[i:i + 2], 16) for i in (0, 2, 4))
    return f'\x1b[1;38;2;{r};{g};{b}m{m.group(2)}\x1b[0m'

for line in text.splitlines():
    print(html.unescape(span.sub(ansi, line)))
