"""Review helper: tile consecutive frames (with frame numbers) so motion spacing can be checked.
python strip.py out/strip_x.jpg START COUNT [STEP] [COLS] [W]"""
import sys
from PIL import Image, ImageDraw
out, a, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
step = int(sys.argv[4]) if len(sys.argv) > 4 else 1
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 8
w = int(sys.argv[6]) if len(sys.argv) > 6 else 240
h = w * 16 // 9
frames = [a + i * step for i in range(n)]
rows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 6), rows * (h + 6)), 'white')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(frames):
    try: im = Image.open(f'out/frames/{f:05d}.png').convert('RGB').resize((w, h), Image.LANCZOS)
    except FileNotFoundError: continue
    x, y = (i % cols) * (w + 6), (i // cols) * (h + 6)
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 44, y + 18], fill='black'); d.text((x + 4, y + 3), str(f), fill='white')
sheet.save(out, quality=88)
