"""The edit: the supplied video, untouched, with every "DAY n" label covered by an overlay from badge.py
(the product badge over the Day 1-7 montage, پێش / دوای over the before/after split screen).

  python edit.py stills 0 243 244 383 384 420   -> out/stills/fNNNN.png (full-size composites)
  python edit.py render                         -> ../fvrts_SuBoonJo_Daily_1080x1920.mp4 (needs work/audio_master.wav)
  python edit.py check                          -> proves the labels never show; loudness; out/sheet.jpg, out/cuts.jpg

The footage is only scaled (480x854 -> 1080x1920, Lanczos plus a light luma unsharp, the same on every frame).
Nothing generative touches the skin: this is a before/after, so the pixels stay the camera's."""
import subprocess, sys, pathlib, json, re
import numpy as np
from PIL import Image

W, H, FPS, N = 1080, 1920, 24, 456
SRC, OUT = 'source/original.mp4', '../fvrts_SuBoonJo_Daily_1080x1920.mp4'

# The cue sheet, in source frames at 24 fps. The original labels type themselves in again at every day cut;
# one badge held across all of them replaces that, and keeps one screen position per appearance.
CUES = [
    # overlay,                     first, last, opacity on lead-in frames
    ('assets/overlay_montage.png', 0, 243, {}),           # DAY 1..7 label up from frame 0; 244 is the black eye-slit wipe
    ('assets/overlay_split.png', 383, 455, {383: 0.5}),   # DAY 1 / DAY 7 split: ghost labels start at 384 (crossfade 26 %),
]                                                         # so ease in on 383, a label-free flashback frame

DECODE = ('scale=1080:1920:flags=lanczos+accurate_rnd+full_chroma_int,unsharp=5:5:0.45:5:5:0,'
          'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24')
ENCODE = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p'


def frames(path=SRC, vf=DECODE, size=(W, H)):
    w, h = size
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         stdout=subprocess.PIPE)
    n = 0
    while True:
        buf = p.stdout.read(w * h * 3)
        if len(buf) < w * h * 3: break
        yield n, np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        n += 1
    p.wait()


def overlays():
    ov = {}
    for path, *_ in CUES:
        a = np.asarray(Image.open(path).convert('RGBA'), np.float32) / 255
        ov[path] = (a[..., :3] * a[..., 3:4], a[..., 3:4])          # premultiplied colour, alpha
    return ov


def opacity(n):
    return [(path, lead.get(n, 1.0)) for path, a, b, lead in CUES if a <= n <= b]


def composite(n, fr, ov):
    layers = opacity(n)
    if not layers: return fr
    x = fr.astype(np.float32) / 255
    for path, k in layers:
        col, al = ov[path]
        x = col * k + x * (1 - al * k)
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def stills(want):
    out = pathlib.Path('out/stills'); out.mkdir(parents=True, exist_ok=True)
    ov = overlays()
    for n, fr in frames():
        if n in want:
            Image.fromarray(composite(n, fr, ov)).save(out / f'f{n:04d}.png')
    print('wrote', len(want), 'stills to', out)


def render():
    ov = overlays()
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                            '-i', '-', '-i', 'work/audio_master.wav', '-map', '0:v', '-map', '1:a', '-vf', ENCODE,
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high',
                            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
                            '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', OUT], stdin=subprocess.PIPE)
    count = 0
    for n, fr in frames():
        enc.stdin.write(composite(n, fr, ov).tobytes()); count += 1
    enc.stdin.close(); enc.wait()
    assert count == N, f'decoded {count} frames, expected {N}'
    print(f'wrote {OUT} ({count} frames)')


def label_masks():
    """Pixels of the original labels: white through a whole day segment while the footage moves under them."""
    import cv2
    segs = {'montage': [(2, 36), (46, 62), (96, 113), (122, 139), (176, 242)],      # days with a clean background
            'split': [(397, 455)]}
    boxes = {'montage': [(10, 70, 220, 200)], 'split': [(0, 20, 220, 140), (0, 430, 230, 545)]}
    small = dict(frames(vf='scale=in_color_matrix=bt709:in_range=tv,format=rgb24', size=(480, 854)))   # source frames
    masks = {}
    for k, ranges in segs.items():
        m = np.zeros((854, 480), bool)
        for a, b in ranges:
            hsv = np.stack([cv2.cvtColor(small[f], cv2.COLOR_RGB2HSV) for f in range(a, b + 1)])
            s = (hsv[..., 2].min(0) > 140) & (hsv[..., 1].max(0) < 75)
            for x0, y0, x1, y1 in boxes[k]:
                m[y0:y1, x0:x1] |= s[y0:y1, x0:x1]
        up = cv2.resize(m.astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST)
        masks[k] = cv2.dilate(up, np.ones((5, 5), np.uint8)).astype(bool)
    return masks


def check():
    # 1. the file
    info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', OUT],
                                     capture_output=True, text=True, check=True).stdout)
    v = next(s for s in info['streams'] if s['codec_type'] == 'video'); a = next(s for s in info['streams'] if s['codec_type'] == 'audio')
    print(f"video {v['width']}x{v['height']} {v['r_frame_rate']} {v['nb_frames']} frames, {v['pix_fmt']}, "
          f"{v.get('color_space')}/{v.get('color_primaries')}/{v.get('color_transfer')}; audio {a['codec_name']} {a['sample_rate']} Hz; "
          f"{float(info['format']['duration']):.3f} s, {int(info['format']['size']) / 1e6:.1f} MB")
    # 2. loudness of the delivered file
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', OUT, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr.split('Summary:')[-1]
    print('loudness', re.search(r'I:\s+(-?[\d.]+) LUFS', r)[1], 'LUFS, true peak', re.search(r'Peak:\s+(-?[\d.]+) dBFS', r.split('True peak')[-1])[1], 'dBTP')
    # 3. the labels never show: inside every label mask the delivered frame must be the badge, frame by frame.
    #    A leaked "DAY" glyph is black on the light card: a third of the label area off by far more than encoding noise.
    masks = label_masks(); ov = overlays()
    worst = {}
    for n, fr in frames(OUT, 'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24'):
        for path, k in opacity(n):
            if k < 1: continue
            key = 'montage' if 'montage' in path else 'split'
            col, al = ov[path]
            d = np.abs(fr[masks[key]].astype(np.float32) - col[masks[key]] * 255).mean(1)
            worst[key] = max(worst.get(key, (0, 0, -1)), (float((d > 40).mean() * 100), float(np.median(d)), n))
    for k, (frac, med, n) in worst.items():
        print(f'{k}: under the badge, worst frame {n}: {frac:.2f} % of label pixels off by >40/255 (median {med:.1f})',
              'OK' if frac < 2 else 'LABEL VISIBLE?')
    # 4. sheets to look at
    pathlib.Path('out').mkdir(exist_ok=True)
    picks = list(range(0, N, 12)); cuts = [36, 37, 38, 40, 44, 63, 64, 68, 88, 92, 114, 118, 140, 144, 165, 172, 243, 244, 382, 383, 384, 386, 390, 394]
    sheet, crops = [], []
    for n, fr in frames(OUT, 'scale=in_color_matrix=bt709:in_range=tv,format=rgb24'):
        if n in picks: sheet.append(Image.fromarray(fr).resize((135, 240), Image.LANCZOS))
        if n in cuts: crops.append(Image.fromarray(fr).crop((0, 0, 540, 1200)).resize((180, 400), Image.LANCZOS))
    for name, tiles, cols in (('sheet', sheet, 10), ('cuts', crops, 12)):
        tw, th = tiles[0].size; rows = -(-len(tiles) // cols)
        im = Image.new('RGB', (cols * tw, rows * th), (20, 20, 20))
        for i, t in enumerate(tiles): im.paste(t, ((i % cols) * tw, (i // cols) * th))
        im.save(f'out/{name}.jpg', quality=90)
    print('wrote out/sheet.jpg (every 0.5 s) and out/cuts.jpg (label zone at every cut)')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'stills': stills({int(x) for x in sys.argv[2:]})
    elif cmd == 'render': render()
    elif cmd == 'check': check()
