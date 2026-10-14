// Dermaren — Kurdistan launch film. 1080x1080, frames numbered at 29.97 fps (f0–f1049),
// master rendered at 59.94 (half frames). seek(f) is a pure function of f.
import { initProducts, P } from './products.js';

const NS = 'http://www.w3.org/2000/svg';
const stage = document.getElementById('stage');
const defs = document.getElementById('defs');

const C = {
  page: '#FCFCFB', ink: '#1C2024', grey: '#68727B', cyan: '#4BB8D1', cyanD: '#2B93AE',
  pink: '#F6BCD0', mint: '#7FD9C1', logo: '#55565A',
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
function frost(parent, text, { font, body, tint = 'rgba(40,90,110,.22)', shadow = 'rgba(40,80,100,.2)', ls = '0', dir = 'ltr' }) {
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
function img(parent, src, style) { const i = document.createElement('img'); i.src = src; Object.assign(i.style, { position: 'absolute' }, style); parent.appendChild(i); return i; }

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

// shared pieces for the journey shots
function dotGrid(parent, x, y, w, h) {
  return div('abs', parent, {
    left: px(x), top: px(y), width: px(w), height: px(h),
    backgroundImage: 'radial-gradient(circle, rgba(75,184,209,.30) 1.7px, transparent 2.3px)', backgroundSize: '36px 36px',
    WebkitMaskImage: 'linear-gradient(180deg,transparent 0%,#000 26%,#000 68%,transparent 100%)',
  });
}
function bez(A, B, Cc, t) { const u = 1 - t; return [u * u * A[0] + 2 * u * t * B[0] + t * t * Cc[0], u * u * A[1] + 2 * u * t * B[1] + t * t * Cc[1]]; }
function route(parent, A, B, Cc) {
  const X0 = -3000, Y0 = -200, W = 4800, H = 1500;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `${X0} ${Y0} ${W} ${H}`);
  Object.assign(svg.style, { position: 'absolute', left: px(X0), top: px(Y0), overflow: 'visible' });
  const d = `M${A[0]} ${A[1]} Q${B[0]} ${B[1]} ${Cc[0]} ${Cc[1]}`;
  const id = 'rm' + (fidN++);
  svg.innerHTML = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${X0}" y="${Y0}" width="${W}" height="${H}"><path class="m" d="${d}" fill="none" stroke="#fff" stroke-width="30"/></mask></defs>
    <path d="${d}" fill="none" stroke="rgba(43,147,174,.55)" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.1 17" mask="url(#${id})"/>
    <path class="tg" d="${d}" fill="none" stroke="rgba(75,184,209,.28)" stroke-width="12" stroke-linecap="round"/>
    <path class="t" d="${d}" fill="none" stroke="#4BB8D1" stroke-width="3.5" stroke-linecap="round"/>`;
  parent.appendChild(svg);
  const lens = [0]; let L = 0, prev = bez(A, B, Cc, 0);
  for (let i = 1; i <= 600; i++) { const p = bez(A, B, Cc, i / 600); L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); lens.push(L); prev = p; }
  const lenAt = u => { const x = clamp(u) * 600, i = Math.min(599, Math.floor(x)); return lerp(lens[i], lens[i + 1], x - i); };
  const m = svg.querySelector('.m'), t = svg.querySelector('.t'), tg = svg.querySelector('.tg');
  return {
    update(u, tail = 240, u0 = 0) {
      const l = lenAt(u), l0 = lenAt(u0);
      m.setAttribute('stroke-dasharray', `0 ${l0.toFixed(2)} ${Math.max(0, l - l0).toFixed(2)} 99999`);
      const tl = Math.min(tail, l);
      const da = `0 ${(l - tl).toFixed(2)} ${tl.toFixed(2)} 99999`;
      t.setAttribute('stroke-dasharray', da); tg.setAttribute('stroke-dasharray', da);
    },
  };
}
function pin(parent, x, y) {
  const g = div('abs', parent, { left: px(x), top: px(y), width: '0', height: '0' });
  const rings = [0, 1].map(() => div('abs', g, { width: '100px', height: '100px', left: '-50px', top: '-50px', borderRadius: '50%', border: '2px solid rgba(75,184,209,.7)' }));
  const glow = div('abs', g, { width: '240px', height: '240px', left: '-120px', top: '-120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(75,184,209,.55) 0%, rgba(75,184,209,.18) 35%, rgba(75,184,209,0) 70%)' });
  const dot = div('abs', g, { width: '22px', height: '22px', left: '-11px', top: '-11px', borderRadius: '50%', background: '#fff', border: '5px solid #4BB8D1', boxSizing: 'border-box', boxShadow: '0 4px 12px rgba(30,110,130,.3)' });
  return {
    g, glow, dot,
    update(lf, amp = 1) {
      rings.forEach((r, i) => { const ph = (lf / 36 + i * 0.5) % 1; T(r, 0, 0, 0.2 + 1.1 * ph); O(r, (1 - ph) * 0.7 * amp); });
    },
  };
}
function counter(parent) {
  const p = glassPill(parent, `<span class="e" style="transition:none">EBL</span>
    <div style="position:relative;width:150px;height:2px;background:rgba(40,70,85,.16);border-radius:2px">
      <div class="pr" style="position:absolute;right:0;top:0;height:2px;background:#4BB8D1;border-radius:2px"></div>
      <div class="dt" style="position:absolute;top:-5px;left:0;width:12px;height:12px;border-radius:50%;background:#4BB8D1;box-shadow:0 0 0 5px rgba(75,184,209,.22)"></div>
    </div><span>ICN</span><span style="width:1px;height:22px;background:rgba(40,70,85,.2)"></span>
    <span class="km" style="font:600 20px Inter;letter-spacing:0;font-variant-numeric:tabular-nums;min-width:104px;text-align:right;color:#1C2024">0 km</span>`,
    { height: '60px', gap: '16px', padding: '0 26px', font: '600 17px Inter', letterSpacing: '.14em', color: '#3A4650' });
  place(p, 540, 96);
  const pr = p.querySelector('.pr'), dt = p.querySelector('.dt'), km = p.querySelector('.km'), e = p.querySelector('.e');
  return {
    el: p,
    set(prog, arrived = 0) {
      pr.style.width = px(150 * prog); dt.style.left = px(150 * (1 - prog) - 6);
      km.textContent = `${Math.round(7117 * prog).toLocaleString('en-US')} km`;
      e.style.color = arrived > 0.5 ? '#2B93AE' : '#3A4650';
    },
  };
}
// 3D droplet placed in screen px on the z=0 plane of a fixed camera
const DROPCAM = { tx: 0, ty: 0, tz: 0, az: 0, el: 0, dist: 40, fov: 24 };
function dropAt(i, x, y, hPx, { rz = 0, ry = 0, sx = 1, sy = 1 } = {}) {
  P.cam(DROPCAM);
  const u = P.upp(DROPCAM.dist, DROPCAM.fov);
  P.drop(i, { x: (x - 540) * u, y: -(y - 540) * u, z: 0, s: hPx / 2 * u, rz, ry });
  const m = P.drops[i]; m.scale.set(hPx / 2 * u * sx, hPx / 2 * u * sy, hPx / 2 * u * sx);
}

// ---------------- init: fonts, images, 3D ----------------
const FONTS = ['400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter',
  '300 20px Somar', '400 20px Somar', '500 20px Somar', '900 20px Somar', "700 20px 'Malgun Gothic'"];
await Promise.all(FONTS.map(f => document.fonts.load(f, 'Aa ئێستا 서울')));
await document.fonts.ready;
await Promise.all(['mark', 'word', 'tm', 'word_dark', 'tm_dark', 'wave0', 'wave1', 'wave2'].map(n => { const i = new Image(); i.src = `img/${n}.png`; return i.decode(); }));
glCanvas = document.createElement('canvas');
await initProducts(glCanvas);

// ============ S1  f0–114  Seoul: "لە کۆریاوە" ============
shot(0, 114, s => {
  div('full', s.bg, { background: C.page });
  const haze = div('full', s.bg, { background: 'radial-gradient(ellipse 85% 75% at 58% 48%, #F5CADB 0%, #F8DCE6 42%, #FAEDF2 72%, #FCF7F8 100%)' });
  div('full', s.bg, { background: 'radial-gradient(ellipse 70% 30% at 50% 100%, #D4EEF5 0%, rgba(212,238,245,0) 100%)' });
  const world = div('abs', s.frame, { width: '1080px', height: '1080px' });
  dotGrid(world, -2900, -140, 4300, 1360);
  const S = [700, 420], B = [-360, 40], Ee = [-1420, 420];
  const rt = route(world, S, B, Ee);
  const pn = pin(world, 700, 540);
  const tag = glassPill(world, `<span class="ko" style="font:700 25px 'Malgun Gothic';letter-spacing:0">서울</span><span style="width:1px;height:20px;background:rgba(40,70,85,.2)"></span><span>SEOUL</span><span style="color:#8A949C">ICN</span>`,
    { height: '54px', gap: '13px', padding: '0 22px', font: '600 18px Inter', letterSpacing: '.14em', color: '#26303A' });
  place(tag, 700, 606);
  const ku = words(world, 'لە کۆریاوە', 'ku abs', { font: '900 112px Somar', color: C.ink, left: '0', width: '640px', textAlign: 'right', top: '650px', lineHeight: '1.25', whiteSpace: 'nowrap' });
  const ar = words(world, 'من كوريا', 'ku abs', { font: '500 58px Somar', color: C.grey, left: '0', width: '640px', textAlign: 'right', top: '800px', lineHeight: '1.3' });
  const ov = div('overlay', s.el), ct = counter(ov);
  s.gl = div('gl', s.frame);
  const off = lf => lf < 40 ? 0 : 900 * Math.pow((lf - 40) / 74, 2.6);
  const Y = lf => 420 + 520 * Math.pow(0.84, lf);
  const U = lf => lf < 42 ? 0 : 0.56 * Math.pow((lf - 42) / 72, 1.8);
  const DX = lf => bez(S, B, Ee, U(lf))[0] + off(lf);
  const DY = lf => bez(S, B, Ee, U(lf))[1] + (Y(lf) - 420);
  return lf => {
    O(haze, 1 - E.io2(clamp(lf / 28)));
    T(world, off(lf), 0);
    blur(s.cam, Math.min(16, d1(off, lf) * 0.42), 0);
    rt.update(U(lf), 200);
    pn.update(lf);
    rise(tag, lf, 5, 26);
    reveal(ku, lf, 9, 4, 44);
    reveal(ar, lf, 17, 4, 34);
    // droplet
    const x = DX(lf), y = DY(lf), vx = d1(DX, lf), vy = d1(DY, lf);
    const rz = Math.atan2(vx * 0.045, 1) / deg;
    dropAt(0, x, y, 176, { rz: clamp(rz, -62, 62), ry: 30 + lf * 3.2, sy: 1 + Math.min(0.12, Math.abs(vx) * 0.002) });
    P.floor.visible = false;
    blur(s.gl, 0, Math.min(10, Math.abs(vy) * 0.22));
    // journey counter
    const cp = rise(ct.el, lf, 44, -30);
    ct.set(U(lf) / 0.56 * 0.56);
  };
});

// ============ S2  f115–172  Erbil: "بۆ کوردستان" ============
shot(115, 172, s => {
  div('full', s.bg, { background: C.page });
  div('full', s.bg, { background: 'radial-gradient(ellipse 70% 30% at 50% 100%, #D4EEF5 0%, rgba(212,238,245,0) 100%)' });
  const world = div('abs', s.frame, { width: '1080px', height: '1080px' });
  dotGrid(world, -1400, -140, 3600, 1360);
  const A = [1500, 260], B = [380, 180], Ee = [300, 650];
  const rt = route(world, A, B, Ee);
  const rip = document.createElementNS(NS, 'svg');
  Object.assign(rip.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible' });
  rip.setAttribute('width', 1080); rip.setAttribute('height', 1080);
  rip.innerHTML = [0, 1, 2].map(() => `<ellipse cx="${Ee[0]}" cy="${Ee[1]}" rx="10" ry="3" fill="none" stroke="#4BB8D1" stroke-width="3"/>`).join('');
  world.appendChild(rip);
  const ells = [...rip.querySelectorAll('ellipse')];
  const pn = pin(world, Ee[0], Ee[1]);
  const tag = glassPill(world, `<span class="ku" style="font:500 27px Somar;letter-spacing:0">هەولێر</span><span style="width:1px;height:20px;background:rgba(40,70,85,.2)"></span><span>ERBIL</span><span style="color:#8A949C">EBL</span>`,
    { height: '54px', gap: '13px', padding: '0 22px', font: '600 18px Inter', letterSpacing: '.14em', color: '#26303A' });
  place(tag, Ee[0], Ee[1] + 78);
  const ku = words(world, 'بۆ کوردستان', 'ku abs', { font: '900 104px Somar', color: C.ink, left: '440px', width: '590px', textAlign: 'right', top: '392px', lineHeight: '1.25', whiteSpace: 'nowrap' });
  const ar = words(world, 'لكوردستان', 'ku abs', { font: '500 58px Somar', color: C.grey, left: '440px', width: '590px', textAlign: 'right', top: '536px', lineHeight: '1.3' });
  const ov = div('overlay', s.el), ct = counter(ov);
  s.gl = div('gl', s.frame);
  const off = lf => -235 * Math.pow(0.88, lf);
  const Wp = lf => lf < 12 ? 0.5 + 0.5 * Math.pow(Math.max(0, lf) / 12, 1.25) : 1;
  const zoom = lf => 1 + acc(lf, 38, 57, 3.4, 3);
  return lf => {
    const o = off(lf);
    T(world, o, 0);
    const z = zoom(lf), qx = Ee[0] + o, qy = Ee[1];
    T(s.cam, (1 - z) * (qx - 540), (1 - z) * (qy - 540), z);
    const zb = Math.min(9, d1(zoom, lf) * 15);
    const hb = Math.min(16, d1(off, lf) * 0.42);
    blur(s.cam, Math.max(hb, zb), zb);
    const w = Wp(lf);
    rt.update(w, 200);
    pn.update(lf + 20, lf < 12 ? 0.4 : 1);
    // droplet → lands at lf 12, squashes and sinks into the ripples
    const [bx, by] = bez(A, B, Ee, w);
    const sq = E.out2(clamp((lf - 12) / 7)), sink = E.in2(clamp((lf - 14) / 6));
    const h = 176 * (1 - sink);
    const sy = 1 - 0.55 * sq, sx = 1 + 0.45 * sq;
    const vx = d1(lf2 => bez(A, B, Ee, Wp(lf2))[0], lf);
    if (h > 1) dropAt(0, bx + o, by - h * sy / 2, h, { rz: clamp(Math.atan2(vx * 0.045, 1) / deg, -62, 62) * (1 - sq), ry: 120 + lf * 3.2, sx, sy });
    P.floor.visible = false;
    blur(s.gl, 0, 0);
    ells.forEach((e, i) => {
      const t = lf - 12 - i * 5;
      if (t < 0) { e.setAttribute('opacity', 0); return; }
      const rx = 16 + 200 * (1 - Math.pow(0.9, t));
      e.setAttribute('rx', rx.toFixed(2)); e.setAttribute('ry', (rx * 0.3).toFixed(2));
      e.setAttribute('opacity', clamp(1 - t / 34).toFixed(3)); e.setAttribute('stroke-width', (3.5 * (1 - t / 40) + 0.5).toFixed(2));
    });
    const gp = lf < 12 ? 0.15 : 0.35 + 0.65 * Math.pow(0.9, lf - 12);
    T(pn.glow, 0, 0, lf < 12 ? 0.5 : 0.5 + 0.9 * (1 - Math.pow(0.85, lf - 12))); O(pn.glow, gp);
    rise(tag, lf, 13, 26);
    reveal(ku, lf, 3, 4, 44);
    reveal(ar, lf, 11, 4, 34);
    ct.set(0.574 + 0.426 * clamp((w - 0.5) / 0.5), lf >= 12 ? 1 : 0);
    const ce = acc(lf, 42, 57, 1, 3);
    T(ct.el, 0, -60 * ce); blur(ct.el, 0, 10 * ce); O(ct.el, 1 - ce);
  };
});

// ============ S3  f173–230  the mark assembles, lockup ============
shot(173, 230, s => {
  div('full', s.bg, { background: C.page });
  div('full', s.bg, { background: 'radial-gradient(circle at 50% 48%, #E3F3F8 0%, rgba(227,243,248,0) 48%)' });
  const lock = div('abs', s.frame, { width: '1080px', height: '1080px', transformOrigin: '540px 520px' });
  const halo = div('abs', lock, { width: '100px', height: '100px', left: '490px', top: '470px', borderRadius: '50%',
    background: 'radial-gradient(circle, #FFFFFF 0%, #F4FAFB 55%, #EAF4F7 100%)', boxShadow: '0 30px 70px rgba(40,110,130,.10), inset 0 0 0 1px rgba(190,220,228,.55)' });
  const k = 330 / 1029, MW = 330, MH = 648 * k, MX = 540 - MW / 2, MY = 520 - MH / 2;
  const parts = [{ x: 0, y: 0 }, { x: 194, y: 128 }, { x: 387, y: 256 }];
  const ls = 820 / 5416, LX = 540 - 410, LY = 520 - 696 * ls / 2;
  const wordBox = div('abs', lock, { left: px(LX + 1163 * ls), top: px(LY), width: px(3974 * ls), height: px(660 * ls) });
  img(wordBox, 'img/word_dark.png', { width: '100%', height: '100%', left: '0', top: '0' });
  const tm = img(lock, 'img/tm_dark.png', { left: px(LX + 5145 * ls), top: px(LY + 132 * ls), width: px(271 * ls), height: px(153 * ls) });
  const markG = div('abs', lock, { left: px(MX), top: px(MY), width: px(MW), height: px(MH), transformOrigin: '0 0' });
  const WW = 642 * k, WH = 392 * k;
  const waves = parts.map((p, i) => {
    const outer = div('abs', markG, { width: px(WW), height: px(WH), left: '0', top: '0' });
    const inner = img(outer, `img/wave${i}.png`, { width: px(WW), height: px(WH), left: '0', top: '0' });
    return { outer, inner, cx: p.x * k + WW / 2, cy: p.y * k + WH / 2 };
  });
  const shim = div('abs', markG, { left: '0', top: '0', width: px(MW), height: px(MH), WebkitMaskImage: 'url(img/mark.png)', WebkitMaskSize: '100% 100%', overflow: 'hidden' });
  const band = div('abs', shim, { left: '0', top: '-50px', width: '140px', height: px(MH + 100), background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.85),rgba(255,255,255,0))', transform: 'rotate(18deg)' });
  // lockup geometry (logo 5416x696 → 820 px wide)
  const mTo = { x: LX, y: LY + 48 * ls, s: (1029 * ls) / MW };
  const cx0 = MW / 2, cy0 = MH / 2;
  const pos = (i, lf) => {
    const p = 1 - Math.pow(0.8, lf + 2), q = 1 - Math.min(1, p / 0.99);
    const w = waves[i], dx = w.cx - cx0, dy = w.cy - cy0;
    const rf = Math.hypot(dx, dy), af = i === 1 ? -60 * deg : Math.atan2(dy, dx);
    const r = rf + (i === 1 ? 250 : 300) * q, a = af + (5.4 + i * 0.4) * q;
    return { x: cx0 + r * Math.cos(a), y: cy0 + r * Math.sin(a), rot: -150 * q - i * 25 * q, sc: 0.72 + 0.28 * (1 - q) };
  };
  return lf => {
    const m = kf(lf, [[22, 0], [36, 1, 'io3']]);
    // waves orbit counter-clockwise and lock
    waves.forEach((w, i) => {
      const a = pos(i, lf), b = pos(i, lf - 0.25), c = pos(i, lf + 0.25);
      const vx = (c.x - b.x) * 2, vy = (c.y - b.y) * 2, sp = Math.hypot(vx, vy), ang = Math.atan2(vy, vx) / deg;
      w.outer.style.transform = `translate(${(a.x - WW / 2).toFixed(2)}px,${(a.y - WH / 2).toFixed(2)}px) rotate(${ang.toFixed(2)}deg)`;
      w.inner.style.transform = `rotate(${(a.rot - ang).toFixed(2)}deg) scale(${a.sc.toFixed(4)})`;
      blur(w.outer, Math.min(10, sp * 0.3), 0);
    });
    const pulse = lf > 17 && lf < 27 ? 1 + 0.035 * Math.sin(Math.PI * (lf - 17) / 10) : 1;
    const sc = lerp(1, mTo.s, m) * pulse;
    const tx = lerp(MX, mTo.x, m) - MX - (pulse - 1) * MW / 2, ty = lerp(MY, mTo.y, m) - MY - (pulse - 1) * MH / 2;
    markG.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`;
    band.style.left = px(kf(lf, [[16, -160], [32, MW + 40, 'io2']]));
    O(shim, lf > 15 ? 1 : 0);
    // halo grows around the mark, then shrinks away as the lockup forms
    const hd = ex(lf, 0, 250, 450, 0.18) * (1 - 0.7 * m);
    const hcx = lerp(540, mTo.x + 1029 * ls / 2, m), hcy = lerp(520, mTo.y + 648 * ls / 2, m);
    T(halo, hcx - 540, hcy - 520, hd / 100); O(halo, 1 - E.in2(m));
    // wordmark slides out from behind the mark
    const q = kf(lf, [[31, 0], [45, 1, 'out3']]);
    wordBox.style.clipPath = `inset(0 ${((1 - q) * 100).toFixed(2)}% 0 0)`;
    T(wordBox, -(1 - q) * 60, 0); blur(wordBox, (1 - q) * 7, (1 - q) * 2);
    O(tm, (q - 0.85) / 0.15);
    // exit: shrink accelerating, blur ramp
    const xe = acc(lf, 47, 58, 1, 2.5);
    T(lock, 0, -26 * xe, 1 - 0.16 * xe);
    blur(lock, xe > 0 ? 0.3 + 6.7 * xe : 0);
  };
});

// ============ S4  f231–404  hero lineup ============
shot(231, 404, s => {
  const bgA = div('full', s.bg, { background: 'linear-gradient(180deg,#C9EBF4 0%,#E4F2F6 30%,#F7E3EB 64%,#FDFAF9 100%)' });
  const bgB = div('full', s.bg, { background: 'linear-gradient(180deg,#F6DEE8 0%,#FAEDF2 45%,#FDFBFA 100%)' });
  const glowA = div('full', s.bg, { background: 'radial-gradient(ellipse 60% 22% at 50% 78%, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 100%)' });
  const title = frost(s.frame, 'جوانی کۆری', {
    font: '900 170px Somar', dir: 'rtl',
    body: 'linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(244,250,252,.78) 45%, rgba(255,255,255,.9) 100%)',
  });
  place(title, 540, 178);
  s.gl = div('gl', s.frame);
  const ku = words(s.frame, 'ئێستا لە کوردستان', 'ku abs', { font: '500 46px Somar', color: C.ink, left: '0', width: '1080px', textAlign: 'center', top: '884px', lineHeight: '1.4' });
  const ar = words(s.frame, 'الجمال الكوري، هسه بكوردستان', 'ku abs', { font: '400 34px Somar', color: C.grey, left: '0', width: '1080px', textAlign: 'center', top: '952px', lineHeight: '1.4' });
  const prods = [
    { n: 'toner', x: 0, z: -1.6, ry: -8, o: 8 },
    { n: 'serum', x: -6.9, z: 1.4, ry: 26, o: 3 },
    { n: 'tube', x: 6.9, z: 0.9, ry: -24, o: 0 },
  ];
  const Yp = (p, lf) => -16 * Math.pow(0.84, lf + p.o);
  const DIST = 57.6, FOV = 24, upp = P.upp(DIST, FOV);
  const txB = lf => 6.2 - 0.07 * lf - acc(lf, 64, 87, 13, 3);
  return lf => {
    const A = lf < 87;
    [bgA, glowA, title, ku, ar].forEach(e => e.style.display = A ? '' : 'none');
    bgB.style.display = A ? 'none' : '';
    if (A) {
      const az = ex(lf, 0, -26, -5, 0.1) + 0.1 * lf;
      P.cam({ tx: 0, ty: 6.1, tz: 0, az, el: 5, dist: ex(lf, 0, 70, DIST, 0.1), fov: FOV, shiftY: 42 });
      let vmax = 0;
      prods.forEach(p => {
        const y = Yp(p, lf), ry = p.ry + 150 * Math.pow(0.84, lf + p.o);
        P.show(p.n, { x: p.x, z: p.z, y, ry });
        const v = Math.abs(d1(f => Yp(p, f), lf)) / upp; if (y > -12) vmax = Math.max(vmax, v);
      });
      blur(s.gl, 0, Math.min(10, vmax * 0.16));
      const ty = 80 * Math.pow(0.86, lf), tv = Math.abs(d1(f => 80 * Math.pow(0.86, f), lf));
      T(title, 0, ty); O(title, 0.25 + lf / 8); blur(title, 0, Math.min(8, tv * 0.5));
      title.sheen(kf(lf, [[18, 100], [70, 0, 'io2']]));
      reveal(ku, lf, 22, 3.5, 30);
      reveal(ar, lf, 33, 3, 26);
    } else {
      const l2 = lf - 87;
      const tx = txB(l2);
      P.cam({ tx, ty: 5.4, tz: 0, az: 16, el: 3, dist: 30, fov: 22, shiftY: 20 });
      prods.forEach(p => P.show(p.n, { x: p.x, z: p.z, y: 0, ry: p.ry }));
      // floating droplets for parallax
      for (let i = 0; i < 7; i++) {
        P.drop(i, { x: -12 + i * 4.1 + hash(i, 1) * 1.5, y: 1.5 + hash(i, 2) * 8 + 0.3 * Math.sin(lf * 0.06 + i), z: -6 + hash(i, 3) * 13, s: 0.28 + hash(i, 4) * 0.3, ry: lf * 2 + i * 50, rz: -10 + hash(i, 5) * 20 });
      }
      const vpx = Math.abs(d1(txB, l2)) / P.upp(30, 22);
      blur(s.cam, Math.min(26, vpx * 0.2), 0);
    }
  };
});

// ============ product shots ============
function productShot(f0, f1, o) {
  shot(f0, f1, s => {
    div('full', s.bg, { background: o.bg });
    div('full', s.bg, { background: `radial-gradient(ellipse 34% 11% at ${o.side === 'left' ? 30 : 70}% ${(o.floorY / 1080 * 100).toFixed(1)}%, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 100%)` });
    const big = frost(s.frame, o.big, { font: '800 360px Inter', ls: '-0.055em', body: o.bigBody, tint: o.tint });
    place(big, 540, 1010);
    s.gl = div('gl', s.frame);
    // text block
    const TW = 480, tbX = o.side === 'left' ? 1080 - 42 - TW : 42;
    const tb = div('abs', s.frame, { left: px(tbX), top: '0', width: px(TW), height: '1080px' });
    const el = (cls, st, html) => div(cls, tb, Object.assign({ position: 'absolute', right: '0', width: px(TW), textAlign: 'right' }, st), html);
    const idx = glassPill(tb, `<b style="font-weight:700;color:#1C2024">${o.idx}</b><span style="color:#8A949C">/ 03</span><span style="width:1px;height:18px;background:rgba(40,70,85,.2)"></span><span>${o.cat}</span>`,
      { right: '0', left: 'auto', height: '48px', gap: '11px', padding: '0 20px', font: '600 16px Inter', letterSpacing: '.14em', color: '#3A4650' });
    const n1 = el('lat', { font: '700 70px Inter', letterSpacing: '-0.03em', color: C.ink, lineHeight: '1.02' }, o.n1);
    const n2 = el('lat', { font: '400 70px Inter', letterSpacing: '-0.03em', color: '#7E888F', lineHeight: '1.02' }, o.n2);
    const ku = words(tb, o.ku, 'ku', { position: 'absolute', right: '0', width: px(TW), textAlign: 'right', font: `500 ${o.kuSize || 38}px Somar`, lineHeight: '1.55', color: C.ink, textWrap: 'balance' });
    const ar = words(tb, o.ar, 'ku', { position: 'absolute', right: '0', width: px(TW), textAlign: 'right', font: '400 32px Somar', lineHeight: '1.5', color: '#636D76', textWrap: 'balance' });
    const chipRow = div('', tb, { position: 'absolute', right: '0', display: 'flex', gap: '12px', direction: 'rtl' });
    const chips = o.chips.map(c => div('glass chip', chipRow, { position: 'relative' }, `<i style="background:${o.dot}"></i>${c}`));
    // stack vertically, centred on the block's middle
    const gaps = [0, 30, 8, 30, 20, 34];
    const items = [idx, n1, n2, ku, ar, chipRow];
    let y = 0; const tops = [];
    items.forEach((e, i) => { y += gaps[i]; tops.push(y); y += e.offsetHeight; });
    const y0 = o.textCY - y / 2;
    items.forEach((e, i) => { e.style.top = px(y0 + tops[i]); });
    const it = P.items[o.prod];
    const upp = it.h / o.hPx, DIST = upp * 1080 / (2 * Math.tan(12 * deg));
    const lift = 0.9;
    const out = o.side === 'left' ? -1 : 1;           // the side away from the text
    const drops = [...Array(o.nDrops)].map((_, i) => {
      const k = i + o.seed * 10;
      if (i % 3 === 2) return { x: (hash(k, 7) - 0.5) * 4, y: it.h * (0.95 + hash(k, 9) * 0.3), z: -9 + hash(k, 8) * 3, s: 0.26 + hash(k, 10) * 0.2, ph: hash(k, 11) * 6.28 };
      return { x: out * (it.w * 0.72 + hash(k, 7) * 3.4), y: 0.8 + hash(k, 9) * it.h * 0.95, z: -6 + hash(k, 8) * 10, s: 0.28 + hash(k, 10) * 0.3, ph: hash(k, 11) * 6.28 };
    });
    return lf => {
      if (o.setup) o.setup();
      // entrance / exit camera moves on the whole frame
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
      // product
      const spin = o.spin(lf);
      const fy = lift + 0.14 * Math.sin(lf * 0.065);
      P.cam({ tx: 0, ty: it.h / 2 + lift, tz: 0, az: o.az(lf), el: 4.5, dist: DIST, fov: 24,
        shiftX: o.prodX - 540, shiftY: (o.floorY - lift / upp - o.hPx / 2) - 540 });
      P.show(o.prod, { x: 0, y: fy, z: 0, ry: spin, rz: o.tilt ? o.tilt(lf) : 0 });
      drops.forEach((d, i) => P.drop(i, { x: d.x, y: d.y + 0.3 * Math.sin(lf * 0.05 + d.ph), z: d.z, s: d.s, ry: lf * 2.2 + i * 40, rz: 8 * Math.sin(lf * 0.03 + d.ph), pearl: o.pearls }));
      big.style.translate = `${(40 - 1.1 * lf).toFixed(2)}px 0`;
      big.sheen(kf(lf, [[30, 100], [110, 0, 'io2']]));
      rise(idx, lf, 6, 24);
      rise(n1, lf, 9, 40);
      rise(n2, lf, 13, 40);
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
  prod: 'serum', side: 'left', idx: '01', cat: 'SERUM', n1: 'Su Boon Jo', n2: 'Serum',
  ku: 'شێدارکردنەوەی قووڵی پێست و درەوشانەوە.', ar: 'ترطيب عميق وبشرة تلمع',
  chips: ['Hyaluronic Acid', 'Ceramide'], dot: C.cyan,
  bg: 'linear-gradient(180deg,#CBEDF5 0%,#E4F4F8 46%,#F8FCFD 100%)',
  big: 'Serum', bigBody: 'linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(236,248,251,.8) 55%, rgba(255,255,255,.9) 100%)', tint: 'rgba(40,110,130,.16)',
  hPx: 500, prodX: 300, floorY: 800, textCY: 470, nDrops: 6, seed: 1,
  enter: 'left', exit: 'up',
  az: lf => 0, spin: lf => -150 * Math.pow(0.88, lf) - 22 + 34 * E.sine(clamp(lf / 170)) + 90 * Math.pow(clamp((lf - 146) / 28, 0, 2), 3),
});
productShot(579, 752, {
  prod: 'toner', side: 'right', idx: '02', cat: 'TONER', n1: 'Mae Il', n2: 'Cream Toner',
  ku: 'هاوسەنگکردنی تەندروستی پێست و ئامادەکردنی بۆ ڕۆتینی ڕۆژانە.', ar: 'يوازن بشرتك ويجهزها لروتينك اليومي',
  chips: ['Panthenol', 'Ceramides'], dot: '#EE97B7',
  bg: 'linear-gradient(180deg,#F8D6E3 0%,#FBE8EF 46%,#FEFAFB 100%)',
  big: 'Toner', bigBody: 'linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(252,238,244,.82) 55%, rgba(255,255,255,.9) 100%)', tint: 'rgba(150,60,90,.14)',
  hPx: 590, prodX: 770, floorY: 830, textCY: 470, nDrops: 7, pearls: true, seed: 2, kuSize: 36,
  enter: 'below', exit: 'push',
  az: lf => 0, spin: lf => 150 * Math.pow(0.86, lf) + 18 - 30 * E.sine(clamp(lf / 170)),
});
productShot(753, 926, {
  prod: 'tube', side: 'left', idx: '03', cat: 'CREAM', n1: 'Mae Kkeun', n2: 'Cream',
  ku: 'نەرمی و شێ لەناو قووڵایی خانەکاندا.', ar: 'نعومة ورطوبة توصل لأعماق بشرتك',
  chips: ['Niacinamide', 'Ceramides'], dot: '#4FC9A6',
  bg: 'linear-gradient(180deg,#CFF1E4 0%,#E6F7F0 46%,#F9FEFC 100%)',
  big: 'Cream', bigBody: 'linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(234,249,243,.82) 55%, rgba(255,255,255,.9) 100%)', tint: 'rgba(30,120,90,.15)',
  hPx: 560, prodX: 300, floorY: 815, textCY: 470, nDrops: 6, seed: 3,
  enter: 'zoom', exit: 'pull',
  setup: () => { P.M.drop.color.set('#A9EFD8'); P.M.drop.emissive.set('#4FC9A6'); },
  az: lf => 0, tilt: lf => 16 * Math.pow(0.9, lf) * Math.cos(lf * 0.16),
  spin: lf => -140 * Math.pow(0.87, lf) - 20 + 32 * E.sine(clamp(lf / 170)),
});

// ============ S8  f927–955  logo disc (the only frozen stretch) ============
shot(927, 955, s => {
  div('full', s.bg, { background: C.page });
  const disc = div('abs', s.frame, { width: '220px', height: '220px', left: '430px', top: '430px', borderRadius: '50%', background: '#F4F7F7',
    boxShadow: '0 22px 50px rgba(30,70,80,.10), inset 0 0 0 1px #E3EAEC' });
  img(disc, 'img/mark.png', { width: '146px', height: px(648 * 146 / 1029), left: px(110 - 73), top: px(110 - 648 * 146 / 1029 / 2) });
  const CY = lf => kf(lf, [[0, 720], [3, 598], [6, 556], [10, 543], [13, 540, 'out2']]);
  return lf => {
    const d = lf < 22 ? 220 : 220 - 68 * Math.pow((lf - 22) / 7, 3);
    const cy = CY(lf);
    T(disc, 0, cy - 540, d / 220);
    const v = Math.abs(d1(CY, lf));
    const sv = lf > 22 ? Math.abs(d1(l => 68 * Math.pow(Math.max(0, l - 22) / 7, 3), lf)) : 0;
    blur(disc, sv * 0.25, Math.min(12, v * 0.2 + sv * 0.25));
  };
});

// ============ S9  f956–1049  end card ============
shot(956, 1049, s => {
  div('full', s.bg, { background: 'radial-gradient(circle at 50% 46%, #29292C 0%, #141416 42%, #020204 100%)' });
  const grp = div('abs', s.frame, { width: '1080px', height: '1080px', transformOrigin: '540px 540px' });
  const LW = 600, lsc = LW / 5416, LH = 696 * lsc;
  const mkLock = (parent, glow) => {
    const L = div('abs', parent, { width: px(LW), height: px(LH), left: px(540 - LW / 2), top: px(500 - LH / 2), transformOrigin: '50% 50%' });
    const m = img(L, 'img/mark.png', { left: '0', top: px(48 * lsc), width: px(1029 * lsc), height: px(648 * lsc) });
    const w = img(L, 'img/word.png', { left: px(1163 * lsc), top: '0', width: px(3974 * lsc), height: px(660 * lsc) });
    const t = img(L, 'img/tm.png', { left: px(5145 * lsc), top: px(132 * lsc), width: px(271 * lsc), height: px(153 * lsc), opacity: '.8' });
    if (glow) {
      m.style.filter = 'drop-shadow(0 0 5px rgba(90,205,230,.7)) drop-shadow(0 0 26px rgba(75,184,209,.45))';
      w.style.filter = 'drop-shadow(0 0 4px rgba(255,255,255,.55)) drop-shadow(0 0 22px rgba(255,255,255,.28)) drop-shadow(0 0 70px rgba(140,210,230,.22))';
    }
    return L;
  };
  const streaks = [...Array(22)].map(() => mkLock(grp, false));
  const main = mkLock(grp, true);
  const ku = words(grp, 'ئێستا لە کوردستان', 'ku abs', { font: '500 46px Somar', color: '#EEEEF1', left: '0', width: '1080px', textAlign: 'center', top: '600px', lineHeight: '1.4' });
  const ar = words(grp, 'هسه بكوردستان', 'ku abs', { font: '400 34px Somar', color: '#9C9CA4', left: '0', width: '1080px', textAlign: 'center', top: '672px', lineHeight: '1.4' });
  const WD = lf => kf(lf, [[0, 1700], [1, 1380], [2, 1150], [3, 1060], [8, 770], [10, 712], [19, 626], [44, 598], [80, 574], [84, 570], [88, 520, 'in3'], [93, 330, 'in3']]);
  return lf => {
    const w = WD(lf), sc = w / LW;
    T(main, 0, 0, sc);
    const sm = clamp(1 - lf / 3.5);
    blur(main, 26 * sm, 0.6 * sm);
    streaks.forEach((e, i) => {
      const a = clamp(1 - lf / 6) * 0.42 * (1 - i / 22);
      e.style.display = a > 0.003 ? '' : 'none';
      if (a > 0.003) { T(e, 0, 0, sc * (1 + 0.035 * (i + 1) * (1 + 2 * clamp(1 - lf / 6)))); O(e, a); blur(e, 4 + i * 0.6, 1); }
    });
    reveal(ku, lf, 13, 4, 26);
    reveal(ar, lf, 21, 4, 22);
    // collapse at the very end: the whole card folds into the centre
    const cl = clamp((lf - 84) / 9);
    const ts = cl > 0 ? 1 - 0.55 * E.in3(cl) : 1;
    T(grp, 0, 0, ts);
    blur(grp, 3.5 * E.in2(cl));
    [ku, ar].forEach(e => O(e, 1));
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
