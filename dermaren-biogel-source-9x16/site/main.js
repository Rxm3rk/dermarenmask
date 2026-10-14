// Dermaren Bio-Gel vs an ordinary sheet mask — 1080x1920, 24 fps, 840 frames (35.0 s).
// Cel / frame-by-frame look: animated on 2s (fast actions on 1s, holds on 3s), line boil = 4 jitter
// variants cycled every 2 frames, smear frames on fast moves, hand-drawn cel FX, paper multiply.
// seek(f) is a pure function of the frame number.
import { W, H, G, D, line, fill, lettering, drawLettering, ell, arcPts, mirror, lerpPts, mix, spring, wob, kf, E,
  clamp, lerp, inv, hash, hs, vn, on2, on3, TAU, star4, burst, INK } from './core.js';
import { PAL, drawBody, drawHead, drawSheet, sheetOutline, drawGel, SHEET_OUT, SHEET_HOLES, GEL_FIT } from './char.js';
import { FXC, sparkle, twinkle, impactLines, starburst, drop, splash, puffs, speedLines, heat, check, cross, ripple, snowflake, pill } from './fx.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
G.ctx = ctx;
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
const CUE = await (await fetch('cues.json')).json();
const C = CUE.frames;            // named cue frames shared with audio.py
export const FRAMES = CUE.FRAMES;

// ---------------- copy (Kurdish Sorani + Arabic) ----------------
const COPY = {
  ordinary: ['ماسکی ئاسایی', 'الماسك العادي'],
  p1: ['دەتکێت و پیس دەکات', 'يقطّر ويوسّخ'],
  p2: ['بە پێستەوە نالکێت', 'ما يلصق على البشرة'],
  p3: ['زوو وشک دەبێتەوە', 'ينشف بسرعة'],
  reveal: ['ماسکێکی جیاواز', 'ماسك مختلف تماماً'],
  d1: ['سیرەمەکە خۆی ماسکەکەیە', 'السيروم هو نفسه الماسك'],
  d1b: ['بۆیە هیچ ناتکێت', 'فما يقطّر أبداً'],
  h1: ['وەک پێستی دووەم دەلکێت', 'يلصق كأنه بشرة ثانية'],
  h2: ['فێنکییەکی درێژخایەن', 'برودة تدوم طويلاً'],
  h3: ['بە گەرمیی پێست دەتوێتەوە', 'يذوب بحرارة بشرتك'],
  recap: ['جیاوازییەکە', 'الفرق'],
  ordCol: ['ئاسایی', 'العادي'],
  rows: [['ناتکێت', 'ما يقطّر'], ['باش دەلکێت', 'يلصق زين'], ['فێنک دەمێنێتەوە', 'يبقى بارد']],
  end: ['هەست بە جیاوازییەکە بکە', 'اشعري بالفرق'],
};

// ---------------- assets ----------------
await Promise.all(['900', '500', '400'].map(w => document.fonts.load(`${w} 40px Somar`, 'ماسکی ئاسایی Bio-Gel الفرق')));
await document.fonts.ready;
const [paper, grainImg, boxImg, markImg, wordImg] = await Promise.all(['paper', 'grain', 'box', 'mark', 'word'].map(n => loadImg(`img/${n}.png`)));
const BOX = await (await fetch('img/box_hull.json')).json();
G.grain = ctx.createPattern(grainImg, 'repeat');

// ---------------- lettering (pre-rendered, 4 boil variants per word) ----------------
const MAXW = 920;
function fit(text, weight, size, dir) {
  const m = document.createElement('canvas').getContext('2d');
  m.font = `${weight} ${size}px Somar`; m.direction = dir || 'rtl';
  const w = m.measureText(text).width;
  return w > MAXW ? Math.floor(size * MAXW / w) : size;
}
let seedN = 1;
function L(text, weight, size, col, o = {}) {
  const s = fit(text, weight, size, o.dir);
  return lettering(text, Object.assign({ font: `${weight} ${s}px Somar`, fill: col, seed: (seedN += 7) }, o));
}
// title pair: big Kurdish + Arabic beneath
function pair(k, ku, ar, o = {}) {
  return {
    ku: L(ku, 900, o.kuSize ?? 104, o.kuCol ?? PAL.ink, { shadow: { col: o.shCol ?? '#BFC3BB', dx: 7, dy: 7 } }),
    ar: L(ar, 500, o.arSize ?? 60, o.arCol ?? '#5D5A6B'),
  };
}
const T = {
  ordinary: pair('ordinary', ...COPY.ordinary),
  p1: pair('p1', ...COPY.p1), p2: pair('p2', ...COPY.p2), p3: pair('p3', ...COPY.p3),
  reveal: pair('reveal', ...COPY.reveal, { kuCol: PAL.cream, shCol: '#2A1680', arCol: PAL.pink, kuSize: 92 }),
  biogel: L('Bio-Gel', 900, 200, PAL.cream, { dir: 'ltr', shadow: { col: PAL.pink, dx: 10, dy: 10 }, space: 0.6 }),
  d1: pair('d1', ...COPY.d1, { kuCol: PAL.cream, shCol: '#2A1680', arCol: PAL.pink, kuSize: 92 }),
  d1b: pair('d1b', ...COPY.d1b, { kuCol: PAL.cream, shCol: '#2A1680', arCol: PAL.pink, kuSize: 100 }),
  h1: pair('h1', ...COPY.h1, { shCol: PAL.pink, arCol: '#7A3E58' }),
  h2: pair('h2', ...COPY.h2, { shCol: PAL.ice, arCol: '#2D6E80' }),
  h3: pair('h3', ...COPY.h3, { shCol: PAL.pink, arCol: '#7A3E58' }),
  recap: pair('recap', ...COPY.recap, { shCol: PAL.pink, arCol: PAL.violet, kuSize: 112 }),
  end: pair('end', ...COPY.end, { kuCol: PAL.cream, shCol: '#2A1680', arCol: PAL.pink, kuSize: 100, arSize: 68 }),
  num: ['١', '٢', '٣'].map(n => L(n, 900, 64, PAL.ink)),
  colBio: L('Bio-Gel', 900, 58, PAL.violet, { dir: 'ltr' }),
  vs: L('VS', 900, 110, PAL.ink, { dir: 'ltr', shadow: { col: PAL.pink, dx: 7, dy: 7 } }),
  colOrd: L(COPY.ordCol[0], 900, 58, '#4A4656'),
  colOrdAr: L(COPY.ordCol[1], 500, 36, '#77737F'),
  rows: COPY.rows.map(([k, a]) => ({ ku: L(k, 900, 56, PAL.ink), ar: L(a, 500, 40, '#6A6676') })),
  ingr: ['Exosome', 'Hyaluronic ×7', 'Collagen', 'Centella'].map(t => L(t, 900, 40, PAL.ink, { dir: 'ltr' })),
};

// ---------------- timing helpers ----------------
const POP_IN = [[0, 0], [2, 1.16], [4, 0.93], [6, 1.04], [8, 0.99], [10, 1]];
const POP_OUT = [[0, 1], [2, 1.03], [4, 0.5], [6, 0]];
const kfl = (t, K) => kf(t, K.map(k => [k[0], k[1], 'lin']));
const popIn = t => t < 0 ? 0 : kfl(on2(t), POP_IN);
const popOut = t => t < 0 ? 1 : kfl(on2(t), POP_OUT);
// word animation for a lettering line: in at tin, out at tout (stagger per word)
const wordsAnim = (f, tin, tout, st = 2) => (i, n) => {
  const p = popIn(f - tin - i * st) * popOut(f - tout - (n - 1 - i));
  const r = kfl(on2(f - tin - i * st), [[0, -0.25], [2, 0.09], [4, -0.04], [6, 0]]);
  return { p, r };
};
function title(P, f, tin, tout, y1 = 330, y2 = 440) {
  if (f < tin - 1 || f > tout + 12) return;
  drawLettering(P.ku, 540, y1, wordsAnim(f, tin, tout));
  drawLettering(P.ar, 540, y2, wordsAnim(f, tin + 6, tout + 2));
}
function badge(n, f, tin, tout, x = 540, y = 168) {
  const p = popIn(f - tin) * popOut(f - tout);
  if (p <= 0) return;
  D.push(); D.t(x, y).s(p);
  fill(ell(0, 0, 50, 50, 14), { col: PAL.cream, seed: 1200 + n, off: [5, -4] });
  line(ell(0, 0, 50, 50, 14), { w: 6, seed: 1210 + n, closed: true });
  D.pop();
  drawLettering(T.num[n], x, y + 26, () => ({ p }));
}
// cut-out jitter (stop-motion paper feel), changes every 2 frames
const jit = (f, s, a = 1.6) => [hs(on2(f), s) * a, hs(on2(f), s + 1) * a, hs(on2(f), s + 2) * 0.006 * a];

// ---------------- backgrounds ----------------
function bg(col) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
function tiles(f) {   // bathroom tiles behind the ordinary-mask scenes
  D.reset();
  for (let i = 1; i < 6; i++) line([[i * 216 - 4, -20], [i * 216 + 4, 1940]], { w: 3.2, seed: 1300 + i, alpha: 0.16, taper: [0, 0], amp: 1.6 });
  for (let j = 1; j < 9; j++) line([[-20, j * 216 + 40], [1100, j * 216 + 36]], { w: 3.2, seed: 1320 + j, alpha: 0.16, taper: [0, 0], amp: 1.6 });
}
function rays(f, cx, cy, col, n = 14, a0 = 0) {
  D.reset();
  const rot = a0 + on2(f) * 0.0035;
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * TAU, b = a + TAU / n * 0.5;
    fill([[cx, cy], [cx + Math.cos(a) * 1700, cy + Math.sin(a) * 1700], [cx + Math.cos(b) * 1700, cy + Math.sin(b) * 1700]], { col, seed: 1400 + i, sharp: true, amp: 2, grain: 0.4 });
  }
}
function dots(seed, col, n, alpha = 0.5) {   // scattered paper confetti dots / tiny sparkles
  D.reset();
  for (let i = 0; i < n; i++) {
    const x = 40 + hash(i, seed) * 1000, y = 120 + hash(i, seed + 1) * 1700;
    fill(ell(x, y, 5 + hash(i, seed + 2) * 5, 5 + hash(i, seed + 2) * 5, 6), { col, seed: seed + i, alpha, grain: 0, amp: 0.8 });
  }
}

// ---------------- face placement ----------------
const FX0 = 540, FY0 = 1130, FS = 1.08;
const faceT = (dx = 0, dy = 0, s = 1, r = 0) => { D.reset(); D.t(FX0 + dx, FY0 + dy + 330 * FS).r(r).t(0, -330 * FS).s(FS * s); };
const toScreen = (x, y) => [FX0 + x * FS, FY0 + y * FS];

// =====================================================================
// ACT 1 — the ordinary sheet mask (f0–289)
// =====================================================================
const ESS = '#A9D6E2';
const DRIPS = [   // [srcX, srcY, formStart, floorY]
  [0, 304, 50, 560], [-168, 232, 58, 450], [166, 232, 66, 450], [-92, 292, 74, 520],
  [0, 304, 84, 560], [-168, 232, 92, 450], [166, 232, 100, 450], [92, 292, 106, 520],
];
const GDROP = 2.6;   // px/frame² (local)
function dripState(d, f) {
  const [x, y, t0, fy] = d, form = 10;
  const tf = t0 + form, tfall = Math.sqrt(2 * (fy - y) / GDROP), th = tf + tfall;
  return { x, y, t0, tf, th, fy };
}
function act1Face(f) {
  // expression timeline
  const F = on2(f);
  const p = { drab: 1, eyes: 'open', lid: 0.45, brow: -0.4, mouth: 'flat', blush: 0.45, look: [0, 0] };
  if (f < C.splat) { p.eyes = 'closed'; p.brow = 0.2; p.mouth = 'smile'; }
  else if (f < C.splat + 8) { p.eyes = 'squeeze'; p.mouth = 'o'; p.brow = 0.6; }
  else if (f < C.p1) { p.lid = 0.5; p.brow = -0.3; p.mouth = 'flat'; p.look = [0.4, 0.1]; }
  else if (f < C.p2) { p.look = [0, 0.95]; p.lid = 0.25; p.sad = 0.8; p.brow = 0.1; p.mouth = 'wavy'; }
  else if (f < C.p3) { p.look = [-0.7, -0.9]; p.lid = 0.15; p.brow = 0.7; p.mouth = 'flat'; }
  else if (f < C.rip) { p.lid = 0.55; p.brow = -0.85; p.mouth = 'grit'; p.sweat = clamp((F - C.p3) / 46); p.look = [0.2, 0]; }
  else if (f < C.poof) { p.lid = 0; p.look = [0, -1]; p.brow = 0.8; p.mouth = 'o'; p.blush = 0.8; }
  else { p.eyes = 'squeeze'; p.mouth = 'o'; p.brow = 0.8; }
  if (p.eyes === 'open' && [36, 88, 134, 172, 212].some(b => f === b || f === b + 1)) p.eyes = 'blink';
  return p;
}
function act1Head(f) {   // head acting (on 2s; the splat recoil on 1s)
  const F = on2(f);
  let dx = 0, dy = 0, r = 0;
  if (f >= C.splat && f < C.splat + 12) dy = kfl(f - C.splat, [[0, 0], [2, 18], [4, 6], [6, -5], [8, 2], [10, 0]]);
  else if (f >= C.p1 && f < C.p2) { r = 0.022 + 0.01 * Math.sin(F * 0.13); dy = 8; }
  else if (f >= C.p2 && f < C.p3) r = 0.04 * Math.sin((F - C.p2) * 0.21);
  else if (f >= C.p3 && f < C.rip) { dx = hs(F, 5) * 4; dy = 6 + hs(F, 6) * 3; r = -0.018 + hs(F, 7) * 0.006; }
  else if (f >= C.rip && f < C.poof) { dy = kfl(F - C.rip, [[0, 0], [2, -14], [6, -6], [10, -8]]); r = 0.01; }
  return { dx, dy, r };
}
function act1(f) {
  const F = on2(f);
  bg('#D9DDD3');
  tiles(f);
  // --- sheet state ---
  const sh = { wet: 1, lift: 0, slide: 0, curl: 0, crack: 0 };
  if (f >= C.p2) {
    sh.lift = kf(F, [[C.p2, 0], [C.p2 + 14, 0.95, 'out2'], [C.p2 + 28, 0.7], [C.p2 + 44, 1.05], [C.p2 + 60, 0.85]]) + 0.12 * Math.sin(F * 0.55) * (f < C.p3 ? 1 : 0.3);
    sh.flap = kf(F, [[C.p2 + 4, 0], [C.p2 + 12, 1, 'outBack']]); sh.flapW = Math.sin(F * 0.6);
    sh.slide = (f >= C.p2 + 18 ? 20 : 0) + (f >= C.p2 + 44 ? 24 : 0) + (f >= C.p2 + 18 && f < C.p2 + 21 ? 7 : 0) + (f >= C.p2 + 44 && f < C.p2 + 47 ? 8 : 0);
  }
  if (f >= C.p3) {
    sh.wet = kf(F, [[C.p3, 1], [C.p3 + 36, 0, 'io2']]);
    sh.curl = kf(F, [[C.p3 + 4, 0], [C.p3 + 40, 1]]);
    sh.crack = kf(F, [[C.p3 + 12, 0], [C.p3 + 42, 1, 'lin']]);
    sh.lift = Math.max(sh.lift, 0.6); sh.flap = 1.15; sh.flapW = 0.4 * Math.sin(F * 0.3);
  }
  // hook: the sheet falls (smear on 1s) and splats
  let sY = 0, sSx = 1, sSy = 1;
  if (f < C.splat) { sY = f === 0 ? -560 : -230; sSy = f === 0 ? 2.5 : 1.7; sSx = f === 0 ? 0.7 : 0.82; }
  else {
    const t = f - C.splat;
    const sq = t < 2 ? [1.14, 0.84] : t < 4 ? [0.95, 1.06] : t < 6 ? [1.03, 0.97] : t < 8 ? [0.99, 1.01] : [1, 1];
    [sSx, sSy] = sq;
  }
  // toss: rip (f >= C.rip), crumple, poof
  const ripped = f >= C.rip;
  const face = act1Face(f);
  const hd = act1Head(f), HT = () => faceT(hd.dx, hd.dy, 1, hd.r);
  faceT();
  drawBody({ drab: 1 });
  // drip stains on the robe / chest
  if (f >= C.p1 && f < C.poof + 20) DRIPS.forEach((d, i) => {
    const s = dripState(d, f);
    if (F > s.th) {
      const r = 26 * E.out2(clamp((F - s.th) / 10));
      fill(ell(s.x + hs(i, 3) * 10, s.fy + 18, r * 1.5, r * 0.55, 10), { col: '#BBB6AE', seed: 1500 + i, alpha: 0.75, grain: 0.6 });
    }
  });
  HT();
  drawHead(face, () => {
    if (ripped || f < C.splat) return;
    D.push(); D.t(0, sY).s(sSx, sSy);
    // peel anticipation before the rip
    if (f >= C.rip - 8) { D.t(0, -kf(f, [[C.rip - 8, 0], [C.rip - 1, 26, 'in2']])); }
    drawSheet(Object.assign({}, sh, f >= C.rip - 8 ? { lift: 1.3 + 0.1 * Math.sin(f * 1.7) } : {}));
    D.pop();
    // air bubbles trapped under the sheet (P2)
    if (f >= C.p2 + 6 && f < C.p3 + 20) {
      [[-150, -96, 0], [172, 110, 6], [62, -150, 12], [-176, 150, 18]].forEach(([x, y, d], i) => {
        const t = F - C.p2 - 6 - d; if (t < 0) return;
        const r = (16 + 8 * Math.sin(F * 0.4 + i)) * E.outBack(clamp(t / 6));
        line(ell(x, y + sh.slide, r, r * 0.9, 10), { w: 3.8, seed: 1600 + i, closed: true, col: '#6B655B' });
        line(arcPts(x - r * 0.25, y + sh.slide - r * 0.25, r * 0.45, r * 0.45, Math.PI * 1.05, Math.PI * 1.55, 4), { w: 3.4, seed: 1610 + i, col: '#FFFFFF' });
      });
    }
  });
  // the falling sheet (smear frames, on 1s) passes in front of the towel
  if (f < C.splat) {
    faceT();
    D.push(); D.t(0, sY - 40).s(sSx, sSy);
    drawSheet({ wet: 1 });
    D.pop();
    speedLines(0, -520, 300, 380, Math.PI / 2, f, { n: 9, seed: 1690, speed: 0, w: 6 });
  }
  // --- drips (P1): form at the mask edge, stretch, fall, splash ---
  if (f >= C.p1 && f < C.rip) DRIPS.forEach((d, i) => {
    const s = dripState(d, F);
    const t = F - s.t0;
    if (t < 0) return;
    if (F < s.th) HT(); else faceT();
    if (F < s.tf) {   // forming: bulge and neck
      const k = E.out2(t / (s.tf - s.t0));
      const r = 7 + 11 * k, neck = 6 + 26 * k;
      drop(s.x, s.y + neck * 0.5 + r * 0.4, r, 0, 2 + 6 * k, { col: ESS, seed: 1700 + i * 5 });
    } else if (F < s.th) {
      const tt = F - s.tf, yy = s.y + 18 + 0.5 * GDROP * tt * tt, vy = GDROP * tt + 2;
      drop(s.x, yy, 17, 0, vy * 1.4, { col: ESS, seed: 1700 + i * 5, stretch: 0.06 });
    } else {
      splash(s.x, s.fy, F - s.th, { n: 7, r: 10, speed: 11, spread: 1.1, life: 14, col: ESS, seed: 1720 + i * 9, g: 1.6 });
    }
  });
  // wet streak down the neck
  if (f >= C.p1 + 8 && f < C.rip) {
    HT();
    const p = clamp((F - C.p1 - 8) / 40);
    line([[-40, 300], [-46, 360], [-40, 420], [-50, 470]], { w: 9, seed: 1750, col: ESS, trim: [0, p], taper: [0.2, 0.05] });
    line([[60, 296], [66, 350], [60, 400]], { w: 7, seed: 1751, col: ESS, trim: [0, clamp(p * 1.3 - 0.3)], taper: [0.2, 0.05] });
  }
  // --- splat hook FX ---
  if (f >= C.splat && f < C.splat + 24) {
    const t = f - C.splat;   // on 1s for the fast action
    HT();
    impactLines(0, 40, 330, 520, 14, t, { w: 9, seed: 31, life: 8 });
    if (t >= 1) splash(-236, 40, t, { n: 8, r: 17, speed: 21, r0: 40, dir: -2.4, spread: 0.9, col: ESS, seed: 61, life: 20 });
    if (t >= 1) splash(236, 40, t, { n: 8, r: 17, speed: 21, r0: 40, dir: -0.75, spread: 0.9, col: ESS, seed: 71, life: 20 });
    if (t >= 1) splash(0, 300, t, { n: 7, r: 15, speed: 15, r0: 34, dir: Math.PI / 2, spread: 1.4, col: ESS, seed: 81, life: 18 });
  }
  // --- P2 air escaping at the lifted edges ---
  if (f >= C.p2 + 10 && f < C.p3) {
    HT();
    [[-226, -216, -2.3], [232, -150, -0.6], [-246, 120, 3.0]].forEach(([x, y, a], i) => {
      const ph = ((F - C.p2 - 10 + i * 8) % 24) / 24;
      const d = 30 + ph * 90, s = Math.sin(ph * Math.PI);
      puffs([[x + Math.cos(a) * d, y + Math.sin(a) * d, 22 * s], [x + Math.cos(a) * (d + 24), y + Math.sin(a) * (d + 24) - 10, 15 * s]], { seed: 1800 + i * 10, w: 3.5, shade: false, col: '#EEF2EE' });
    });
  }
  // --- P3 heat + thermometer ---
  if (f >= C.p3 && f < C.rip + 4) {
    faceT();
    heat(-350, -170, F + 10, { n: 3, gap: 36, rise: 90, w: 6.5, seed: 1860 });
    heat(360, -60, F + 20, { n: 3, gap: 36, rise: 90, w: 6.5, seed: 1870 });
    heat(-330, 120, F + 4, { n: 2, gap: 36, rise: 70, w: 5.5, seed: 1880 });
    thermo(920, 720, kf(F, [[C.p3, 0.35], [C.p3 + 30, 0.95, 'out2']]) + 0.03 * Math.sin(F), PAL.pinkDeep, popIn(f - C.p3 - 2) * popOut(f - C.rip));
  }
  // --- rip, crumple, poof ---
  if (ripped && f < C.poof + 2) {
    const t = f - C.rip;
    let bx = 0, by = -700, s = 1;
    D.reset();
    faceT();
    if (t < 2) {   // smear frames on 1s
      const k = t === 0 ? 2.8 : 1.7, yy = t === 0 ? -360 : -640;
      D.push(); D.t(0, yy).st(Math.PI / 2, k);
      drawSheet({ wet: 0, curl: 1, lift: 1.4 });
      D.pop();
      speedLines(0, -300, 260, 420, -Math.PI / 2, t, { n: 10, seed: 1900, speed: 60, w: 6 });
    } else {
      const c = clamp((F - C.rip - 2) / 12);
      const tremble = f >= C.poof - 8 ? [hs(f, 7) * 7, hs(f, 8) * 7] : [0, 0];
      s = f >= C.poof - 8 ? 1 + 0.18 * (f - C.poof + 8) / 8 : 1;
      D.push(); D.t(bx + tremble[0], by + tremble[1]).s(s);
      crumple(c, F);
      D.pop();
      if (c < 0.6) speedLines(0, -620, 120, 300, -Math.PI / 2, t, { n: 6, seed: 1910, speed: 30, w: 4 });
    }
  }
  // problem titles
  D.reset();
  title(T.ordinary, f, C.splat + 6, C.p1 - 6);
  badge(0, f, C.p1, C.p2 - 4); title(T.p1, f, C.p1 + 2, C.p2 - 6);
  badge(1, f, C.p2, C.p3 - 4); title(T.p2, f, C.p2 + 2, C.p3 - 6);
  badge(2, f, C.p3, C.rip - 6); title(T.p3, f, C.p3 + 2, C.rip - 6);
}
// sheet → crumpled ball morph (c 0..1)
function crumple(c, F) {
  const n = SHEET_OUT.length;
  const ball = SHEET_OUT.map(([x, y], i) => {
    const a = Math.atan2(y, x), r = 96 * (0.72 + 0.46 * hash(i, 77));
    return [Math.cos(a) * r, Math.sin(a) * r * 0.92];
  });
  const O = lerpPts(SHEET_OUT, ball, E.out3(c));
  const col = mix(PAL.sheetDry, '#E9E4DA', c);
  fill(O, { col, seed: 1950, off: [5, -3], sharp: c > 0.5 });
  if (c > 0.3) {
    const k = clamp((c - 0.3) / 0.7);
    [[[-50, -40], [-10, -10], [-30, 30]], [[20, -60], [40, -20], [70, -30]], [[-60, 30], [-20, 50], [10, 30], [40, 60]], [[0, -20], [30, 10], [60, 0]],
     [[-70, -10], [-40, 0], [-56, -30]], [[10, 40], [30, 70], [-6, 74]], [[50, 30], [66, 50]], [[-20, -70], [-6, -46], [16, -64]]]
      .forEach((l, i) => line(l, { w: 3.6, seed: 1960 + i, sharp: true, col: PAL.sheetEdge, alpha: k }));
    [[-30, 10], [40, -36], [10, 50]].forEach(([x, y], i) => fill([[x, y], [x + 22, y - 8], [x + 14, y + 16]], { col: '#D2CBBE', seed: 1975 + i, sharp: true, alpha: k * 0.8 }));
  }
  line(O, { w: 5, seed: 1951, closed: true, sharp: c > 0.5, col: PAL.sheetEdge });
}
function thermo(x, y, lvl, col, s) {
  if (s <= 0.01) return;
  D.reset(); D.t(x, y).s(s).r(0.08);
  const tube = [[-20, -130], [20, -130], [20, 70], [-20, 70]];
  fill(tube, { col: '#FFFDF8', seed: 2000, off: [4, -3] });
  const top = 70 - 200 * clamp(lvl);
  fill([[-11, top], [11, top], [11, 90], [-11, 90]], { col, seed: 2001, sharp: true, amp: 1 });
  fill(ell(0, 108, 36, 36, 12), { col, seed: 2002, off: [4, -3] });
  line([[-20, 84], [-20, -110], [-14, -128], [0, -134], [14, -128], [20, -110], [20, 84]], { w: 6, seed: 2003, taper: [0, 0] });
  line(arcPts(0, 108, 36, 36, -Math.PI * 0.32, Math.PI * 1.32, 12), { w: 6, seed: 2004, taper: [0, 0] });
  for (let i = 0; i < 4; i++) line([[20, -90 + i * 40], [6, -90 + i * 40]], { w: 3.5, seed: 2005 + i });
}

// =====================================================================
// SMOKE transition (poof → violet)
// =====================================================================
const SMOKE = [];
for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) {
  const x = i * 360 + (j % 2 ? 180 : 0) - 90 + hs(i + j * 7, 3) * 50, y = j * 280 - 20 + hs(i + j * 7, 4) * 50;
  SMOKE.push([x, y, 230 + hash(i + j * 7, 5) * 70]);
}
function smoke(f) {
  const t = f - C.poof;
  if (t < 0 || t > 34) return;
  const [ox, oy] = toScreen(0, -700);
  const T2 = on2(t);
  D.reset();
  const circles = SMOKE.map(([x, y, r], i) => {
    const d = Math.hypot(x - ox, y - oy), delay = d / 160;
    const g = clamp((T2 - delay) / 8);
    const dc = Math.hypot(x - 540, y - 1060);
    const outT = t - 16 - dc / 500;   // the burst on the downbeat clears from the centre outwards (on 1s)
    const k = outT > 0 ? clamp(1 - outT / 7) : 1;
    const push = outT > 0 ? E.in2(clamp(outT / 7)) * 520 : 0;
    const ax = x - 540, ay = y - 1060, al = Math.hypot(ax, ay) || 1;
    const px = lerp(ox, x, E.out3(g)) + ax / al * push, py = lerp(oy, y, E.out3(g)) + ay / al * push;
    return [px, py, r * E.outBack(g, 1.4) * k];
  }).filter(c => c[2] > 2);
  puffs(circles, { seed: 2100, w: 7, curls: true, col: '#FFFCF5', sc: '#E7E1F3' });
  // sparkles flung out of the poof
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + 0.3, d = 120 + T2 * 26;
    sparkle(ox + Math.cos(a) * d, oy + Math.sin(a) * d, 44, twinkle(T2 - 1, 16), { seed: 2150 + i, col: i % 2 ? PAL.pink : '#FFFCF5', rot: T2 * 0.05 });
  }
}

// =====================================================================
// REVEAL — the real ProExo box (f290–385)
// =====================================================================
function boxSticker(cx, cy, w, sx = 1, sy = 1, rot = 0, f = 0, o = {}) {
  const k = w / BOX.w, h = BOX.h * k;
  const [jx, jy, jr] = jit(f, o.seed ?? 2200, o.jit ?? 1.4);
  D.reset(); D.t(cx + jx, cy + jy).r(rot + jr).s(sx, sy);
  // scissor-cut sticker border: hull expanded, straight cuts
  const hx = BOX.w / 2, hy = BOX.h / 2;
  const P = BOX.hull.map(([x, y]) => { const dx = x - hx, dy = y - hy, l = Math.hypot(dx, dy) || 1; return [(dx + dx / l * 22) * k, (dy + dy / l * 22) * k]; });
  if (o.shadow !== false) fill(P.map(([x, y]) => [x + 16, y + 20]), { col: o.shCol || '#2A1680', seed: 2201, sharp: true, alpha: 0.75, grain: 0.3 });
  fill(P, { col: '#FFFDF8', seed: 2202, sharp: true, grain: 0.5 });
  D.setCtx();
  ctx.drawImage(boxImg, -hx * k, -hy * k, BOX.w * k, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  line(P, { w: o.lw ?? 5.5, seed: 2203, closed: true, sharp: true, taper: [0, 0], amp: 1.6 });
}
function reveal(f) {
  const F = on2(f);
  bg(PAL.violet);
  rays(f, 540, 1080, '#5634C2');
  dots(2300, '#6E50D8', 26, 0.8);
  const t = f - C.reveal - 2;
  // box slam + later hop and drop
  let by = 1100, sx = 1, sy = 1;
  if (t < 0) { by = 1100 + (t === -2 ? 900 : 380); sy = t === -2 ? 2.3 : 1.6; sx = 1 / Math.sqrt(sy); }
  else if (t < 10) { [sx, sy] = t < 2 ? [1.18, 0.83] : t < 4 ? [0.94, 1.07] : t < 6 ? [1.03, 0.97] : t < 8 ? [0.99, 1.01] : [1, 1]; }
  const hop = C.gelOut - 8;
  if (f >= hop && f < C.gelOut) { const a = (F - hop) / 8; sx = 1 + 0.07 * a; sy = 1 - 0.09 * a; }
  if (f >= C.gelOut) {
    const u = f - C.gelOut;
    if (u < 2) { sx = 0.94; sy = 1.1; }
    by += 1.9 * Math.pow(Math.max(0, F - C.gelOut - 1), 2) * 6;
  }
  if (f < C.gelOut + 4) gelOnViolet(f);
  if (by < 2600) {
    const bw = 580, hh = BOX.h * bw / BOX.w;
    // pivot at the bottom edge for squash
    boxSticker(540, by + hh / 2 * (1 - sy), bw, sx, sy, 0, f);
    if (f >= C.gelOut + 2 && f < C.gelOut + 14) speedLines(540, by - 300, 260, 300, -Math.PI / 2, f - C.gelOut, { n: 7, seed: 2310, speed: 30, w: 5, col: PAL.cream });
  }
  if (t >= 0 && t < 12) { D.reset(); impactLines(540, 1100, 420, 640, 16, t, { w: 9, col: PAL.cream, seed: 2320, life: 9 }); }
  if (f >= C.gelOut + 4) gelOnViolet(f);
  // sparkles around
  [[170, 780, 4], [915, 840, 10], [140, 1420, 16], [940, 1470, 22], [540, 1600, 28], [880, 620, 34]].forEach(([x, y, d], i) => {
    const tt = (F - C.reveal - d) % 40;
    D.reset(); sparkle(x, y, 34, twinkle(tt, 22), { seed: 2330 + i, col: i % 2 ? PAL.pink : PAL.cream, rot: 0.2 });
  });
  // titles
  D.reset();
  if (f < C.gelOut + 14) {
    drawLettering(T.biogel, 540, 330, wordsAnim(f, C.reveal + 6, C.gelOut - 10));
    title(T.reveal, f, C.reveal + 12, C.gelOut - 12, 470, 570);
  }
}

// =====================================================================
// GEL hero object on violet (pops out of the box, ingredients, upside-down gag)
// =====================================================================
const FLY = 10;   // ingredients land on the beats C.d1 + 12i
const ING = [
  { from: [-200, 520], to: [-70, -60], t0: () => C.d1 - FLY },
  { from: [1280, 600], to: [80, -40], t0: () => C.d1 + 12 - FLY },
  { from: [-200, 1700], to: [-60, 140], t0: () => C.d1 + 24 - FLY },
  { from: [1280, 1640], to: [90, 150], t0: () => C.d1 + 36 - FLY },
];
function ingIcon(i, s) {
  if (i === 0) {   // exosome: cluster of vesicles
    const P = [[0, 0], [30, -18], [-30, -16], [0, -34], [32, 18], [-32, 20], [0, 36]];
    P.forEach(([x, y], k) => { fill(ell(x, y, 19, 19, 10), { col: k ? PAL.cream : PAL.pink, seed: 2400 + k, off: [3, -2], amp: 1 }); line(ell(x, y, 19, 19, 10), { w: 4, seed: 2410 + k, closed: true, amp: 1 }); });
  } else if (i === 1) {   // hyaluronic droplet
    const P = [[0, -50], [26, -14], [34, 14], [22, 38], [0, 46], [-22, 38], [-34, 14], [-26, -14]];
    fill(P, { col: PAL.ice, seed: 2420, off: [4, -3] }); line(P, { w: 5, seed: 2421, closed: true });
    line([[-12, 0], [-14, 22]], { w: 4, seed: 2422, col: '#FFFFFF' });
  } else if (i === 2) {   // collagen triple helix
    const A = [], B = [];
    for (let k = 0; k <= 10; k++) { const y = -52 + k * 10.4; A.push([Math.sin(k * 0.9) * 22, y]); B.push([-Math.sin(k * 0.9) * 22, y]); }
    line(A, { w: 9, seed: 2430, col: PAL.pinkDeep }); line(B, { w: 9, seed: 2431, col: PAL.cream });
    line(A, { w: 3, seed: 2432, alpha: 0.6 });
  } else {   // centella leaf
    const P = [[0, -54], [30, -30], [40, 0], [26, 32], [0, 48], [-26, 32], [-40, 0], [-30, -30]];
    fill(P, { col: PAL.cream, seed: 2440, off: [4, -3] }); line(P, { w: 5, seed: 2441, closed: true });
    line([[0, 52], [0, -40]], { w: 4, seed: 2442 }); [[-1, -10], [1, 6], [-1, 22]].forEach(([s2, y], k) => line([[0, y], [s2 * 24, y - 18]], { w: 3.4, seed: 2443 + k }));
  }
}
function gelOnViolet(f) {
  const F = on2(f);
  const t = f - C.gelOut;
  if (t < 0 || f >= C.iris + 4) return;
  // position / scale / rotation of the floating gel (screen coords)
  let x = 540, y = 1060, s = 1.02, rot = 0, sx = 1, sy = 1, jig = 0.5, smear = null;
  if (t < 18) {
    // shoot up out of the box, fall back and land in the middle
    if (t < 2) { y = t === 0 ? 650 : 520; s = 0.55 + t * 0.15; smear = [-Math.PI / 2, t === 0 ? 2.6 : 1.8]; }
    else if (t < 8) { const u = (F - C.gelOut - 2) / 6; y = lerp(520, 440, E.out2(u)); s = lerp(0.75, 0.92, u); rot = lerp(-0.3, 0.1, u); }
    else { const u = clamp((F - C.gelOut - 8) / 8); y = lerp(440, 1060, E.in2(u)); s = lerp(0.92, 1.02, u); rot = lerp(0.1, 0, u); if (u > 0.4 && u < 1) smear = [Math.PI / 2, 1 + u * 0.8]; }
  }
  const land = C.gelOut + 18;
  if (f >= land) { const u = f - land; jig = 0.5 + 1.6 * Math.exp(-u * 0.12); if (u < 8) { const q = [[1.15, 0.86], [0.93, 1.08], [1.04, 0.96], [0.99, 1.01]][Math.floor(u / 2)]; sx = q[0]; sy = q[1]; } }
  y += f >= land ? Math.sin(F * 0.12) * 10 : 0;
  // ingredient plops make it wobble
  ING.forEach((g, i) => { const u = F - (g.t0() + FLY); if (u >= 0 && u < 14) { jig += 1.4 * Math.exp(-u * 0.2); sx *= 1 + 0.05 * Math.exp(-u * 0.25) * Math.cos(u * 0.9); sy /= 1 + 0.05 * Math.exp(-u * 0.25) * Math.cos(u * 0.9); } });
  // upside-down gag
  const g0 = C.flip;
  if (f >= g0 - 4) {
    const u = f - g0;   // on 1s for the flip and the shake
    rot = kf(f, [[g0 - 4, 0], [g0, -0.18], [g0 + 6, Math.PI + 0.16, 'out3'], [g0 + 10, Math.PI, 'io2'],
      [C.flipBack, Math.PI], [C.flipBack + 6, TAU + 0.12, 'io3'], [C.flipBack + 9, TAU, 'io2']]);
    if (u >= 2 && u < 4) smear = [0, 1.7];
    if (f >= C.shake && f < C.shake + 16) { const k = f - C.shake; x += 40 * Math.sin(k * 1.7) * Math.exp(-k * 0.06); rot += 0.12 * Math.sin(k * 1.7 + 1); }
  }
  // launch toward the iris
  if (f >= C.launch - 4) {
    const u = f - C.launch;
    if (u < 0) { sx = 1 + 0.06 * (u + 4) / 4; sy = 1 - 0.1 * (u + 4) / 4; }
    else { y -= 160 * u * u * 0.5 + 240 * u; smear = [-Math.PI / 2, 2.2]; }
  }
  if (y < -600) return;
  D.reset(); D.t(x, y);
  if (smear) D.st(smear[0], smear[1]);
  D.r(rot).s(s * sx, s * sy);
  drawGel({ fit: 0, jig, t: F, dark: true });
  // rotation arrow during the flip
  if (f >= C.flip - 2 && f < C.flip + 12) {
    const u = clamp((f - C.flip + 2) / 8);
    D.reset();
    const A = arcPts(540, 1060, 400, 400, -2.4, -2.4 + 2.2 * E.out2(u), 14);
    line(A, { w: 12, seed: 2505, col: PAL.pink, taper: [0.5, 0.05] });
    const e = A[A.length - 1], q = A[A.length - 3], a = Math.atan2(e[1] - q[1], e[0] - q[0]);
    if (u > 0.3) fill([[e[0] + Math.cos(a) * 34, e[1] + Math.sin(a) * 34], [e[0] + Math.cos(a + 2.3) * 30, e[1] + Math.sin(a + 2.3) * 30], [e[0] + Math.cos(a - 2.3) * 30, e[1] + Math.sin(a - 2.3) * 30]], { col: PAL.pink, seed: 2506, sharp: true });
  }
  // shake motion marks
  if (f >= C.shake && f < C.shake + 16) {
    D.reset();
    [-1, 1].forEach((k, i) => line(arcPts(x + k * 330, y, 60, 120, k > 0 ? -0.6 : Math.PI - 0.6, k > 0 ? 0.6 : Math.PI + 0.6, 6), { w: 6, seed: 2500 + i, col: PAL.cream }));
    [-1, 1].forEach((k, i) => line(arcPts(x + k * 370, y, 60, 90, k > 0 ? -0.5 : Math.PI - 0.5, k > 0 ? 0.5 : Math.PI + 0.5, 6), { w: 5, seed: 2502 + i, col: PAL.cream }));
  }
}
function diff1(f) {
  const F = on2(f);
  bg(PAL.violet);
  rays(f, 540, 1080, '#5634C2');
  dots(2300, '#6E50D8', 26, 0.8);
  gelOnViolet(f);
  // ingredients fly in on arcs and plop into the gel
  ING.forEach((g, i) => {
    const t0 = g.t0(), u = F - t0;
    if (u < 0 || u > FLY + 16) return;
    const [tx, ty] = [540 + g.to[0] * 1.02, 1060 + g.to[1] * 1.02];
    if (u <= FLY) {
      const p = E.in2(u / FLY) * 0.6 + E.out2(u / FLY) * 0.4;
      const cx = lerp(g.from[0], tx, p), cy = lerp(g.from[1], ty, p) - Math.sin(p * Math.PI) * 220;
      const p2 = Math.min(1, p + 0.08), nx = lerp(g.from[0], tx, p2), ny = lerp(g.from[1], ty, p2) - Math.sin(p2 * Math.PI) * 220;
      const a = Math.atan2(ny - cy, nx - cx);
      D.reset(); D.t(cx, cy).st(a, 1 + 0.5 * Math.sin(p * Math.PI)).r(F * 0.06).s(1.75);
      ingIcon(i);
      D.reset(); pill(cx, cy + 130, T.ingr[i].width + 56, 66, { seed: 2600 + i * 3 });
      drawLettering(T.ingr[i], cx, cy + 145, () => ({ p: 1 }));
    } else {
      const v = u - FLY;
      const s = clamp(1 - v / 4);
      if (s > 0) { D.reset(); D.t(tx, ty).s(1.75 * s); ingIcon(i); }
      D.reset(); ripple(tx, ty, 70, 30, v, { seed: 2610 + i * 3, w: 5 });
      sparkle(tx + 40, ty - 50, 26, twinkle(v - 1, 12), { seed: 2620 + i, col: '#FFFFFF' });
    }
  });
  // check mark after the shake
  if (f >= C.check) {
    D.reset();
    check(890, 1300, 1.7, (F - C.check) / 6, { col: PAL.pink, seed: 2700, w: 15 });
    sparkle(950, 1220, 30, twinkle(F - C.check - 4, 18), { seed: 2701, col: PAL.cream });
  }
  D.reset();
  title(T.d1, f, C.d1 + 2, C.flip - 6);
  title(T.d1b, f, C.flip + 6, C.launch - 4);
}

// =====================================================================
// HERO — the gel on the face (iris in, slap, hug, cool, melt)
// =====================================================================
function heroFace(f) {
  const F = on2(f);
  const p = { drab: 0, eyes: 'closed', brow: 0.2, mouth: 'smile', blush: 0.9 };
  if (f < C.slap) { p.mouth = 'smile'; }
  else if (f < C.slap + 8) { p.eyes = 'squeeze'; p.mouth = 'o'; p.brow = 0.7; }
  else if (f < C.cool) { p.eyes = 'closed'; p.mouth = 'smile'; }
  else if (f < C.cool + 16) { p.mouth = 'o'; p.brow = 0.4; }
  else if (f < C.glowEyes) { p.mouth = 'smile'; p.brow = 0.3; }
  else { p.eyes = 'happy'; p.mouth = 'open'; p.brow = 0.45; p.blush = 1.15; }
  p.glow = f >= C.melt ? kf(F, [[C.melt + 14, 0], [C.melt + 30, 1, 'out2']]) : 0;
  return p;
}
function hero(f) {
  const F = on2(f);
  bg('#F8DCE2');
  D.reset();
  fill(ell(540, 1010, 470, 470, 20), { col: '#FCEDEA', seed: 2800, grain: 0.6 });
  line(ell(540, 1010, 470, 470, 20), { w: 4, seed: 2801, closed: true, alpha: 0.25 });
  dots(2810, '#F2B6C4', 22, 0.9);
  const ph = (F - CUE.beat0) / 24 * TAU;   // one sway per two beats
  const sway = f >= C.hug + 18 ? (f >= C.glowEyes ? 0.045 : 0.025) : 0;
  const tilt = sway * Math.sin(ph), bob = f >= C.glowEyes ? -9 * Math.abs(Math.sin(ph)) : 0;
  faceT();
  drawBody({ drab: 0 });
  faceT(0, bob, 1, tilt);
  const face = heroFace(f);
  const ts = f - C.slap;
  // gel state
  let gy = 0, gsx = 1, gsy = 1, fit = 0, jig = 0, melt = 0, smear = null, show = true;
  if (ts < 0) {
    const u = ts;   // fall in on 1s
    if (u < -6) show = false;
    else { gy = u === -6 || u === -5 ? -1250 : u >= -2 ? -260 : -720; smear = [Math.PI / 2, u >= -2 ? 1.6 : 2.4]; }
  } else {
    const q = ts < 2 ? [1.12, 0.88] : ts < 4 ? [0.95, 1.06] : ts < 6 ? [1.03, 0.97] : [1, 1];
    gsx = q[0]; gsy = q[1];
    jig = 1.6 * Math.exp(-ts * 0.1);
    fit = kf(F, [[C.slap + 6, 0], [C.hug + 14, 1, 'io2']]);
    melt = kf(F, [[C.melt + 4, 0], [C.melt + 34, 1, 'io2']]);
  }
  const gel = () => {
    D.push(); D.t(0, gy);
    if (smear) D.st(smear[0], smear[1]);
    D.s(gsx, gsy);
    drawGel({ fit, jig, t: F, melt });
    D.pop();
  };
  drawHead(face, () => { if (show && ts >= 0) gel(); });
  if (show && ts < 0) { faceT(0, bob, 1, tilt); gel(); speedLines(0, -480, 280, 360, Math.PI / 2, f, { n: 8, seed: 2825, speed: 0, w: 6, col: PAL.violet }); }
  // slap impact FX — no drips, just a clean seal
  if (ts >= 0 && ts < 12) { faceT(); impactLines(0, 40, 340, 520, 14, ts, { w: 9, seed: 2830, life: 8, col: PAL.violet }); }
  // seal trace + contour pings while hugging
  if (f >= C.hug && f < C.hug + 40) {
    faceT(0, bob, 1, tilt);
    const p = clamp((F - C.hug) / 18), q = clamp((F - C.hug - 20) / 14);
    line(GEL_FIT, { w: 9, seed: 2840, closed: true, col: PAL.pink, trim: [q, p], taper: [0.1, 0.1] });
    for (let i = 0; i < 8; i++) {
      const [x, y] = GEL_FIT[(i * 2) % GEL_FIT.length];
      sparkle(x * 1.06, y * 1.06, 22, twinkle(F - C.hug - i * 2.5, 12), { seed: 2850 + i, col: '#FFFFFF' });
    }
  }
  // cooling: orbiting air swirls, snowflakes, thermometer drops
  if (f >= C.cool && f < C.melt + 10) {
    const u = F - C.cool, fade = f >= C.melt ? clamp(1 - (F - C.melt) / 10) : 1;
    faceT(0, bob, 1, tilt);
    for (let k = 0; k < 3; k++) {
      const ph = u * 0.09 + k * TAU / 3;
      const P = arcPts(0, -60 + k * 30, 360 + k * 18, 150 + k * 10, ph, ph + 1.1, 10).map(([x, y]) => { const a = -0.22; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; });
      line(P, { w: 13 * fade, seed: 2870 + k, col: PAL.cyan, taper: [0.7, 0.2] });
    }
    D.reset();
    [[150, 760, 0], [930, 960, 6], [120, 1270, 12], [960, 1380, 18], [250, 560, 24], [840, 560, 30]].forEach(([x, y, d], i) => {
      snowflake(x, y, 50, twinkle((u - d) % 30, 24) * fade, { seed: 2880 + i * 20, rot: u * 0.03 + i, col: PAL.cyan, w: 6.5 });
    });
    thermo(930, 760, kf(F, [[C.cool, 0.8], [C.cool + 26, 0.22, 'out2']]), PAL.cyan, popIn(f - C.cool - 2) * popOut(f - C.melt + 2));
  }
  // melt: essence sinks into the skin, glow sparkles
  if (f >= C.melt) {
    const u = F - C.melt;
    faceT(0, bob, 1, tilt);
    for (let i = 0; i < 14; i++) {
      const x = hs(i, 91) * 190, y = -150 + hash(i, 92) * 400, d = i * 1.6;
      const v = u - 4 - d; if (v < 0 || v > 14) continue;
      const k = 1 - v / 14;
      fill(ell(x, y + v * 2, 9 * k, 9 * k, 8), { col: '#FFFFFF', seed: 2900 + i, alpha: 0.9, grain: 0 });
      line(ell(x, y + v * 2, 9 * k, 9 * k, 8), { w: 3, seed: 2920 + i, closed: true, col: PAL.violet, alpha: k });
    }
    [[-190, -70, 18], [200, 60, 22], [-60, 250, 26], [150, -150, 30], [-230, 160, 34], [60, -230, 38]].forEach(([x, y, d], i) => {
      sparkle(x, y, 26, twinkle((u - d) % 26, 20), { seed: 2950 + i, col: '#FFFFFF' });
    });
  }
  D.reset();
  title(T.h1, f, C.slap + 6, C.cool - 6);
  title(T.h2, f, C.cool + 2, C.melt - 6);
  title(T.h3, f, C.melt + 2, C.card - 4);
}
function iris(f) {   // violet → pink circle wipe carrying the hero scene
  const t = f - C.iris;
  if (t < 0) return false;
  const r = t >= 12 ? 9999 : kf(on2(t), [[0, 0], [12, 1300, 'in2']]);
  if (r > 2000) return false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.arc(540, 1080, r, 0, TAU); ctx.clip();
  hero(f);
  ctx.restore();
  D.reset(); line(ell(540, 1080, r, r, 24), { w: 12, seed: 2990, closed: true, taper: [0, 0] });
  return true;
}

// =====================================================================
// RECAP — the comparison card
// =====================================================================
const LX = 185, RX = 895, ROWY = [1090, 1330, 1570];
function miniSheet(x, y, s) {
  D.reset(); D.t(x, y).s(s);
  fill(SHEET_OUT, { col: PAL.sheet, seed: 3000, holes: SHEET_HOLES, off: [5, -3] });
  line(SHEET_OUT, { w: 6, seed: 3001, closed: true, col: PAL.sheetEdge });
  SHEET_HOLES.forEach((h, i) => line(h, { w: 5, seed: 3002 + i, closed: true, col: PAL.sheetEdge }));
  [[-150, 300], [150, 290], [0, 330]].forEach(([dx, dy], i) => drop(dx, dy + 30, 16, 0, 6, { col: ESS, seed: 3010 + i * 3 }));
}
function recap(f, cy) {
  const F = on2(f);
  D.reset();
  bg(PAL.cream);
  const Y = y => y + cy;
  D.reset();
  // header
  drawLettering(T.recap.ku, 540, Y(250), () => ({ p: 1 }));
  drawLettering(T.recap.ar, 540, Y(350), () => ({ p: 1 }));
  // columns: left = Bio-Gel (the real box), right = ordinary sheet mask
  const cl = popIn(f - C.card - 2), cr = popIn(f - C.card - 6), cv = popIn(f - C.card - 8);
  if (cl > 0) {
    boxSticker(LX, Y(610), 230 * cl, 1, 1, -0.05, f, { seed: 3100, shCol: '#DCCFBE', lw: 4.5 });
    D.reset(); drawLettering(T.colBio, LX, Y(850), () => ({ p: cl }));
  }
  if (cr > 0) {
    miniSheet(RX, Y(585), 0.5 * cr);
    D.reset(); drawLettering(T.colOrd, RX, Y(850), () => ({ p: cr }));
    drawLettering(T.colOrdAr, RX, Y(902), () => ({ p: cr }));
  }
  if (cv > 0) { D.reset(); drawLettering(T.vs, 540, Y(660), () => ({ p: cv, r: -0.08 })); }
  // rows
  T.rows.forEach((r, i) => {
    const t0 = C.row1 + i * 24, ry = ROWY[i];
    const p = popIn(f - t0);
    D.reset();
    if (p > 0) {
      line([[70, Y(ry - 150)], [1010, Y(ry - 154)]], { w: 3.5, seed: 3200 + i, alpha: 0.28, trim: [0, clamp((F - t0) / 6)], taper: [0, 0] });
      drawLettering(r.ku, 540, Y(ry), () => ({ p }));
      drawLettering(r.ar, 540, Y(ry + 60), () => ({ p }));
    }
    const tx = f - (t0 + 6), tc = f - (t0 + 12);
    if (tx >= 0) { D.reset(); cross(RX, Y(ry - 12), 1.4, on2(tx) / 6, { seed: 3210 + i * 3, col: '#6E6A76', w: 12 }); }
    if (tc >= 0) {
      D.reset();
      const pc = popIn(tc);
      fill(ell(LX, Y(ry - 12), 74 * pc, 74 * pc, 14), { col: PAL.violet, seed: 3230 + i, off: [5, -4] });
      line(ell(LX, Y(ry - 12), 74 * pc, 74 * pc, 14), { w: 5.5, seed: 3240 + i, closed: true });
      check(LX + 2, Y(ry - 8), 1.45, on2(tc) / 6, { seed: 3250 + i * 3, col: PAL.cream, w: 13 });
      sparkle(LX + 78, Y(ry - 84), 26, twinkle(on2(tc) - 2, 12), { seed: 3260 + i, col: PAL.pink });
    }
  });
}
function card(f) {
  const t = f - C.card;
  if (t < -4) return false;
  // card slides up on 1s with a smear frame
  const cy = t < -2 ? 1500 : t < 0 ? 760 : t < 2 ? -40 : t < 4 ? 14 : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.rect(0, Math.max(0, cy), W, H); ctx.clip();
  recap(f, cy);
  ctx.restore();
  if (cy > 0) {
    D.reset();
    line([[-20, cy + 2], [1100, cy - 2]], { w: 9, seed: 3290, taper: [0, 0] });
    if (t < 0) speedLines(540, cy + 300, 260, 480, -Math.PI / 2, f, { n: 8, seed: 3291, speed: 50, w: 5, col: PAL.violet, alpha: 0.5 });
  }
  return true;
}

// =====================================================================
// END CARD
// =====================================================================
function splat(f) {   // violet ink splat wipe from the Bio-Gel column
  const t = f - C.splatEnd;
  if (t < 0 || t >= 12) return;
  const r = kf(on2(t), [[0, 0], [10, 2400, 'in2']]);
  D.reset(); D.t(LX, ROWY[2] - 12);
  const P = burst(r * 0.86, r, 18, 3300);
  fill(P, { col: PAL.violet, seed: 3301, off: [0, 0] });
  line(P, { w: 10, seed: 3302, closed: true });

}
function endCard(f) {
  const F = on2(f), H3 = on3(f);
  bg(PAL.violet);
  rays(f, 540, 930, '#5634C2', 14, 0.3);
  dots(3400, '#6E50D8', 30, 0.8);
  const t = f - C.end;
  // logo lockup (mark + white wordmark) at the top
  const lp = popIn(f - C.logo);
  if (lp > 0) {
    const LW = 560, sc = LW / 5416, LH = 696 * sc;
    D.reset(); D.t(540, 250).s(lp); D.setCtx();
    ctx.drawImage(markImg, -LW / 2, -LH / 2 + 48 * sc, 1029 * sc, 648 * sc);
    ctx.drawImage(wordImg, -LW / 2 + 1163 * sc, -LH / 2, 3974 * sc, 660 * sc);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // box slam + final bounce on the last downbeat
  let sx = 1, sy = 1, by = 930;
  if (t < 0) { by = 930 + (t === -2 ? 1000 : 420); sy = t === -2 ? 2.3 : 1.6; sx = 1 / Math.sqrt(sy); }
  else if (t < 10) { [sx, sy] = t < 2 ? [1.16, 0.85] : t < 4 ? [0.95, 1.06] : t < 6 ? [1.02, 0.98] : [1, 1]; }
  const tb = f - C.final, tn = f - C.button;
  if (tb >= 0 && tb < 10) { [sx, sy] = tb < 2 ? [1.06, 0.93] : tb < 4 ? [0.98, 1.03] : tb < 6 ? [1.01, 0.99] : [1, 1]; }
  if (tn >= 0 && tn < 8) { [sx, sy] = tn < 2 ? [1.03, 0.965] : tn < 4 ? [0.99, 1.01] : [1, 1]; }
  if (f > C.final + 10) by += 7 * Math.sin(on3(f) * 0.16);
  const bw = 520, hh = BOX.h * bw / BOX.w;
  boxSticker(540, by + hh / 2 * (1 - sy), bw, sx, sy, -0.03, f > C.final + 12 ? H3 : f, { seed: 3420 });
  if (t >= 0 && t < 12) { D.reset(); impactLines(540, 930, 400, 600, 16, t, { w: 9, col: PAL.cream, seed: 3430, life: 9 }); }
  if (tb >= 0 && tb < 12) { D.reset(); impactLines(540, 930, 420, 560, 12, tb, { w: 7, col: PAL.pink, seed: 3431, life: 8 }); }
  // sparkles (loop)
  [[170, 660, 0], [915, 700, 9], [130, 1180, 18], [950, 1230, 27], [260, 1660, 4], [820, 1640, 13], [540, 1720, 22]].forEach(([x, y, d], i) => {
    const tt = (F - C.end - 6 - d + 400) % 36;
    D.reset(); sparkle(x, y, 32, twinkle(tt, 24), { seed: 3440 + i, col: i % 2 ? PAL.pink : PAL.cream, rot: 0.15 });
  });
  D.reset();
  drawLettering(T.end.ku, 540, 1440, wordsAnim(f, C.tag, 9999, 3));
  drawLettering(T.end.ar, 540, 1545, wordsAnim(f, C.tag + 10, 9999, 3));
  if (f >= C.tag + 14) line([[300, 1588], [450, 1600], [620, 1596], [780, 1582]], { w: 9, seed: 3460, col: PAL.pink, trim: [0, clamp((F - C.tag - 14) / 8)], taper: [0.2, 0.5] });
}

// =====================================================================
// camera: slow push-ins + screen shake on the big impacts (shake on 1s, decaying)
const SHAKES = [[() => C.splat, 16], [() => C.reveal + 2, 13], [() => C.slap, 11], [() => C.card, 8], [() => C.end, 13], [() => C.final, 6]];
function camera(f) {
  let s = 1, cx = 540, cy = 1000;
  if (f >= C.p1 && f < C.rip) s = 1 + 0.045 * E.sine(clamp((on2(f) - C.p1) / (C.rip - C.p1)));
  else if (f >= C.rip && f < C.reveal) s = 1.045;
  if (f >= C.iris + 12 && f < C.card) { s = 1 + 0.05 * E.sine(clamp((on2(f) - C.slap) / (C.card - C.slap))); cy = 1060; }
  if (f >= C.end) { s = 1 + 0.03 * E.sine(clamp((on3(f) - C.end) / (FRAMES - C.end))); cy = 930; }
  let ox = 0, oy = 0;
  SHAKES.forEach(([fn, a]) => {
    const t = f - fn();
    if (t >= 0 && t < 6) { const k = [1, -0.62, 0.38, -0.2, 0.1, -0.04][t]; oy += a * k; ox += a * 0.35 * k * (t % 2 ? 1 : -1); }
  });
  G.cam = [s, 0, 0, s, cx - cx * s + ox, cy - cy * s + oy];
}
window.seek = f => {
  G.f = f;
  camera(f);
  const hold = f >= C.hold;
  G.boil = hold ? Math.floor(f / 3) % 4 : Math.floor(f / 2) % 4;
  G.boilAmp = 1;
  D.reset();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (f < C.reveal - 2) act1(f);
  else if (f < C.d1 - FLY - 2) reveal(f);
  else if (f < C.iris) diff1(f);
  else if (f < C.iris + 12) { diff1(f); iris(f); }
  else if (f < C.card - 4) hero(f);
  else if (f < C.end - 2) { if (f < C.card + 4) hero(f); card(f); splat(f); }
  else endCard(f);
  smoke(f);
  // paper multiply over everything
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(paper, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return true;
};
window.FRAMES = FRAMES;
window.__ready = true;
