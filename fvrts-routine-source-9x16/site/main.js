// fvrts — "بەرهەمەکانی fvrts بۆ تۆ! بۆ چی بەکاردێن؟" — 1080x1920, 24 fps, 960 frames (40.0 s).
// Cel / frame-by-frame look: drawings on 2s (fast actions on 1s, the end hold on 3s); line boil = 4 jitter
// variants cycled every 2 frames; smear frames on fast moves; hand-drawn cel FX; paper multiply.
// seek(f) is a pure function of the frame number (seeded noise only, closed-form motion).
import { W, H, G, D, line, fill, withClip, lettering, drawLettering, ell, arcPts, rrect, mix, spring, wob, kf, steps, E,
  clamp, lerp, inv, hash, hs, vn, on2, on3, TAU, star4, burst, INK, sstep } from './core.js';
import { PC, toner, tonerCap, serum, tube, tubeCap, logo, setLogo, initLabels, serumNozzle, logoAspect } from './prods.js';
import { SK, CELLS, GAPS, cell, backing, gapMortar, seamMortar, flake, droplet, ytop, slope, CW, CH, RP, face } from './skin.js';
import { FC, LENS, girl } from './face.js';
import { FXC, sparkle, twinkle, impactLines, starburst, splash, puffs, speedLines, ripple, stream, crown, confetti, twistMarks, arrow, pill } from './fx.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
G.ctx = ctx;
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
const CUE = await (await fetch('cues.json')).json();
const C = CUE.frames;
export const FRAMES = CUE.FRAMES;

const PAL = {
  sky: '#FADCE3', sun: '#F7CCD7', dots: '#F3B9C8', pinkBg: '#F7CFD7', ray: '#F4C5D1',
  mintBg: '#CDEEE1', mintRay: '#BBE7D6', halo: '#E4F7EF', plum: '#8B3A5C', shadow: '#EE9AB2', white: '#FFFFFF',
  mint: PC.mint, mintD: '#3FB896',
};

// ---------------- copy (Kurdish Sorani + Arabic, light Iraqi) ----------------
const COPY = {
  title: ['بەرهەمەکانی', 'LOGO', 'بۆ', 'تۆ!'], titleAr: ['منتجات', 'LOGO', 'لكِ!'],
  q: 'بۆ چی بەکاردێن؟', qAr: 'شنو فايدتها؟',
  names: ['تۆنەر', 'سیرەم', 'کرێم'],
  t: ['پێستت هاوسەنگ و ئامادە دەکات', 'يوازن بشرتك ويجهّزها'], tChip: 'دوای شوشتن · بعد الغسل',
  s: ['شێداریی قووڵ و درەوشانەوە', 'ترطيب عميق وبشرة تلمع'], sChips: ['8 Hyaluronic Acids', 'Ceramides'],
  c: ['شێ دەپارێزێت و پێست لووس دەکات', 'يحبس الرطوبة وينعّم البشرة'], cChips: ['5 Ceramides', 'Niacinamide'],
  result: ['پێستێکی بەهێز و پڕ لە شێ', 'بشرة قوية ومرطّبة'],
  tag: ['سێ هەنگاو بۆ پێستێکی تەندروست', 'ثلاث خطوات لبشرة صحية'],
};

// ---------------- assets ----------------
await Promise.all(['900', '500', '400'].map(w => document.fonts.load(`${w} 40px Somar`, 'بەرهەمەکانی بۆ تۆ منتجات ١٢٣')));
await Promise.all(['500', '600', '700', '800'].map(w => document.fonts.load(`${w} 40px Inter`, 'Mae Il Cream 8 ?')));
await document.fonts.ready;
const [paper, grainImg] = await Promise.all(['paper', 'grain'].map(n => loadImg(`img/${n}.png`)));
setLogo(await (await fetch('logo.json')).json());
G.grain = ctx.createPattern(grainImg, 'repeat');

// ---------------- lettering ----------------
const MAXW = 940;
let seedN = 1;
function L(text, weight, size, col, o = {}) {
  const fam = o.fam || 'Somar', m = document.createElement('canvas').getContext('2d');
  m.font = `${weight} ${size}px ${fam}`; m.direction = o.dir || 'rtl';
  const words = Array.isArray(text) ? text : [text];
  const wsum = words.reduce((a, w) => a + (typeof w === 'object' ? w.adv : m.measureText(w).width), 0) + (words.length - 1) * m.measureText(' ').width;
  const s = wsum > (o.maxw || MAXW) ? Math.floor(size * (o.maxw || MAXW) / wsum) : size;
  const k = s / size;
  const words2 = words.map(w => typeof w === 'object' ? Object.assign({}, w, { adv: w.adv * k, k }) : w);
  return lettering(Array.isArray(text) ? words2 : text, Object.assign({ seed: (seedN += 7) }, o, { font: `${weight} ${s}px ${fam}`, fill: col }));
}
initLabels(L);
// the vertical-safe inline logo "word" (with the same offset shadow as the lettering)
const logoWord = (h, sh, seed) => ({
  adv: h * logoAspect() + h * 0.1,
  custom(baseY) {
    const hh = h * (this.k || 1);
    D.push(); D.t(0, baseY - hh / 2);
    if (sh) { D.push(); D.t(sh.dx, sh.dy); logo(hh, { seed: seed + 5, col: sh.col, amp: 1.3 }); D.pop(); }
    logo(hh, { seed, amp: 1.3 });
    D.pop();
  },
});
const SH = { col: PAL.shadow, dx: 6, dy: 6 };
const KU = (t, size, o = {}) => L(t, 900, size, o.col || INK, Object.assign({ shadow: Object.assign({}, SH, o.sh || {}), space: 1.35 }, o));
const AR = (t, size, o = {}) => L(t, 500, size, o.col || PAL.plum, o);
const withLogo = (arr, h, sh, seed) => arr.map(w => w === 'LOGO' ? logoWord(h, sh, seed) : w);
const T = {
  title: KU(withLogo(COPY.title, 76, SH, 120), 100),
  titleAr: AR(withLogo(COPY.titleAr, 46, null, 140), 62),
  q: KU(COPY.q, 124), qAr: AR(COPY.qAr, 66),
  names: COPY.names.map(n => KU(n, 84)),
  digits: ['١', '٢', '٣'].map(d => L(d, 900, 60, INK)),
  lines: [COPY.t, COPY.s, COPY.c].map(([k, a]) => ({ ku: KU(k, 72), ar: AR(a, 50) })),
  tChip: L(COPY.tChip, 500, 36, INK),
  sChips: COPY.sChips.map(c => L(c, 600, 36, INK, { fam: 'Inter', dir: 'ltr' })),
  cChips: COPY.cChips.map(c => L(c, 600, 36, INK, { fam: 'Inter', dir: 'ltr' })),
  result: { ku: KU(COPY.result[0], 80), ar: AR(COPY.result[1], 56) },
  tag: { ku: KU(COPY.tag[0], 68), ar: AR(COPY.tag[1], 50) },
  endNames: COPY.names.map(n => KU(n, 54, { sh: { dx: 4, dy: 4 } })),
  qm: L('?', 800, 70, INK, { fam: 'Inter', dir: 'ltr', shadow: { col: '#FFFFFF', dx: 4, dy: 4 } }),
};

// ---------------- timing helpers ----------------
const POP_IN = [[0, 0], [2, 1.18], [4, 0.92], [6, 1.04], [8, 0.99], [10, 1]];
const POP_OUT = [[0, 1], [2, 1.07], [4, 0.45], [6, 0]];
const kfl = (t, K) => kf(t, K.map(k => [k[0], k[1], 'lin']));
const popIn = t => t < 0 ? 0 : kfl(on2(t), POP_IN);
const popOut = t => t < 0 ? 1 : kfl(on2(t), POP_OUT);
const wordsAnim = (f, tin, tout, st = 4) => (i, n) => {
  const p = popIn(f - tin - i * st) * popOut(f - tout - 2 * (n - 1 - i));
  const r = kfl(on2(f - tin - i * st), [[0, -0.22], [2, 0.08], [4, -0.03], [6, 0]]);
  return { p, r };
};
function title(P, f, tin, tout, y1, y2, st = 4, arDelay = 8) {
  if (f < tin - 1 || f > tout + 16) return;
  D.abs();
  drawLettering(P.ku, 540, y1, wordsAnim(f, tin, tout, st));
  if (P.ar) drawLettering(P.ar, 540, y2, wordsAnim(f, tin + arDelay, tout + 2, st));
}
// squash/stretch keys after an impact (on 1s for 4 frames, then on 2s)
const LAND = [[1.24, 0.78], [1.12, 0.88], [0.93, 1.08], [0.93, 1.08], [1.04, 0.96], [1.04, 0.96], [0.99, 1.01], [0.99, 1.01]];
const land = t => t < 0 || t >= LAND.length ? [1, 1] : LAND[t];
// camera shake (screen px), decaying, alternating every frame
function shake(f, list) {
  let ox = 0, oy = 0;
  list.forEach(([f0, a]) => {
    const t = f - f0;
    if (t >= 0 && t < 7) { const k = [1, -0.64, 0.4, -0.24, 0.12, -0.06, 0.02][t]; oy += a * k; ox += a * 0.3 * k * (t % 2 ? 1 : -1); }
  });
  return [ox, oy];
}

// ---------------- screen-space UI: header badge, chips ----------------
const HY = 190;   // header row
function header(k, f, tin, tout) {
  const p = popIn(f - tin) * popOut(f - tout);
  if (p <= 0.001) return;
  D.abs();
  const nm = T.names[k], r = 46, gap = 26, total = nm.width + gap + 2 * r;
  const bx = 540 + total / 2 - r, nx = 540 - total / 2 + nm.width / 2;
  D.push(); D.t(bx, HY).r(-0.25 * (1 - Math.min(1, p))).s(p);
  fill(ell(0, 0, r, r, 16), { col: PAL.mint, seed: 8000 + k, off: [5, -4] });
  withClip(ell(0, 0, r, r, 16), { seed: 8000 + k, off: [5, -4] }, () => fill(ell(14, 16, r * 0.9, r * 0.8, 12), { col: PC.mintSh, seed: 8003 + k, alpha: 0.7 }));
  line(ell(0, 0, r, r, 16), { w: 6, seed: 8010 + k, closed: true, taper: [0, 0] });
  drawLettering(T.digits[k], 0, 21, () => ({ p: 1 }));
  D.pop();
  D.abs();
  drawLettering(nm, nx, HY + 30, wordsAnim(f, tin + 2, tout));
}
function chip(Lt, x, y, p, sd, dot) {
  if (p <= 0.001) return;
  D.abs(); D.push(); D.t(x, y).r(hs(sd, 3) * 0.04).s(p);
  const w = Lt.width + (dot ? 90 : 64), h = 74;
  pill(0, 0, w, h, { seed: sd, col: '#FFFFFF', w: 5 });
  if (dot) {
    fill(ell(w / 2 - 38, 0, 12, 12, 10), { col: dot, seed: sd + 5, grain: 0 });
    line(ell(w / 2 - 38, 0, 12, 12, 10), { w: 3.8, seed: sd + 6, closed: true, taper: [0, 0], amp: 0.6 });
  }
  drawLettering(Lt, dot ? -12 : 0, Lt.size * 0.36, () => ({ p: 1 }));
  D.pop();
}
const chipP = (f, tin, tout) => popIn(f - tin) * popOut(f - tout);

// ---------------- backgrounds ----------------
function bg(col) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
function skyDeco(f) {
  // big paper-cut sun behind the product stage + floating dots (world space, parallax 0.5)
  const F = on2(f);
  D.push();
  fill(ell(540, 860, 470, 470, 24), { col: PAL.sun, seed: 8100, grain: 0.5, amp: 2 });
  line(ell(540, 860, 452, 452, 24), { w: 7, seed: 8102, col: '#FFFFFF', alpha: 0.55, closed: true, taper: [0, 0] });
  line(ell(540, 860, 474, 474, 24), { w: 3.2, seed: 8103, closed: true, taper: [0, 0], alpha: 0.35 });
  line(arcPts(540, 860, 420, 420, Math.PI * 1.08, Math.PI * 1.42, 10), { w: 9, seed: 8101, col: '#FFFFFF', alpha: 0.75, taper: [0.4, 0.4] });
  line(arcPts(540, 860, 420, 420, Math.PI * 1.47, Math.PI * 1.53, 3), { w: 9, seed: 8104, col: '#FFFFFF', alpha: 0.75, taper: [0.4, 0.4] });
  for (let i = 0; i < 7; i++) {   // moisture bubbles drifting up on 2s
    const per = 150 + 40 * hash(i, 8130), ph = ((F + hash(i, 8131) * per) % per) / per;
    const x = 90 + 900 * hash(i, 8132) + 22 * Math.sin(F * 0.05 + i * 2), y = 1240 - ph * 1100, r = 9 + 10 * hash(i, 8133);
    const a = Math.sin(ph * Math.PI);
    if (a < 0.05) continue;
    line(ell(x, y, r, r, 10), { w: 3.2, seed: 8134 + i, closed: true, taper: [0, 0], alpha: 0.5 * a, amp: 0.8 });
    line(arcPts(x, y, r * 0.6, r * 0.6, Math.PI * 1.1, Math.PI * 1.45, 3), { w: 2.6, seed: 8150 + i, col: '#FFFFFF', alpha: 0.9 * a, amp: 0.5 });
  }
  for (let i = 0; i < 16; i++) {
    const x = 60 + hash(i, 8110) * 960, y = 140 + hash(i, 8111) * 1000 + 6 * Math.sin(F * 0.07 + i);
    if (Math.hypot(x - 540, y - 860) < 420) continue;
    if (i % 3 === 0) sparkle(x, y, 13, 0.9 + 0.1 * Math.sin(F * 0.3 + i), { seed: 8120 + i, col: '#FFFFFF', w: 3.2 });
    else fill(ell(x, y, 6, 6, 7), { col: PAL.dots, seed: 8140 + i, grain: 0, amp: 0.8 });
  }
  D.pop();
}

// =====================================================================
// CELL STATES
// =====================================================================
const WV = CUE.wave;
const reachT = c => {   // when the toner wave reaches a cell (deeper rows soak later)
  const d = Math.abs(c.x - WV.x0) / WV.reach;
  return (d >= 0.985 ? C.splash + 60 : C.splash - WV.tau * Math.log(1 - d)) + c.r * 5;
};
const DROPS = CUE.drops.map(([fl, fd, x, sz], i) => ({ fl, fd, x, sz, i }));
const hitOf = c => c.r === 0 ? DROPS.filter(d => Math.abs(d.x - c.x) < CW / 2 + 6) : [];
const sweepT = c => C.shine + (1180 - c.x) / 48;
const GAPF = CUE.gaps.map(([x, f]) => ({ x, f }));
const pipeT = c => {   // when the cream reaches above a top-row cell (tube travels right → left)
  const xs = GAPF.map(g => g.x), fs = GAPF.map(g => g.f);
  if (c.x >= xs[0]) return fs[0] - (c.x - xs[0]) / 35;
  for (let i = 1; i < xs.length; i++) if (c.x >= xs[i]) return lerp(fs[i], fs[i - 1], (c.x - xs[i]) / (xs[i - 1] - xs[i]));
  return fs[fs.length - 1] + (xs[xs.length - 1] - c.x) / 35;
};
const blinkAt = (c, f) => { const per = 52 + Math.floor(hash(c.id, 21) * 50), ph = Math.floor(hash(c.id, 22) * per); return ((f + ph) % per) < 2; };

// load from the products standing on the top row during the hook
const HOOK = [
  { k: 0, x: 815, s: 1, fl: C.land1, y0: 740, g: 3.4, r0: -0.22 },
  { k: 1, x: 540, s: 1, fl: C.land2, y0: 230, g: 3.0, r0: 0.28 },
  { k: 2, x: 265, s: 1, fl: C.land3, y0: 40, g: 1.7, r0: -0.3 },
];
const leapF = j => C.leap + 2 * j;
function hookLoad(c, f) {
  if (c.r !== 0 || f >= C.leap + 12) return 0;
  let load = 0;
  HOOK.forEach((h, j) => {
    const tl = f - h.fl, tlp = f - leapF(j);
    if (tl < 0 || tlp > 3) return;
    const w = Math.max(0, 1 - Math.abs(c.x - h.x) / 210);
    let a = tl < 2 ? 0.27 : tl < 4 ? 0.17 : 0.1;
    if (f >= C.crouch && tlp < 0) a = 0.16;
    if (tlp >= 0) a = [-0.1, -0.06, -0.02, 0][tlp];
    if (Math.abs(a * w) > Math.abs(load)) load = a * w;
  });
  return load;
}

function cellState(c, f) {
  const F = on2(f);
  const st = { dry: 1, sx: 1, sy: 1, dy: 0, rot: 0, sag: 6, crack: 1, glow: 0, dew: 0 };
  // ----- hydration (toner wave) -----
  const tr = reachT(c), h = sstep((F - tr) / 10);
  st.dry = 1 - h;
  const dryJ = 1 - h;
  st.sx = lerp(1, 0.93, dryJ); st.sy = lerp(1, 0.9, dryJ);
  st.rot = hs(c.id, 31) * 0.06 * dryJ; st.dy = hs(c.id, 32) * 5 * dryJ;
  st.sag = 7 * dryJ; st.crack = 1 - h;
  // gulp + plump wobble when the wave arrives
  const tg = F - tr;
  if (tg >= 0 && tg < 24) { const w2 = wob(tg, 0.16, 0.75); st.sx *= 1 + 0.07 * w2; st.sy *= 1 - 0.07 * w2; }
  // ----- hook weight -----
  const ld = hookLoad(c, f);
  st.sy *= 1 - ld; st.sx *= 1 + ld * 0.6;
  // dry section: breathing / tired droop
  if (f >= C.dry && f < C.tonerIn) st.sy *= 1 - 0.015 * (1 + Math.sin(F * 0.18 + c.id));
  // ----- serum -----
  let glow = 0, dew = 0;
  hitOf(c).forEach(d => { const t = F - d.fd; if (t >= 0) { glow = Math.max(glow, sstep(t / 6)); dew = Math.max(dew, sstep(t / 6)); } });
  const ts = F - sweepT(c);
  if (ts >= 0) { glow = Math.max(glow, 0.75 * sstep(ts / 8)); dew = Math.max(dew, sstep(ts / 6)); }
  hitOf(c).forEach(d => { const t = F - d.fd; if (t >= 0 && t < 14) { const w2 = wob(t, 0.2, 0.9); st.sx *= 1 + 0.05 * w2; st.sy *= 1 - 0.05 * w2; } });
  st.glow = glow; st.dew = dew;
  // ----- hero lock: crouch, jump, land -----
  const tl = f - C.lock - Math.round(Math.abs(c.x - 540) / 260);
  if (f >= C.lock - 6 && tl < 0) { st.sy *= 0.9; st.sx *= 1.05; }
  if (tl >= 0 && tl < 14) {
    const J = JUMP[tl];
    st.dy += J * (c.r === 0 ? 1 : 0.6);
    if (tl < 3) { st.sy *= 1.12; st.sx *= 0.92; }
    if (tl >= 6 && tl < 8) { st.sy *= 0.9; st.sx *= 1.06; }
    if (tl >= 8 && tl < 10) { st.sy *= 1.04; st.sx *= 0.98; }
  }
  if (f >= C.lock + 14) { st.sy *= 1 + 0.012 * Math.sin(F * 0.26 + c.id * 0.7); }
  st.mortar = sstep((F - (C.deep + c.r * 5)) / 6);
  st.face = cellFace(c, f, tr);
  return st;
}
function cellFace(c, f, tr) {
  const F = on2(f);
  let eyes = 'sleepy', mouth = hash(c.id, 12) < 0.5 ? 'flat' : 'wavy', blush = 0, look = [0, 0], sweat = 0;
  const ld = hookLoad(c, f);
  if (F < tr) {
    if (ld > 0.14) { eyes = 'oof'; mouth = 'frown'; }
    else if (f >= C.land1 && f < C.leap + 10 && Math.abs(c.x - 540) < 520) { eyes = 'open'; look = [hs(c.id, 5) * 0.4, -1]; mouth = 'flat'; }
    if (f >= C.leap && f < C.leap + 12) { eyes = 'open'; look = [0, -1]; mouth = 'o'; }
    if (f >= C.dry && f < C.tonerIn) {
      eyes = 'sleepy'; look = [0, 0.4];
      if (c.id % 4 === 1) sweat = clamp((F - C.dry) / 10);
      if (c.r === 0 && Math.abs(c.x - 540) < 20 && f >= C.yawn && f < C.yawn + 14) { eyes = 'blink'; mouth = 'open'; }
    }
    if (f >= C.tonerIn && f < tr) { eyes = 'open'; look = [clamp((690 - c.x) / 400, -1, 1), -1]; mouth = 'o'; }
  } else if (F < tr + 8) { eyes = 'blink'; mouth = 'gulp'; }
  else if (F < tr + 16) { eyes = 'wow'; mouth = 'o'; blush = 0.5; }
  else { eyes = 'open'; mouth = 'smile'; blush = 0.7; }
  // serum hit / shine
  hitOf(c).forEach(d => { const t = F - d.fd; if (t >= 0 && t < 16) { eyes = 'sparkle'; mouth = 'open'; blush = 1; } });
  const ts = F - sweepT(c); if (ts >= 0 && ts < 12) { eyes = 'sparkle'; blush = Math.max(blush, 0.9); }
  // watching the serum / tube
  if (f >= C.serumIn && f < C.pump1 && F >= tr + 16) look = [clamp((780 - c.x) / 400, -1, 1), -1];
  // cream: content once the cream passes over them
  if (c.r === 0 ? F >= pipeT(c) : F >= C.deep + c.r * 5) { eyes = 'happy'; mouth = 'smile'; blush = 1; }
  if (f >= C.lock - 6 && f < C.lock) { eyes = 'oof'; mouth = 'smile'; }
  if (f >= C.lock) { eyes = 'happy'; mouth = 'open'; blush = 1; }
  if ((eyes === 'open' || eyes === 'sleepy') && blinkAt(c, f)) eyes = 'blink';
  return { eyes, mouth, blush, look, sweat };
}

// =====================================================================
// WALL + its FX
// =====================================================================
function drawWall(f) {
  const F = on2(f);
  backing();
  // ceramide mortar (white) — piped into the top row's gaps, then soaking down to every seam
  GAPS.forEach(g => {
    let m = 0, blob = 0;
    if (g.r === 0) {
      const gp = GAPF.find(q => Math.abs(q.x - g.x) < 30);
      if (gp) { const t = F - gp.f; m = sstep(t / 6); blob = t < 0 ? 0 : Math.min(1, popIn(t) * 1.0); if (f >= C.seal + 4) blob = Math.max(0, 1 - (F - C.seal - 4) / 6); }
    } else m = sstep((F - (C.deep + g.r * 5)) / 6);
    gapMortar(g, m, blob);
  });
  for (let r = 0; r < 5; r++) {
    const t = F - (C.deep + 2 + r * 5);
    if (t > 0) seamMortar(r, lerp(1300, -240, sstep(t / 6)));
  }
  // cells (top row last so its outline sits over the seam)
  const order = CELLS.slice().sort((a, b) => b.r - a.r);
  order.forEach(c => cell(c, cellState(c, f)));
}
function topCoatSpan(xa, xb, f, o = {}) {
  if (xb - xa < 4) return;
  const th = o.th ?? 20, top = [], bot = [];
  for (let x = xa; x <= xb; x += 24) { top.push([x, ytop(x) - 6 + 2.5 * Math.sin(x * 0.021)]); bot.push([x, ytop(x) + th]); }
  top.push([xb, ytop(xb) - 4]); bot.push([xb, ytop(xb) + th]);
  fill([...top, ...bot.reverse()], { col: SK.mortar, seed: 7200, alpha: o.alpha ?? 0.95, grain: 0.25, amp: 1.2 });
  line(top, { w: 5, seed: 7201, taper: [0.03, 0.03] });
  if (o.shine !== undefined) {
    const pts = [];
    for (let x = o.shine - 130; x <= o.shine + 130; x += 26) if (x >= xa && x <= xb) pts.push([x, ytop(x) + 4]);
    if (pts.length > 1) line(pts, { w: 7, seed: 7202, col: '#FFFFFF', taper: [0.5, 0.5], amp: 0.8 });
  }
}
// dry-skin bits: flakes curling off, moisture escaping through the cracks
const FLAKES = [[180, C.dry + 2], [470, C.dry + 8], [760, C.dry + 14], [960, C.dry + 4], [320, C.dry + 20], [620, C.dry + 26]];
const WISPS = [[406, C.dry + 4], [674, C.dry + 12], [138, C.dry + 20], [942, C.dry + 28]];
function dryFX(f) {
  const F = on2(f);
  if (f < C.dry - 20 || f >= C.splash + 30) return;
  FLAKES.forEach(([x, t0], i) => {
    const t = F - t0; if (t < 0 || t > 40) return;
    const y = ytop(x) - 4 - t * 2.2 - 0.03 * t * t, xx = x + Math.sin(t * 0.18 + i) * 16 + t * 0.6;
    flake(xx, y, 1, Math.sin(t * 0.2 + i) * 0.7, 7400 + i * 5, clamp(1 - (t - 26) / 14));
  });
  WISPS.forEach(([x, t0], i) => {
    const t = F - t0; if (t < 0 || t > 44) return;
    const y = ytop(x) + 10 - t * 5.2, xx = x + Math.sin(t * 0.22 + i * 2) * 14;
    const a = clamp(1 - (t - 30) / 14);
    droplet(xx, y, 28, { seed: 7500 + i * 20, alpha: a, face: { eyes: 'wow', mouth: 'o', look: [0, -1] }, rot: Math.sin(t * 0.22 + i * 2) * 0.15 });
    if (t < 8) line([[x - 14, ytop(x) + 18], [x, ytop(x) + 2], [x + 14, ytop(x) + 18]], { w: 4, seed: 7560 + i, alpha: 1 - t / 8 });
  });
}

// =====================================================================
// PRODUCTS
// =====================================================================
function drawProd(k, x, y, s, o = {}) {
  D.push(); D.t(x, y);
  if (o.rot) D.r(o.rot);
  if (o.smear) D.st(-Math.PI / 2, o.smear);
  D.s(s * (o.sx ?? 1), s * (o.sy ?? 1));
  if (k === 0) toner(o); else if (k === 1) serum(o); else tube(o);
  D.pop();
}
const PH = [562, 482, 515];
// ---------- hook: landing, title bob, question tilt, leap ----------
function hookProducts(f) {
  if (f >= C.leap + 10) return;
  const F = on2(f);
  HOOK.forEach((h, j) => {
    const yl0 = ytop(h.x) + 8, yl = yl0 + hookLoad(CELLS.find(c => c.r === 0 && Math.abs(c.x - h.x) < 140) || CELLS[0], f) * CH;
    let y = yl, sx = 1, sy = 1, smear = 0, rot = 0, show = true;
    if (f < h.fl) {   // free fall from the staircase start (closed form), tumbling upright as it lands
      const v0 = (yl0 - h.y0 - 0.5 * h.g * h.fl * h.fl) / h.fl;
      y = h.y0 + v0 * f + 0.5 * h.g * f * f;
      smear = f === h.fl - 1 ? 2.0 : f === h.fl - 2 ? 1.4 : 1;
      rot = h.r0 * (1 - f / h.fl) ** 2;
      if (y < -10) show = false;
      D.reset(); speedLines(h.x, y - PH[h.k] * h.s * smear - 70, 170, 120, -Math.PI / 2, f, { n: 7, seed: 8200 + j * 10, speed: 0, w: 5.5, alpha: 0.9 });
    } else {
      [sx, sy] = land(f - h.fl);
      // bob on the beats while the title plays
      if (f >= C.title && f < C.crouch) { const b = (F % 12); sy *= b < 2 ? 0.95 : b < 4 ? 1.03 : 1; sx *= b < 2 ? 1.03 : b < 4 ? 0.985 : 1; }
      // curious tilt for the question
      if (f >= C.tilt && f < C.crouch) rot = (j === 1 ? 0.1 : -0.11) * spring(F - C.tilt - j * 2, 0.22, 0.6) * (j === 2 ? -1 : 1);
      if (f >= C.crouch && f < leapF(j)) { sy *= 0.86; sx *= 1.08; rot *= 0.4; }
      const tl = f - leapF(j);
      if (tl >= 0) {   // leap on 1s with smear
        y = yl - (150 * tl + 40 * tl * tl);
        smear = tl === 0 ? 1.3 : tl === 1 ? 2.1 : 1.6;
        sx = 0.92; sy = 1;
        D.reset(); speedLines(h.x, y + 60, 160, 100, Math.PI / 2, f, { n: 6, seed: 8240 + j * 10, speed: 0, w: 5 });
      }
    }
    if (!show) return;
    D.reset(); drawProd(h.k, h.x, y, h.s, { sx, sy, smear, rot });
    // impact FX on landing
    const ti = on2(f - h.fl);
    if (f - h.fl >= 0 && ti < 10) {
      D.reset();
      impactLines(h.x, yl - 10, 120, 230, 9, ti, { seed: 8260 + j * 10, life: 8, w: 7, rot: Math.PI });
      const tw = k => twinkle(ti - k, 12);
      puffs([[h.x - 120 - ti * 7, yl - 20 - ti * 2, 38 * tw(0)], [h.x - 165 - ti * 8, yl - 6, 26 * tw(1)], [h.x - 86 - ti * 5, yl - 44 - ti * 3, 24 * tw(1)],
             [h.x + 120 + ti * 7, yl - 20 - ti * 2, 36 * tw(0)], [h.x + 165 + ti * 8, yl - 6, 25 * tw(1)], [h.x + 86 + ti * 5, yl - 44 - ti * 3, 22 * tw(1)]],
        { seed: 8280 + j * 20, w: 4.5, col: SK.flake, sc: '#E9D9CD', curls: true });
    }
    // question marks over their heads
    const tq = f - (C.tilt + 4 + j * 4);
    if (tq >= 0 && f < C.crouch + 2) {
      D.reset();
      const p = popIn(tq) * popOut(f - C.crouch + 4);
      drawLettering(T.qm, h.x + (j === 1 ? 30 : -30), y - PH[h.k] * h.s - 46 + 4 * Math.sin(F * 0.4 + j), () => ({ p, r: (j - 1) * 0.15 }));
    }
  });
}

// ---------- toner ----------
const TS = 0.95, THALF = 281;
function tonerXf(f) {
  const F = on2(f);
  const o = { X: 540, Y: 1120 - THALF * TS, th: 0, sx: 1, sy: 1, smear: 0, show: f >= C.tonerIn - 10 && f < C.tonerOut + 10 };
  if (f < C.tonerIn) {   // fall in (on 1s) while the camera pulls back
    const u = (f - (C.tonerIn - 10)) / 10;
    o.Y = lerp(-300, o.Y, u * u); o.smear = f === C.tonerIn - 1 ? 2.0 : f === C.tonerIn - 2 ? 1.4 : 1;
  } else {
    const t = f - C.tonerIn;
    o.Y += kfl(on2(t), [[0, 26], [2, -14], [4, 6], [6, -2], [8, 0]]);
    [o.sx, o.sy] = t < 8 ? [[1.1, 0.9], [1.1, 0.9], [0.95, 1.06], [0.95, 1.06], [1.02, 0.98], [1.02, 0.98], [1, 1], [1, 1]][t] : [1, 1];
    o.Y += 6 * Math.sin(F * 0.25);
  }
  if (f >= C.twist && f < C.capPop) o.th = (f % 2 ? 1 : -1) * 0.022;
  o.th += kf(F, [[C.tiltT, 0], [C.tiltT + 4, 0.14], [C.pour + 2, -2.08, 'out3'], [C.pour + 8, -1.96], [C.pour + 14, -2.02], [C.pourEnd, -2.0], [C.pourEnd + 4, -2.1], [C.pourEnd + 14, 0.12, 'out3'], [C.pourEnd + 18, -0.05], [C.pourEnd + 22, 0]]);
  o.X = kf(F, [[C.tiltT, 540], [C.pour + 2, 690], [C.pourEnd + 2, 690], [C.pourEnd + 14, 540]]);
  o.Y += kf(F, [[C.tiltT, 0], [C.pour + 2, -48], [C.pourEnd + 2, -48], [C.pourEnd + 14, 0]]);
  // exit: crouch then leap off to the right (on 1s)
  const te = f - (C.tonerOut + 4);
  if (f >= C.tonerOut && te < 0) { o.sy *= 0.88; o.sx *= 1.07; }
  if (te >= 0) { o.Y -= 150 * te + 30 * te * te; o.X += 70 * te; o.smear = te === 0 ? 1.3 : te === 1 ? 2.1 : 1.6; o.th = 0.25; }
  return o;
}
function placeToner(o) { D.reset(); D.t(o.X, o.Y).r(o.th).s(TS).t(0, THALF); if (o.smear) D.st(-Math.PI / 2, o.smear); D.s(o.sx, o.sy); }
const tonerNeck = f => { placeToner(tonerXf(f)); return D.ap(0, -458); };
function capWorld(f) {   // the cap's world placement while detached (null when screwed on)
  const tp = f - C.capPop;
  if (tp < 0 || f >= C.capBack + 2) return null;
  const n0 = tonerNeck(C.capPop);
  if (f < C.capBack - 6) {
    return { x: n0[0] + 58 * tp, y: n0[1] - 46 - (66 * tp - 2.6 * tp * tp), r: 0.5 * tp, s: TS };
  }
  // falls back in (on 1s) and lands on the neck
  const nk = tonerNeck(C.capBack), u = (f - (C.capBack - 6)) / 6;
  return { x: nk[0], y: lerp(-200, nk[1] - 52, u * u), r: 0, s: TS, smear: u > 0.3 ? 1.8 : 1.2 };
}
function tonerScene(f) {
  const o = tonerXf(f);
  if (!o.show) return;
  const F = on2(f);
  const capOff = f >= C.capPop && f < C.capBack;
  const twist = f >= C.twist && f < C.capPop ? (f - C.twist) / 7 : f >= C.capBack && f < C.capClick ? 1.2 - (f - C.capBack) / 10 : 0;
  const capLift = f >= C.twist && f < C.capPop ? -(f - C.twist) * 0.8 : 0;
  placeToner(o);
  toner({ cap: capOff ? { x: 0, y: 0 } : (capLift ? { x: 0, y: capLift } : null), noCap: capOff, twist, seed: 3000 });
  // twist marks + pop burst
  if (f >= C.twist && f < C.capPop) { placeToner(o); twistMarks(0, -504, 92, 26, f - C.twist, { seed: 8300, w: 5 }); }
  const tp = f - C.capPop;
  if (tp >= 0 && tp < 10) { const nk = tonerNeck(C.capPop); D.reset(); impactLines(nk[0], nk[1] - 40, 40, 130, 10, on2(tp), { seed: 8310, w: 7, life: 9 }); starburst(nk[0], nk[1] - 30, 30, 62, 9, twinkle(on2(tp), 8) * 0.9, { seed: 8320, col: '#FFFFFF' }); }
  // flying / returning cap
  const cw = capWorld(f);
  if (cw) {
    D.reset(); D.t(cw.x, cw.y).r(cw.r); if (cw.smear) D.st(-Math.PI / 2, cw.smear); D.s(cw.s);
    tonerCap(0);
    if (f < C.capBack - 6 && tp < 12) { D.reset(); speedLines(cw.x - 30, cw.y + 70, 90, 40, Math.PI / 2 + 0.4, f, { n: 4, seed: 8330, speed: 0, w: 4 }); }
  }
  if (f >= C.capBack && f < C.capBack + 8) { const nk = tonerNeck(C.capBack); D.reset(); impactLines(nk[0], nk[1] - 50, 70, 130, 8, on2(f - C.capBack), { seed: 8340, w: 6, life: 7 }); }
  if (f >= C.capBack + 2 && f < C.capClick) { placeToner(o); twistMarks(0, -504, 92, 26, f - C.capBack, { seed: 8350, w: 5, rot: 1 }); }
  if (f >= C.capClick && f < C.capClick + 10) { const nk = tonerNeck(C.capClick); D.reset(); sparkle(nk[0] + 70, nk[1] - 90, 30, twinkle(on2(f - C.capClick), 10), { seed: 8360, col: '#FFFFFF' }); }
}
// milk stream from the neck to the skin, then the wave
function pour(f) {
  if (f < C.pour || f >= C.pourEnd + 8) return;
  const [nx, ny] = tonerNeck(f), F = on2(f);
  const ix = 540, iy = ytop(540) - 6;
  const pts = [[nx, ny], [nx - 12, ny + 40], [lerp(nx, ix, 0.7) + 6 * Math.sin(F * 0.7), lerp(ny, iy, 0.62)], [ix, iy]];
  const a = f >= C.pourEnd ? clamp((f - C.pourEnd) / 7) : 0, b = clamp((f - C.pour) / 6);
  D.reset();
  stream(pts, 34, { trim: [a, b], seed: 8400 });
}
function wave(f) {
  const t0 = f - C.splash;
  if (t0 < 0) return;
  const F = on2(f), t = on2(t0);
  const d = WV.reach * (1 - Math.exp(-t / WV.tau)), xl = 540 - d, xr = 540 + d;
  const soak = clamp((F - C.splash - 16) / 34);
  D.reset();
  if (soak < 1) {
    const th = 30 * (1 - soak) + 6, top = [], bot = [];
    for (let x = xl; x <= xr + 0.1; x += 18) {
      const edge = Math.min(x - xl, xr - x), tip = sstep(edge / 26), bul = (1 + 0.6 * Math.exp(-edge / 45) * (1 - soak)) * tip;
      top.push([x, ytop(x) - th * bul * (0.85 + 0.15 * Math.sin(x * 0.035 + F * 0.4))]);
      bot.push([x, ytop(x) + 24 * tip]);
    }
    if (top.length > 1) {
      fill([...top, ...bot.slice().reverse()], { col: FXC.cream, seed: 8500, amp: 1.6, grain: 0.3, alpha: 0.97 });
      line(top, { w: 5, seed: 8501, taper: [0.08, 0.08] });
      const mid = top.filter((p, i) => i % 2 === 0).map(([x, y]) => [x, y + th * 0.45]);
      if (mid.length > 2) line(mid, { w: 4, seed: 8502, col: '#FFFFFF', taper: [0.3, 0.3], alpha: 0.9 });
      // curling lips at the fronts
      [[xl, -1], [xr, 1]].forEach(([x, s], i) => {
        if (x < -60 || x > 1140 || soak > 0.6) return;
        const y = ytop(x) - th * 1.6;
        line(arcPts(x - s * 6, y + 14, 22, 18, s > 0 ? -2.6 : -0.5, s > 0 ? 0.4 : -3.5, 8), { w: 5, seed: 8503 + i, taper: [0.1, 0.4] });
      });
    }
  }
  // crown at the impact and droplets flung from the fronts
  crown(540, ytop(540) - 4, on2(f - C.splash), { seed: 8510, life: 14, r: 64, h: 60 });
  splash(540, ytop(540) - 20, on2(f - C.splash), { n: 8, r: 12, speed: 15, dir: -Math.PI / 2, spread: 1.25, col: FXC.cream, seed: 8520, life: 18, g: 1.3 });
  [[xl, -1], [xr, 1]].forEach(([x, s], i) => {
    for (let k = 0; k < 3; k++) {
      const te = on2(f - C.splash) - 4 - k * 6;
      if (te < 0) continue;
      const de = WV.reach * (1 - Math.exp(-(on2(t0) - te) / WV.tau));
      splash(540 + s * de, ytop(540 + s * de) - 30, te, { n: 3, r: 9, speed: 10, dir: s > 0 ? -1.0 : -2.15, spread: 0.5, col: FXC.cream, seed: 8530 + i * 10 + k, life: 14, g: 1.2 });
    }
  });
}

// ---------- serum ----------
const SS = 1.12, SHALF = 241;
function serumXf(f) {
  const F = on2(f);
  const o = { X: 820, Y: 1150 - SHALF * SS, th: 0, sx: 1, sy: 1, smear: 0, press: 0, show: f >= C.serumIn - 6 && f < C.serumOut + 10 };
  if (f < C.serumIn) { const u = (f - (C.serumIn - 6)) / 6; o.Y = lerp(-420, o.Y, u * u); o.smear = f === C.serumIn - 1 ? 2.0 : f === C.serumIn - 2 ? 1.4 : 1; }
  else {
    const t = f - C.serumIn;
    o.Y += kfl(on2(t), [[0, 26], [2, -14], [4, 6], [6, -2], [8, 0]]);
    [o.sx, o.sy] = t < 8 ? [[1.1, 0.9], [1.1, 0.9], [0.95, 1.06], [0.95, 1.06], [1.02, 0.98], [1.02, 0.98], [1, 1], [1, 1]][t] : [1, 1];
    o.Y += 6 * Math.sin(F * 0.25 + 1);
  }
  o.th = kf(F, [[C.serumIn + 2, 0], [C.pump1 - 4, -0.3], [C.pump2 - 4, -0.3], [C.pump2 - 1, -0.62], [C.pump3 - 4, -0.62], [C.pump3 - 1, -0.96], [C.pump3 + 14, -0.96], [C.pump3 + 26, 0]]);
  [C.pump1, C.pump2, C.pump3].forEach(fp => {
    const d = f - fp;
    if (d >= 0 && d < 5) { o.press = [1, 1, 0.55, 0.2, 0][d]; o.sy *= 1 - 0.05 * o.press; o.sx *= 1 + 0.03 * o.press; }
  });
  const te = f - (C.serumOut + 4);
  if (f >= C.serumOut && te < 0) { o.sy *= 0.88; o.sx *= 1.07; }
  if (te >= 0) { o.Y -= 150 * te + 30 * te * te; o.X -= 80 * te; o.smear = te === 0 ? 1.3 : te === 1 ? 2.1 : 1.6; o.th = -0.3; }
  return o;
}
function placeSerum(o) { D.reset(); D.t(o.X, o.Y).r(o.th).s(SS).t(0, SHALF); if (o.smear) D.st(-Math.PI / 2, o.smear); D.s(o.sx, o.sy); }
function serumNoz(f) { const o = serumXf(f); placeSerum(o); const [x, y] = serumNozzle(o.press); return D.ap(x, y); }
function serumScene(f) {
  const o = serumXf(f);
  if (!o.show) return;
  placeSerum(o);
  serum({ press: o.press, seed: 3100 });
  [C.pump1, C.pump2, C.pump3].forEach((fp, i) => {
    const d = f - fp;
    if (d >= 0 && d < 8) {
      const [nx, ny] = serumNoz(fp);
      D.reset(); impactLines(nx, ny, 18, 70, 7, on2(d), { seed: 8600 + i * 10, w: 5, life: 7 });
      placeSerum(o); D.push(); D.t(0, -500); line(arcPts(0, 0, 40, 14, Math.PI * 1.1, Math.PI * 1.9, 6), { w: 5, seed: 8620 + i, taper: [0.3, 0.3], alpha: d < 4 ? 1 : 0.5 }); D.pop();
    }
  });
}
function serumDrops(f) {
  DROPS.forEach(d => {
    if (f < d.fl || f > d.fd + 16) return;
    const [x0, y0] = serumNoz(d.fl);
    const yt = ytop(d.x) + 2, T2 = d.fd - d.fl, g = 1.25;
    const vx = (d.x - x0) / T2, vy = (yt - y0 - 0.5 * g * T2 * T2) / T2;
    const r = d.sz;
    D.reset();
    if (f < d.fd) {
      const t = Math.max(0, on2(f) - d.fl), x = x0 + vx * t, y = y0 + vy * t + 0.5 * g * t * t;
      const vyy = vy + g * t, sp = Math.hypot(vx, vyy), k = 1 + Math.min(0.45, sp * 0.012);
      const a = Math.atan2(vyy, vx) - Math.PI / 2;
      droplet(x, y, r, { seed: 8700 + d.i * 30, rot: a + Math.PI, sx: 1 / Math.sqrt(k), sy: k, face: t > 1 && r >= 24 ? { eyes: t > 6 ? 'happy' : 'open', mouth: 'smile', blush: 0.8 } : null, col: '#C8F0E2', sh: '#8FD8C0' });
    } else {
      const t = on2(f - d.fd);
      if (t < 4) droplet(d.x, yt - r * (1 - t / 4) * 0.6, r * (1 - t / 5), { seed: 8700 + d.i * 30, sx: 1 + t * 0.2, sy: 1 - t * 0.2, col: '#C8F0E2', sh: '#8FD8C0' });
      ripple(d.x, yt + 4, 46, 12, t, { seed: 8790 + d.i * 3, w: 5, col: '#FFFFFF', life: 12 });
      sparkle(d.x + 30, yt - 40, 20, twinkle(t, 12), { seed: 8820 + d.i, col: '#FFFFFF', w: 3.5 });
    }
  });
}
function shineSweep(f) {
  const t = on2(f - C.shine);
  if (f < C.shine || t > 30) return;
  const x = 1180 - t * 48 * 1.0;
  D.reset();
  sparkle(x, ytop(x) - 30, 46, 1, { seed: 8850, col: '#FFFFFF', rot: t * 0.1, w: 4.5 });
  sparkle(x + 60, ytop(x + 60) - 80, 22, twinkle(t % 10, 10), { seed: 8851, col: '#FFFFFF', w: 3.5 });
}

// ---------- cream tube ----------
const CS = 1.0;
const GF0 = GAPF.map(g => g.f);
const PIPE_X0 = 1120;
function tubePath(f) {   // nozzle x while piping (right → left through the gap keys, linear)
  const K = [[C.squirt + 4, PIPE_X0], ...GAPF.map(g => [g.f, g.x])];
  return kf(f, K.map(k => [k[0], k[1], 'lin']));
}
function tubeXf(f) {
  const F = on2(f);
  const o = { X: 540, Y: 1110, th: 0, sx: 1, sy: 1, smear: 0, smearA: -Math.PI / 2, sq: 0, show: f >= C.creamIn - 6 && f < C.creamOut + 10 };
  if (f < C.creamIn) { const u = (f - (C.creamIn - 6)) / 6; o.Y = lerp(-420, o.Y, u * u); o.smear = f === C.creamIn - 1 ? 2.0 : f === C.creamIn - 2 ? 1.4 : 1; return o; }
  const t = f - C.creamIn;
  o.Y += kfl(on2(t), [[0, 26], [2, -14], [4, 6], [6, -2], [8, 0]]);
  if (t < 8) [o.sx, o.sy] = [[1.1, 0.9], [1.1, 0.9], [0.95, 1.06], [0.95, 1.06], [1.02, 0.98], [1.02, 0.98], [1, 1], [1, 1]][t];
  if (f < C.squirt) {   // squeeze: anticipation stretch, then crush and tremble (on 1s)
    o.Y += 6 * Math.sin(F * 0.25 + 2);
    o.sq = kf(f, [[C.squeeze, 0], [C.squeeze + 3, -0.08], [C.squirt - 2, 0.52, 'in2']]);
    if (f >= C.squeeze + 6) o.X += (f % 2 ? 1 : -1) * 4 * (f - C.squeeze - 5) / 6;
    if (f >= C.squeeze && f < C.squeeze + 3) o.sy *= 1.04;
    return o;
  }
  o.sq = 0.5 + 0.06 * Math.sin(F * 1.1);
  if (f < C.squirt + 4) {   // hop in an arc to the right edge (on 2s, one smear drawing)
    const u = E.io2((F - C.squirt) / 4);
    o.X = lerp(540, PIPE_X0, u); o.Y = lerp(1110, ytop(PIPE_X0) + 18, u) - 150 * Math.sin(u * Math.PI);
    o.th = 0.3 * Math.sin(u * Math.PI);
    return o;
  }
  if (f < C.flip) {   // piping right → left, dipping into each gap (on 2s)
    const x = tubePath(F);
    o.X = x; o.Y = ytop(x) + 18 - 16 * (1 - Math.cos(TAU * (F - GF0[0]) / 6)) / 2; o.th = -0.14;
    o.sq = 0.5 + 0.1 * (1 - Math.cos(TAU * (F - GF0[0]) / 6)) / 2;
    return o;
  }
  const x1 = GAPF[GAPF.length - 1].x;
  if (f < C.tada) {   // back-flip up to centre stage (on 1s; smear on the two fastest frames)
    const u = (f - C.flip) / (C.tada - C.flip), e = E.io2(u);
    o.X = lerp(x1, 540, e); o.Y = lerp(ytop(x1) + 18, 1110, e) - 190 * Math.sin(u * Math.PI);
    o.th = -0.14 + (TAU + 0.14) * E.io3(u); o.sq = lerp(0.5, 0.3, u);
    return o;
  }
  // ta-da landing at hover, then it re-inflates with a pop and idles until it leaves
  const tl = f - C.tada;
  [o.sx, o.sy] = tl < 8 ? [[1.14, 0.86], [1.14, 0.86], [0.94, 1.07], [0.94, 1.07], [1.03, 0.97], [1.03, 0.97], [1, 1], [1, 1]][tl] : [1, 1];
  o.sq = f < C.inflate ? 0.3 : 0.3 * Math.exp(-(F - C.inflate) / 3) * Math.cos((F - C.inflate) * 0.9);
  if (f >= C.inflate && f < C.inflate + 4) { o.sx *= 1.08; o.sy *= 0.95; }
  o.Y += 6 * Math.sin(F * 0.25 + 2);
  const te = f - (C.creamOut + 4);
  if (f >= C.creamOut && te < 0) { o.sy *= 0.88; o.sx *= 1.07; }
  if (te >= 0) { o.Y -= 150 * te + 30 * te * te; o.X += 70 * te; o.smear = te === 0 ? 1.3 : te === 1 ? 2.1 : 1.6; o.smearA = -Math.PI / 2; o.th = 0.25; }
  return o;
}
function placeTube(o) { D.reset(); D.t(o.X, o.Y).t(0, -258).r(o.th).t(0, 258); if (o.smear) D.st(o.smearA, o.smear); D.s(CS * o.sx, CS * o.sy); }
function capTubeWorld(f) {
  const t = f - C.squirt;
  if (t < 0 || f >= C.inflate) return null;
  if (f >= C.inflate - 8) {   // the return flight (on 1s), spinning, lands on the nozzle at C.inflate
    const u = (f - (C.inflate - 8)) / 8, o = tubeXf(C.inflate);
    return { x: lerp(-140, o.X, E.out2(u)), y: lerp(1150, o.Y - 51, u) - 300 * Math.sin(u * Math.PI), r: -TAU * 2 * (1 - E.out2(u)), smear: u > 0.25 && u < 0.6 ? 1.6 : 0 };
  }
  if (t > 40) return null;
  const x0 = 540, y0 = 1060;
  if (t < 4) return { x: x0, y: y0 + 34 * t + 3 * t * t, r: 0.1 * t, smear: t >= 2 ? 1.8 : 1.2 };
  const u = on2(t - 4);   // bonk on the skin, bounce away to the left, rolling (on 2s)
  const hop = 34 * u - 2.6 * u * u;
  return { x: x0 - 46 * u, y: ytop(x0 - 46 * u) - 52 - Math.max(0, hop), r: -0.5 * u };
}
function ribbonEnd(f) { return f < C.flip ? tubePath(on2(f)) : GAPF[GAPF.length - 1].x; }
function ribbon(f) {   // the piped cream trail resting on the surface
  if (f < C.squirt + 4 || f >= C.seal + 10) return;
  const xEnd = ribbonEnd(f);
  const pts = [];
  for (let x = PIPE_X0 + 60; x >= xEnd; x -= 22) pts.push([x, ytop(x) - 8 + 3 * Math.sin(x * 0.05)]);
  pts.push([xEnd, ytop(xEnd) - 8]);
  if (pts.length < 2) return;
  D.reset();
  line(pts, { w: 34, seed: 8900, taper: [0.02, 0.06] });
  line(pts, { w: 24, seed: 8901, col: FXC.cream, taper: [0.02, 0.06] });
  line(pts.map(([x, y]) => [x, y - 5]), { w: 5, seed: 8902, col: '#FFFFFF', taper: [0.2, 0.2], amp: 1 });
}
function creamScene(f) {
  const o = tubeXf(f);
  const cw = capTubeWorld(f);
  if (cw) { D.reset(); D.t(cw.x, cw.y).r(cw.r); if (cw.smear) D.st(-Math.PI / 2, cw.smear); tubeCap(); }
  const tb = f - C.squirt;
  if (tb >= 3 && tb < 10) { D.reset(); impactLines(540, ytop(540) - 10, 60, 150, 9, on2(tb - 3), { seed: 9000, w: 6, life: 7, rot: Math.PI }); }
  if (!o.show) return;
  placeTube(o);
  tube({ sq: o.sq, capOff: f >= C.squirt && f < C.inflate ? { x: 0, y: 0 } : null, seed: 3200 });
  if (f >= C.squeeze + 6 && f < C.squirt) { placeTube(o); D.push(); D.t(0, -260); [-1, 1].forEach((s, i) => line([[s * 150, -40], [s * 175, 0], [s * 150, 40]], { w: 5, seed: 9010 + i, sharp: true, taper: [0.2, 0.2] })); D.pop(); }
  if (f >= C.squirt && f < C.squirt + 6) { D.reset(); starburst(540, 1120, 26, 60, 9, twinkle(on2(f - C.squirt), 6), { seed: 9020, col: '#FFFFFF' }); }
  if (f >= C.flip && f < C.tada) { D.reset(); twistMarks(o.X, o.Y - 250, 180, 180, f - C.flip, { seed: 9030, w: 6 }); }
  if (f >= C.inflate && f < C.inflate + 8) { placeTube(o); D.push(); D.t(0, -260); impactLines(0, 0, 170, 250, 10, on2(f - C.inflate), { seed: 9045, w: 6, life: 7 }); D.pop(); }
  const te = f - (C.creamOut + 4);
  if (te >= 0 && te < 8) { D.reset(); speedLines(o.X - 40, o.Y + 120, 220, 120, Math.PI / 2 + 0.3, f, { n: 6, seed: 9040, speed: 0, w: 5 }); }
}
function coat(f) {   // the ribbon relaxes into a smooth glossy seal over the whole surface
  if (f < C.seal) return;
  const F = on2(f), u = sstep((F - C.seal) / 8);
  const xa = lerp(GAPF[GAPF.length - 1].x, -240, u), xb = lerp(PIPE_X0 + 60, 1320, u);
  const sh = f >= C.deep && f < C.deep + 40 ? lerp(1250, -150, (F - C.deep) / 40) : (f >= C.lock + 2 && f < C.lock + 16 ? lerp(-150, 1250, (F - C.lock - 2) / 14) : undefined);
  D.reset();
  topCoatSpan(xa, xb, f, { th: lerp(12, 22, u), shine: sh });
  if (f >= C.seal + 6) [[160, 0], [420, 6], [700, 12], [930, 18]].forEach(([x, d], i) => sparkle(x, ytop(x) - 34, 24, twinkle((F - C.seal - 6 - d) % 34, 16), { seed: 9050 + i, col: '#FFFFFF', w: 3.5 }));
}

// ---------- hero: the three land together on the healed wall and ride the cells' jump ----------
const HERO = [{ k: 0, x: 815, f0: C.heroIn }, { k: 1, x: 540, f0: C.heroIn + 2 }, { k: 2, x: 265, f0: C.heroIn + 4 }];
const JUMP = [-34, -52, -46, -34, -18, -18, 0, 0, 0, 0, 0, 0, 0, 0];
function heroProducts(f) {
  if (f < C.heroIn || f >= C.lensPop) return;
  HERO.forEach((h, j) => {
    const yl = ytop(h.x) + 8;
    let y = yl, sx = 1, sy = 1, smear = 1;
    if (f < C.lock) {
      const u = (f - h.f0) / (C.lock - h.f0);
      if (u < 0) return;
      y = lerp(150, yl, u * u);
      smear = f === C.lock - 1 ? 2.0 : f === C.lock - 2 ? 1.4 : 1;
      D.reset(); speedLines(h.x, y - PH[h.k] - 70, 170, 120, -Math.PI / 2, f, { n: 6, seed: 9190 + j * 10, speed: 0, w: 5.5 });
    } else {
      const tl = f - C.lock - Math.round(Math.abs(h.x - 540) / 260);
      [sx, sy] = land(Math.max(0, f - C.lock));
      if (tl >= 0 && tl < JUMP.length) y += JUMP[tl];
      if (f >= C.lock + 14) { const b = Math.sin(on2(f) * 0.26 + j); sy *= 1 + 0.015 * b; }
    }
    D.reset(); drawProd(h.k, h.x, y, 1, { sx, sy, smear });
  });
}

// ---------- hero lock ----------
function lockFX(f) {   // sunburst of alternating white / mint rays + an expanding ring, rotating slowly on 2s
  const t = f - C.lock;
  if (t < 0 || f >= C.zoom + 4) return;
  const F = on2(f);
  const cx = 540, cy = ytop(540) - 10;
  const R = t < 2 ? [520, 1100][t] : 1500;
  D.reset();
  const n = 20, rot = F * 0.008;
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * TAU, b = a + TAU / n * 0.55;
    fill([[cx, cy], [cx + Math.cos(a) * R, cy + Math.sin(a) * R], [cx + Math.cos(b) * R, cy + Math.sin(b) * R]],
      { col: i % 2 ? PAL.mint : '#FFFFFF', seed: 9100 + i, sharp: true, amp: 1.6, grain: 0.35, alpha: i % 2 ? 0.85 : 0.95 });
  }
  // the ring shockwave (on 1s while fast, then on 2s)
  const rr = t < 4 ? [140, 300, 420, 500][t] : kf(on2(t), [[4, 500], [14, 680, 'out2']]);
  const ra = t < 14 ? 1 : 0;
  if (ra) {
    line(ell(cx, cy, rr, rr * 0.92, 28), { w: Math.max(3, 16 - t), seed: 9110, closed: true, taper: [0, 0] });
    line(ell(cx, cy, rr * 0.82, rr * 0.75, 24), { w: Math.max(2, 8 - t * 0.5), seed: 9111, closed: true, taper: [0, 0], col: '#FFFFFF' });
  }
  fill(ell(cx, cy, 190, 170, 20), { col: PAL.sun, seed: 9112, grain: 0.35 });
  line(ell(cx, cy, 190, 170, 20), { w: 6, seed: 9113, closed: true, taper: [0, 0] });
}
function lockFront(f) {
  const t = f - C.lock;
  if (t < 0 || f >= C.zoom + 4) return;
  D.reset();
  const t2 = on2(t);
  confetti(540, ytop(540) - 20, t2, { n: 20, speed: 34, spread: 1.35, life: 30, seed: 9120, r: 19, g: 1.2 });
  confetti(300, ytop(300) - 20, t2 - 2, { n: 9, speed: 26, spread: 0.9, life: 26, seed: 9140, r: 16, dir: -2.1 });
  confetti(780, ytop(780) - 20, t2 - 2, { n: 9, speed: 26, spread: 0.9, life: 26, seed: 9160, r: 16, dir: -1.05 });
  impactLines(540, ytop(540) - 20, 280, 560, 18, t2, { seed: 9180, w: 9, life: 9 });
}

// =====================================================================
// THE WORLD (hook → dry → toner → serum → cream → lock)
// =====================================================================
function camera(f) {
  const F = on2(f);
  let s = 1, cx = 540, cy = 1380;
  if (f >= C.leap && f < C.tonerIn + 4) { s = kf(F, [[C.leap, 1], [C.leap + 16, 1.3], [C.tonerIn - 20, 1.34, 'sine'], [C.tonerIn + 4, 1]]); cy = 2300; }
  else if (f >= C.tonerIn + 4 && f < C.lock) {
    const bump = (a, b, c2, d) => sstep((F - a) / (b - a)) * (1 - sstep((F - c2) / (d - c2)));
    const pT = bump(C.pour - 4, C.splash + 6, C.pourEnd + 4, C.capBack + 6), pS = bump(C.pump1 - 6, C.pump1 + 8, C.shine + 4, C.serumOut);
    const pC = bump(C.squirt - 2, C.squirt + 8, C.flip + 2, C.tada + 8);
    s = 1 + 0.08 * pT + 0.04 * pS + 0.14 * pC;
    cy = lerp(1380, 2000, Math.max(pT, pS, pC));
  }
  else if (f >= C.lock) s = 1 + 0.03 * E.out2(clamp((F - C.lock) / 12));
  const [ox, oy] = shake(f, [[C.land1, 12], [C.land2, 9], [C.land3, 9], [C.capPop, 4], [C.splash, 7], [C.squirt + 4, 8], [C.lock, 18]]);
  return [s, 0, 0, s, cx - cx * s + ox, cy - cy * s + oy];
}
function world(f, cam) {
  G.cam = cam;
  D.reset();
  bg(PAL.sky);
  D.reset(); skyDeco(f);
  D.reset(); lockFX(f);
  D.reset(); drawWall(f);
  D.reset(); dryFX(f);
  wave(f);
  ribbon(f);
  coat(f);
  shineSweep(f);
  hookProducts(f);
  tonerScene(f);
  pour(f);
  serumScene(f);
  serumDrops(f);
  creamScene(f);
  heroProducts(f);
  lockFront(f);
}
function worldText(f) {
  // hook title + question
  title({ ku: T.title, ar: T.titleAr }, f, C.title, C.question - 6, 300, 410, 4);
  title({ ku: T.q, ar: T.qAr }, f, C.question + 2, C.qOut, 330, 450, 4, 10);
  // product headers + lines + chips
  header(0, f, C.tonerIn + 4, C.tonerOut);
  title(T.lines[0], f, C.tonerLine, C.tonerOut, 360, 448);
  chip(T.tChip, 214, 800, chipP(f, C.tonerChip, C.tonerOut + 2), 9200);
  header(1, f, C.serumIn + 4, C.serumOut - 2);
  title(T.lines[1], f, C.serumLine, C.serumOut - 2, 360, 448);
  chip(T.sChips[0], 300, 660, chipP(f, C.serumChips, C.serumOut), 9210, PAL.mintD);
  chip(T.sChips[1], 300, 756, chipP(f, C.serumChips + 6, C.serumOut + 2), 9220, PC.labelSh);
  header(2, f, C.creamIn + 4, C.creamOut);
  title(T.lines[2], f, C.creamLine, C.creamOut, 360, 448);
  chip(T.cChips[0], 370, 530, chipP(f, C.creamChips, C.creamOut + 2), 9230, PC.labelSh);
  chip(T.cChips[1], 720, 530, chipP(f, C.creamChips + 6, C.creamOut + 4), 9240, PAL.mintD);
}

// =====================================================================
// HERO — zoom out from the wall to her cheek; result line; star wipe
// =====================================================================
const RL = 96, WRAD = 760, WC = [540, 1400], LK = RL / WRAD, S0 = 1 / LK;
const FY = 880, FS = 1.12, QREST = [540 + FS * LENS[0], FY + FS * LENS[1]];
function zoomS(f) {
  if (f < C.zoom) return S0;
  if (f >= C.lensPop) return 1;
  const u = E.out3((f - C.zoom) / (C.lensPop - C.zoom));
  return Math.exp(Math.log(S0) * (1 - u));
}
function girlPose(f) {
  const F = on2(f);
  const p = { eyes: 'open', mouth: 'open', blush: 1, glow: 1, look: [0.1, -0.05], tilt: 0, swingL: 0, swingR: 0 };
  if (f >= C.wink && f < C.wink + 10) { p.eyes = 'wink'; }
  const tw = F - C.wink;
  p.tilt = tw >= 0 ? 0.07 * spring(tw, 0.2, 0.55) * (f < C.wink + 12 ? 1 : 0.6) : 0;
  if (f >= C.result) p.tilt = 0.042 * Math.sin(TAU * (F - C.result) / 24) + 0.03;
  // braids follow through (lag 4 frames, 1.6x)
  const lagT = F - 4;
  const tiltAt = g => g >= C.result ? 0.042 * Math.sin(TAU * (g - C.result) / 24) + 0.03 : (g - C.wink >= 0 ? 0.07 * spring(g - C.wink, 0.2, 0.55) : 0);
  p.swingL = -1.6 * tiltAt(lagT); p.swingR = -1.6 * tiltAt(lagT);
  if (f < C.lensPop) { p.look = [0.2, 0.1]; }
  return p;
}
function heroBg(f) {
  const F = on2(f);
  bg(PAL.mintBg);
  D.abs();
  for (let i = 0; i < 14; i++) {
    const a = F * 0.004 + i / 14 * TAU, b = a + TAU / 28;
    fill([[540, 900], [540 + Math.cos(a) * 1700, 900 + Math.sin(a) * 1700], [540 + Math.cos(b) * 1700, 900 + Math.sin(b) * 1700]], { col: PAL.mintRay, seed: 9300 + i, sharp: true, amp: 2, grain: 0.4 });
  }
  fill(ell(540, 880, 420, 420, 22), { col: PAL.halo, seed: 9320, grain: 0.4 });
}
function heroScene(f) {
  const F = on2(f);
  const s = zoomS(f), u = (S0 - s) / (S0 - 1);
  const Q = [lerp(WC[0], QREST[0], u), lerp(WC[1], QREST[1], u)];
  heroBg(f);
  // the girl (camera: cheek point → Q, scale s)
  G.cam = [s, 0, 0, s, Q[0] - s * LENS[0], Q[1] - s * LENS[1]];
  D.reset(); D.t(540 - QREST[0] + LENS[0], FY - QREST[1] + LENS[1]);
  // (face centre sits at (540, FY) at rest)
  D.reset(); D.m = [s * FS, 0, 0, s * FS, Q[0] - s * FS * LENS[0], Q[1] - s * FS * LENS[1]];
  girl(girlPose(f));
  // zoom speed lines (screen space)
  if (f >= C.zoom && f < C.lensPop) {
    D.abs();
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU + hs(i, 9330) * 0.15, r0 = 420 + 200 * hash(i + f, 9331), r1 = r0 + 260;
      line([[Q[0] + Math.cos(a) * r0, Q[1] + Math.sin(a) * r0], [Q[0] + Math.cos(a) * r1, Q[1] + Math.sin(a) * r1]], { w: 6, seed: 9340 + i, taper: [0.8, 0.1], abs: true });
    }
  }
  // the lens: macro wall inside the circle
  let R = 0;
  if (f < C.zoom) R = kf(f, [[C.iris, 1500], [C.zoom, RL * S0, 'in2']]);
  else if (f < C.lensPop) R = RL * s * FS;
  if (R > 0) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.arc(Q[0], Q[1], R, 0, TAU); ctx.clip();
    const k = s * LK;
    world(f, [k, 0, 0, k, Q[0] - k * WC[0], Q[1] - k * WC[1]]);
    ctx.restore();
    D.abs();
    line(ell(Q[0], Q[1], R, R, 28), { w: Math.max(6, 9 * Math.min(2, R / 300)), seed: 9350, closed: true, taper: [0, 0], abs: true });
    line(arcPts(Q[0], Q[1], R * 0.86, R * 0.86, Math.PI * 1.1, Math.PI * 1.38, 10), { w: Math.max(4, R * 0.03), seed: 9351, col: '#FFFFFF', taper: [0.4, 0.4], abs: true, alpha: 0.8 });
  }
  // lens pop
  const tp = on2(f - C.lensPop);
  if (f >= C.lensPop && tp < 14) {
    D.abs();
    ripple(QREST[0], QREST[1], 120, 120, tp, { seed: 9360, w: 7, col: '#FFFFFF', life: 12, n: 2 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.4, d = 70 + tp * 12; sparkle(QREST[0] + Math.cos(a) * d, QREST[1] + Math.sin(a) * d, 26, twinkle(tp, 12), { seed: 9370 + i, col: '#FFFFFF' }); }
  }
  // cheek / eye sparkles once revealed
  if (f >= C.lensPop) {
    D.abs();
    [[QREST[0] + 10, QREST[1] - 30, 0], [540 - 150 * FS, FY + 40 * FS, 9], [540 + 60 * FS, FY - 190 * FS, 17], [QREST[0] + 90, FY - 60 * FS, 25]].forEach(([x, y, d], i) => {
      sparkle(x, y, 30, twinkle((F - C.lensPop - d + 400) % 34, 22), { seed: 9380 + i, col: '#FFFFFF' });
    });
    const tw = on2(f - C.wink);
    if (f >= C.wink && tw < 14) { sparkle(540 + 175 * FS, FY - 40 * FS, 44, twinkle(tw, 14), { seed: 9390, col: '#FFFFFF', rot: tw * 0.1 }); impactLines(540 + 175 * FS, FY - 40 * FS, 40, 100, 8, tw, { seed: 9391, w: 5, life: 8 }); }
  }
  // result line
  title(T.result, f, C.result, C.starWipe - 4, 250, 345, 4, 16);
}
function starWipe(f) {
  const t = f - C.starWipe;
  if (t < 0 || f >= C.end) return false;
  const r = kf(on2(t), [[0, 30], [12, 2600, 'in2']]);
  const cx = 540 + 150 * FS, cy = FY + 30 * FS;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  D.abs(); D.push(); D.t(cx, cy).r(on2(t) * 0.05);
  const P = star4(r, 0.38);
  ctx.beginPath();
  // clip to the star (sharp polygon)
  P.forEach(([x, y], i) => { const q = D.ap(x, y); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
  ctx.closePath(); ctx.clip();
  D.pop();
  endCard(f, true);
  ctx.restore();
  D.abs(); D.push(); D.t(cx, cy).r(on2(t) * 0.05);
  line(star4(r, 0.38), { w: 10, seed: 9400, closed: true, sharp: true, taper: [0, 0] });
  D.pop();
  return true;
}

// =====================================================================
// END CARD — the routine 1-2-3, logo, tagline; hold on 3s
// =====================================================================
const END = [
  { k: 0, x: 826, s: 0.9, f: C.e1 }, { k: 1, x: 540, s: 0.96, f: C.e2 }, { k: 2, x: 254, s: 0.9, f: C.e3 },
];
const EBASE = 1236;
function endCard(f, preview = false) {
  const F = on2(f), H3 = on3(f), hold = f >= C.hold;
  const Fh = hold ? H3 : F;
  bg(PAL.pinkBg);
  D.abs();
  for (let i = 0; i < 12; i++) {
    const a = Fh * 0.0035 + i / 12 * TAU, b = a + TAU / 24;
    fill([[540, 960], [540 + Math.cos(a) * 1800, 960 + Math.sin(a) * 1800], [540 + Math.cos(b) * 1800, 960 + Math.sin(b) * 1800]], { col: PAL.ray, seed: 9500 + i, sharp: true, amp: 2, grain: 0.4 });
  }
  if (preview) return;
  // floor shadows
  END.forEach((e, j) => { const p = clamp((f - e.f + 2) / 4); if (p > 0) fill(ell(e.x, EBASE + 8, 120 * e.s * p, 20 * p, 14), { col: '#EBA8BA', seed: 9520 + j, grain: 0.3 }); });
  // products drop in on the beats (smear, squash), hop on the final hit, breathe on the hold
  END.forEach((e, j) => {
    const t = f - e.f;
    if (t < -6) return;
    let y = EBASE, sx = 1, sy = 1, smear = 0;
    if (t < 0) { const u = (t + 6) / 6; y = lerp(-300, EBASE, u * u); smear = t === -1 ? 2.0 : t === -2 ? 1.4 : 1; }
    else [sx, sy] = land(t);
    const tf = f - C.final + j;
    if (tf >= -4 && tf < 0) { sy *= 0.9; sx *= 1.06; }
    if (tf >= 0 && tf < 10) { y -= [40, 64, 70, 64, 46, 20, 0, 0, 0, 0][tf]; if (tf < 3) { sy *= 1.08; sx *= 0.95; } if (tf >= 6 && tf < 8) { sy *= 0.92; sx *= 1.05; } }
    if (hold && tf >= 12) { const b = Math.sin(H3 * 0.21 + j * 1.3); sy *= 1 + 0.012 * b; sx *= 1 - 0.008 * b; }
    D.abs(); drawProd(e.k, e.x, y, e.s, { sx, sy, smear });
    const tp2 = on2(t);
    if (t >= 0 && t < 10) { D.abs(); puffs([[e.x - 100 - tp2 * 5, EBASE - 10 - tp2, 24 * twinkle(tp2, 12)], [e.x + 100 + tp2 * 5, EBASE - 10 - tp2, 22 * twinkle(tp2 - 1, 12)]], { seed: 9540 + j * 10, w: 4.5, col: '#FFFFFF', sc: '#F7DDE4' }); }
  });
  // step badges + names, arrows (RTL: 1 on the right)
  END.forEach((e, j) => {
    const p = popIn(f - (C.badges + j * 6));
    if (p <= 0) return;
    D.abs(); D.push(); D.t(e.x, EBASE + 78).r(-0.2 * (1 - Math.min(1, p))).s(p);
    fill(ell(0, 0, 40, 40, 16), { col: PAL.mint, seed: 9600 + j, off: [4, -3] });
    line(ell(0, 0, 40, 40, 16), { w: 5.5, seed: 9610 + j, closed: true, taper: [0, 0] });
    drawLettering(T.digits[j], 0, 20, () => ({ p: 0.9 }));
    D.pop();
    D.abs(); drawLettering(T.endNames[j], e.x, EBASE + 178, () => ({ p: popIn(f - (C.badges + 2 + j * 6)) }));
  });
  [[0, 1], [1, 2]].forEach(([a, b], i) => {
    const p = clamp((F - (C.arrows + i * 8)) / 8);
    const xa = END[a].x - 62, xb = END[b].x + 62, y = EBASE + 78;
    D.abs(); arrow([[xa, y], [(xa + xb) / 2, y - 18], [xb, y]], p, { seed: 9620 + i * 3, w: 6, head: 18 });
  });
  // logo: ink outline draws on, then the fill pops in (boiling, off-register)
  const tl = on2(f - C.logo);
  if (f >= C.logo) {
    D.abs(); D.push(); D.t(540, 318);
    const h = 172, pop = tl >= 14 ? popIn(tl - 14) : 0;
    if (pop > 0) { D.push(); D.s(0.94 + 0.06 * pop); logo(h, { seed: 9700, amp: 1.4, off: [5, -4], col: INK }); D.pop(); }
    else logo(h, { seed: 9710, trim: clamp(tl / 14), w: 6, amp: 1.4 });
    D.pop();
    if (tl >= 14 && tl < 28) { D.abs(); sparkle(540 + 290, 250, 36, twinkle(tl - 14, 14), { seed: 9720, col: '#FFFFFF' }); sparkle(540 - 300, 390, 28, twinkle(tl - 17, 14), { seed: 9721, col: '#FFFFFF' }); }
  }
  // tagline
  title(T.tag, f, C.tag, 9999, 540, 626, 4, 16);
  // final sparkles (looping twinkles on the hold)
  if (f >= C.final) {
    D.abs();
    [[150, 640, 0], [930, 600, 7], [120, 1000, 14], [960, 980, 21], [540, 700, 28], [700, 1450, 4], [380, 1460, 11]].forEach(([x, y, d], i) => {
      const tt = ((hold ? H3 : F) - C.final - d + 600) % 36;
      sparkle(x, y, 28, twinkle(tt, 24), { seed: 9740 + i, col: '#FFFFFF', rot: 0.15 });
    });
    const tf = on2(f - C.final);
    if (f >= C.final && tf < 24) confetti(540, EBASE - 300, tf, { n: 16, speed: 30, spread: 1.6, life: 12, seed: 9760, r: 13, g: 1.4 });
  }
}

// =====================================================================
window.seek = f => {
  G.f = f;
  G.boil = f >= C.hold ? Math.floor(f / 3) % 4 : Math.floor(f / 2) % 4;
  G.boilAmp = 1; G.alpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (f < C.iris) {
    world(f, camera(f));
    G.cam = [1, 0, 0, 1, 0, 0];
    worldText(f);
  } else if (f < C.end) {
    G.cam = [1, 0, 0, 1, 0, 0];
    heroScene(f);
    // the lock flash (1 frame white, 1 frame half)
    starWipe(f);
  } else {
    G.cam = [1, 0, 0, 1, 0, 0];
    endCard(f);
  }
  if (f === C.lock || f === C.lock + 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = f === C.lock ? 0.7 : 0.3; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  // paper multiply over everything
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(paper, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return true;
};
window.FRAMES = FRAMES;
window.__ready = true;
