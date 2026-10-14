// Usage: node render.js stills 40 86 150 ...   |  node render.js full [workers]
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'site');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
    }).listen(0, () => res(srv));
  });
}
async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return page;
}
async function shoot(page, f, file) {
  await page.evaluate(f => window.seek(f), f);
  await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 }, animations: 'disabled' });
}
(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--hide-scrollbars'] });
  if (mode === 'stills') {
    const out = path.join(__dirname, 'out', 'stills'); fs.mkdirSync(out, { recursive: true });
    const page = await openPage(browser, port);
    for (const a of args) { const f = parseFloat(a); const t = Date.now(); await shoot(page, f, path.join(out, `f${String(a).padStart(4, '0')}.png`)); console.log('still', a, Date.now() - t, 'ms'); }
  } else if (mode === 'range') {
    const [a, b, N] = args.map(Number), step = 0.5;
    const out = path.join(__dirname, 'out', 'frames'); fs.mkdirSync(out, { recursive: true });
    await Promise.all([...Array(N || 2)].map(async (_, w) => {
      const page = await openPage(browser, port);
      for (let i = a + w; i <= b; i += (N || 2)) await shoot(page, i * step, path.join(out, `${String(i).padStart(5, '0')}.png`));
    }));
    console.log('range done', a, b);
  } else if (mode === 'full') {
    const N = parseInt(args[0] || '3'), step = parseFloat(args[1] || '0.5');
    const out = path.join(__dirname, 'out', 'frames'); fs.mkdirSync(out, { recursive: true });
    const total = Math.round(1050 / step);
    const start = Date.now(); let done = 0;
    await Promise.all([...Array(N)].map(async (_, w) => {
      const page = await openPage(browser, port);
      for (let i = w; i < total; i += N) {
        const file = path.join(out, `${String(i).padStart(5, '0')}.png`);
        await shoot(page, i * step, file);
        if (++done % 100 === 0) console.log(`${done}/${total}  ${((Date.now() - start) / done).toFixed(0)} ms/frame`);
      }
    }));
    console.log('done', total, 'frames in', ((Date.now() - start) / 1000).toFixed(1), 's');
  }
  await browser.close(); srv.close();
})();
