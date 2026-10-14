"""Core of the edit engine: project config, timeline, sub-pixel camera, matte compositing.

The project folder comes from $AUTOEDIT_PROJECT (default: the current directory) and must contain
prep/ as written by prep.py. Images are float32 RGB in 0..1. Every camera and layer transform is a
float transform (never integer-rounded boxes), so slow moves never step.
"""
import json, os, sys, math
from functools import lru_cache
import numpy as np, cv2


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(obj, path, **kw):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, **kw)

PROJECT = os.path.abspath(os.environ.get('AUTOEDIT_PROJECT', os.getcwd()))
PREP = os.path.join(PROJECT, 'prep')

def _load_prep(name):
    path = os.path.join(PREP, name)
    if not os.path.exists(path):
        sys.exit(f'{path} not found. Run prep.py on the clip first, then point film.py at the same folder '
                 '(--project <dir> or AUTOEDIT_PROJECT=<dir>).')
    with open(path) as f:
        return json.load(f)

CFG = _load_prep('project.json')
W, H = CFG['out_w'], CFG['out_h']
SRC_W, SRC_H, SRC_FPS = CFG['src_w'], CFG['src_h'], CFG['src_fps']
EDL = _load_prep('edl.json')
WORDS = EDL['words']                    # each: w, s, e, onset (output seconds), i
CUTS = EDL['cuts']                      # [0, cut1, ..., duration]
DURATION = EDL['duration']
_faces_path = os.path.join(PREP, 'faces.json')
FACES = {int(k): v for k, v in load_json(_faces_path).items()} if os.path.exists(_faces_path) else {}
# optional second plate: a world edit of the cut, prepared by world.py import (prep/plate.json)
_plate_path = os.path.join(PREP, 'plate.json')
PLATE = load_json(_plate_path) if os.path.exists(_plate_path) else None
K0 = min(SRC_W / W, SRC_H / H)          # source px per output px at zoom 1: the frame is filled (cover fit)

# ---------------------------------------------------------------- easing
def clamp01(x): return min(1.0, max(0.0, x))
def lin(t, a, b): return clamp01((t - a) / (b - a)) if b > a else float(t >= b)
def e_out3(x): x = clamp01(x); return 1 - (1 - x) ** 3
def e_out5(x): x = clamp01(x); return 1 - (1 - x) ** 5
def e_outexpo(x): x = clamp01(x); return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)
def e_in3(x): x = clamp01(x); return x ** 3
def e_io3(x): x = clamp01(x); return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
def e_io_sine(x): x = clamp01(x); return -(math.cos(math.pi * x) - 1) / 2
def mix(a, b, k): return a + (b - a) * k

# ---------------------------------------------------------------- timeline
def word(i): return WORDS[i]
def onset(i): return WORDS[i]['onset']

def src_frame(t):
    """Source frame index shown at output time t (seconds)."""
    for m in EDL['map']:
        if m['out'][0] <= t < m['out'][1]:
            return min(m['src'][1] - 1, m['src'][0] + int((t - m['out'][0]) * SRC_FPS + 1e-6))
    return EDL['map'][-1]['src'][1] - 1

def segment(t):
    for k in range(len(CUTS) - 1):
        if CUTS[k] <= t < CUTS[k + 1]: return k
    return len(CUTS) - 2

def eyes(i):
    for d in range(8):
        for j in (i - d, i + d):
            r = FACES.get(j)
            if r and 'box' in r and r.get('leye') and r.get('reye'):
                le = np.array(r['leye'][0]) * [SRC_W, SRC_H]; re_ = np.array(r['reye'][0]) * [SRC_W, SRC_H]
                return (le + re_) / 2, float(np.linalg.norm(re_ - le))
    return np.array([SRC_W / 2, SRC_H * 0.38]), SRC_W * 0.12

@lru_cache(None)
def seg_face(k):
    """Mean eye midpoint and inter-ocular distance over a segment (source px): static per
    segment so the camera never chases micro head motion."""
    a, b = CUTS[k], CUTS[k + 1]
    pts = [eyes(src_frame(t)) for t in np.arange(a, b, 1 / SRC_FPS)]
    return np.mean([p[0] for p in pts], axis=0), float(np.mean([p[1] for p in pts]))

# ---------------------------------------------------------------- frames
@lru_cache(maxsize=8)
def _read(path, gray):
    im = cv2.imread(path, cv2.IMREAD_GRAYSCALE if gray else cv2.IMREAD_COLOR)
    if im is None: raise FileNotFoundError(path)
    return im

def load_src(i):
    return cv2.cvtColor(_read(os.path.join(PREP, 'frames', f'{i:05d}.jpg'), False), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

def load_matte(i):
    return _read(os.path.join(PREP, 'matte', f'{i:05d}.png'), True).astype(np.float32) / 255.0

def plate_frame(t):
    """World-edit frame shown at output time t. The edit follows the cut's clock, scaled by its
    measured length (edits can come back slightly short)."""
    k = int(round(t * PLATE['rate'] * PLATE['fps']))
    return min(max(k, 0), PLATE['frames'] - 1)

def _align(img, interp):
    al = PLATE.get('align') or {}
    sc, dx, dy = al.get('scale', 1.0), al.get('dx', 0.0), al.get('dy', 0.0)
    if abs(sc - 1) < 1e-3 and abs(dx) < 0.5 and abs(dy) < 0.5: return img
    M = np.float32([[sc, 0, dx], [0, sc, dy]])           # plate px -> source px
    return cv2.warpAffine(img, M, (SRC_W, SRC_H), flags=interp, borderMode=cv2.BORDER_REFLECT)

def load_plate(k):
    im = cv2.cvtColor(_read(os.path.join(PREP, 'plate', f'{k:05d}.jpg'), False), cv2.COLOR_BGR2RGB)
    return _align(im.astype(np.float32) / 255.0, cv2.INTER_CUBIC)

def load_plate_matte(k):
    m = _read(os.path.join(PREP, 'plate_matte', f'{k:05d}.png'), True).astype(np.float32) / 255.0
    return _align(m, cv2.INTER_LINEAR)

def cam_matrix(s, cx, cy):
    k = K0 / s
    return np.float32([[k, 0, cx - (W / 2) * k], [0, k, cy - (H / 2) * k]]), k

def cam_warp(img, s, cx, cy, interp=cv2.INTER_CUBIC):
    """Zoom s (1.0 = whole source frame) centred on source point (cx, cy), resampled with a float transform."""
    M, k = cam_matrix(s, cx, cy)
    if k > 1.02: img = cv2.GaussianBlur(img, (0, 0), 0.5 * math.sqrt(k * k - 1))
    return cv2.warpAffine(img, M, (W, H), flags=interp | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)

def clamp_center(s, cx, cy):
    hw, hh = W * K0 / 2 / s, H * K0 / 2 / s
    return min(max(cx, hw), SRC_W - hw), min(max(cy, hh), SRC_H - hh)

def anchor_cam(s, P):
    """Zoom about anchor P (source px): P keeps its screen position as s changes. At zoom 1 the
    frame is centred on P as far as the source allows (the whole width when the shapes match,
    a crop that follows the face when a landscape source makes a vertical edit)."""
    C0 = np.array(clamp_center(1.0, P[0], P[1])); c = np.asarray(P) + (C0 - np.asarray(P)) / s
    return (s,) + clamp_center(s, c[0], c[1])

def to_screen(p, s, cx, cy):
    k = K0 / s
    return (p[0] - cx) / k + W / 2, (p[1] - cy) / k + H / 2

def plate_and_fg(I, m):
    """Background plate B and edge-decontaminated subject colour F with B*(1-m)+F*m == I exactly.
    Change B (dim it, put type on it, relight it) and composite: no halo around the subject."""
    inv = 1.0 - m
    num = cv2.GaussianBlur(I * inv[..., None], (0, 0), 14)
    den = cv2.GaussianBlur(inv, (0, 0), 14)[..., None]
    Best = num / np.maximum(den, 1e-3)
    w = np.clip((inv - 0.90) / 0.08, 0, 1)[..., None]
    B = I * w + Best * (1 - w)
    F = np.clip((I - inv[..., None] * B) / np.maximum(m, 0.04)[..., None], 0, 1)
    return B, F

def composite(B, F, m):
    return B * (1 - m[..., None]) + F * m[..., None]

def place(canvas, lay, anchor, x, y, scale=1.0, alpha=1.0, clip=None):
    """Composite premultiplied RGBA `lay` onto float RGB `canvas` (in place); `anchor` lands at (x, y)."""
    if alpha <= 0.001 or scale <= 0.001: return canvas
    lh, lw = lay.shape[:2]
    x0 = x - anchor[0] * scale; y0 = y - anchor[1] * scale
    X0, Y0 = max(0, int(math.floor(x0)) - 1), max(0, int(math.floor(y0)) - 1)
    X1, Y1 = min(canvas.shape[1], int(math.ceil(x0 + lw * scale)) + 1), min(canvas.shape[0], int(math.ceil(y0 + lh * scale)) + 1)
    if clip is not None:
        X0, Y0 = max(X0, int(clip[0])), max(Y0, int(clip[1])); X1, Y1 = min(X1, int(clip[2])), min(Y1, int(clip[3]))
    if X1 <= X0 or Y1 <= Y0: return canvas
    M = np.float32([[1 / scale, 0, (X0 - x0) / scale], [0, 1 / scale, (Y0 - y0) / scale]])
    src = cv2.GaussianBlur(lay, (0, 0), 0.5 / scale) if scale < 0.8 else lay
    roi = cv2.warpAffine(src, M, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)) * alpha
    c = canvas[Y0:Y1, X0:X1]; c *= (1 - roi[..., 3:4]); c += roi[..., :3]
    return canvas
