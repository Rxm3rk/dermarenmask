// fvrts — Kurdistan launch film. 1080x1920 (9:16), frames numbered at 29.97 fps (f0–f1049),
// master rendered at 59.94 (half frames). seek(f) is a pure function of f.
import { initProducts, P } from './products.js';

const NS = 'http://www.w3.org/2000/svg';
const stage = document.getElementById('stage');
const defs = document.getElementById('defs');

// fvrts palette: blush pink, ink black, mint
const C = {
  page: '#FDF8F9', ink: '#121212', grey: '#6E676A', pink: '#F7CFD7', pinkD: '#EE9FB6',
  mint: '#7FD9C1', mintD: '#3FBF9C',
};

// ---------------- math ----------------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t, in2: t => t * t, in3: t => t * t * t, in4: t => t ** 4,
  out2: t => 1 - (1 - t) ** 2, out3: t => 1 - (1 - t) ** 3, out4: t => 1 - (1 - t) ** 4,
  io2: t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  io3: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
function kf(f, keys, ease = 'lin') {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    if (f <= f1) { const [f0, v0] = keys[i - 1]; return v0 + (v1 - v0) * E[e || ease]((f - f0) / (f1 - f0)); }
  }
  return keys[keys.length - 1][1];
}
// exponential approach: covers r of the remaining distance each frame
const ex = (f, f0, from, to, r = 0.16) => f <= f0 ? from : to + (from - to) * Math.pow(1 - r, f - f0);
// accelerating move from f0 (power ease-in, keeps going past f1)
const acc = (f, f0, f1, amt, p = 3) => f <= f0 ? 0 : amt * Math.pow((f - f0) / (f1 - f0), p);
const d1 = (fn, f) => (fn(f + 0.25) - fn(f - 0.25)) * 2;             // per-frame velocity
const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const deg = Math.PI / 180;
// damped spring: 0 → 1 with overshoot
const spring = (t, k = 0.2, w = 0.34) => t <= 0 ? 0 : 1 - Math.exp(-k * t) * Math.cos(w * t);

// ---------------- DOM helpers ----------------
function div(cls, parent, style, html) {
  const e = document.createElement('div');
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const px = v => `${v}px`;
function T(e, x = 0, y = 0, s = 1, r = 0, sy) {
  e.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)},${(sy ?? s).toFixed(4)})`;
}
const O = (e, o) => { e.style.opacity = clamp(o).toFixed(3); };
let fidN = 0;
// blur: round when bx≈by, otherwise SVG directional gaussian. `extra` = more CSS filters after it.
function blur(e, bx, by = bx, extra = '') {
  bx = Math.max(0, bx); by = Math.max(0, by);
  let f = '';
  if (bx < 0.05 && by < 0.05) f = '';
  else if (Math.abs(bx - by) < 0.08) f = `blur(${((bx + by) / 2).toFixed(2)}px)`;
  else {
    if (!e._fe) {
      const id = 'db' + (fidN++), fl = document.createElementNS(NS, 'filter');
      fl.setAttribute('id', id); fl.setAttribute('x', '-40%'); fl.setAttribute('y', '-40%');
      fl.setAttribute('width', '180%'); fl.setAttribute('height', '180%');
      fl.setAttribute('color-interpolation-filters', 'sRGB');
      const g = document.createElementNS(NS, 'feGaussianBlur'); fl.appendChild(g); defs.appendChild(fl);
      e._fe = g; e._fid = id;
    }
    e._fe.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`);
    f = `url(#${e._fid})`;
  }
  const s = (f + ' ' + extra).trim();
  e.style.filter = s || 'none';
}
function place(e, cx, cy) { e.style.left = px(cx - e.offsetWidth / 2); e.style.top = px(cy - e.offsetHeight / 2); }
// word-by-word text (RTL order is DOM order, so Kurdish/Arabic reveal right→left)
function words(parent, text, cls, style) {
  const e = div(cls, parent, style); e._w = [];
  text.split(' ').forEach((w, i, a) => {
    const s = document.createElement('span'); s.className = 'w'; s.textContent = w; e.appendChild(s); e._w.push(s);
    if (i < a.length - 1) e.appendChild(document.createTextNode(' '));
  });
  return e;
}
function reveal(e, lf, start, stagger = 2.4, dist = 34, r = 0.17) {
  e._w.forEach((s, i) => {
    const t = lf - start - i * stagger, p = t <= 0 ? 0 : 1 - Math.pow(1 - r, t);
    s.style.opacity = clamp(p * 1.6).toFixed(3);
    s.style.transform = `translateY(${((1 - p) * dist).toFixed(2)}px)`;
    const b = (1 - p) * 9; s.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : 'none';
  });
}
function rise(e, lf, start, dist = 34, r = 0.17, bx = 9) {
  const t = lf - start, p = t <= 0 ? 0 : 1 - Math.pow(1 - r, t);
  O(e, p * 1.6); e.style.translate = `0 ${((1 - p) * dist).toFixed(2)}px`;
  blur(e, (1 - p) * bx);
  return p;
}
function frost(parent, text, { font, body, tint = 'rgba(150,70,95,.2)', shadow = 'rgba(150,70,95,.18)', ls = '0', dir = 'ltr' }) {
  const w = div('frost', parent, { font, letterSpacing: ls, direction: dir, lineHeight: '1' });
  const L = st => { const d = div('', w, st); d.textContent = text; return d; };
  w._sh = L({ color: shadow, filter: 'blur(15px)', transform: 'translateY(16px)' });
  w._body = L({ backgroundImage: body, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
  w._sheen = L({ backgroundImage: 'linear-gradient(105deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.95) 48%,rgba(255,255,255,0) 58%)', backgroundSize: '300% 100%', backgroundPosition: '100% 0', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
  w._edge = L({ color: 'transparent', WebkitTextStroke: `2px ${tint}`, transform: 'translateY(2px)' });
  w._rim = L({ color: 'transparent', WebkitTextStroke: '2.2px rgba(255,255,255,1)', WebkitMaskImage: 'linear-gradient(180deg,#000 0%,rgba(0,0,0,.3) 50%,rgba(0,0,0,.8) 100%)' });
  w.sheen = x => { w._sheen.style.backgroundPosition = `${x.toFixed(2)}% 0`; };
  return w;
}
const glassPill = (parent, html, style) => div('glass abs', parent, Object.assign({ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }, style), html);
const SEP = '<span style="width:1px;height:22px;background:rgba(18,18,18,.18)"></span>';
function img(parent, src, style) { const i = document.createElement('img'); i.src = src; Object.assign(i.style, { position: 'absolute' }, style); parent.appendChild(i); return i; }

// fvrts logo: 2059x679 master, five letters
const LOGO = { W: 2059, H: 679, parts: [{ x: 0, y: 0, w: 343, h: 676 }, { x: 334, y: 188, w: 508, h: 486 }, { x: 920, y: 187, w: 277, h: 488 }, { x: 1244, y: 84, w: 345, h: 595 }, { x: 1646, y: 186, w: 413, h: 493 }] };

// ---------------- shots ----------------
const shots = [];
function shot(f0, f1, build) {
  const el = div('shot', stage), bg = div('full', el), cam = div('cam', el), frame = div('frame', cam);
  const s = { f0, f1, el, cam, bg, frame, gl: null };
  el.style.display = 'block';
  s.render = build(s);
  el.style.display = 'none';
  shots.push(s);
}
let glCanvas;

// ---------------- journey pieces ----------------
function dotGrid(parent, x, y, w, h) {
  return div('abs', parent, {
    left: px(x), top: px(y), width: px(w), height: px(h),
    backgroundImage: 'radial-gradient(circle, rgba(226,130,158,.30) 1.7px, transparent 2.3px)', backgroundSize: '36px 36px',
    WebkitMaskImage: 'linear-gradient(180deg,transparent 0%,#000 18%,#000 78%,transparent 100%)',
  });
}
function bez(A, B, Cc, t) { const u = 1 - t; return [u * u * A[0] + 2 * u * t * B[0] + t * t * Cc[0], u * u * A[1] + 2 * u * t * B[1] + t * t * Cc[1]]; }
function route(parent, A, B, Cc) {
  const X0 = -3000, Y0 = -200, W = 4800, H = 2400;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `${X0} ${Y0} ${W} ${H}`);
  Object.assign(svg.style, { position: 'absolute', left: px(X0), top: px(Y0), overflow: 'visible' });
  const d = `M${A[0]} ${A[1]} Q${B[0]} ${B[1]} ${Cc[0]} ${Cc[1]}`;
  const id = 'rm' + (fidN++);
  svg.innerHTML = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${X0}" y="${Y0}" width="${W}" height="${H}"><path class="m" d="${d}" fill="none" stroke="#fff" stroke-width="30"/></mask></defs>
    <path d="${d}" fill="none" stroke="rgba(18,18,18,.32)" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.1 17" mask="url(#${id})"/>
    <path class="tg" d="${d}" fill="none" stroke="rgba(127,217,193,.35)" stroke-width="14" stroke-linecap="round"/>
    <path class="t" d="${d}" fill="none" stroke="#3FBF9C" stroke-width="3.5" stroke-linecap="round"/>`;
  parent.appendChild(svg);
  const lens = [0]; let L = 0, prev = bez(A, B, Cc, 0);
  for (let i = 1; i <= 600; i++) { const p = bez(A, B, Cc, i / 600); L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); lens.push(L); prev = p; }
  const lenAt = u => { const x = clamp(u) * 600, i = Math.min(599, Math.floor(x)); return lerp(lens[i], lens[i + 1], x - i); };
  const m = svg.querySelector('.m'), t = svg.querySelector('.t'), tg = svg.querySelector('.tg');
  return {
    update(u, tail = 240, u0 = 0) {
      const l = lenAt(u), l0 = lenAt(u0);
      m.setAttribute('stroke-dasharray', `0 ${l0.toFixed(2)} ${Math.max(0, l - l0).toFixed(2)} 99999`);
      // the comet tail starts behind the drop and only appears once it has somewhere to trail from
      const head = Math.max(0, l - 70), tl = Math.min(tail, head);
      const da = `0 ${(head - tl).toFixed(2)} ${tl.toFixed(2)} 99999`;
      t.setAttribute('stroke-dasharray', da); tg.setAttribute('stroke-dasharray', da);
      const a = clamp((l - 90) / 160).toFixed(3); t.setAttribute('opacity', a); tg.setAttribute('opacity', a);
    },
  };
}
// the Korea → Kurdistan journey slider (frosted glass capsule)
function journey(parent) {
  const bar = glassPill(parent, '', { width: '900px', height: '138px', borderRadius: '46px', justifyContent: 'space-between', padding: '0 30px', boxSizing: 'border-box' });
  const badge = (url, p) => {
    const b = div('', p, { position: 'relative', width: '68px', height: '68px', flex: '0 0 68px' });
    const glow = div('', b, { position: 'absolute', inset: '-12px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(127,217,193,.8) 0%, rgba(127,217,193,0) 70%)', opacity: '0' });
    div('', b, { position: 'absolute', inset: '0', borderRadius: '50%', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: '50% 50%', boxShadow: '0 0 0 3px #fff, 0 8px 22px rgba(150,60,90,.22)' });
    return glow;
  };
  const label = (p, en, nat, natCls, align) => {
    const t = div('', p, { display: 'flex', flexDirection: 'column', gap: '4px', alignItems: align });
    div('', t, { font: '700 17px Inter', letterSpacing: '.16em', color: C.ink }, en);
    div(natCls, t, { font: natCls === 'ku' ? '500 24px Somar' : "700 22px 'Malgun Gothic'", color: C.grey, lineHeight: '1.1' }, nat);
  };
  const L = div('', bar, { display: 'flex', alignItems: 'center', gap: '14px', width: '240px' });
  const kuGlow = badge(P.flagURL.ku, L); label(L, 'KURDISTAN', 'کوردستان', 'ku', 'flex-start');
  const mid = div('', bar, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '290px' });
  const km = div('', mid, { font: '700 36px Inter', letterSpacing: '-0.01em', color: C.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' });
  const trk = div('', mid, { position: 'relative', width: '280px', height: '4px', borderRadius: '4px', background: 'repeating-linear-gradient(90deg, rgba(18,18,18,.2) 0 7px, transparent 7px 13px)' });
  const fill = div('', trk, { position: 'absolute', right: '0', top: '0', height: '4px', borderRadius: '4px', background: 'linear-gradient(270deg,#EE9FB6,#7FD9C1)' });
  const dot = div('', trk, { position: 'absolute', top: '-10px', width: '24px', height: '24px', borderRadius: '50%', background: 'radial-gradient(circle at 34% 30%, #ffffff 0%, #C4F3E4 32%, #3FBF9C 100%)', boxShadow: '0 0 0 6px rgba(127,217,193,.28), 0 4px 12px rgba(30,120,90,.35)' });
  const R = div('', bar, { display: 'flex', alignItems: 'center', gap: '14px', width: '240px', justifyContent: 'flex-end' });
  label(R, 'KOREA', '한국', 'ko', 'flex-end'); badge(P.flagURL.ko, R);
  place(bar, 540, 250);
  return {
    el: bar,
    set(prog, arrived = 0) {
      fill.style.width = px(280 * prog); dot.style.left = px(280 * (1 - prog) - 12);
      km.innerHTML = `${Math.round(7117 * prog).toLocaleString('en-US')}<span style="font:600 19px Inter;color:#8B8386;margin-left:6px">km</span>`;
      O(kuGlow, arrived);
    },
  };
}
// 3D pieces placed in screen px on the z=0 plane of a fixed camera
const DROPCAM = { tx: 0, ty: 0, tz: 0, az: 0, el: 0, dist: 40, fov: 24 };
function dropAt(i, x, y, hPx, { rz = 0, ry = 0, sx = 1, sy = 1, z = 0 } = {}) {
  P.cam(DROPCAM);
  const u = P.upp(DROPCAM.dist, DROPCAM.fov);
  P.drop(i, { x: (x - 540) * u, y: -(y - 960) * u, z, s: hPx / 2 * u, rz, ry });
  const m = P.drops[i]; m.scale.set(hPx / 2 * u * sx, hPx / 2 * u * sy, hPx / 2 * u * sx);
}
function flagAt(k, cx, cy, wPx, { ry = 0, rz = 0, t = 0, amp = 1 } = {}) {
  P.cam(DROPCAM);
  const u = P.upp(DROPCAM.dist, DROPCAM.fov);
  P.flag(k, { x: (cx - wPx / 2 - 540) * u, y: -(cy - 960) * u, z: 0, s: wPx * u / 3, ry, rz, t, amp });
}

// ---------------- init: fonts, images, 3D ----------------
const FONTS = ['400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter',
  '300 20px Somar', '400 20px Somar', '500 20px Somar', '900 20px Somar', "700 20px 'Malgun Gothic'"];
await Promise.all(FONTS.map(f => document.fonts.load(f, 'Aa ئێستا 서울')));
await document.fonts.ready;
await Promise.all(['fvrts', 'l0', 'l1', 'l2', 'l3', 'l4'].map(n => { const i = new Image(); i.src = `img/${n}.png`; return i.decode(); }));
glCanvas = document.createElement('canvas');
await initProducts(glCanvas);

// ============ S1  f0–114  Korea: the drop leaves the Taegukgi — "لە کۆریاوە" ============
shot(0, 114, s => {
  div('full', s.bg, { background: C.page });
  const haze = div('full', s.bg, { background: 'radial-gradient(ellipse 90% 55% at 52% 36%, #F4BFCD 0%, #F8D6DF 42%, #FBEAEF 72%, #FDF6F8 100%)' });
  div('full', s.bg, { background: 'radial-gradient(ellipse 85% 24% at 50% 100%, #D2F2E6 0%, rgba(210,242,230,0) 100%)' });
  const world = div('abs', s.frame, { width: '1080px', height: '1920px' });
  dotGrid(world, -2900, -140, 4300, 2200);
  const FX = 560, FY = 640, FW = 560, DRX = 640, BOT = FY + FW / 3;
  const S = [DRX, BOT + 96], B = [220, 1160], Ee = [-1600, 760];
  const rt = route(world, S, B, Ee);
  const tag = glassPill(world, `<span class="ko" style="font:700 26px 'Malgun Gothic';letter-spacing:0">한국</span>${SEP}<span>SOUTH KOREA</span>`,
    { height: '58px', gap: '14px', padding: '0 26px', font: '700 18px Inter', letterSpacing: '.16em', color: C.ink });
  place(tag, FX, 396);
  const ku = words(world, 'لە کۆریاوە', 'ku abs', { font: '900 136px Somar', color: C.ink, left: '0', width: '1080px', textAlign: 'center', top: '1060px', lineHeight: '1.25', whiteSpace: 'nowrap' });
  const ar = words(world, 'من كوريا', 'ku abs', { font: '500 70px Somar', color: C.grey, left: '0', width: '1080px', textAlign: 'center', top: '1248px', lineHeight: '1.3' });
  s.gl = div('gl', s.frame);
  const ov = div('overlay', s.el), jb = journey(ov);
  const off = lf => lf < 44 ? 0 : 900 * Math.pow((lf - 44) / 70, 2.6);
  const RY = lf => 720 * Math.pow(0.84, lf);                    // the flag rises out of the haze
  const U = lf => lf < 34 ? 0 : 0.56 * Math.pow((lf - 34) / 80, 1.7);
  const WX = lf => bez(S, B, Ee, U(lf))[0], WY = lf => bez(S, B, Ee, U(lf))[1];
  return lf => {
    O(haze, 1 - E.io2(clamp(lf / 28)));
    const o = off(lf), ry0 = RY(lf);
    T(world, o, 0);
    blur(s.cam, Math.min(16, d1(off, lf) * 0.42), 0);
    rt.update(U(lf), 230);
    P.floor.visible = false;
    flagAt('ko', FX + o, FY + ry0, FW, { ry: -16 + 10 * Math.pow(0.84, lf), rz: 6 * Math.pow(0.84, lf), t: lf, amp: 1 });
    blur(s.gl, 0, Math.min(10, Math.abs(d1(RY, lf)) * 0.12));
    rise(tag, lf, 6, 26);
    reveal(ku, lf, 10, 4, 44);
    reveal(ar, lf, 18, 4, 34);
    // the drop forms on the flag's hem, stretches, lets go, and flies west
    if (lf >= 18) {
      let sy, rz = 0;
      if (lf < 34) {
        const g = (lf - 18) / 16, h = 150 * E.out2(g);
        sy = 1 + 0.35 * E.in2(g);
        dropAt(0, DRX + o, BOT + ry0 + h * sy / 2 - 8, Math.max(1, h), { sy, ry: 40 + lf * 3, z: 0.4 });
      } else {
        const vxw = d1(WX, lf);
        sy = 1 + 0.35 * Math.exp(-(lf - 34) / 4) * Math.cos((lf - 34) * 0.7);
        rz = clamp(Math.atan2(vxw * 0.045, 1) / deg, -62, 62);
        dropAt(0, WX(lf) + o, WY(lf) + ry0, 150, { sy, rz, ry: 40 + lf * 3, z: 0.4 });
      }
    }
    rise(jb.el, lf, 30, -34);
    jb.set(U(lf));
  };
});

// ============ S2  f115–172  Kurdistan: the drop lands in the sun — "بۆ کوردستان" ============
shot(115, 172, s => {
  div('full', s.bg, { background: C.page });
  div('full', s.bg, { background: 'radial-gradient(ellipse 85% 24% at 50% 100%, #D2F2E6 0%, rgba(210,242,230,0) 100%)' });
  const world = div('abs', s.frame, { width: '1080px', height: '1920px' });
  dotGrid(world, -1400, -140, 3600, 2200);
  const FX = 540, FY = 640, FW = 560;
  const A = [1400, 1300], B = [740, 990], Ee = [FX, FY];
  const rt = route(world, A, B, Ee);
  const tag = glassPill(world, `<span class="ku" style="font:500 28px Somar;letter-spacing:0">کوردستان</span>${SEP}<span>KURDISTAN</span>`,
    { height: '58px', gap: '14px', padding: '0 26px', font: '700 18px Inter', letterSpacing: '.16em', color: C.ink });
  place(tag, FX, 396);
  const ku = words(world, 'بۆ کوردستان', 'ku abs', { font: '900 128px Somar', color: C.ink, left: '0', width: '1080px', textAlign: 'center', top: '1090px', lineHeight: '1.25', whiteSpace: 'nowrap' });
  const ar = words(world, 'لكوردستان', 'ku abs', { font: '500 70px Somar', color: C.grey, left: '0', width: '1080px', textAlign: 'center', top: '1270px', lineHeight: '1.3' });
  s.gl = div('gl', s.frame);
  // light burst + rings above the 3D layer, riding the same world pan
  const fx = div('abs', s.frame, { width: '1080px', height: '1920px' });
  const bloom = div('abs', fx, { width: '600px', height: '600px', left: px(FX - 300), top: px(FY - 300), borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,250,232,.98) 0%, rgba(255,226,140,.6) 22%, rgba(254,189,17,.22) 45%, rgba(254,189,17,0) 70%)' });
  const rs = document.createElementNS(NS, 'svg');
  Object.assign(rs.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible', filter: 'drop-shadow(0 0 8px rgba(254,200,60,.8))' });
  rs.setAttribute('width', 1080); rs.setAttribute('height', 1920);
  rs.innerHTML = [0, 1, 2].map(() => `<circle cx="${FX}" cy="${FY}" r="10" fill="none" stroke="#fff" stroke-width="4"/>`).join('');
  fx.appendChild(rs);
  const rings = [...rs.querySelectorAll('circle')];
  const ov = div('overlay', s.el), jb = journey(ov);
  const off = lf => -235 * Math.pow(0.88, lf);
  const Wp = lf => lf < 12 ? 0.5 + 0.5 * Math.pow(Math.max(0, lf) / 12, 1.25) : 1;
  const zoom = lf => 1 + acc(lf, 38, 57, 3.4, 3);
  return lf => {
    const o = off(lf);
    T(world, o, 0); T(fx, o, 0);
    const z = zoom(lf), qx = FX + o, qy = FY;
    T(s.cam, (1 - z) * (qx - 540), (1 - z) * (qy - 960), z);
    const zb = Math.min(9, d1(zoom, lf) * 15), hb = Math.min(16, d1(off, lf) * 0.42);
    blur(s.cam, Math.max(hb, zb), zb);
    const w = Wp(lf);
    rt.update(w, 230);
    P.floor.visible = false;
    const hit = lf >= 12 ? Math.exp(-(lf - 12) / 9) : 0;
    flagAt('ku', FX + o, FY, FW, { ry: 14, rz: -1.5 * hit, t: lf + 60, amp: 1 + 1.6 * hit });
    blur(s.gl, 0, 0);
    // the drop flies into the sun and is absorbed
    if (lf < 16.5) {
      const [bx, by] = bez(A, B, Ee, w);
      const vx = d1(l => bez(A, B, Ee, Wp(l))[0], lf);
      const h = 150 * (1 - E.in2(clamp((lf - 12) / 4.5)));
      if (h > 1) dropAt(0, bx + o, by, h, { rz: clamp(Math.atan2(vx * 0.045, 1) / deg, -62, 62), ry: 150 + lf * 3, z: 1.2 });
    }
    const bt = lf - 12;
    O(bloom, bt < 0 ? 0 : kf(bt, [[0, 0], [1.5, 1], [26, 0.18, 'out2']]));
    T(bloom, 0, 0, bt < 0 ? 0.3 : 0.45 + 0.75 * (1 - Math.pow(0.84, bt)));
    rings.forEach((c, i) => {
      const t = lf - 12.5 - i * 4.5;
      if (t < 0) { c.setAttribute('opacity', 0); return; }
      c.setAttribute('r', (24 + 330 * (1 - Math.pow(0.91, t))).toFixed(2));
      c.setAttribute('opacity', clamp(1 - t / 30).toFixed(3));
      c.setAttribute('stroke-width', (5 * (1 - t / 36) + 0.6).toFixed(2));
    });
    rise(tag, lf, 3, 26);
    reveal(ku, lf, 3, 4, 44);
    reveal(ar, lf, 11, 4, 34);
    jb.set(0.574 + 0.426 * clamp((w - 0.5) / 0.5), lf >= 12 ? kf(lf, [[12, 0], [15, 1], [40, 0.65]]) : 0);
    const ce = acc(lf, 42, 57, 1, 3);
    T(jb.el, 0, -70 * ce); blur(jb.el, 0, 10 * ce); O(jb.el, 1 - ce);
  };
});

// ============ S3  f173–230  fvrts: letters orbit in and lock on the pink tile ============
shot(173, 230, s => {
  div('full', s.bg, { background: C.page });
  div('full', s.bg, { background: 'radial-gradient(circle at 50% 50%, #FBE4EA 0%, rgba(251,228,234,0) 46%)' });
  const lock = div('abs', s.frame, { width: '1080px', height: '1920px', transformOrigin: '540px 960px' });
  const TS = 580;
  const tile = div('abs', lock, { left: px(540 - TS / 2), top: px(960 - TS / 2), width: px(TS), height: px(TS), borderRadius: '156px',
    background: 'linear-gradient(160deg, #FBE0E6 0%, #F7CFD7 46%, #F1BCC9 100%)', overflow: 'hidden',
    boxShadow: '0 60px 110px rgba(214,110,140,.30), 0 14px 34px rgba(214,110,140,.20), inset 0 2px 0 rgba(255,255,255,.8), inset 0 -4px 14px rgba(200,95,125,.16)' });
  const tsheen = div('abs', tile, { width: '240px', height: '1000px', top: '-220px', left: '-360px', background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0))', transform: 'rotate(24deg)' });
  const WW = 440, k = WW / LOGO.W, WH = LOGO.H * k, WX = 540 - WW / 2, WY = 960 - WH / 2;
  const word = div('abs', lock, { left: px(WX), top: px(WY), width: px(WW), height: px(WH), transformOrigin: '50% 50%' });
  const cx0 = WW / 2, cy0 = WH / 2;
  const letters = LOGO.parts.map((p, i) => {
    const w = p.w * k, h = p.h * k;
    const outer = div('abs', word, { width: px(w), height: px(h) });
    const inner = img(outer, `img/l${i}.png`, { width: px(w), height: px(h), left: '0', top: '0' });
    return { outer, inner, w, h, cx: p.x * k + w / 2, cy: p.y * k + h / 2 };
  });
  const shim = div('abs', word, { left: '0', top: '0', width: px(WW), height: px(WH), WebkitMaskImage: 'url(img/fvrts.png)', WebkitMaskSize: '100% 100%', overflow: 'hidden' });
  const band = div('abs', shim, { left: '0', top: '-60px', width: '110px', height: px(WH + 120), background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.6),rgba(255,255,255,0))', transform: 'rotate(18deg)' });
  const pos = (i, lf) => {
    const p = 1 - Math.pow(0.8, lf + 2), q = 1 - Math.min(1, p / 0.99);
    const L = letters[i], dx = L.cx - cx0, dy = L.cy - cy0;
    const rf = Math.hypot(dx, dy), af = rf < 30 ? (-60 + i * 72) * deg : Math.atan2(dy, dx);
    const r = rf + 360 * q, a = af + (5.0 + i * 0.32) * q;
    return { x: cx0 + r * Math.cos(a), y: cy0 + r * Math.sin(a), rot: -170 * q - i * 22 * q, sc: 0.55 + 0.45 * (1 - q) };
  };
  const TSC = lf => 0.55 + 0.45 * spring(lf + 3, 0.2, 0.33);
  return lf => {
    const ts = TSC(lf), tr = -9 * Math.exp(-0.2 * (lf + 3)) * Math.cos(0.3 * (lf + 3));
    T(tile, 0, 0, ts, tr);
    blur(tile, Math.min(8, Math.abs(d1(TSC, lf)) * 60));
    tsheen.style.left = px(kf(lf, [[14, -360], [36, TS + 120, 'io2']]));
    letters.forEach((L, i) => {
      const a = pos(i, lf), b = pos(i, lf - 0.25), c = pos(i, lf + 0.25);
      const vx = (c.x - b.x) * 2, vy = (c.y - b.y) * 2, sp = Math.hypot(vx, vy), ang = Math.atan2(vy, vx) / deg;
      L.outer.style.transform = `translate(${(a.x - L.w / 2).toFixed(2)}px,${(a.y - L.h / 2).toFixed(2)}px) rotate(${ang.toFixed(2)}deg)`;
      L.inner.style.transform = `rotate(${(a.rot - ang).toFixed(2)}deg) scale(${a.sc.toFixed(4)})`;
      blur(L.outer, Math.min(10, sp * 0.3), 0);
    });
    const pulse = lf > 17 && lf < 27 ? 1 + 0.04 * Math.sin(Math.PI * (lf - 17) / 10) : 1;
    T(word, 0, 0, pulse);
    band.style.left = px(kf(lf, [[18, -160], [36, WW + 60, 'io2']]));
    O(shim, lf > 16 ? 1 : 0);
    // slow push-in, then the whole icon shrinks away accelerating into a blur
    const xe = acc(lf, 47, 58, 1, 2.5);
    T(lock, 0, -30 * xe, (1 + 0.05 * E.sine(clamp((lf - 18) / 29))) * (1 - 0.18 * xe));
    blur(lock, xe > 0 ? 0.3 + 6.7 * xe : 0);
  };
});

// ============ S4  f231–404  hero lineup ============
shot(231, 404, s => {
  const bgA = div('full', s.bg, { background: 'linear-gradient(180deg,#CDEFE3 0%,#E6F5EF 30%,#F8DFE6 64%,#FEF9FA 100%)' });
  const bgB = div('full', s.bg, { background: 'linear-gradient(180deg,#F6D3DD 0%,#FBEAEF 45%,#FEFBFB 100%)' });
  const glowA = div('full', s.bg, { background: 'radial-gradient(ellipse 70% 12% at 50% 69%, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 100%)' });
  const tBody = 'linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(252,242,245,.8) 45%, rgba(255,255,255,.9) 100%)';
  const t1 = frost(s.frame, 'جوانی', { font: '900 250px Somar', dir: 'rtl', body: tBody });
  const t2 = frost(s.frame, 'کۆری', { font: '900 250px Somar', dir: 'rtl', body: tBody });
  place(t1, 540, 330); place(t2, 540, 600);
  s.gl = div('gl', s.frame);
  const ku = words(s.frame, 'ئێستا لە کوردستان', 'ku abs', { font: '500 58px Somar', color: C.ink, left: '0', width: '1080px', textAlign: 'center', top: '1384px', lineHeight: '1.4' });
  const ar = words(s.frame, 'الجمال الكوري، هسه بكوردستان', 'ku abs', { font: '400 42px Somar', color: C.grey, left: '0', width: '1080px', textAlign: 'center', top: '1470px', lineHeight: '1.4' });
  const prods = [
    { n: 'toner', x: 0, z: -1.6, ry: -8, o: 8 },
    { n: 'serum', x: -6.7, z: 1.4, ry: 26, o: 3 },
    { n: 'tube', x: 6.7, z: 0.9, ry: -24, o: 0 },
  ];
  const Yp = (p, lf) => -16 * Math.pow(0.84, lf + p.o);
  const FOV = 24, DIST = (12.25 / 600) * 1920 / (2 * Math.tan(12 * deg)), upp = P.upp(DIST, FOV);
  const txB = lf => 6.2 - 0.07 * lf - acc(lf, 64, 87, 13, 3);
  return lf => {
    const A = lf < 87;
    [bgA, glowA, t1, t2, ku, ar].forEach(e => e.style.display = A ? '' : 'none');
    bgB.style.display = A ? 'none' : '';
    if (A) {
      const az = ex(lf, 0, -26, -5, 0.1) + 0.1 * lf;
      P.cam({ tx: 0, ty: 6.1, tz: 0, az, el: 5, dist: ex(lf, 0, DIST * 1.2, DIST, 0.1), fov: FOV, shiftY: 70 });
      let vmax = 0;
      prods.forEach(p => {
        const y = Yp(p, lf), ry = p.ry + 150 * Math.pow(0.84, lf + p.o);
        P.show(p.n, { x: p.x, z: p.z, y, ry });
        const v = Math.abs(d1(f => Yp(p, f), lf)) / upp; if (y > -12) vmax = Math.max(vmax, v);
      });
      blur(s.gl, 0, Math.min(10, vmax * 0.16));
      [t1, t2].forEach((t, i) => {
        const yy = (80 + 60 * i) * Math.pow(0.86, lf), vv = Math.abs(d1(f => (80 + 60 * i) * Math.pow(0.86, f), lf));
        T(t, 0, yy); O(t, 0.25 + lf / 8); blur(t, 0, Math.min(8, vv * 0.5));
        t.sheen(kf(lf, [[18 + 6 * i, 100], [70 + 6 * i, 0, 'io2']]));
      });
      reveal(ku, lf, 22, 3.5, 30);
      reveal(ar, lf, 33, 3, 26);
    } else {
      const l2 = lf - 87;
      const tx = txB(l2);
      P.cam({ tx, ty: 5.6, tz: 0, az: 16, el: 3, dist: 30, fov: 30, shiftY: 0 });
      prods.forEach(p => P.show(p.n, { x: p.x, z: p.z, y: 0, ry: p.ry }));
      for (let i = 0; i < 7; i++) {
        P.drop(i, { x: -12 + i * 4.1 + hash(i, 1) * 1.5, y: 1.5 + hash(i, 2) * 8 + 0.3 * Math.sin(lf * 0.06 + i), z: -6 + hash(i, 3) * 13, s: 0.28 + hash(i, 4) * 0.3, ry: lf * 2 + i * 50, rz: -10 + hash(i, 5) * 20 });
      }
      const vpx = Math.abs(d1(txB, l2)) / P.upp(30, 30);
      blur(s.cam, Math.min(26, vpx * 0.2), 0);
    }
  };
});

// ============ product shots: name above, product centre, copy below, giant glass word at the bottom edge ============
function productShot(f0, f1, o) {
  shot(f0, f1, s => {
    div('full', s.bg, { background: o.bg });
    div('full', s.bg, { background: `radial-gradient(ellipse 55% 6% at 50% ${(o.floorY / 1920 * 100).toFixed(1)}%, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 100%)` });
    const big = frost(s.frame, o.big, { font: '800 420px Inter', ls: '-0.055em', body: o.bigBody, tint: o.tint, shadow: o.tint });
    place(big, 540, 1790);
    s.gl = div('gl', s.frame);
    const nameRow = div('lat abs', s.frame, { left: '0', width: '1080px', top: '258px', textAlign: 'center', font: '700 82px Inter', letterSpacing: '-0.03em', lineHeight: '1.05', whiteSpace: 'nowrap' });
    const n1 = div('', nameRow, { display: 'inline-block', color: C.ink }, o.n1);
    nameRow.appendChild(document.createTextNode(' '));
    const n2 = div('', nameRow, { display: 'inline-block', color: '#8A8285', fontWeight: '400' }, o.n2);
    const ku = words(s.frame, o.ku, 'ku abs', { left: '80px', width: '920px', top: '1228px', textAlign: 'center', font: `500 ${o.kuSize || 48}px Somar`, lineHeight: '1.5', color: C.ink, textWrap: 'balance' });
    const ar = words(s.frame, o.ar, 'ku abs', { left: '80px', width: '920px', textAlign: 'center', font: '400 40px Somar', lineHeight: '1.5', color: C.grey, textWrap: 'balance' });
    ar.style.top = px(1228 + ku.offsetHeight + 16);
    const chipRow = div('abs', s.frame, { left: '0', width: '1080px', display: 'flex', justifyContent: 'center', gap: '14px', direction: 'rtl' });
    chipRow.style.top = px(1228 + ku.offsetHeight + 16 + ar.offsetHeight + 34);
    const chips = o.chips.map(c => div('glass chip', chipRow, { position: 'relative', height: '56px', font: '600 23px Inter', padding: '0 24px' }, `<i style="background:${o.dot}"></i>${c}`));
    const it = P.items[o.prod];
    const upp = it.h / o.hPx, DIST = upp * 1920 / (2 * Math.tan(12 * deg));
    const lift = 0.9;
    const drops = [...Array(o.nDrops)].map((_, i) => {
      const k = i + o.seed * 10, out = i % 2 ? 1 : -1;
      if (i % 3 === 2) return { x: (hash(k, 7) - 0.5) * 5, y: it.h * (0.92 + hash(k, 9) * 0.14), z: -9 + hash(k, 8) * 3, s: 0.24 + hash(k, 10) * 0.18, ph: hash(k, 11) * 6.28 };
      return { x: out * (it.w * 0.7 + hash(k, 7) * 3.0), y: 0.8 + hash(k, 9) * it.h * 0.9, z: -6 + hash(k, 8) * 10, s: 0.28 + hash(k, 10) * 0.3, ph: hash(k, 11) * 6.28 };
    });
    return lf => {
      if (o.setup) o.setup();
      let cx = 0, cy = 0, cs = 1, bx = 0, by = 0, br = 0;
      if (o.enter === 'left') { const f = l => -400 * Math.pow(0.8, l); cx += f(lf); bx = Math.abs(d1(f, lf)) * 0.2; }
      if (o.enter === 'below') { const f = l => 460 * Math.pow(0.86, l); cy = f(lf); by = Math.abs(d1(f, lf)) * 0.24; }
      if (o.enter === 'zoom') { const f = l => 1 - 0.24 * Math.pow(0.86, l); cs *= f(lf); br = Math.abs(d1(f, lf)) * 110; }
      if (o.exit === 'up') { const f = l => -720 * Math.pow(clamp((l - 146) / 28, 0, 2), 3); cy += f(lf); by = Math.max(by, Math.abs(d1(f, lf)) * 0.24); }
      if (o.exit === 'push') { const f = l => 1 + 0.75 * Math.pow(clamp((l - 146) / 28, 0, 2), 3); cs *= f(lf); br = Math.max(br, Math.abs(d1(f, lf)) * 120); }
      if (o.exit === 'pull') { const f = l => 1 - 0.4 * Math.pow(clamp((l - 146) / 28, 0, 2), 3); cs *= f(lf); br = Math.max(br, Math.abs(d1(f, lf)) * 120); }
      T(s.cam, cx, cy, cs);
      br = Math.min(10, br);
      blur(s.cam, Math.min(24, Math.max(bx, br)), Math.min(18, Math.max(by, br)));
      const spin = o.spin(lf);
      const fy = lift + 0.14 * Math.sin(lf * 0.065);
      P.cam({ tx: 0, ty: it.h / 2 + lift, tz: 0, az: 0, el: 4.5, dist: DIST, fov: 24,
        shiftX: 0, shiftY: (o.floorY - lift / upp - o.hPx / 2) - 960 });
      P.show(o.prod, { x: 0, y: fy, z: 0, ry: spin, rz: o.tilt ? o.tilt(lf) : 0 });
      drops.forEach((d, i) => P.drop(i, { x: d.x, y: d.y + 0.3 * Math.sin(lf * 0.05 + d.ph), z: d.z, s: d.s, ry: lf * 2.2 + i * 40, rz: 8 * Math.sin(lf * 0.03 + d.ph), pearl: o.pearls }));
      big.style.translate = `${(40 - 1.1 * lf).toFixed(2)}px 0`;
      big.sheen(kf(lf, [[30, 100], [110, 0, 'io2']]));
      rise(n1, lf, 8, 40);
      rise(n2, lf, 12, 40);
      reveal(ku, lf, 21, 2.2, 30);
      reveal(ar, lf, 36, 2.2, 26);
      chips.forEach((c, i) => {
        const t = lf - (74.5 + i * 14.5);
        const sc = t <= 0 ? 0.6 : 1 - 0.4 * Math.exp(-0.22 * t) * Math.cos(0.42 * t);
        c.style.transform = `scale(${sc.toFixed(4)})`; O(c, t / 4); blur(c, (1 - clamp(t / 6)) * 6);
      });
    };
  });
}

productShot(405, 578, {
  prod: 'serum', n1: 'Su Boon Jo', n2: 'Serum',
  ku: 'شێدارکردنەوەی قووڵی پێست و درەوشانەوە.', ar: 'ترطيب عميق وبشرة تلمع',
  chips: ['Hyaluronic Acid', 'Ceramide'], dot: C.mintD,
  bg: 'linear-gradient(180deg,#F6CAD5 0%,#FAE2E9 46%,#FFF8FA 100%)',
  big: 'Serum', bigBody: 'linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(252,234,240,.82) 55%, rgba(255,255,255,.9) 100%)', tint: 'rgba(175,70,105,.17)',
  hPx: 680, floorY: 1150, nDrops: 6, seed: 1,
  enter: 'left', exit: 'up',
  spin: lf => -150 * Math.pow(0.88, lf) - 22 + 34 * E.sine(clamp(lf / 170)) + 90 * Math.pow(clamp((lf - 146) / 28, 0, 2), 3),
});
productShot(579, 752, {
  prod: 'toner', n1: 'Mae Il', n2: 'Cream Toner',
  ku: 'هاوسەنگکردنی تەندروستی پێست و ئامادەکردنی بۆ ڕۆتینی ڕۆژانە.', ar: 'يوازن بشرتك ويجهزها لروتينك اليومي',
  chips: ['Panthenol', 'Ceramides'], dot: C.pinkD,
  bg: 'linear-gradient(180deg,#C6EDDE 0%,#E2F5EE 46%,#F8FDFB 100%)',
  big: 'Toner', bigBody: 'linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(234,249,243,.82) 55%, rgba(255,255,255,.9) 100%)', tint: 'rgba(30,120,90,.16)',
  hPx: 700, floorY: 1170, nDrops: 7, pearls: true, seed: 2, kuSize: 44,
  enter: 'below', exit: 'push',
  spin: lf => 150 * Math.pow(0.86, lf) + 18 - 30 * E.sine(clamp(lf / 170)),
});
productShot(753, 926, {
  prod: 'tube', n1: 'Mae Kkeun', n2: 'Cream',
  ku: 'نەرمی و شێ لەناو قووڵایی خانەکاندا.', ar: 'نعومة ورطوبة توصل لأعماق بشرتك',
  chips: ['Niacinamide', 'Ceramides'], dot: C.mintD,
  bg: 'linear-gradient(165deg,#CFF0E3 0%,#F1EEF0 46%,#F8D9E2 100%)',
  big: 'Cream', bigBody: 'linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(252,238,242,.82) 55%, rgba(255,255,255,.9) 100%)', tint: 'rgba(175,70,105,.16)',
  hPx: 700, floorY: 1170, nDrops: 6, seed: 3,
  enter: 'zoom', exit: 'pull',
  setup: () => { P.M.drop.color.set('#F9C6D4'); P.M.drop.emissive.set('#EE8FAE'); },
  tilt: lf => 16 * Math.pow(0.9, lf) * Math.cos(lf * 0.16),
  spin: lf => -140 * Math.pow(0.87, lf) - 20 + 32 * E.sine(clamp(lf / 170)),
});

// ============ S8  f927–955  logo disc (the only frozen stretch) ============
shot(927, 955, s => {
  div('full', s.bg, { background: C.page });
  const D = 250;
  const disc = div('abs', s.frame, { width: px(D), height: px(D), left: px(540 - D / 2), top: px(960 - D / 2), borderRadius: '50%',
    background: 'linear-gradient(160deg, #FBE0E6 0%, #F7CFD7 50%, #F1BCC9 100%)',
    boxShadow: '0 26px 60px rgba(214,110,140,.26), inset 0 2px 0 rgba(255,255,255,.8)' });
  const LW = 164;
  img(disc, 'img/fvrts.png', { width: px(LW), height: px(LW * LOGO.H / LOGO.W), left: px(D / 2 - LW / 2), top: px(D / 2 - LW * LOGO.H / LOGO.W / 2) });
  const CY = lf => kf(lf, [[0, 1190], [3, 1052], [6, 1000], [10, 965], [13, 960, 'out2']]);
  return lf => {
    const d = lf < 22 ? D : D - 76 * Math.pow((lf - 22) / 7, 3);
    const cy = CY(lf);
    T(disc, 0, cy - 960, d / D);
    const v = Math.abs(d1(CY, lf));
    const sv = lf > 22 ? Math.abs(d1(l => 76 * Math.pow(Math.max(0, l - 22) / 7, 3), lf)) : 0;
    blur(disc, sv * 0.25, Math.min(12, v * 0.2 + sv * 0.25));
  };
});

// ============ S9  f956–1049  end card: the fvrts wordmark on its own pink ============
shot(956, 1049, s => {
  div('full', s.bg, { background: 'radial-gradient(circle at 50% 46%, #FCE7EC 0%, #F7CFD7 44%, #EDB2C1 100%)' });
  const grp = div('abs', s.frame, { width: '1080px', height: '1920px', transformOrigin: '540px 960px' });
  const LW = 600, LH = LW * LOGO.H / LOGO.W, CYW = 880;
  const mk = (parent, main) => {
    const L = div('abs', parent, { width: px(LW), height: px(LH), left: px(540 - LW / 2), top: px(CYW - LH / 2), transformOrigin: '50% 50%' });
    img(L, 'img/fvrts.png', { left: '0', top: '0', width: px(LW), height: px(LH), filter: main ? 'drop-shadow(0 20px 36px rgba(160,55,90,.22))' : 'none' });
    return L;
  };
  const streaks = [...Array(22)].map(() => mk(grp, false));
  const main = mk(grp, true);
  const shim = div('abs', main, { left: '0', top: '0', width: px(LW), height: px(LH), WebkitMaskImage: 'url(img/fvrts.png)', WebkitMaskSize: '100% 100%', overflow: 'hidden' });
  const band = div('abs', shim, { left: '0', top: '-60px', width: '150px', height: px(LH + 120), background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.42),rgba(255,255,255,0))', transform: 'rotate(18deg)' });
  const ku = words(grp, 'ئێستا لە کوردستان', 'ku abs', { font: '500 58px Somar', color: C.ink, left: '0', width: '1080px', textAlign: 'center', top: '1040px', lineHeight: '1.4' });
  const ar = words(grp, 'هسه بكوردستان', 'ku abs', { font: '400 44px Somar', color: '#7A5360', left: '0', width: '1080px', textAlign: 'center', top: '1128px', lineHeight: '1.4' });
  const WD = lf => kf(lf, [[0, 1900], [1, 1500], [2, 1220], [3, 1100], [8, 780], [10, 720], [19, 632], [44, 604], [80, 580], [84, 576], [88, 520, 'in3'], [93, 330, 'in3']]);
  return lf => {
    const sc = WD(lf) / LW;
    T(main, 0, 0, sc);
    const sm = clamp(1 - lf / 3.5);
    blur(main, 26 * sm, 0.6 * sm);
    streaks.forEach((e, i) => {
      const a = clamp(1 - lf / 6) * 0.12 * (1 - i / 22);
      e.style.display = a > 0.003 ? '' : 'none';
      if (a > 0.003) { T(e, 0, 0, sc * (1 + 0.035 * (i + 1) * (1 + 2 * clamp(1 - lf / 6)))); O(e, a); blur(e, 4 + i * 0.6, 1); }
    });
    band.style.left = px(kf(lf, [[14, -200], [46, LW + 60, 'io2']]));
    reveal(ku, lf, 13, 4, 26);
    reveal(ar, lf, 21, 4, 22);
    const cl = clamp((lf - 84) / 9);
    T(grp, 0, 0, cl > 0 ? 1 - 0.55 * E.in3(cl) : 1);
    blur(grp, 3.5 * E.in2(cl));
  };
});

// ---------------- seek ----------------
window.seek = f => {
  P.reset();
  let used = false;
  for (const s of shots) {
    const on = f >= s.f0 && f < s.f1 + 1;
    s.el.style.display = on ? 'block' : 'none';
    if (on) {
      if (s.gl) { if (glCanvas.parentNode !== s.gl) s.gl.appendChild(glCanvas); used = true; }
      s.render(f - s.f0, f);
    }
  }
  glCanvas.style.display = used ? 'block' : 'none';
  if (used) P.render();
  return true;
};
window.FRAMES = 1050;
window.__ready = true;
