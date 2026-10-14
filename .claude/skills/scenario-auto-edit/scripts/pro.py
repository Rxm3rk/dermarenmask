"""Finishing layer: typography with layered shadows, captions, odometer, logo reveal, optics
(chromatic pulse, bloom, grain), and the audio side (sound kit placement, voice chain, ducking,
mastering, BT.709 encode).

Fonts (SIL Open Font License, fetched by get_fonts.py from google/fonts into $AUTOEDIT_FONTS or
~/.cache/scenario-auto-edit/fonts): Oswald Bold for display, Instrument Sans for captions and UI,
Instrument Serif for emphasis. One accent colour at most.
"""
import os, sys, math, json
from functools import lru_cache
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
import fx
W, H, lin, mix, clamp01 = fx.W, fx.H, fx.lin, fx.mix, fx.clamp01
e_out3, e_out5, e_in3, e_io3 = fx.e_out3, fx.e_out5, fx.e_in3, fx.e_io3


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(obj, path, **kw):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, **kw)

FPS = fx.CFG.get('out_fps', 24)
FONTS = os.environ.get('AUTOEDIT_FONTS') or os.path.join(os.path.expanduser('~'), '.cache', 'scenario-auto-edit', 'fonts')
INK = (0.067, 0.067, 0.067)

# ---------------------------------------------------------------- easing with a soft spring
def e_spring(x, overshoot=0.06):
    x = clamp01(x)
    return 1 - (1 - x) ** 3 * math.cos(x * math.pi * 1.5) if overshoot else e_out3(x)

# ---------------------------------------------------------------- type
# kind -> (file from google/fonts, variable axes to set). Oswald and Instrument Sans ship as
# variable fonts there; the axes pick the same instance as the static Bold and Regular cuts.
FONT_FILES = {'display': ('Oswald[wght].ttf', {'Weight': 700}),
              'sans': ('InstrumentSans[wdth,wght].ttf', {'Weight': 700, 'Width': 100}),
              'sans-reg': ('InstrumentSans[wdth,wght].ttf', {'Weight': 400, 'Width': 100}),
              'serif': ('InstrumentSerif-Regular.ttf', {})}

FONT_OVERRIDE = {}   # kind -> path to a .ttf/.otf (beats.json "fonts"), e.g. for scripts these families lack

@lru_cache(None)
def font(kind, size):
    if FONT_OVERRIDE.get(kind):
        return ImageFont.truetype(FONT_OVERRIDE[kind], int(round(size)))
    name, axes = FONT_FILES[kind]
    path = os.path.join(FONTS, name)
    if not os.path.exists(path):
        sys.exit(f'Font not found: {path}\nRun: python {os.path.join(os.path.dirname(os.path.abspath(__file__)), "get_fonts.py")}'
                 + (f' --dest {FONTS}' if os.environ.get('AUTOEDIT_FONTS') else ''))
    f = ImageFont.truetype(path, int(round(size)))
    if axes:
        values = []
        for ax in f.get_variation_axes():
            label = ax['name'].decode() if isinstance(ax['name'], bytes) else ax['name']
            values.append(axes.get(label, ax['default']))
        f.set_variation_by_axes(values)
    return f

@lru_cache(None)
def text_layer(txt, kind, size, rgb=(1, 1, 1), tracking=0.0, ss=2):
    """Premultiplied RGBA, rendered at 2x and downsampled for clean edges. Anchor = (centre x, cap-height centre y)."""
    f = font(kind, size * ss)
    widths = [f.getlength(c) for c in txt]
    total = sum(widths) + tracking * size * ss * (len(txt) - 1)
    asc, desc = f.getmetrics(); pad = int(size * ss * 0.4)
    im = Image.new('L', (int(total + 2 * pad), int(asc + desc + 2 * pad)), 0); d = ImageDraw.Draw(im)
    x = pad
    for c, cw in zip(txt, widths):
        d.text((x, pad), c, font=f, fill=255); x += cw + tracking * size * ss
    im = im.resize((im.width // ss, im.height // ss), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255.0
    cap = f.getbbox('H'); cy = (pad + (cap[1] + cap[3]) / 2) / ss
    lay = np.dstack([a * rgb[0], a * rgb[1], a * rgb[2], a]).astype(np.float32)
    return lay, ((pad + total / 2) / ss, cy)

def text_width(txt, kind, size, tracking=0.0):
    f = font(kind, size)
    return sum(f.getlength(c) for c in txt) + tracking * size * (len(txt) - 1)

def letters(txt, kind, size, rgb, tracking=0.0):
    f = font(kind, size)
    widths = [f.getlength(c) for c in txt]
    total = sum(widths) + tracking * size * (len(txt) - 1)
    out, x = [], -total / 2
    for c, cw in zip(txt, widths):
        lay, anc = text_layer(c, kind, size, rgb)
        out.append((lay, anc, x + cw / 2)); x += cw + tracking * size
    return out, total

def blurred(lay, sigma):
    return lay if sigma < 0.3 else cv2.GaussianBlur(lay, (0, 0), sigma)

def soft_shadow(lay, sigma, opacity):
    a = cv2.GaussianBlur(lay[..., 3], (0, 0), sigma) * opacity
    z = np.zeros_like(a)
    return np.dstack([z, z, z, a]).astype(np.float32)

def place_shadowed(G, lay, anc, x, y, scale=1.0, alpha=1.0, clip=None, amb=(22, 0.32, 9), contact=(3, 0.28, 2)):
    """Two-layer shadow (ambient + contact), the way a designer builds it, then the type."""
    if amb: fx.place(G, soft_shadow(lay, amb[0], amb[1]), anc, x, y + amb[2] * scale, scale, alpha, clip)
    if contact: fx.place(G, soft_shadow(lay, contact[0], contact[1]), anc, x, y + contact[2] * scale, scale, alpha, clip)
    fx.place(G, lay, anc, x, y, scale, alpha, clip)

# fx.place composites RGB only; for a separate graphics layer we need RGBA accumulation
def place_rgba(G, lay, anc, x, y, scale=1.0, alpha=1.0, clip=None):
    """Composite premultiplied `lay` over premultiplied RGBA canvas G (in place)."""
    if alpha <= 0.001: return G
    lh, lw = lay.shape[:2]
    x0 = x - anc[0] * scale; y0 = y - anc[1] * scale
    X0, Y0 = max(0, int(math.floor(x0)) - 1), max(0, int(math.floor(y0)) - 1)
    X1, Y1 = min(W, int(math.ceil(x0 + lw * scale)) + 1), min(H, int(math.ceil(y0 + lh * scale)) + 1)
    if clip is not None:
        X0, Y0 = max(X0, int(clip[0])), max(Y0, int(clip[1])); X1, Y1 = min(X1, int(math.ceil(clip[2]))), min(Y1, int(math.ceil(clip[3])))
    if X1 <= X0 or Y1 <= Y0: return G
    M = np.float32([[1 / scale, 0, (X0 - x0) / scale], [0, 1 / scale, (Y0 - y0) / scale]])
    src = cv2.GaussianBlur(lay, (0, 0), 0.5 / scale) if scale < 0.8 else lay
    roi = cv2.warpAffine(src, M, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)) * alpha
    c = G[Y0:Y1, X0:X1]
    c *= (1 - roi[..., 3:4]); c += roi
    return G

def type_rgba(G, lay, anc, x, y, scale=1.0, alpha=1.0, clip=None, blur=0.0):
    return place_rgba(G, blurred(lay, blur), anc, x, y, scale, alpha, clip)

def new_layer():
    return np.zeros((H, W, 4), np.float32)

def composite_graphics_on_wall(B, G, m, light=(14, 24), subject_shadow=0.42, cast=(10, 18, 20, 0.20)):
    """Type that lives behind the subject: it casts a soft shadow on the wall, and the subject
    casts a soft shadow on it. Both shadows are offset from a key light above-left."""
    if G[..., 3].max() < 1e-3: return B
    ga = G[..., 3]
    M = np.float32([[1, 0, cast[0]], [0, 1, cast[1]]])
    sh = cv2.GaussianBlur(cv2.warpAffine(ga, M, (W, H)), (0, 0), cast[2]) * cast[3]
    B = B * (1 - sh[..., None])
    Ms = np.float32([[1, 0, light[0]], [0, 1, light[1]]])
    ss = cv2.GaussianBlur(cv2.warpAffine(m, Ms, (W, H)), (0, 0), 26) * subject_shadow
    Grgb = G[..., :3] * (1 - ss[..., None])
    return B * (1 - ga[..., None]) + Grgb

def over(img, G):
    return img * (1 - G[..., 3:4]) + G[..., :3]

# ---------------------------------------------------------------- odometer
def odometer_width(size, to, prefix='', suffix='', kind='display'):
    f = font(kind, size)
    dw = max(f.getlength(str(d)) for d in range(10)) * 0.98
    n_cols = len(str(int(round(abs(to))))) if to else 1
    return (f.getlength(prefix) + size * 0.02 if prefix else 0) + dw * n_cols + (f.getlength(suffix) + size * 0.02 if suffix else 0)

def odometer(G, value, x, y, size, rgb, to=100, prefix='', suffix='', kind='display', clip_pad=0.62):
    """Rolling digit columns with tabular width, counting to the integer `to`. `value` is a float;
    each column carries like a real counter and leading zeros stay blank. `prefix` and `suffix`
    (for example "$" or "%") come from beats.json. The layout is fixed for the final value, so the
    number never shifts while it rolls."""
    f = font(kind, size)
    dw = max(f.getlength(str(d)) for d in range(10)) * 0.98
    capH = f.getbbox('H')[3] - f.getbbox('H')[1]
    n_cols = len(str(int(round(abs(to))))) if to else 1
    left = x - odometer_width(size, to, prefix, suffix, kind) / 2
    clip = (0, y - capH * clip_pad - 4, W, y + capH * clip_pad + 4)
    if prefix:
        lay, anc = text_layer(prefix, kind, size, rgb)
        type_rgba(G, lay, anc, left + f.getlength(prefix) / 2, y); left += f.getlength(prefix) + size * 0.02
    v = max(0.0, min(float(abs(to)), value))
    if abs(to) - v < 1e-3: v = float(round(abs(to)))
    pitch = capH * 1.35
    for ci in range(n_cols):
        p = n_cols - 1 - ci; place = 10 ** p
        if p == 0:
            pos = v % 10
        else:
            lower = v - math.floor(v / place) * place
            pos = math.floor(v / place) % 10 + max(0.0, lower - (place - 1))
        base = math.floor(pos); frac = pos - base
        cx = left + dw * (ci + 0.5)
        for dd in (0, 1):
            d = int((base + dd) % 10)
            if p > 0 and math.floor(v / place) + dd == 0:
                continue                                  # leading zero: blank
            lay, anc = text_layer(str(d), kind, size, rgb)
            type_rgba(G, lay, anc, cx, y + (dd - frac) * pitch, clip=clip)
    if suffix:
        lay, anc = text_layer(suffix, kind, size, rgb)
        type_rgba(G, lay, anc, left + dw * n_cols + size * 0.02 + f.getlength(suffix) / 2, y)
    return G

# ---------------------------------------------------------------- logo
@lru_cache(None)
def logo_layer(path, height, ink=None):
    """A logo as a premultiplied RGBA layer at a given height. PNGs with transparency keep their
    colours (or take `ink`); opaque dark-on-light PNGs get alpha from their luminance."""
    im = Image.open(path).convert('RGBA'); a = np.asarray(im, np.float32) / 255.0
    if a[..., 3].min() > 0.98:                       # opaque: dark mark on a light ground
        lum = a[..., :3].mean(2); ink_l = np.percentile(lum, 1)
        al = np.clip((1 - lum) / max(1 - ink_l, 1e-3), 0, 1)
        rgb = np.dstack([np.full_like(al, ink_l)] * 3) if ink is None else np.dstack([np.full_like(al, c) for c in ink])
    else:
        al = a[..., 3]; rgb = a[..., :3] if ink is None else np.dstack([np.full_like(al, c) for c in ink])
    ys, xs = np.nonzero(al > 0.02)
    al, rgb = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1], rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = height / al.shape[0]; size = (max(1, int(round(al.shape[1] * k))), int(round(height)))
    al = cv2.resize(al, size, interpolation=cv2.INTER_AREA); rgb = cv2.resize(rgb, size, interpolation=cv2.INTER_AREA)
    return np.dstack([rgb * al[..., None], al]).astype(np.float32)

def draw_logo(G, t, t0, cx, cy, height, path, ink=None, glint=True):
    """Premium logo reveal centred at (cx, cy): a soft left-to-right mask wipe with a defocus that
    resolves, a slight settle in scale, then one glint. Starts at t0, done by t0 + 0.6 s."""
    lay = logo_layer(path, height, ink); h, w = lay.shape[:2]
    k = e_out5(lin(t, t0, t0 + 0.55))
    if k <= 0: return G
    x0 = cx - w / 2
    type_rgba(G, lay, (w / 2, h / 2), cx, cy, scale=mix(0.96, 1.0, k), alpha=min(1, k * 1.4),
              clip=(x0 - 4, 0, x0 + w * min(1, k * 1.15) + 4, H), blur=(1 - k) * 6)
    if glint:
        kg = lin(t, t0 + 0.62, t0 + 1.05)
        if 0 < kg < 1:
            band_x = x0 - 200 + (w + 400) * e_io3(kg)
            yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
            band = np.exp(-((xx - band_x - (yy - cy) * 0.5) / 46.0) ** 2) * 0.55
            a = G[..., 3]
            G[..., :3] = np.minimum(G[..., :3] + (band * a * 0.6)[..., None], a[..., None])
    return G

# ---------------------------------------------------------------- captions
class Captions:
    """Word-by-word captions: each word eases in (opacity, rise, defocus) on its spoken onset,
    a chunk leaves together. Emphasis words switch to Instrument Serif, set larger."""
    def __init__(self, chunks, emphasis=(), y=1392, size=66, rgb=(1, 1, 1), spans=None, space=True, keep_punctuation=False):
        self.chunks, self.emph, self.y, self.size, self.rgb, self.spans = chunks, set(emphasis), y, size, rgb, spans
        self.space, self.keep_punct = space, keep_punctuation

    def text(self, w):
        t = w['w']
        return t if self.keep_punct else (t.rstrip(',.;:\u3001\u3002\uff0c') or t)

    def word_style(self, w):
        return ('serif', self.size * 1.32) if w['i'] in self.emph else ('sans', self.size)

    def draw(self, G, t):
        for ci, ch in enumerate(self.chunks):
            a, b = self.spans[ci]
            if not (a - 0.05 <= t < b): continue
            out_k = e_in3(lin(t, b - 0.085, b - 0.005))      # leaves completely before the next chunk arrives
            parts = []
            for w in ch:
                kind, sz = self.word_style(w)
                parts.append((w, kind, sz, text_width(self.text(w), kind, sz, -0.005)))
            space = font('sans', self.size).getlength(' ') * 0.95 if self.space else 0.0
            total = sum(p[3] for p in parts) + space * (len(parts) - 1)
            x = W / 2 - total / 2
            for w, kind, sz, pw in parts:
                k = e_out3(lin(t, w['onset'] - 0.03, w['onset'] + 0.13))
                if k <= 0: x += pw + space; continue
                lay, anc = text_layer(self.text(w), kind, sz, self.rgb, -0.005)
                yy = self.y + (1 - k) * 16 - out_k * 10 + (6 if kind == 'serif' else 0)
                al = k * (1 - out_k)
                blur = (1 - k) * 5
                place_rgba(G, soft_shadow(lay, 20, 0.40 if kind == 'sans' else 0.55), anc, x + pw / 2, yy + 9, alpha=al)
                place_rgba(G, soft_shadow(lay, 3, 0.35), anc, x + pw / 2, yy + 2, alpha=al)
                type_rgba(G, lay, anc, x + pw / 2, yy, alpha=al, blur=blur)
                x += pw + space
        return G

# ---------------------------------------------------------------- optics
def chroma_pulse(img, amt):
    if amt < 1e-4: return img
    out = img.copy()
    for ch, s in ((0, 1 + amt), (2, 1 - amt)):
        M = cv2.getRotationMatrix2D((W / 2, H * 0.42), 0, s)
        out[..., ch] = cv2.warpAffine(img[..., ch], M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out

def bloom(img, thresh=0.86, amount=0.10):
    hi = np.clip((img - thresh) / (1 - thresh), 0, 1)
    b = cv2.GaussianBlur(hi, (0, 0), 18) * 0.6 + cv2.GaussianBlur(hi, (0, 0), 60) * 0.4
    return np.clip(img + b * amount, 0, 1)

_VIG = None
def finish(img, fo, vignette=0.05, grain=0.012):
    global _VIG
    if _VIG is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r2 = ((xx - W / 2) / (W * 0.78)) ** 2 + ((yy - H * 0.45) / (H * 0.72)) ** 2
        _VIG = (1 - vignette * np.clip(r2, 0, 1.6))[..., None].astype(np.float32)
    x = img * _VIG
    rng = np.random.default_rng(fo * 7919 + 17)
    n = rng.standard_normal((H // 2, W // 2)).astype(np.float32)
    n = cv2.GaussianBlur(cv2.resize(n, (W, H), interpolation=cv2.INTER_LINEAR), (0, 0), 0.6)
    lum = x.mean(2, keepdims=True)
    x = x + n[..., None] * grain * (0.6 + 0.8 * lum * (1 - lum) * 4) / 1.4
    return np.clip(x, 0, 1)

def to_u8(x):
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)

# ---------------------------------------------------------------- audio
SR = 48000
AUDIO = os.path.join(fx.PROJECT, 'audio')

@lru_cache(None)
def sfx(name, rate=1.0):
    import scipy.io.wavfile as wf
    sr, x = wf.read(os.path.join(AUDIO, 'sfx', name + '.wav'))
    x = x.astype(np.float32)
    if np.abs(x).max() > 2: x /= 32768.0
    if x.ndim == 1: x = np.stack([x, x], 1)
    if rate != 1.0:
        n = int(len(x) / rate); idx = np.arange(n) * rate
        x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1).astype(np.float32)
    return x / (np.abs(x).max() + 1e-9)

ATTACK = load_json(os.path.join(AUDIO, 'sfx_info.json')) if os.path.exists(os.path.join(AUDIO, 'sfx_info.json')) else {}

class Mix2:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.voice = np.zeros((self.n, 2), np.float32); self.music = np.zeros((self.n, 2), np.float32)
        self.fx = np.zeros((self.n, 2), np.float32)
    def put(self, buf, x, t, db=0.0, pan=0.0, align='attack', name=None):
        """Place x so its attack (or peak) lands at t."""
        off = 0.0
        if name and align in ('attack', 'peak'):
            key = name + '.wav'
            off = ATTACK.get(key, {}).get('attack_s' if align == 'attack' else 'peak_s', 0.0)
        s = int((t - off) * SR)
        if s < 0: x = x[-s:]; s = 0
        x = x[: max(0, self.n - s)]
        g = 10 ** (db / 20)
        l, r = math.cos((pan + 1) * math.pi / 4) * 1.414, math.sin((pan + 1) * math.pi / 4) * 1.414
        buf[s: s + len(x), 0] += x[:, 0] * g * l; buf[s: s + len(x), 1] += x[:, 1] * g * r
    def fxs(self, name, t, db, pan=0.0, align='attack', rate=1.0):
        self.put(self.fx, sfx(name, rate), t, db, pan, align, name)

def process_voice(path_in, path_out):
    """Broadcast voice chain: rumble filter, de-mud, presence, air, de-ess, gentle compression."""
    import subprocess
    af = ('highpass=f=85,equalizer=f=280:t=q:w=1.1:g=-2.5,equalizer=f=3600:t=q:w=1.0:g=2.2,'
          'highshelf=f=10000:g=1.5,deesser=i=0.35,'
          'acompressor=threshold=-21dB:ratio=3:attack=6:release=90:makeup=3,alimiter=limit=0.95')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path_in, '-af', af, '-ar', str(SR), '-ac', '2', path_out], check=True)

def duck(music, voice, depth_db=7.0, attack=0.02, release=0.25):
    """Sidechain: pull the music down while the speaker talks, smoothly."""
    env = np.abs(voice).mean(1)
    win = int(0.03 * SR)
    env = np.convolve(env, np.ones(win) / win, 'same')
    act = np.clip((20 * np.log10(env + 1e-6) + 42) / 12, 0, 1)
    g = np.empty_like(act); cur = 0.0
    a_c, r_c = math.exp(-1 / (attack * SR)), math.exp(-1 / (release * SR))
    for i in range(0, len(act), 48):
        tgt = act[i]
        c = a_c ** 48 if tgt > cur else r_c ** 48
        cur = tgt + (cur - tgt) * c
        g[i:i + 48] = cur
    gain = 10 ** (-depth_db * g / 20)
    return music * gain[:, None]

def master(mix_path_raw, out_path, lufs=-14.0):
    import subprocess
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', mix_path_raw, '-af', f'loudnorm=I={lufs}:TP=-1.2:LRA=9:print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True).stderr
    js = json.loads(r[r.rfind('{'):r.rfind('}') + 1])
    af = (f"loudnorm=I={lufs}:TP=-1.2:LRA=9:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mix_path_raw, '-af', af, '-ar', str(SR), out_path], check=True)

def encode(frames_glob, audio, out, fps=FPS):
    import subprocess
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', frames_glob, '-i', audio,
                    '-vf', 'scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'film',
                    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0',
                    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], check=True)
