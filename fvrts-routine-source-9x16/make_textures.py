"""Procedural paper textures (seeded, deterministic).
paper.png  1080x1920 grey multiply layer: mottling + fibres + tooth + fine grain (255 = no darkening)
grain.png  256x256 tileable gouache grain for colour fills"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

rng = np.random.default_rng(20261007)
W, H = 1080, 1920


def periodic_blur(n, sigma):
    """gaussian blur with wrap-around (FFT) so the result tiles"""
    h, w = n.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(n) * g))


def norm(a):
    a = a - a.mean()
    return a / (a.std() + 1e-9)


# ---------- paper ----------
mot = 0.6 * norm(periodic_blur(rng.standard_normal((H, W)), 90)) + 0.4 * norm(periodic_blur(rng.standard_normal((H, W)), 22))
tooth = norm(periodic_blur(rng.standard_normal((H, W)), 1.6))
fine = norm(periodic_blur(rng.standard_normal((H, W)), 0.6))
# laid-paper-ish anisotropic tooth (slightly stretched horizontally)
small = (norm(rng.standard_normal((H // 2, W // 6))) * 30 + 128).clip(0, 255).astype(np.uint8)
aniso = norm(np.array(Image.fromarray(small).resize((W, H), Image.BICUBIC), float))

paper = 1.0 - 0.030 * (mot.clip(-3, 3) + 3) / 6 * 2 - 0.013 * tooth.clip(0, 4) - 0.006 * np.abs(fine) - 0.006 * aniso.clip(0, 3)

# fibres: short curved hairs, mostly darker, a few lighter
SS = 2
fib = Image.new('L', (W * SS, H * SS), 128)
dr = ImageDraw.Draw(fib)
for i in range(3200):
    x, y = rng.uniform(0, W * SS), rng.uniform(0, H * SS)
    L = rng.uniform(8, 70) * SS
    a = rng.uniform(0, np.pi)
    bend = rng.normal(0, 0.9)
    pts = []
    for k in range(9):
        t = k / 8
        aa = a + bend * (t - 0.5)
        pts.append((x + np.cos(aa) * L * (t - 0.5), y + np.sin(aa) * L * (t - 0.5)))
    v = int(rng.choice([96, 104, 112, 150], p=[0.3, 0.35, 0.25, 0.1]))
    dr.line(pts, fill=v, width=int(rng.choice([1, 1, 2])))
fib = np.array(fib.filter(ImageFilter.GaussianBlur(0.7 * SS)).resize((W, H), Image.LANCZOS), float)
paper += (fib - 128) / 128 * 0.10

# soft vignette-free; clamp and quantise with dithering
paper = paper.clip(0.80, 1.0)
img = (paper * 255 + rng.uniform(-0.5, 0.5, paper.shape)).round().clip(0, 255).astype(np.uint8)
Image.fromarray(img, 'L').save('site/img/paper.png', optimize=True)
print('paper', img.min(), img.mean().round(2), img.max())

# ---------- tileable gouache grain ----------
G = 256
g = 0.55 * norm(periodic_blur(rng.standard_normal((G, G)), 1.2)) + 0.35 * norm(periodic_blur(rng.standard_normal((G, G)), 5)) + 0.25 * norm(periodic_blur(rng.standard_normal((G, G)), 0.5))
g = norm(g)
gv = 1.0 - 0.10 * (g.clip(-2.5, 2.5) + 2.5) / 5
gi = (gv * 255).round().clip(0, 255).astype(np.uint8)
Image.fromarray(gi, 'L').save('site/img/grain.png', optimize=True)
print('grain', gi.min(), gi.mean().round(2), gi.max())
