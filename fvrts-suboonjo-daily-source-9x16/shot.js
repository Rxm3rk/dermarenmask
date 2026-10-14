// node shot.js page.html out.png  ->  the page as a 1080x1920 PNG with a transparent background.
// Prints each [data-m] element's box so the layout can be checked against the label it covers.
const path = require('path');
let pw;
for (const m of ['playwright-core', 'playwright']) { try { pw = require(m); break; } catch (e) {} }
if (!pw) pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));

(async () => {
  const [inp, out] = process.argv.slice(2);
  const args = ['--force-color-profile=srgb', '--font-render-hinting=none'];
  let browser;
  try { browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args }); }   // as the other films in this repo
  catch (e) { browser = await pw.chromium.launch({ headless: true, args }); }
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(inp));
  await page.evaluate(() => document.fonts.ready);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('[data-m]')].map(e => {
    const r = e.getBoundingClientRect(); return [e.dataset.m, Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
  }));
  console.log(path.basename(out), JSON.stringify(boxes));
  await page.screenshot({ path: out, omitBackground: true });
  await browser.close();
})();
