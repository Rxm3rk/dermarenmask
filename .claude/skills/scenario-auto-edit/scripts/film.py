#!/usr/bin/env python3
"""A finished talking-head edit, driven by <project>/beats.json (word indices refer to prep/edl.json).

usage: python film.py {stills,frames,audio,encode,check} [seconds ...] [--project DIR] [--workers N] [--force]

  film.py stills 0.5 1.2 3.0 --project <dir>   review frames at those output times -> <dir>/out/stills
  film.py frames --project <dir>               every frame -> <dir>/out/frames
  film.py audio --project <dir>                voice chain + Scenario sound kit + music -> <dir>/out/mix.wav
  film.py encode --project <dir>               -> <dir>/out/edit.mp4 (H.264, BT.709, -14 LUFS)
  film.py check --project <dir>                re-transcribe the final mix, measure loudness, write out/sheet.jpg

The project folder is --project, else $AUTOEDIT_PROJECT, else the current directory. It must hold
prep/ (from prep.py), beats.json, and audio/ (from audio_prep.py). Fonts come from get_fonts.py.
stills, frames and audio re-render their own outputs in out/; encode will not replace an existing
out/edit.mp4 unless --force is given.

Every element is optional except captions. See references/beats.md for the schema and the reasoning
behind each default (timings, sizes, levels).
"""
import os, sys, json, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def _cli():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=['stills', 'frames', 'audio', 'encode', 'check'])
    ap.add_argument('seconds', nargs='*', type=float, help='stills only: times on the output clock')
    ap.add_argument('--project', help='project folder (default: $AUTOEDIT_PROJECT, else the current directory)')
    ap.add_argument('--workers', type=int, default=8, help='frames only: render processes (default 8)')
    ap.add_argument('--force', action='store_true', help='encode only: replace an existing out/edit.mp4')
    return ap

if __name__ == '__main__':
    # parse before the engine loads, so --help works anywhere and --project reaches fx.py
    ARGS = _cli().parse_args()
    if ARGS.command == 'stills' and not ARGS.seconds:
        _cli().error('stills needs at least one time in seconds, e.g. film.py stills 0.5 2 4')
    if ARGS.project:
        os.environ['AUTOEDIT_PROJECT'] = os.path.abspath(os.path.expanduser(ARGS.project))

import importlib.util
if any(importlib.util.find_spec(m) is None for m in ('numpy', 'cv2', 'scipy', 'PIL')):
    sys.exit('Missing Python packages. Run: pip install numpy scipy opencv-python-headless pillow')
import numpy as np, cv2
import fx, pro
W, H, lin, mix, onset = fx.W, fx.H, fx.lin, fx.mix, fx.onset
e_out3, e_out5, e_in3, e_io3 = fx.e_out3, fx.e_out5, fx.e_in3, fx.e_io3


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(obj, path, **kw):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, **kw)

P = fx.PROJECT
OUT = os.path.join(P, 'out')
if not os.path.exists(os.path.join(P, 'beats.json')):
    sys.exit(f'{os.path.join(P, "beats.json")} not found. Write it first (references/beats.md has the schema).')
try:
    BEATS = load_json(os.path.join(P, 'beats.json'))
except json.JSONDecodeError as err:
    sys.exit(f'beats.json is not valid JSON: {err}')
FPS = pro.FPS
def bpath(p): return p if os.path.isabs(p) else os.path.join(P, p)
pro.FONT_OVERRIDE.update({k: bpath(v) for k, v in (BEATS.get('fonts') or {}).items()})
_n = len(fx.WORDS)
def _check_word(i, where):
    if not isinstance(i, int) or not 0 <= i < _n:
        sys.exit(f'beats.json {where}: word {i!r} is not an index into prep/edl.json words (0 to {_n - 1}).')
for _k, _v in BEATS.items():
    for _f in ('word', 'start_word', 'land_word', 'until_word', 'from_word', 'drop_on_word'):
        if isinstance(_v, dict) and _f in _v: _check_word(_v[_f], f'"{_k}".{_f}')
for _p in BEATS.get('punches', []): _check_word(_p.get('word'), 'punches')
if (BEATS.get('hook') or {}).get('accent'): _check_word(BEATS['hook']['accent'].get('word'), 'hook.accent')
THEME = BEATS.get('theme', {})
INK = tuple(THEME.get('ink', (0.067, 0.067, 0.067)))
ACCENT = tuple(THEME.get('accent', INK))
WHITE = (0.97, 0.97, 0.97)
END_VO = fx.DURATION
EC = BEATS.get('end_card')
END = END_VO + (EC['seconds'] if EC else 0.0)
N_OUT = int(round(END * FPS))
EC_BG = tuple(EC.get('background', (0.955, 0.955, 0.955))) if EC else (0, 0, 0)
for _k in ('payoff', 'end_card'):
    _lp = (BEATS.get(_k) or {}).get('logo')
    if _lp and not os.path.exists(bpath(_lp)):
        sys.exit(f'beats.json "{_k}".logo: {bpath(_lp)} not found. Add the file, or use "text" instead of "logo".')

# ---------------------------------------------------------------- derived times
hook = BEATS.get('hook'); counter = BEATS.get('counter'); stack = BEATS.get('stack')
lights = BEATS.get('lights_down'); flick = BEATS.get('flicker'); payoff = BEATS.get('payoff')
T_HOOK = onset(hook['word']) - 0.01 if hook else None
T_CNT0 = onset(counter['start_word']) if counter else None
T_LAND = onset(counter['land_word']) + counter.get('land_offset', 0.16) if counter else None
T_STACK = onset(stack['word']) - 0.02 if stack else None
T_PAY = onset(payoff['word']) if payoff else None
T_DARK0 = onset(lights['word']) + 0.02 if lights else None
# lights come back on at until_word, else on the payoff, else they stay down to the end
T_DARK1 = (onset(lights['until_word']) if 'until_word' in lights else T_PAY if payoff else END + 1) if lights else None
T_PUSH = END_VO - 0.35
world = BEATS.get('world')
if world and not fx.PLATE:
    sys.exit('beats.json has "world" but prep/plate.json is missing. Run: python world.py import <world edit.mp4> --project <dir>')
T_WORLD = onset(world['from_word']) - 0.02 if world else None
T_WORLD_END = (onset(world['until_word']) - 0.02 if 'until_word' in world else END_VO) if world else None
WORLD_INK = tuple(world.get('ink', WHITE)) if world else WHITE
# when the headline leaves: an explicit word, else the first caption after it, else the next cut
_after = [c[0] for c in (BEATS.get('captions', {}).get('chunks') or []) if c and hook and onset(c[0]) > T_HOOK + 0.3]
T_HOOK_END = (onset(hook['until_word']) if hook and 'until_word' in hook else
              (onset(_after[0]) - 0.05 if _after else None))

# ---------------------------------------------------------------- camera: one monotone move per shot
_sz = BEATS.get('segment_zoom') or []
SEG_BASE = [_sz[k] if k < len(_sz) else (1.0 if k % 2 == 0 else 1.10) for k in range(len(fx.CUTS) - 1)]

def zoom_at(t):
    k = fx.segment(min(t, END_VO - 1e-4)); a, b = fx.CUTS[k], fx.CUTS[k + 1]
    s = SEG_BASE[k] + (0.035 * e_out3(lin(t, a, a + 0.22)) if k > 0 else 0.0) + 0.02 * lin(t, a, b)
    if counter and a <= T_LAND < b: s += 0.06 * e_out3(lin(t, T_LAND - 0.03, T_LAND + 0.10))
    for pch in BEATS.get('punches', []):
        tp = onset(pch['word']) - 0.02
        if a <= tp < b: s += pch.get('amount', 0.12) * e_out3(lin(t, tp, tp + 0.22))
    if payoff and a <= T_PAY < b: s += 0.035 * e_out3(lin(t, T_PAY, T_PAY + 0.14))
    if EC: s += 0.45 * e_in3(lin(t, T_PUSH, END_VO))
    return s, (0.30 if SEG_BASE[k] > 1.05 else 0.0)

def cam(t):
    k = fx.segment(min(t, END_VO - 1e-4)); mid, iod = fx.seg_face(k)
    s, dy = zoom_at(t)
    return fx.anchor_cam(s, (mid[0], mid[1] + dy * iod))

def head_top(t):
    k = fx.segment(min(t, END_VO - 1e-4)); mid, iod = fx.seg_face(k); s, cx, cy = cam(t)
    return fx.to_screen((mid[0], mid[1] - 2.2 * iod), s, cx, cy)

# ---------------------------------------------------------------- the set: lights down, burst back on
def dark_amount(t):
    if not lights or t < T_DARK0: return 0.0
    return e_io3(lin(t, T_DARK0, T_DARK0 + 0.75))

def set_light(B, F, t, head):
    d = dark_amount(t)
    if d <= 0: return B, F
    hx, hy = head
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r2 = (xx - hx) ** 2 + ((yy - hy) * 0.8) ** 2
    pool = 0.06 + 0.30 * np.exp(-r2 / (2 * 430.0 ** 2))
    dark = B * pool[..., None] * np.float32([1.0, 0.93, 0.85])
    if t >= T_DARK1:
        r = 2400 * e_out3(lin(t, T_DARK1, T_DARK1 + 0.42)); rr = np.sqrt(r2)
        inside = np.clip((r - rr) / 90.0, 0, 1)[..., None]
        ring = np.exp(-((rr - r) / 55.0) ** 2) * (1 - lin(t, T_DARK1, T_DARK1 + 0.45)) * 0.45
        B = np.clip(dark * (1 - inside) + np.clip(B * 1.03, 0, 1) * inside + ring[..., None], 0, 1)
        dd = 1 - lin(t, T_DARK1, T_DARK1 + 0.3)
    else:
        B = B * (1 - d) + dark * d; dd = d
    F = F * (1 - 0.14 * dd) * np.float32([1.0, 0.985, 0.96]) ** dd
    return B, F

def wall_is_dark(t): return bool(lights) and T_DARK0 <= t < T_DARK1
def in_world(t): return bool(world) and T_WORLD <= t < T_WORLD_END
def wall_ink(t): return WHITE if wall_is_dark(t) else WORLD_INK if in_world(t) else INK

def safe_y(y, half):
    """Keep a line of type (half its height above and below y) inside the frame."""
    return min(max(y, half + 36), H - half - 36)

# ---------------------------------------------------------------- type behind the head
def fit(text, kind, size, frac=0.92, tracking=0.0):
    """Largest size up to `size` at which `text` fits `frac` of the frame width."""
    w = pro.text_width(text, kind, size, tracking)
    return int(size * W * frac / w) if w > W * frac else size

def behind(t, top):
    G = pro.new_layer(); tx, ty = top
    ink = wall_ink(t)
    k0 = fx.segment(min(t, END_VO - 1e-4))
    hook_end = T_HOOK_END if T_HOOK_END is not None else fx.CUTS[fx.segment(T_HOOK) + 1] if hook else None
    if hook and fx.segment(T_HOOK) == k0 and T_HOOK - 0.05 <= t < hook_end + 0.10:
        size = fit(hook['text'], 'display', hook.get('size', 296), tracking=0.005)
        cap = pro.font('display', size).getbbox('H'); capH = cap[3] - cap[1]
        lift = 205 if (counter and stack) else 0                   # the counter lifts above the line for the stack word
        y_line = safe_y(ty + 4, capH * 0.6 + lift)
        slot = (0, y_line - capH * 0.56, W, y_line + capH * 0.56)
        t_out = T_CNT0 if counter else fx.CUTS[k0 + 1]
        out_k = e_in3(lin(t, t_out - 0.07, t_out + 0.07))
        if t < t_out + 0.08:
            lets, total = pro.letters(hook['text'], 'display', size, ink, tracking=0.005)
            for j, (lay, anc, xo) in enumerate(lets):
                tj = T_HOOK + j * 0.032; k = e_out5(lin(t, tj, tj + 0.55))
                pro.type_rgba(G, lay, anc, W / 2 + xo, y_line + (1 - k) * capH * 1.15 - out_k * capH * 1.2, clip=slot)
            acc = hook.get('accent')
            if acc:
                ta = onset(acc['word']) - 0.04
                kn = e_out3(lin(t, ta, ta + 0.26)) * (1 - e_in3(lin(t, t_out - 0.08, t_out + 0.02)))
                if kn > 0:
                    lay, anc = pro.text_layer(acc['text'], 'serif', 104, ink)
                    aw = pro.text_width(acc['text'], 'serif', 104)
                    nx = min(W / 2 + total / 2 - aw / 2 - 6, W - aw / 2 - 30)
                    pro.type_rgba(G, lay, anc, nx, y_line - capH * 0.5 - 62 + (1 - kn) * 14, alpha=kn, blur=(1 - kn) * 6)
        if counter and t >= T_CNT0 - 0.06:
            to = counter.get('to', 100); pre, suf = counter.get('prefix', ''), counter.get('suffix', '')
            v = to * e_out3(lin(t, T_CNT0, T_LAND - 0.02))
            kin = e_out5(lin(t, T_CNT0 - 0.06, T_CNT0 + 0.12))
            up = e_out5(lin(t, T_STACK, T_STACK + 0.32)) if stack else 0.0
            yc = mix(y_line + (1 - kin) * capH * 1.2, y_line - lift, up)
            size0 = counter.get('size', 330)
            wid = pro.odometer_width(size0, to, pre, suf)
            if wid > W * 0.9: size0 = int(size0 * W * 0.9 / wid)
            sub = pro.new_layer()
            pro.odometer(sub, v, W / 2, yc, int(size0 * mix(1.0, 0.56, up)), ink, to=to, prefix=pre, suffix=suf)
            if up < 0.02:
                mask = np.zeros((H, 1, 1), np.float32); mask[int(max(0, slot[1])):int(min(H, slot[3]))] = 1
                sub = sub * mask
            G = G * (1 - sub[..., 3:4]) + sub
        if stack and t >= T_STACK:
            ssz = fit(stack['text'], 'display', stack.get('size', 196), tracking=0.01)
            lets, _ = pro.letters(stack['text'], 'display', ssz, ACCENT if not (wall_is_dark(t) or in_world(t)) else ink, tracking=0.01)
            for j, (l, a, xo) in enumerate(lets):
                t0 = T_STACK + 0.07 + j * 0.034; k = e_out3(lin(t, t0, t0 + 0.16))
                if k > 0: pro.type_rgba(G, l, a, W / 2 + xo, y_line + 6 + (1 - k) * 22, alpha=min(1, k * 1.6), blur=(1 - k) * 4)
    if hook and T_HOOK_END is not None:
        ko = e_in3(lin(t, hook_end - 0.14, hook_end + 0.08))
        if ko > 0: G = cv2.GaussianBlur(G, (0, 0), 0.5 + 6 * ko) * (1 - ko)
    if flick and onset(flick['word']) <= t < (T_PAY if payoff else onset(flick['word']) + 0.7):
        t0 = onset(flick['word']); step = flick.get('step', 0.105)
        j = min(int((t - t0) / step), len(flick['words']) - 1); wd = flick['words'][j]
        size = fit(wd, 'display', 210 if len(wd) < 8 else 150, 0.9); tj = t0 + j * step
        a = 1 - lin(t, (T_PAY if payoff else t0 + 0.7) - 0.14, (T_PAY if payoff else t0 + 0.7) - 0.02)
        lay, anc = pro.text_layer(wd, 'display', size, ink, -0.01)
        pro.type_rgba(G, lay, anc, W / 2, safe_y(ty - 5, size * 0.45), scale=mix(1.07, 1.0, e_out3(lin(t, tj, tj + 0.08))), alpha=a)
    if payoff and (payoff.get('logo') or payoff.get('text')) and T_PAY + 0.10 <= t < T_PAY + payoff.get('hold', 2.6) + 0.4:
        hold_end = T_PAY + payoff.get('hold', 2.6)
        L = pro.new_layer()
        if payoff.get('logo'):
            pro.draw_logo(L, t, T_PAY + 0.10, W / 2, LOGO_Y(), payoff.get('logo_height', 150), bpath(payoff['logo']),
                          ink=tuple(payoff['ink']) if payoff.get('ink') else None)
        else:                                                    # a word built letter by letter where a logo would sit
            tsz = fit(payoff['text'], 'display', payoff.get('size', 170), 0.9, 0.01)
            pink = tuple(payoff['ink']) if payoff.get('ink') else wall_ink(T_PAY + 0.2)
            lets, _ = pro.letters(payoff['text'], 'display', tsz, pink, tracking=0.01)
            for j, (l, a, xo) in enumerate(lets):
                t0 = T_PAY + 0.10 + j * 0.03; k = e_out5(lin(t, t0, t0 + 0.3))
                if k > 0: pro.type_rgba(L, l, a, W / 2 + xo, LOGO_Y() + (1 - k) * 26, alpha=min(1, k * 1.5), blur=(1 - k) * 5)
        G = G + L * (1 - e_in3(lin(t, hold_end, hold_end + 0.35)))
    return G

_LY = []
def LOGO_Y():
    """One screen height for the payoff mark, taken where it lands, so it never jumps at a cut."""
    if not _LY:
        half = (payoff.get('logo_height', 150) if payoff.get('logo') else payoff.get('size', 170) * 0.4) / 2
        _LY.append(safe_y(head_top(T_PAY + 0.4)[1] - 175, half))
    return _LY[0]

# ---------------------------------------------------------------- captions
cap = BEATS.get('captions', {})
WORDS = [dict(w, i=i) for i, w in enumerate(fx.WORDS)]
CHUNKS = [[WORDS[i] for i in c] for c in cap.get('chunks', [])]
def chunk_spans():
    sp = []
    for ci, ch in enumerate(CHUNKS):
        seg = fx.segment(ch[0]['onset']); a = max(ch[0]['onset'] - 0.04, fx.CUTS[seg]); b = fx.CUTS[seg + 1]
        if ci + 1 < len(CHUNKS) and fx.segment(CHUNKS[ci + 1][0]['onset']) == seg: b = CHUNKS[ci + 1][0]['onset'] - 0.04
        b = min(b, ch[-1]['e'] + 0.6)
        if payoff and ch[0]['onset'] < T_PAY <= b: b = T_PAY - 0.02
        sp.append((a, b))
    return sp
for _c in cap.get('chunks', []):
    for _i in _c: _check_word(_i, 'captions.chunks')
CAPS = pro.Captions(CHUNKS, emphasis=cap.get('emphasis', []), spans=chunk_spans(), size=cap.get('size', 74),
                    y=cap.get('y', int(H * 0.722)), space=cap.get('space', True), keep_punctuation=cap.get('keep_punctuation', False))

# ---------------------------------------------------------------- frame
def end_card(t):
    img = np.full((H, W, 3), EC_BG, np.float32)
    ink = tuple(EC['ink']) if EC.get('ink') else INK
    G = pro.new_layer(); y = H / 2 - 20
    if EC.get('logo'):
        lh = EC.get('logo_height', 176)
        pro.draw_logo(G, t, END_VO + 0.02, W / 2, y - (70 if EC.get('text') else 0), lh, bpath(EC['logo']),
                      ink=tuple(EC['ink']) if EC.get('ink') else None)
        y += lh / 2 + 40
    if EC.get('text'):                                           # a line of type: a handle, a call to action
        tsz = fit(EC['text'], 'sans', EC.get('size', 64), 0.86)
        k = e_out3(lin(t, END_VO + 0.12, END_VO + 0.5))
        lay, anc = pro.text_layer(EC['text'], 'sans', tsz, ink)
        pro.type_rgba(G, lay, anc, W / 2, y + (1 - k) * 16, alpha=k, blur=(1 - k) * 4)
    return pro.over(img, G)

def plates(t, s, cx, cy):
    """Picture and person matte at t: the source, or the world edit inside the world window."""
    if in_world(t):
        k = fx.plate_frame(t); I0, m0 = fx.load_plate(k), fx.load_plate_matte(k)
    else:
        i = fx.src_frame(t); I0, m0 = fx.load_src(i), fx.load_matte(i)
    return fx.cam_warp(I0, s, cx, cy), np.clip(fx.cam_warp(m0, s, cx, cy, cv2.INTER_LINEAR), 0, 1)

def render_at(t):
    if t >= END_VO: return end_card(t)
    s, cx, cy = cam(t)
    I, m = plates(t, s, cx, cy)
    B, F = fx.plate_and_fg(I, m)
    k = fx.segment(t); mid, iod = fx.seg_face(k)
    head = fx.to_screen(mid, s, cx, cy); top = head_top(t)
    B, F = set_light(B, F, t, head)
    B = pro.composite_graphics_on_wall(B, behind(t, top), m)
    out = fx.composite(B, F, m)
    if world and world.get('flash', 0.12) > 0:                  # a short light flash covers the switch, both ways
        for tw in (T_WORLD, T_WORLD_END if T_WORLD_END < END_VO else None):
            if tw is not None and tw - 0.03 <= t < tw + world.get('flash', 0.12):
                wf_ = min(e_out3(lin(t, tw - 0.03, tw)), 1 - lin(t, tw, tw + world.get('flash', 0.12)))
                out = out * (1 - 0.85 * wf_) + 0.85 * wf_
    O = pro.new_layer(); CAPS.draw(O, t); out = pro.over(out, O)
    if EC:
        fe = e_in3(lin(t, T_PUSH + 0.12, END_VO))
        if fe > 0: out = out * (1 - fe) + np.float32(EC_BG) * fe
    return out

def window(t):
    bounds = sorted(set(fx.CUTS + [END_VO, END] + ([T_WORLD, T_WORLD_END] if world else [])))
    a = max([b for b in bounds if b <= t] + [0.0]); b = min([b for b in bounds if b > t] + [END])
    return a, b - 1e-4

def chroma(t):
    amt = 0.0
    for th, amp in [(T_LAND, 0.0055), (T_PAY, 0.006)]:
        if th is not None and t >= th: amt += amp * math.exp(-(t - th) / 0.09)
    return amt

def render(fo, samples=4):
    t = fo / FPS; a, b = window(t); acc = None
    for j in range(samples):
        tj = min(max(t + ((j + 0.5) / samples - 0.5) * (0.5 / FPS), a), b)
        x = render_at(tj); acc = x if acc is None else acc + x
    out = pro.chroma_pulse(acc / samples, chroma(t))
    out = pro.bloom(out, 0.88, 0.08)
    return pro.to_u8(pro.finish(out, fo))

def save(fo, path):
    cv2.imwrite(path, cv2.cvtColor(render(fo), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])

def _work(fo):
    save(fo, os.path.join(OUT, 'frames', f'{fo:05d}.jpg')); return fo

# ---------------------------------------------------------------- sound
def build_audio():
    import scipy.io.wavfile as wf
    os.makedirs(OUT, exist_ok=True)
    vp = os.path.join(OUT, 'voice.wav'); pro.process_voice(os.path.join(fx.PREP, 'cut_audio.wav'), vp)
    _, v = wf.read(vp); v = v.astype(np.float32); v = v / 32768.0 if np.abs(v).max() > 2 else v
    mx = pro.Mix2(END); mx.voice[: min(len(v), mx.n)] = v[: mx.n] * (0.80 / (np.abs(v).max() + 1e-9))
    have = set(n[:-4] for n in os.listdir(os.path.join(P, 'audio', 'sfx')) if n.endswith('.wav')) if os.path.isdir(os.path.join(P, 'audio', 'sfx')) else set()
    def F(name, t, db, pan=0.0, align='attack', rate=1.0):
        if name in have and t is not None and 0 <= t < END: mx.fxs(name, t, db, pan, align, rate)
    mus_p = os.path.join(P, 'audio', 'music.wav')
    if os.path.exists(mus_p):
        mi = load_json(os.path.join(P, 'audio', 'music_info.json'))
        mu = BEATS.get('music', {})
        drop_t = onset(mu['drop_on_word']) if 'drop_on_word' in mu else (T_PAY if payoff else END_VO * 0.7)
        mx.put(mx.music, _music(mus_p), drop_t - mi['drop_s'], 0.0, align='none')
        pre, post = mu.get('under_voice_db', [18, 15])
        tt = np.arange(mx.n) / pro.SR; kk = np.clip((tt - (drop_t - 0.03)) / 0.06, 0, 1)
        g_pre, g_post = -5.5 - (pre - 18), -15.5 - (post - 15)          # calibrated on a voice peaking at 0.8: lands ~pre/post dB under it
        g = g_pre + (g_post - g_pre) * kk
        fade = np.ones(mx.n, np.float32); fs = int((END - 0.45) * pro.SR); fade[fs:] = np.linspace(1, 0, mx.n - fs) ** 2
        mx.music *= (10 ** (g / 20) * fade)[:, None].astype(np.float32)
        mx.music = pro.duck(mx.music, mx.voice, depth_db=10.0)
    if hook: F('swipe', T_HOOK, -18, -0.2)
    if hook and hook.get('accent'): F('whoosh_air', onset(hook['accent']['word']) - 0.04, -26, 0.4)
    if counter:
        F('odometer', T_CNT0 - 0.04, -13); F('punch', T_LAND, -7); F('boom', T_LAND, -10, align='peak'); F('whoosh_sub', T_LAND - 0.02, -15, align='peak')
    if stack:
        for j in range(len(stack['text'])): F('key_tap', T_STACK + 0.07 + j * 0.034, -21, -0.5 + j * 0.12, rate=0.94 + 0.015 * j)
    for j, c in enumerate(fx.CUTS[1:-1]): F('whoosh_air' if j % 2 == 0 else 'swipe', c, -17, 0.3 if j % 2 else -0.3, align='peak')
    for pch in BEATS.get('punches', []): F('whoosh_sub', onset(pch['word']) + 0.02, -16, -0.2, align='peak')
    if lights:
        F('lights_off', T_DARK0 + 0.01, -10, align='peak'); F('riser', T_DARK1 - 0.03, -13, align='peak')
    if flick:
        for j in range(len(flick['words'])): F('key_tap', onset(flick['word']) + j * flick.get('step', 0.105), -19, 0.3 if j % 2 else -0.3)
    if payoff:
        F('boom', T_PAY, -8, align='peak'); F('punch', T_PAY, -12); F('shimmer', T_PAY + 0.40, -14)
    if world: F('portal', T_WORLD, -15, align='peak')
    if EC: F('whoosh_sub', END_VO - 0.08, -11, align='peak'); F('shimmer', END_VO + 0.64, -15)
    raw = os.path.join(OUT, 'mix_raw.wav')
    wf.write(raw, pro.SR, (mx.voice + mx.music + mx.fx).astype(np.float32))
    pro.master(raw, os.path.join(OUT, 'mix.wav'))

def _music(path):
    import scipy.io.wavfile as wf
    sr, x = wf.read(path); x = x.astype(np.float32)
    if np.abs(x).max() > 2: x /= 32768.0
    if x.ndim == 1: x = np.stack([x, x], 1)
    return x / (np.abs(x).max() + 1e-9)

def check():
    """The cheap verification: every word survives the mix, loudness, a contact sheet to look at."""
    import subprocess, re as _re
    import prep as _prep
    out = os.path.join(OUT, 'edit.mp4')
    if not os.path.exists(out): sys.exit(f'{out} not found. Run film.py encode first.')
    w16 = os.path.join(OUT, 'check16k.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-vn', '-ar', '16000', '-ac', '1', w16], check=True)
    lang = None
    sj = os.path.join(fx.PREP, 'source.json')
    if os.path.exists(sj): lang = load_json(sj).get('language')
    A, B = _prep.norm_words(fx.WORDS), _prep.norm_words(_prep.transcribe(w16, lang, quiet=True))
    if ''.join(A) == ''.join(B): print('WORDS the final mix transcribes to the cut word for word.')
    else: print(f'WORDS DIFFER: cut {" ".join(A)!r} / mix {" ".join(B)!r}. An effect or the music may be masking a word.')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    li = _re.findall(r'I:\s+(-?[\d.]+) LUFS', r); tp = _re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)
    print(f'LOUDNESS integrated {li[-1] if li else "?"} LUFS (target -14), true peak {tp[-1] if tp else "?"} dBFS (keep under -1)')
    n, cols = 12, (6 if H > W else 4)
    sheet = os.path.join(OUT, 'sheet.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-vf',
                    f'fps={n / END:.4f},scale={270 if H > W else 480}:-2,tile={cols}x{math.ceil(n / cols)}',
                    '-frames:v', '1', sheet], check=True)
    print(f'{sheet}  (look at it, then at full-size stills around every cut and switch)')

if __name__ == '__main__':
    cmd = ARGS.command
    if cmd == 'stills':
        os.makedirs(os.path.join(OUT, 'stills'), exist_ok=True)
        for a in ARGS.seconds:
            path = os.path.join(OUT, 'stills', f't{a:05.2f}.jpg'); save(int(round(a * FPS)), path); print(path)
    elif cmd == 'frames':
        from multiprocessing import Pool
        import shutil
        # a shorter render must not leave an earlier render's tail for encode to pick up
        shutil.rmtree(os.path.join(OUT, 'frames'), ignore_errors=True); os.makedirs(os.path.join(OUT, 'frames'))
        print(f'rendering {N_OUT} frames into {os.path.join(OUT, "frames")} (earlier renders there are replaced)', flush=True)
        with Pool(ARGS.workers) as p:
            for k, _ in enumerate(p.imap_unordered(_work, range(N_OUT), chunksize=3)):
                if k % 60 == 0: print('frame', k, '/', N_OUT, flush=True)
    elif cmd == 'audio':
        build_audio()
        print(os.path.join(OUT, 'mix.wav'))
    elif cmd == 'check':
        check()
    elif cmd == 'encode':
        out = os.path.join(OUT, 'edit.mp4')
        if os.path.exists(out) and not ARGS.force:
            sys.exit(f'{out} exists. Move it aside or pass --force to replace it.')
        for need in (os.path.join(OUT, 'frames', f'{0:05d}.jpg'), os.path.join(OUT, 'mix.wav')):
            if not os.path.exists(need):
                sys.exit(f'{need} not found. Run film.py frames and film.py audio first.')
        pro.encode(os.path.join(OUT, 'frames', '%05d.jpg'), os.path.join(OUT, 'mix.wav'), out)
        print(out)
