// Usage: node render.js stills 0 40 120 ...  |  node render.js full [workers]  |  node render.js range a b [workers]
// Frames are drawn by window.seek(f) (a pure function of f) and read back from the canvas as PNG.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'site');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(d); });
    }).listen(0, () => res(srv));
  });
}
async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[log]')) console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  return page;
}
async function shoot(page, f, file) {
  const b64 = await page.evaluate(f => { window.seek(f); return document.getElementById('c').toDataURL('image/png').slice(22); }, f);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}
(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-gpu-vsync'] });
  const t0 = Date.now();
  if (mode === 'stills') {
    const out = path.join(__dirname, 'out', 'stills'); fs.mkdirSync(out, { recursive: true });
    const page = await openPage(browser, port);
    console.log('ready in', Date.now() - t0, 'ms');
    for (const a of args) { const f = parseInt(a); const t = Date.now(); await shoot(page, f, path.join(out, `f${String(f).padStart(4, '0')}.png`)); console.log('still', f, Date.now() - t, 'ms'); }
  } else if (mode === 'full' || mode === 'range') {
    const N = parseInt((mode === 'full' ? args[0] : args[2]) || '3');
    const page0 = await openPage(browser, port);
    const total = await page0.evaluate(() => window.FRAMES);
    const a = mode === 'range' ? parseInt(args[0]) : 0, b = mode === 'range' ? parseInt(args[1]) : total - 1;
    const out = path.join(__dirname, 'out', mode === 'full' || args[3] === 'frames' ? 'frames' : 'preview'); fs.mkdirSync(out, { recursive: true });
    let done = 0;
    const pages = [page0, ...(await Promise.all([...Array(N - 1)].map(() => openPage(browser, port))))];
    await Promise.all(pages.map(async (page, w) => {
      for (let f = a + w; f <= b; f += N) {
        await shoot(page, f, path.join(out, `${String(f).padStart(5, '0')}.png`));
        if (++done % 60 === 0) console.log(`${done}/${b - a + 1}  ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
      }
    }));
    console.log('done', b - a + 1, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  }
  await browser.close(); srv.close();
})();
