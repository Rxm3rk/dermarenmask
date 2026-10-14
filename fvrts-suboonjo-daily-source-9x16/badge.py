"""The badge that replaces every "DAY n" label: the real bottle + کاریگەری ڕۆژانە, on the brand's off-white card.

  python badge.py   -> assets/overlay_montage.png, assets/overlay_split.png  (1080x1920, transparent)

Rendered by Chromium (shot.js) so the Sorani text is shaped by a real text engine, in UniSIRWAN Somar Black.
Each card covers the original brush label it replaces with ~15-25 px to spare (edit.py check proves it)."""
import base64, pathlib, subprocess

HERE = pathlib.Path(__file__).parent
FONT = HERE.parent / 'UniSIRWAN Somar Black.ttf'
BOTTLE = HERE / 'assets' / 'bottle_upright.png'
TEXT = 'کاریگەری ڕۆژانە'            # the supervisor's copy, verbatim; one word per line, right-aligned
INK, CARD = '#121212', '#FDF8F9'     # fvrts ink and page colours (fvrts-launch-source-9x16/site/main.js)
SIZE, RADIUS, PAD = 54, 26, 14       # type px, corner px, inner padding px

# x, y, w, h on the 1080x1920 canvas
OVERLAYS = {
    'overlay_montage': [(66, 194, 382, 196)],                          # DAY 1..7 label: x 88-396, y 218-374
    'overlay_split': [(34, 76, 382, 196), (34, 978, 382, 196)],        # DAY 1 label: x 45-333, y 101-250; DAY 7: x 50-356, y 999-1154
}


def b64(p):
    return base64.b64encode(pathlib.Path(p).read_bytes()).decode()


def page(cards):
    l1, l2 = TEXT.split(' ', 1)
    bottle = b64(BOTTLE)
    body = ''
    for i, (x, y, w, h) in enumerate(cards):
        bh = h - 2 * PAD
        body += f'''
  <div class="card" data-m="card{i}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">
    <img class="bottle" data-m="bottle{i}" src="data:image/png;base64,{bottle}" style="height:{bh}px;left:{PAD + 4}px;top:{PAD}px">
    <div class="txt" data-m="text{i}" style="right:{PAD + 8}px"><span>{l1}</span><span>{l2}</span></div>
  </div>'''
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Somar; src: url(data:font/ttf;base64,{b64(FONT)}) format('truetype'); font-weight: 900; }}
html, body {{ margin:0; width:1080px; height:1920px; background:transparent; overflow:hidden; }}
.card {{ position:absolute; background:{CARD}; border-radius:{RADIUS}px;
  box-shadow: 0 18px 40px rgba(20,12,16,0.22), 0 3px 8px rgba(20,12,16,0.18); }}
.bottle {{ position:absolute; filter: drop-shadow(3px 6px 6px rgba(40,24,30,0.28)); }}
.txt {{ position:absolute; top:0; bottom:0; display:flex; flex-direction:column; justify-content:center; align-items:flex-start;
  direction:rtl; font-family:Somar; font-weight:900; font-size:{SIZE}px; line-height:1.12; color:{INK}; white-space:nowrap; }}
.txt span {{ display:block; width:max-content; }}
</style></head><body>{body}
</body></html>'''


if __name__ == '__main__':
    work = HERE / 'work'; work.mkdir(exist_ok=True)
    for name, cards in OVERLAYS.items():
        html = work / f'{name}.html'
        html.write_text(page(cards), encoding='utf-8')
        subprocess.run(['node', str(HERE / 'shot.js'), str(html), str(HERE / 'assets' / f'{name}.png')], check=True)
