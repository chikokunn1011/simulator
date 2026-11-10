// 関数の教材：指（タッチ）・マウスで点をつかんで動かせるかを確かめる（bash tools/serve.sh のあと node tools/drag-test.js）
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/simulator/sim.html?s=functions');
  await p.waitForTimeout(700);
  const r = await p.evaluate(async () => {
    const out = [], { S, setValue, api } = window.__sim, plot = api.plots[0];
    const cv = document.querySelector('#stage canvas');
    const wait = () => new Promise(r => setTimeout(r, 60));
    const fire = (type, wx, wy, id, pt) => { const rc = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { clientX: rc.left + plot.X(wx), clientY: rc.top + plot.Y(wy), pointerId: id || 1, pointerType: pt || 'touch', bubbles: true })); };
    const drag = async (from, to, pt) => { fire('pointerdown', from[0], from[1], 1, pt); await wait(); fire('pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 1, pt); await wait(); fire('pointermove', to[0], to[1], 1, pt); await wait(); fire('pointerup', to[0], to[1], 1, pt); await wait(); };
    // 1 次関数 y = 2x + 1、P(1, 3)
    await drag([1, 3], [3, 0], 'touch'); out.push('P を x=3 へ（指）: x0=' + S.x0 + ' ' + (S.x0 === 3 ? 'OK' : 'NG'));
    await drag([0, 1], [0.3, 4], 'touch'); out.push('切片を 4 へ（指）: b=' + S.b + ' ' + (S.b === 4 ? 'OK' : 'NG'));
    await drag([0, 4], [0, -2], 'mouse'); out.push('切片を −2 へ（マウス）: b=' + S.b + ' ' + (S.b === -2 ? 'OK' : 'NG'));
    // 何もない所をタップ → P がそこの x へ
    fire('pointerdown', -2, 5); await wait(); fire('pointerup', -2, 5); await wait();
    out.push('タップで P を x=−2 へ: x0=' + S.x0 + ' ' + (S.x0 === -2 ? 'OK' : 'NG'));
    // 二次関数 y = x² − 2x − 3 → 頂点 (1, −4) を (−2, 1) へ
    setValue('mode', 'quad'); setValue('a', 1); setValue('b', -2); setValue('c', -3); await wait();
    await drag([1, -4], [-2, 1], 'touch');
    const p = -S.b / (2 * S.a), q = S.c - S.b * S.b / (4 * S.a);
    out.push('頂点を (−2, 1) へ（指）: b=' + S.b + ' c=' + S.c + ' 頂点(' + p + ', ' + q + ') ' + (p === -2 && q === 1 ? 'OK' : 'NG'));
    // 何もない所のドラッグ → 表示が動く（値は変わらない）
    const before = JSON.stringify([S.a, S.b, S.c]), x0 = plot.range.xmin;
    await drag([5, -5], [3, -5], 'touch');
    out.push('ドラッグで表示を動かす: xmin ' + x0.toFixed(2) + '→' + plot.range.xmin.toFixed(2) + ' 値そのまま=' + (before === JSON.stringify([S.a, S.b, S.c])));
    // 2 本指でひろげる → 拡大
    const w0 = plot.range.xmax - plot.range.xmin;
    fire('pointerdown', -1, 0, 1); fire('pointerdown', 1, 0, 2); await wait();
    fire('pointermove', -3, 0, 1); fire('pointermove', 3, 0, 2); await wait();
    fire('pointerup', -3, 0, 1); fire('pointerup', 3, 0, 2); await wait();
    const w1 = plot.range.xmax - plot.range.xmin;
    out.push('2本指でひろげる: 横の幅 ' + w0.toFixed(2) + '→' + w1.toFixed(2) + ' ' + (w1 < w0 ? 'OK（拡大）' : 'NG'));
    return out;
  });
  console.log(r.join('\n')); console.log('errors:', errs.join('\n') || 'none');
  await b.close();
})();
