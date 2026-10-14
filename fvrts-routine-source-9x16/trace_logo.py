"""Trace the client's fvrts wordmark (transparent PNG) into closed outline polygons so the
logo can be drawn by the same boiling brush renderer as the rest of the film.
site/img/logo_src.png -> site/logo.json  (points in logo px, origin at the visual centre)"""
import cv2, json, numpy as np

im = cv2.imread('site/img/logo_src.png', cv2.IMREAD_UNCHANGED)
a = im[..., 3]
_, m = cv2.threshold(a, 127, 255, cv2.THRESH_BINARY)
cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
H, W = m.shape
ys, xs = np.nonzero(m)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
out = []
for i, c in enumerate(cnts):
    c = c[:, 0, :].astype(float)
    if cv2.contourArea(c.astype(np.float32)) < 200: continue
    # uniform resample along the contour (every ~11 px) so Catmull-Rom stays on the original edge
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(np.vstack([c, c[:1]]), axis=0).T))]
    L = d[-1]; n = max(24, int(L / 11))
    s = np.linspace(0, L, n, endpoint=False)
    cc = np.vstack([c, c[:1]])
    px = np.interp(s, d, cc[:, 0]); py = np.interp(s, d, cc[:, 1])
    hole = hier[0][i][3] >= 0
    bx = (c[:, 0].min() + c[:, 0].max()) / 2
    out.append({'hole': bool(hole), 'cx': round(bx - cx, 1), 'pts': [[round(x - cx, 1), round(y - cy, 1)] for x, y in zip(px, py)]})
out.sort(key=lambda o: o['cx'])
json.dump({'w': int(xs.max() - xs.min()), 'h': int(ys.max() - ys.min()), 'paths': out}, open('site/logo.json', 'w'))
print('contours', len(out), [(o['hole'], len(o['pts']), o['cx']) for o in out], 'bbox', xs.max() - xs.min(), ys.max() - ys.min())
