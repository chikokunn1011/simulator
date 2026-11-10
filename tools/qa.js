const { chromium } = require('playwright');
(async () => {
  const [,, id, port] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${port||8765}/simulator/sim.html?s=${id}`);
  await p.waitForTimeout(600);
  const r = await p.evaluate(async () => {
    const out = [];
    const sim = window.__sim;
    // 全パラメータを最小・最大・範囲外・NaN に
    for (const prm of sim.sim.params) {
      for (const v of [prm.min, prm.max, prm.max + 100, -1e9, NaN, Infinity]) { sim.setValue(prm.key, v); await new Promise(r => requestAnimationFrame(r)); }
      sim.setValue(prm.key, prm.value);
    }
    for (const c of sim.sim.choices) for (const [v] of c.options) { sim.setValue(c.key, v); await new Promise(r => requestAnimationFrame(r)); }
    for (const pr of sim.sim.presets) { document.querySelectorAll('.presets .chip')[sim.sim.presets.indexOf(pr)].click(); await new Promise(r => setTimeout(r, 30));
      const t = document.body.innerText; if (/NaN|undefined|Infinity/.test(document.getElementById('readouts').innerText + document.getElementById('formula').innerText)) out.push('NaN in preset ' + pr.label); }
    // 説明・確認問題を全プリセットで作る
    for (let i = 0; i < sim.sim.presets.length; i++) {
      document.querySelectorAll('.presets .chip')[i].click();
      const ex = sim.sim.explain ? sim.sim.explain(sim.S) : '';
      if (/NaN|undefined|Infinity/.test(ex)) out.push('explain NaN preset ' + i);
      const qs = sim.sim.quiz(Object.assign({}, sim.S));
      qs.forEach((q, k) => { const s = q.q + q.choices.join('|') + q.explain + Object.values(q.why||{}).join(''); if (/NaN|undefined|Infinity/.test(s)) out.push('quiz NaN preset ' + i + ' q' + k);
        if (q.choices.length < 3) out.push('few choices preset ' + i + ' q' + k + ': ' + q.choices.length);
        if (new Set(q.choices).size !== q.choices.length) out.push('dup choices'); });
    }
    // 確認問題を1周
    document.getElementById('tab-4').click();
    let n = 0;
    while (document.querySelector('.quiz-choice') && n < 10) {
      document.querySelector('.quiz-choice').click(); n++;
      const nx = document.querySelector('.quiz-next'); if (!nx) break; nx.click();
    }
    out.push('quiz end: ' + (document.querySelector('.quiz-big') || {}).textContent);
    // 初期状態にもどす
    document.getElementById('tab-2').click();
    [...document.querySelectorAll('.btn')].find(b => b.textContent === '初期状態にもどす').click();
    const diff = Object.keys(sim.sim.params.reduce((o,p)=>{if (sim.S[p.key]!==p.value) o[p.key]=1; return o;},{}));
    out.push('reset diff: ' + diff.join(','));
    return out;
  });
  console.log(r.join('\n')); console.log('errors:', errs.join('\n') || 'none');
  await b.close();
})();
