// Hand-drawn cel FX: sparkles, impact bursts, droplets/splashes, smoke puffs, speed lines,
// heat squiggles, swirls, snowflakes, write-on check/cross marks, ripples.
// Coordinates are local to the current D transform; t values are frame counts unless noted.
import { D, G, line, fill, withClip, ell, arcPts, star4, burst, hash, hs, vn, clamp, lerp, E, TAU, INK } from './core.js';

export const FXC = { cream: '#FFF9F4', creamShade: '#F2E1E4', ice: '#BDEBDA', cyan: '#5DBF9C', pink: '#F49BB3', violet: '#E0789A', white: '#FFFFFF' };

// 4-point sparkle. s: 0..1 size, col fill, outline (bool)
export function sparkle(x, y, r, s = 1, o = {}) {
  if (s <= 0.02) return;
  D.push(); D.t(x, y).r(o.rot || 0).s(s);
  const P = star4(r, o.k ?? 0.3);
  fill(P, { col: o.col || FXC.cream, seed: o.seed ?? 900, sharp: true, amp: 1.2, grain: 0.3, off: o.off || [0, 0] });
  if (o.line !== false) line(P, { w: o.w ?? 4.5, seed: (o.seed ?? 900) + 1, closed: true, sharp: true, col: o.lc || INK, amp: 1.2, taper: [0, 0] });
  D.pop();
}
// twinkle helper: size over a life of `dur` frames starting at t0 (pops in, holds, pops out)
export const twinkle = (t, dur = 16) => t < 0 || t > dur ? 0 : t < 4 ? E.outBack(t / 4, 2.4) : t > dur - 4 ? (dur - t) / 4 : 1;

// impact: radial tapered lines bursting out. t: frames since impact
export function impactLines(x, y, r0, r1, n, t, o = {}) {
  const life = o.life ?? 8;
  if (t < 0 || t > life) return;
  const p = E.out2(t / life);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hs(i, o.seed ?? 3) * 0.25 + (o.rot || 0);
    const ra = lerp(r0, r1, p * 0.55), rb = lerp(r0, r1, Math.min(1, 0.35 + p));
    const L = (1 - p * 0.6) * (0.75 + 0.5 * hash(i, (o.seed ?? 3) + 1));
    line([[x + Math.cos(a) * ra, y + Math.sin(a) * ra], [x + Math.cos(a) * lerp(ra, rb, L), y + Math.sin(a) * lerp(ra, rb, L)]],
      { w: (o.w ?? 7) * (1 - p * 0.5), seed: (o.seed ?? 3) + i, col: o.col || INK, taper: [0.15, 0.85] });
  }
}

// spiky starburst shape ("SPLAT" style)
export function starburst(x, y, r0, r1, n, s, o = {}) {
  if (s <= 0.02) return;
  D.push(); D.t(x, y).r(o.rot || 0).s(s);
  const P = burst(r0, r1, n, o.seed ?? 7);
  fill(P, { col: o.col || FXC.cream, seed: o.seed ?? 7, sharp: true, off: o.off || [6, -4] });
  line(P, { w: o.w ?? 6, seed: (o.seed ?? 7) + 1, closed: true, sharp: true, col: o.lc || INK, taper: [0, 0] });
  D.pop();
}

// a droplet stretched along its velocity (vx, vy in px/frame)
export function drop(x, y, r, vx = 0, vy = 0, o = {}) {
  if (r < 0.8) return;
  const sp = Math.hypot(vx, vy), k = 1 + Math.min(2.2, sp * (o.stretch ?? 0.045));
  const a = sp > 0.01 ? Math.atan2(vy, vx) : Math.PI / 2;
  D.push(); D.t(x, y).r(a - Math.PI / 2).s(1 / Math.sqrt(k), k);
  // teardrop pointing back along the motion (tail up when falling)
  const P = [[0, -r * 1.9], [r * 0.62, -r * 0.6], [r, r * 0.15], [r * 0.7, r * 0.78], [0, r], [-r * 0.7, r * 0.78], [-r, r * 0.15], [-r * 0.62, -r * 0.6]];
  fill(P, { col: o.col || FXC.ice, seed: o.seed ?? 40, off: [0, 0], amp: 0.8, grain: 0.3 });
  line(P, { w: o.w ?? 4, seed: (o.seed ?? 40) + 1, closed: true, col: o.lc || INK, amp: 0.8, taper: [0, 0] });
  if (r > 6) line([[-r * 0.35, -r * 0.1], [-r * 0.4, r * 0.35]], { w: Math.max(2, r * 0.18), seed: (o.seed ?? 40) + 2, col: '#FFFFFF', amp: 0.4 });
  D.pop();
}
// ballistic splash: n droplets from (x,y) at frame t (closed form). dir: angle of the spray centre, spread: half-angle
export function splash(x, y, t, o = {}) {
  const n = o.n ?? 9, life = o.life ?? 18, g = o.g ?? 1.4, sd = o.seed ?? 50;
  if (t < 0 || t > life) return;
  for (let i = 0; i < n; i++) {
    const a = (o.dir ?? -Math.PI / 2) + hs(i, sd) * (o.spread ?? 1.2);
    const v = (o.speed ?? 16) * (0.55 + 0.45 * hash(i, sd + 1));
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v, r0 = (o.r0 ?? 0) * (0.6 + 0.8 * hash(i, sd + 3));
    const px = x + Math.cos(a) * r0 + vx * t, py = y + Math.sin(a) * r0 + vy * t + 0.5 * g * t * t;
    const r = (o.r ?? 10) * (0.6 + 0.6 * hash(i, sd + 2)) * (1 - Math.pow(t / life, 2));
    drop(px, py, r, vx, vy + g * t, { col: o.col, lc: o.lc, seed: sd + 10 + i, w: o.w });
  }
}

// smoke puff cluster with a single outer silhouette (outline under fill trick)
// circles: [[x, y, r], ...] in local coords
export function puffs(circles, o = {}) {
  const w = o.w ?? 6, sd = o.seed ?? 200;
  circles.forEach(([x, y, r], i) => { if (r > 1) line(ell(x, y, r, r, 12), { w: w * 2, seed: sd + i, closed: true, col: o.lc || INK, taper: [0, 0], amp: 1.6 }); });
  circles.forEach(([x, y, r], i) => { if (r > 1) fill(ell(x, y, r, r, 12), { col: o.col || FXC.cream, seed: sd + 50 + i, amp: 1.6, grain: 0.5 }); });
  if (o.shade !== false) circles.forEach(([x, y, r], i) => {
    if (r > 14) fill(ell(x + r * 0.2, y + r * 0.22, r * 0.66, r * 0.62, 12), { col: o.sc || FXC.creamShade, seed: sd + 100 + i, amp: 1.2, grain: 0.5 });
  });
  if (o.curls) circles.forEach(([x, y, r], i) => {
    if (r > 40 && i % 2 === 0) line(arcPts(x - r * 0.15, y - r * 0.1, r * 0.45, r * 0.4, Math.PI * 0.9, Math.PI * 1.9, 8), { w: 4, seed: sd + 150 + i, col: o.lc || INK, alpha: 0.8 });
  });
}

// straight speed lines inside a band; dir angle, t frames; lines slide along dir
export function speedLines(cx, cy, len, spread, dir, t, o = {}) {
  const n = o.n ?? 8, sd = o.seed ?? 70;
  const ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
  for (let i = 0; i < n; i++) {
    const off = hs(i, sd) * spread, l = len * (0.5 + 0.5 * hash(i, sd + 1));
    const sh = ((t * (o.speed ?? 40) + hash(i, sd + 2) * 400) % 400) - 200;
    const x0 = cx + nx * off + ux * sh, y0 = cy + ny * off + uy * sh;
    line([[x0, y0], [x0 + ux * l, y0 + uy * l]], { w: o.w ?? 5, seed: sd + 10 + i, col: o.col || INK, taper: [0.1, 0.9], alpha: o.alpha ?? 1 });
  }
}

// rising heat squiggles
export function heat(x, y, t, o = {}) {
  const n = o.n ?? 3, sd = o.seed ?? 120;
  for (let i = 0; i < n; i++) {
    const ph = ((t * 0.035 + i / n) % 1);
    const yy = y - ph * (o.rise ?? 120), xx = x + (i - (n - 1) / 2) * (o.gap ?? 44);
    const a = Math.sin(ph * Math.PI);
    const P = [];
    for (let k = 0; k <= 6; k++) P.push([xx + Math.sin(k * 1.4 + t * 0.2 + i) * 9, yy - k * 13]);
    line(P, { w: (o.w ?? 5) * a, seed: sd + i, col: o.col || INK, taper: [0.4, 0.4], alpha: a });
  }
}

// ✓ and ✕ written on (t: 0..1 progress)
export function check(x, y, s, t, o = {}) {
  if (t <= 0) return;
  D.push(); D.t(x, y).s(s);
  const P = [[-34, 2], [-12, 26], [36, -32]];
  line(P, { w: o.w ?? 13, seed: o.seed ?? 960, col: o.col || FXC.violet, sharp: true, trim: [0, E.out2(clamp(t))], taper: [0.15, 0.35] });
  D.pop();
}
export function cross(x, y, s, t, o = {}) {
  if (t <= 0) return;
  D.push(); D.t(x, y).s(s);
  line([[-28, -28], [28, 28]], { w: o.w ?? 11, seed: o.seed ?? 970, col: o.col || INK, sharp: true, trim: [0, E.out2(clamp(t * 2))], taper: [0.15, 0.3] });
  line([[28, -28], [-28, 28]], { w: o.w ?? 11, seed: (o.seed ?? 970) + 1, col: o.col || INK, sharp: true, trim: [0, E.out2(clamp(t * 2 - 1))], taper: [0.15, 0.3] });
  D.pop();
}

// expanding ellipse ripples (t frames since plop)
export function ripple(x, y, rx, ry, t, o = {}) {
  const n = o.n ?? 2, life = o.life ?? 14;
  for (let i = 0; i < n; i++) {
    const tt = t - i * 4;
    if (tt < 0 || tt > life) continue;
    const p = E.out2(tt / life);
    line(ell(x, y, rx * (0.3 + p), ry * (0.3 + p), 14), { w: (o.w ?? 4) * (1 - p), seed: (o.seed ?? 980) + i, closed: true, col: o.col || '#FFFFFF', taper: [0, 0], alpha: 1 - p * 0.5 });
  }
}

// snowflake (6 arms with ticks)
export function snowflake(x, y, r, s = 1, o = {}) {
  if (s <= 0.02) return;
  D.push(); D.t(x, y).r(o.rot || 0).s(s);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU, c = Math.cos(a), sn = Math.sin(a);
    line([[0, 0], [c * r, sn * r]], { w: o.w ?? 4.5, seed: (o.seed ?? 990) + i, col: o.col || FXC.cyan, taper: [0.1, 0.4], amp: 0.8 });
    const bx = c * r * 0.55, by = sn * r * 0.55;
    [-1, 1].forEach(k => {
      const b = a + k * 0.7;
      line([[bx, by], [bx + Math.cos(b) * r * 0.3, by + Math.sin(b) * r * 0.3]], { w: (o.w ?? 4.5) * 0.8, seed: (o.seed ?? 990) + 10 + i * 2 + (k > 0), col: o.col || FXC.cyan, taper: [0.1, 0.5], amp: 0.6 });
    });
  }
  D.pop();
}

// rounded "pill" tag with a boiling outline (for ingredient labels)
export function pill(x, y, w, h, o = {}) {
  const r = h / 2, P = [];
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI; P.push([x + w / 2 - r + Math.cos(a) * r, y + Math.sin(a) * r]); }
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + i / 8 * Math.PI; P.push([x - w / 2 + r + Math.cos(a) * r, y + Math.sin(a) * r]); }
  fill(P, { col: o.col || FXC.cream, seed: o.seed ?? 1000, off: o.off || [4, -3], amp: 1.2 });
  line(P, { w: o.w ?? 4.5, seed: (o.seed ?? 1000) + 1, closed: true, col: o.lc || INK, amp: 1.2, taper: [0, 0] });
}

// ---------------- liquid ----------------
// a poured stream: polyline pts (local), width w; trim [a,b] for the falling slug / detaching tail
export function stream(pts, w, o = {}) {
  const sd = o.seed ?? 1400, tr = o.trim || [0, 1];
  const wf = u => 0.82 + 0.18 * Math.sin(u * 9 + G.boil * 1.7) * (o.wobble ?? 1);
  line(pts, { w: w + 9, seed: sd, col: o.lc || INK, trim: tr, taper: [0.08, 0.08], wf, amp: 1.6 });
  line(pts, { w, seed: sd + 1, col: o.col || FXC.cream, trim: tr, taper: [0.06, 0.06], wf, amp: 1.6 });
  line(pts.map(([x, y]) => [x + w * 0.22, y]), { w: w * 0.28, seed: sd + 2, col: o.sh || FXC.creamShade, trim: [tr[0] + 0.05, tr[1] - 0.05], taper: [0.3, 0.3], amp: 1.2 });
  line(pts.map(([x, y]) => [x - w * 0.18, y]), { w: Math.max(2.5, w * 0.12), seed: sd + 3, col: '#FFFFFF', trim: [tr[0] + 0.12, tr[1] - 0.2], taper: [0.4, 0.4], amp: 1 });
}
// crown splash ring at an impact point (t frames since impact)
export function crown(x, y, t, o = {}) {
  const life = o.life ?? 12;
  if (t < 0 || t > life) return;
  const p = E.out2(t / life), n = o.n ?? 7, sd = o.seed ?? 1450, r = (o.r ?? 70) * (0.5 + p * 0.7);
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i + 0.5) / n * Math.PI, h = (o.h ?? 46) * Math.sin(Math.min(1, p * 1.6) * Math.PI) * (0.6 + 0.6 * hash(i, sd));
    const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * 6;
    line([[bx, by], [bx + Math.cos(a) * 10, by - h]], { w: (o.w ?? 13) * (1 - p * 0.6), seed: sd + i, col: o.col || FXC.cream, taper: [0.1, 0.9], amp: 0.8 });
  }
}
// confetti / glitter bits flung from a point (closed-form ballistic), kinds: dot, star, heart, drop
export function confetti(x, y, t, o = {}) {
  const n = o.n ?? 14, life = o.life ?? 26, g = o.g ?? 0.9, sd = o.seed ?? 1500;
  if (t < 0 || t > life) return;
  for (let i = 0; i < n; i++) {
    const a = (o.dir ?? -Math.PI / 2) + hs(i, sd) * (o.spread ?? 1.4);
    const v = (o.speed ?? 22) * (0.5 + 0.5 * hash(i, sd + 1));
    const px = x + Math.cos(a) * v * t * 0.9, py = y + Math.sin(a) * v * t * 0.9 + 0.5 * g * t * t;
    const k = 1 - Math.pow(t / life, 3), r = (o.r ?? 13) * (0.6 + 0.6 * hash(i, sd + 2)) * k;
    if (r < 1) continue;
    const kind = (o.kinds || ['star', 'dot', 'heart'])[i % (o.kinds || ['star', 'dot', 'heart']).length];
    const col = (o.cols || [FXC.white, FXC.pink, FXC.ice])[i % (o.cols || [FXC.white, FXC.pink, FXC.ice]).length];
    D.push(); D.t(px, py).r(t * 0.12 * hs(i, sd + 3));
    let P;
    if (kind === 'star') P = star4(r * 1.5, 0.34);
    else if (kind === 'heart') P = [[0, r * 0.95], [-r * 1.05, -r * 0.05], [-r * 0.85, -r * 0.75], [-r * 0.3, -r * 0.85], [0, -r * 0.45], [r * 0.3, -r * 0.85], [r * 0.85, -r * 0.75], [r * 1.05, -r * 0.05]];
    else P = ell(0, 0, r * 0.75, r * 0.75, 8);
    fill(P, { col, seed: sd + 10 + i, sharp: kind === 'star', grain: 0.2, amp: 0.8 });
    line(P, { w: 3.6, seed: sd + 40 + i, closed: true, sharp: kind === 'star', taper: [0, 0], amp: 0.8, col: o.lc || INK });
    D.pop();
  }
}
// motion arcs (twist / spin marks) around a centre
export function twistMarks(x, y, rx, ry, t, o = {}) {
  const sd = o.seed ?? 1600;
  for (let k = 0; k < 2; k++) {
    const a0 = (k ? Math.PI : 0) + (o.rot || 0) + t * 0.6;
    line(arcPts(x, y, rx, ry, a0 - 0.7, a0 + 0.5, 8), { w: o.w ?? 5, seed: sd + k, col: o.col || INK, taper: [0.6, 0.15] });
  }
}
// a hand-drawn arrow along pts (write-on with trim p)
export function arrow(pts, p, o = {}) {
  if (p <= 0) return;
  const sd = o.seed ?? 1700;
  line(pts, { w: o.w ?? 7, seed: sd, trim: [0, E.out2(clamp(p))], taper: [0.25, 0.05], col: o.col || INK });
  if (p > 0.85) {
    const e = pts[pts.length - 1], q = pts[pts.length - 2], a = Math.atan2(e[1] - q[1], e[0] - q[0]), s = (o.head ?? 22) * clamp((p - 0.85) / 0.15);
    line([[e[0] + Math.cos(a + 2.5) * s, e[1] + Math.sin(a + 2.5) * s], e, [e[0] + Math.cos(a - 2.5) * s, e[1] + Math.sin(a - 2.5) * s]], { w: (o.w ?? 7) * 0.9, seed: sd + 1, sharp: true, taper: [0.2, 0.2], col: o.col || INK });
  }
}
