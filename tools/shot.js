const { chromium } = require('playwright');
(async () => {
  const [,, url, out, w, h, style, extra] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w || 390, height: +h || 844 }, deviceScaleFactor: 1, hasTouch: (+w||390) < 800 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  if (style) await p.addInitScript(s => { try { localStorage.setItem('ew:style', JSON.stringify(s)); localStorage.setItem('study:fg', '1'); } catch (e) {} }, style);
  await p.goto(url);
  await p.waitForTimeout(800);
  if (extra) { await p.evaluate(extra); await p.waitForTimeout(500); }
  await p.screenshot({ path: out, fullPage: false });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log('overflowX', sw, errs.join('\n'));
  await b.close();
})();
