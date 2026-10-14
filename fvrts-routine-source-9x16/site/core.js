// Core: math, seeded noise, an affine matrix stack, and the hand-drawn renderer
// (variable-width brush strokes with line boil, off-register fills, cel-shade clips, boiling lettering).
// Everything is a pure function of the global frame state G (set once per frame by seek()).

export const W = 1080, H = 1920, FPS = 24;
export const G = { f: 0, boil: 0, ctx: null, grain: null, boilAmp: 1, lw: 1, cam: [1, 0, 0, 1, 0, 0] };

// ---------------- math ----------------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const sstep = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2, deg = Math.PI / 180;
export const E = {
  lin: t => t, in2: t => t * t, in3: t => t * t * t, out2: t => 1 - (1 - t) ** 2, out3: t => 1 - (1 - t) ** 3,
  out4: t => 1 - (1 - t) ** 4, io2: t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  io3: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2, sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.9) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  inBack: (t, s = 1.7) => (s + 1) * t ** 3 - s * t * t,
};
// keyframes [[f, v, ease?], ...]
export function kf(f, keys, ease = 'io2') {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    if (f <= f1) { const [f0, v0] = keys[i - 1]; return v0 + (v1 - v0) * E[e || ease]((f - f0) / (f1 - f0)); }
  }
  return keys[keys.length - 1][1];
}
// stepped keys (cel timing: value holds until the next key) [[f, v], ...]
export function steps(f, keys) {
  let v = keys[0][1];
  for (const k of keys) if (f >= k[0]) v = k[1];
  return v;
}
// damped spring 0→1 (overshoots), t in frames
export const spring = (t, k = 0.2, w = 0.5) => t <= 0 ? 0 : 1 - Math.exp(-k * t) * Math.cos(w * t);
// decaying wobble, t in frames
export const wob = (t, k = 0.12, w = 0.7) => t <= 0 ? 0 : Math.exp(-k * t) * Math.sin(w * t);
// timing: animate on 2s / 3s (sample the clock on even frames)
export const on2 = f => f - (((f % 2) + 2) % 2);
export const on3 = f => f - (((f % 3) + 3) % 3);

// integer hash → [0,1)
export function hash(i, s = 0) {
  let h = Math.imul((i | 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(((s | 0) + 0x632BE5AB) | 0, 0xC2B2AE35);
  h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D); h ^= h >>> 15; h = Math.imul(h, 0x846CA68B); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const hs = (i, s = 0) => hash(i, s) * 2 - 1;   // [-1,1)
// smooth 1D / 2D value noise in [-1,1]
export function vn(x, seed = 0) {
  const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t);
  return lerp(hs(i, seed), hs(i + 1, seed), u);
}
export function vn2(x, y, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j;
  const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
  const k = seed * 7919;
  const a = hs(i + j * 57731, k), b = hs(i + 1 + j * 57731, k), c = hs(i + (j + 1) * 57731, k), d = hs(i + 1 + (j + 1) * 57731, k);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

// ---------------- affine matrix stack ----------------
// m = [a, b, c, d, e, f]  (x' = a x + c y + e,  y' = b x + d y + f)
let M = [1, 0, 0, 1, 0, 0];
const stack = [];
export const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const D = {
  push() { stack.push(M); }, pop() { M = stack.pop(); },
  reset() { M = G.cam.slice(); stack.length = 0; },
  abs() { M = [1, 0, 0, 1, 0, 0]; },
  get m() { return M; }, set m(v) { M = v; },
  t(x, y) { M = mul(M, [1, 0, 0, 1, x, y]); return D; },
  r(a) { const c = Math.cos(a), s = Math.sin(a); M = mul(M, [c, s, -s, c, 0, 0]); return D; },
  s(x, y = x) { M = mul(M, [x, 0, 0, y, 0, 0]); return D; },
  // stretch by k along direction angle `a` (smears, squash & stretch); keeps area if `keep`
  st(a, k, keep = true) {
    const q = keep ? 1 / Math.sqrt(Math.max(0.05, k)) : 1;
    D.r(a); D.s(k, q); D.r(-a); return D;
  },
  ap(x, y) { return [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]; },
  get sc() { return Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])); },
  setCtx() { G.ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); },
};

// ---------------- curves ----------------
// centripetal Catmull-Rom through pts (local coords), sampled every `step` px
function crSeg(p0, p1, p2, p3, n, out) {
  const tj = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-3;
  const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
  for (let k = 0; k < n; k++) {
    const t = t1 + (t2 - t1) * k / n;
    const A1x = (t1 - t) / (t1 - t0) * p0[0] + (t - t0) / (t1 - t0) * p1[0], A1y = (t1 - t) / (t1 - t0) * p0[1] + (t - t0) / (t1 - t0) * p1[1];
    const A2x = (t2 - t) / (t2 - t1) * p1[0] + (t - t1) / (t2 - t1) * p2[0], A2y = (t2 - t) / (t2 - t1) * p1[1] + (t - t1) / (t2 - t1) * p2[1];
    const A3x = (t3 - t) / (t3 - t2) * p2[0] + (t - t2) / (t3 - t2) * p3[0], A3y = (t3 - t) / (t3 - t2) * p2[1] + (t - t2) / (t3 - t2) * p3[1];
    const B1x = (t2 - t) / (t2 - t0) * A1x + (t - t0) / (t2 - t0) * A2x, B1y = (t2 - t) / (t2 - t0) * A1y + (t - t0) / (t2 - t0) * A2y;
    const B2x = (t3 - t) / (t3 - t1) * A2x + (t - t1) / (t3 - t1) * A3x, B2y = (t3 - t) / (t3 - t1) * A2y + (t - t1) / (t3 - t1) * A3y;
    out.push([(t2 - t) / (t2 - t1) * B1x + (t - t1) / (t2 - t1) * B2x, (t2 - t) / (t2 - t1) * B1y + (t - t1) / (t2 - t1) * B2y]);
  }
}
// returns screen-space samples {x, y, s, L}
export function sample(pts, closed = false, sharp = false, step = 3.2) {
  const P = pts.map(p => D.ap(p[0], p[1]));
  const n = P.length, out = [];
  if (n < 2) return null;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p1 = P[i], p2 = P[(i + 1) % n];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.max(1, Math.ceil(len / step));
    if (sharp) { for (let j = 0; j < k; j++) out.push([lerp(p1[0], p2[0], j / k), lerp(p1[1], p2[1], j / k)]); }
    else {
      const p0 = closed ? P[(i - 1 + n) % n] : (i === 0 ? [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]] : P[i - 1]);
      const p3 = closed ? P[(i + 2) % n] : (i + 2 < n ? P[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]]);
      crSeg(p0, p1, p2, p3, k, out);
    }
  }
  if (!closed) out.push(P[n - 1]);
  const m = out.length, x = new Float64Array(m), y = new Float64Array(m), s = new Float64Array(m);
  let L = 0;
  for (let i = 0; i < m; i++) {
    x[i] = out[i][0]; y[i] = out[i][1];
    if (i) L += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
    s[i] = L;
  }
  if (closed) L += Math.hypot(x[0] - x[m - 1], y[0] - y[m - 1]);
  return { x, y, s, L, closed };
}
// boil: displace samples with smooth noise along arc length (periodic for closed curves)
function boil(c, seed, amp, lam) {
  if (amp <= 0) return c;
  const b = G.boil, k1 = seed * 4 + b * 2 + 11, k2 = k1 + 1;
  const ox = hs(seed * 13 + b, 77) * amp * 0.45, oy = hs(seed * 13 + b, 78) * amp * 0.45;
  const n = c.x.length;
  if (c.closed) {
    const R = c.L / (TAU * lam);
    for (let i = 0; i < n; i++) {
      const a = c.s[i] / c.L * TAU, cx = R * Math.cos(a), cy = R * Math.sin(a);
      c.x[i] += amp * vn2(cx + 50, cy, k1) + ox; c.y[i] += amp * vn2(cx, cy + 50, k2) + oy;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const u = c.s[i] / lam;
      c.x[i] += amp * vn(u, k1) + ox; c.y[i] += amp * vn(u + 31.7, k2) + oy;
    }
  }
  return c;
}

// ---------------- brush stroke ----------------
// pts: local control points. o: {w, col, seed, amp, lam, taper:[a,b] (px or fraction<1), trim:[a,b], closed, sharp, alpha, abs, wf}
export function line(pts, o = {}) {
  const ctx = G.ctx;
  const c = sample(pts, !!o.closed, !!o.sharp);
  if (!c || c.L < 0.5) return;
  const seed = o.seed ?? 1, amp = (o.amp ?? 2.1) * G.boilAmp, lam = o.lam ?? 70;
  boil(c, seed, amp, lam);
  let n = c.x.length;
  let X = c.x, Y = c.y, S = c.s, L = c.L;
  if (c.closed) { // close the loop with a small overlap so it reads as one hand-drawn line
    const ov = Math.min(n - 1, Math.max(2, Math.round(n * (o.overlap ?? 0.04))));
    const X2 = new Float64Array(n + ov + 1), Y2 = new Float64Array(n + ov + 1), S2 = new Float64Array(n + ov + 1);
    for (let i = 0; i <= n + ov; i++) { const j = i % n; X2[i] = X[j]; Y2[i] = Y[j]; }
    let l = 0; for (let i = 0; i <= n + ov; i++) { if (i) l += Math.hypot(X2[i] - X2[i - 1], Y2[i] - Y2[i - 1]); S2[i] = l; }
    X = X2; Y = Y2; S = S2; n = X.length; L = l;
  }
  // trim (write-on): keep [a,b] of the length
  let i0 = 0, i1 = n - 1;
  if (o.trim) {
    const a = clamp(o.trim[0]) * L, b = clamp(o.trim[1]) * L;
    if (b - a < 0.5) return;
    while (i0 < n - 1 && S[i0 + 1] < a) i0++;
    while (i1 > 0 && S[i1 - 1] > b) i1--;
  }
  const m = i1 - i0 + 1;
  if (m < 2) return;
  const sc = o.abs ? 1 : D.sc;
  const w0 = (o.w ?? 6) * sc * (o.abs ? 1 : G.lw);
  const Ls = S[i1] - S[i0];
  let ta = o.taper ? o.taper[0] : (c.closed ? 0.12 : 0.3), tb = o.taper ? o.taper[1] : (c.closed ? 0.12 : 0.3);
  if (ta < 1) ta *= Ls; if (tb < 1) tb *= Ls;
  ta = Math.min(ta, Ls * 0.5); tb = Math.min(tb, Ls * 0.5);
  const lx = new Float64Array(m), ly = new Float64Array(m), rx = new Float64Array(m), ry = new Float64Array(m), wv = new Float64Array(m);
  const k3 = seed * 4 + G.boil * 2 + 19;
  for (let k = 0; k < m; k++) {
    const i = i0 + k, s = S[i] - S[i0];
    const ip = Math.max(i0, i - 1), inx = Math.min(i1, i + 1);
    let tx = X[inx] - X[ip], ty = Y[inx] - Y[ip];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    let w = w0 * (1 + (o.pv ?? 0.24) * vn(S[i] / 46, k3) + 0.07 * vn(S[i] / 4.5, k3 + 5));
    if (ta > 0) w *= 0.12 + 0.88 * sstep(s / ta);
    if (tb > 0) w *= 0.12 + 0.88 * sstep((Ls - s) / tb);
    if (o.wf) w *= o.wf(s / Ls);
    w = Math.max(0.35, w) * 0.5;
    wv[k] = w;
    lx[k] = X[i] - ty * w; ly[k] = Y[i] + tx * w; rx[k] = X[i] + ty * w; ry[k] = Y[i] - tx * w;
  }
  ctx.beginPath();
  ctx.moveTo(lx[0], ly[0]);
  for (let k = 1; k < m; k++) ctx.lineTo(lx[k], ly[k]);
  { const k = m - 1, a = Math.atan2(ly[k] - ry[k], lx[k] - rx[k]); ctx.arc(X[i0 + k], Y[i0 + k], wv[k], a, a - Math.PI, true); }
  for (let k = m - 1; k >= 0; k--) ctx.lineTo(rx[k], ry[k]);
  { const a = Math.atan2(ry[0] - ly[0], rx[0] - lx[0]); ctx.arc(X[i0], Y[i0], wv[0], a, a - Math.PI, true); }
  ctx.closePath();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = (o.alpha ?? 1) * G.alpha;
  ctx.fillStyle = o.col || INK;
  ctx.fill('nonzero');
  ctx.restore();
}
G.alpha = 1;
export let INK = '#1D1418';
export const setInk = c => { INK = c; };

// colour mixing (hex in, hex out), cached
const rgbCache = {};
const toRgb = h => rgbCache[h] || (rgbCache[h] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
export function mix(a, b, t) {
  t = clamp(t); if (t <= 0) return a; if (t >= 1) return b;
  const A = toRgb(a), B = toRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------------- fills ----------------
// pts: local polygon (smooth unless sharp). o: {col, seed, amp, off:[dx,dy] screen px, holes:[pts...], grain, alpha, sharp}
function pathOf(pts, closed, sharp, seed, amp, lam, off) {
  const c = sample(pts, closed, sharp);
  if (!c) return null;
  boil(c, seed, amp, lam);
  const ctx = G.ctx;
  ctx.moveTo(c.x[0] + off[0], c.y[0] + off[1]);
  for (let i = 1; i < c.x.length; i++) ctx.lineTo(c.x[i] + off[0], c.y[i] + off[1]);
  ctx.closePath();
  return c;
}
const offOf = (o, seed) => {
  const b = G.boil, sc = o.abs ? 1 : Math.min(2.5, D.sc);
  return o.off ? [o.off[0] * sc + hs(seed + b * 3, 5) * 1.2, o.off[1] * sc + hs(seed + b * 3, 6) * 1.2] : [0, 0];
};
export function fill(pts, o = {}) {
  const ctx = G.ctx;
  const seed = o.seed ?? 3, amp = (o.amp ?? 2.4) * G.boilAmp, lam = o.lam ?? 80;
  const b = G.boil;
  const off = offOf(o, seed);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  pathOf(pts, true, !!o.sharp, seed, amp, lam, off);
  if (o.holes) o.holes.forEach((h, i) => pathOf(h, true, !!o.sharp, seed + 100 + i, amp, lam, off));
  ctx.globalAlpha = (o.alpha ?? 1) * G.alpha;
  ctx.fillStyle = o.col || '#fff';
  const rule = o.holes ? 'evenodd' : 'nonzero';
  ctx.fill(rule);
  if ((o.grain ?? 0.55) > 0 && G.grain) {
    G.grain.setTransform(new DOMMatrix([1, 0, 0, 1, Math.floor(hash(seed, b) * 256), Math.floor(hash(seed, b + 9) * 256)]));
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = (o.alpha ?? 1) * (o.grain ?? 0.55) * G.alpha;
    ctx.fillStyle = G.grain;
    ctx.fill(rule);
  }
  ctx.restore();
}
// clip subsequent drawing to the same boiled outline a fill() with these options would produce.
// Call inside ctx.save()/ctx.restore() (use withClip).
export function clipTo(pts, o = {}) {
  const ctx = G.ctx;
  const seed = o.seed ?? 3, amp = (o.amp ?? 2.4) * G.boilAmp, lam = o.lam ?? 80;
  const off = offOf(o, seed);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  pathOf(pts, true, !!o.sharp, seed, amp, lam, off);
  ctx.clip();
}
export function withClip(pts, o, fn) {
  G.ctx.save(); clipTo(pts, o); fn(); G.ctx.restore();
}

// ---------------- shape helpers (local coords) ----------------
export const ell = (cx, cy, rx, ry, n = 14, a0 = 0) => Array.from({ length: n }, (_, i) => {
  const a = a0 + i / n * TAU; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
});
export const arcPts = (cx, cy, rx, ry, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => {
  const a = lerp(a0, a1, i / n); return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
});
// rounded rectangle (x0,y0)-(x1,y1); r = corner radius (or [tl,tr,br,bl]); k points per corner
export function rrect(x0, y0, x1, y1, r, k = 4) {
  const R = Array.isArray(r) ? r : [r, r, r, r];
  const P = [];
  const corner = (cx, cy, rr, a0) => { for (let i = 0; i <= k; i++) { const a = a0 + i / k * Math.PI / 2; P.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } };
  corner(x1 - R[1], y0 + R[1], R[1], -Math.PI / 2);
  corner(x1 - R[2], y1 - R[2], R[2], 0);
  corner(x0 + R[3], y1 - R[3], R[3], Math.PI / 2);
  corner(x0 + R[0], y0 + R[0], R[0], Math.PI);
  return P;
}
// superellipse centred at (cx,cy), half sizes a,b, exponent e (2 = ellipse, 4+ = squircle)
export function squircle(cx, cy, a, b, e = 4, n = 24, a0 = 0) {
  return Array.from({ length: n }, (_, i) => {
    const t = a0 + i / n * TAU, c = Math.cos(t), s = Math.sin(t);
    return [cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / e), cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / e)];
  });
}
export const mirror = pts => pts.map(p => [-p[0], p[1]]);
export const lerpPts = (A, B, t) => A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]);
export const offPts = (A, dx, dy) => A.map(p => [p[0] + dx, p[1] + dy]);
export const scalePts = (A, sx, sy = sx, cx = 0, cy = 0) => A.map(p => [cx + (p[0] - cx) * sx, cy + (p[1] - cy) * sy]);
// 4-point sparkle star
export const star4 = (r, k = 0.28) => Array.from({ length: 8 }, (_, i) => {
  const a = i / 8 * TAU - Math.PI / 2, rr = i % 2 ? r * k : r; return [rr * Math.cos(a), rr * Math.sin(a)];
});
// spiky burst
export const burst = (r0, r1, n, seed = 1) => Array.from({ length: n * 2 }, (_, i) => {
  const a = i / (n * 2) * TAU, rr = i % 2 ? r0 * (0.85 + 0.3 * hash(i, seed)) : r1 * (0.8 + 0.4 * hash(i, seed + 1));
  return [rr * Math.cos(a), rr * Math.sin(a)];
});

// ---------------- boiling lettering ----------------
// Words are pre-rendered (browser shaping for Kurdish/Arabic), then warped with a smooth
// displacement field into 4 boil variants (the "Turbulent Displace" route, evolution per variant).
function warp(src, seed, amp, lam, amp2, lam2) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d'), sd = sctx.getImageData(0, 0, w, h).data;
  const P = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = sd[i * 4 + 3] / 255;
    P[i * 4] = sd[i * 4] * a; P[i * 4 + 1] = sd[i * 4 + 1] * a; P[i * 4 + 2] = sd[i * 4 + 2] * a; P[i * 4 + 3] = sd[i * 4 + 3];
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const octx = out.getContext('2d'), od = octx.createImageData(w, h), o = od.data;
  const g = 4, gw = Math.ceil(w / g) + 2, gh = Math.ceil(h / g) + 2;
  const DX = new Float32Array(gw * gh), DY = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = i * g, y = j * g;
    DX[j * gw + i] = amp * vn2(x / lam, y / lam, seed) + amp2 * vn2(x / lam2, y / lam2, seed + 3);
    DY[j * gw + i] = amp * vn2(x / lam + 40, y / lam, seed + 1) + amp2 * vn2(x / lam2 + 40, y / lam2, seed + 4);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = x / g, gy = y / g, i = Math.floor(gx), j = Math.floor(gy), tx = gx - i, ty = gy - j;
    const q = j * gw + i;
    const dx = lerp(lerp(DX[q], DX[q + 1], tx), lerp(DX[q + gw], DX[q + gw + 1], tx), ty);
    const dy = lerp(lerp(DY[q], DY[q + 1], tx), lerp(DY[q + gw], DY[q + gw + 1], tx), ty);
    const sx = x + dx, sy = y + dy;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const k = (y * w + x) * 4;
    if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) { o[k + 3] = 0; continue; }
    const a = (y0 * w + x0) * 4, b = a + 4, c = a + w * 4, d = c + 4;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const A = P[a + 3] * w00 + P[b + 3] * w10 + P[c + 3] * w01 + P[d + 3] * w11;
    if (A < 0.5) { o[k + 3] = 0; continue; }
    const ia = 255 / A;
    o[k] = (P[a] * w00 + P[b] * w10 + P[c] * w01 + P[d] * w11) * ia;
    o[k + 1] = (P[a + 1] * w00 + P[b + 1] * w10 + P[c + 1] * w01 + P[d + 1] * w11) * ia;
    o[k + 2] = (P[a + 2] * w00 + P[b + 2] * w10 + P[c + 2] * w01 + P[d + 2] * w11) * ia;
    o[k + 3] = A;
  }
  octx.putImageData(od, 0, 0);
  return out;
}

// st: {font: '900 120px Somar', fill, outline:{col,w}, shadow:{col,dx,dy}, dir, amp}
function renderWord(text, st) {
  const pad = Math.ceil((st.outline ? st.outline.w : 0) + Math.max(Math.abs(st.shadow?.dx || 0), Math.abs(st.shadow?.dy || 0)) + 14);
  const m = document.createElement('canvas').getContext('2d');
  m.font = st.font; m.direction = st.dir || 'rtl';
  if ('letterSpacing' in m) m.letterSpacing = st.track || '0px';
  const met = m.measureText(text);
  const asc = Math.ceil(met.actualBoundingBoxAscent), desc = Math.ceil(met.actualBoundingBoxDescent);
  const wl = Math.ceil(met.actualBoundingBoxLeft), wr = Math.ceil(met.actualBoundingBoxRight);
  const cw = wl + wr + pad * 2, ch = asc + desc + pad * 2;
  const variants = [];
  const make = () => {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const x = c.getContext('2d'); x.font = st.font; x.direction = st.dir || 'rtl'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    if ('letterSpacing' in x) x.letterSpacing = st.track || '0px';
    return [c, x];
  };
  const ox = pad + wl, oy = pad + asc;
  for (let v = 0; v < 4; v++) {
    const [c, x] = make();
    const seed = (st.seed || 1) * 31 + v * 7;
    const layer = (fn) => { const [lc, lx] = make(); fn(lx); return warp(lc, seed + lc.width % 13, st.amp ?? 2.1, st.lam ?? 34, st.amp2 ?? 0.55, 6); };
    if (st.shadow) {
      const sh = layer(lx => {
        lx.fillStyle = st.shadow.col;
        if (st.outline) { lx.strokeStyle = st.shadow.col; lx.lineWidth = st.outline.w * 2; lx.strokeText(text, ox + st.shadow.dx, oy + st.shadow.dy); }
        lx.fillText(text, ox + st.shadow.dx, oy + st.shadow.dy);
      });
      x.drawImage(sh, 0, 0);
    }
    const body = layer(lx => {
      if (st.outline) { lx.strokeStyle = st.outline.col; lx.lineWidth = st.outline.w * 2; lx.strokeText(text, ox, oy); }
      lx.fillStyle = st.fill; lx.fillText(text, ox, oy);
    });
    x.drawImage(body, 0, 0);
    variants.push(c);
  }
  return { v: variants, ox, oy, w: cw, h: ch, adv: met.width, dir: st.dir || 'rtl' };
}

// a line of words; layout RTL (first word on the right) unless dir:'ltr'.
// A word may be an object {custom: fn(scale), adv, asc} drawn by the caller-supplied function (e.g. the vector logo).
export function lettering(text, st) {
  const m = document.createElement('canvas').getContext('2d');
  m.font = st.font; m.direction = st.dir || 'rtl';
  const words = Array.isArray(text) ? text : text.split(' ');
  const sp = m.measureText(' ').width * (st.space ?? 1);
  const R = words.map((w, i) => typeof w === 'object'
    ? Object.assign({ text: '', dir: st.dir || 'rtl' }, w)
    : Object.assign(renderWord(w, Object.assign({}, st, { seed: (st.seed || 1) + i * 17 })), { text: w }));
  const total = R.reduce((a, r) => a + r.adv, 0) + sp * (words.length - 1);
  let cur = st.dir === 'ltr' ? -total / 2 : total / 2;
  R.forEach(r => {
    if (st.dir === 'ltr') { r.x0 = cur; r.cx = cur + r.adv / 2; cur += r.adv + sp; }
    else { r.x0 = cur - r.adv; r.cx = cur - r.adv / 2; cur -= r.adv + sp; }
  });
  return { words: R, width: total, size: parseFloat(st.font.match(/(\d+)px/)[1]), jit: st.jit };
}
// draw a lettering line centred at (cx, baselineY) in current D space.
// pw(i, n) → {p: 0..1 scale progress, r: extra rotation, dx, dy, a: alpha, sx, sy}
export function drawLettering(L, cx, by, pw = () => ({ p: 1 })) {
  const ctx = G.ctx;
  L.words.forEach((r, i) => {
    const st = pw(i, L.words.length);
    if (!st || st.p <= 0.001 || st.a === 0) return;
    D.push();
    const px = cx + r.cx, py = by - L.size * 0.32;
    D.t(px + (st.dx || 0), py + (st.dy || 0)).r((st.r || 0) + hs(i * 3 + 1, 41) * (L.jit ?? 0.035));
    if (st.sx) D.s(st.sx * st.p, (st.sy ?? st.sx) * st.p); else D.s(st.p);
    if (r.custom) { G.alpha = st.a ?? 1; r.custom(by - py); G.alpha = 1; D.pop(); return; }
    const img = r.v[(G.boil + i) % 4];
    D.setCtx();
    ctx.globalAlpha = (st.a ?? 1) * G.alpha;
    const left = (cx + r.x0) - px, base = by - py;
    ctx.drawImage(img, left + (r.dir === 'ltr' ? 0 : r.adv) - r.ox, base - r.oy);
    ctx.globalAlpha = 1;
    D.pop();
  });
  G.ctx.setTransform(1, 0, 0, 1, 0, 0);
}
