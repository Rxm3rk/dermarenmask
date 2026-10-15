"""The overlays that replace the "DAY n" labels, rendered by Chromium (shot.js) so the Sorani is shaped by a real text engine.

  python badge.py   -> assets/overlay_montage.png, assets/overlay_split.png  (1080x1920, transparent)

Montage (DAY 1..7): the badge. The real bottle stands in it and rises out of the card, beside کاریگەری ڕۆژانە.
Split screen (DAY 1 / DAY 7): the same card with one word: پێش (before) on the top half, دوای (after) on the bottom.
Every card covers the brush label it replaces with ~15-25 px to spare (edit.py check proves it)."""
import base64, pathlib, subprocess

HERE = pathlib.Path(__file__).parent
FONT = HERE.parent / 'UniSIRWAN Somar Black.ttf'
BOTTLE = HERE / 'assets' / 'bottle_upright.png'
TEXT = 'کاریگەری ڕۆژانە'             # the supervisor's copy, verbatim; one word per line, right-aligned
BEFORE, AFTER = 'پێش', 'دوای'         # the before/after captions on the split screen
INK, CARD = '#121212', '#FDF8F9'      # fvrts ink and page colours (fvrts-launch-source-9x16/site/main.js)
SIZE, CAPTION, RADIUS, PAD = 54, 96, 26, 14   # badge type px, caption type px, corner px, inner padding px
BOTTLE_H = 286                        # the product: 1.7x the card's inner height, so it rises ~100 px out of the card

# kind, x, y, w, h of each card on the 1080x1920 canvas (the bottle rises above its card)
OVERLAYS = {
    'overlay_montage': [('badge', 66, 194, 436, 196, TEXT)],         # DAY 1..7 label: x 88-396, y 218-374
    'overlay_split': [('caption', 32, 82, 340, 186, BEFORE),         # DAY 1 label: x 45-333, y 101-250
                      ('caption', 32, 984, 340, 186, AFTER)],        # DAY 7 label: x 50-356, y 999-1154 (seam at y 960)
}


def b64(p):
    return base64.b64encode(pathlib.Path(p).read_bytes()).decode()


def page(cards):
    bottle = b64(BOTTLE)
    body = ''
    for i, (kind, x, y, w, h, text) in enumerate(cards):
        if kind == 'badge':
            l1, l2 = text.split(' ', 1)
            inner = f'''
    <img class="bottle" data-m="bottle{i}" src="data:image/png;base64,{bottle}" style="height:{BOTTLE_H}px;left:{PAD + 2}px;top:{h - 12 - BOTTLE_H}px">
    <div class="txt" data-m="text{i}" style="right:{PAD + 10}px"><span>{l1}</span><span>{l2}</span></div>'''
        else:
            inner = f'''
    <div class="cap" data-m="text{i}">{text}</div>'''
        body += f'''
  <div class="card" data-m="card{i}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">{inner}
  </div>'''
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Somar; src: url(data:font/ttf;base64,{b64(FONT)}) format('truetype'); font-weight: 900; }}
html, body {{ margin:0; width:1080px; height:1920px; background:transparent; overflow:hidden; }}
.card {{ position:absolute; background:{CARD}; border-radius:{RADIUS}px;
  box-shadow: 0 18px 40px rgba(20,12,16,0.22), 0 3px 8px rgba(20,12,16,0.18); }}
.bottle {{ position:absolute; filter: drop-shadow(4px 8px 9px rgba(40,24,30,0.30)); }}
.txt {{ position:absolute; top:0; bottom:0; display:flex; flex-direction:column; justify-content:center; align-items:flex-start;
  direction:rtl; font-family:Somar; font-weight:900; font-size:{SIZE}px; line-height:1.12; color:{INK}; white-space:nowrap; }}
.txt span {{ display:block; width:max-content; }}
.cap {{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  direction:rtl; font-family:Somar; font-weight:900; font-size:{CAPTION}px; line-height:1; color:{INK}; white-space:nowrap; }}
</style></head><body>{body}
</body></html>'''


if __name__ == '__main__':
    work = HERE / 'work'; work.mkdir(exist_ok=True)
    for name, cards in OVERLAYS.items():
        html = work / f'{name}.html'
        html.write_text(page(cards), encoding='utf-8')
        subprocess.run(['node', str(HERE / 'shot.js'), str(html), str(HERE / 'assets' / f'{name}.png')], check=True)
