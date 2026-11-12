// 円周角・三平方：指（タッチ）・マウスで点をつかんで動かせるかを確かめる（bash tools/serve.sh のあと node tools/drag-geo.js）
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const run = async (id, fn) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    p.on('pageerror', (e) => errs.push(id + ': ' + e.message));
    await p.goto('http://localhost:8765/simulator/sim.html?s=' + id);
    await p.waitForTimeout(700);
    console.log('== ' + id + '\n' + (await p.evaluate(fn)).join('\n'));
    await p.close();
  };
  const helpers = `
    const { S, setValue, api } = window.__sim, plot = api.plots[0], cv = document.querySelector('#stage canvas'), out = [];
    const wait = () => new Promise((r) => setTimeout(r, 60));
    const fire = (type, wx, wy, pt) => { const rc = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { clientX: rc.left + plot.X(wx), clientY: rc.top + plot.Y(wy), pointerId: 1, pointerType: pt || 'touch', bubbles: true })); };
    const drag = async (from, to, pt) => { fire('pointerdown', from[0], from[1], pt); await wait(); fire('pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, pt); await wait(); fire('pointermove', to[0], to[1], pt); await wait(); fire('pointerup', to[0], to[1], pt); await wait(); };
    const ok = (name, got, want) => out.push(name + ': ' + JSON.stringify(got) + ' ' + (JSON.stringify(got) === JSON.stringify(want) ? 'OK' : 'NG（' + JSON.stringify(want) + ' のはず）'));
    // つかめる点の上のタッチはスクロールを止める（preventDefault）、ほかの所は止めない
    const touch = (wx, wy) => { const rc = cv.getBoundingClientRect(); const t = new Touch({ identifier: 1, target: cv, clientX: rc.left + plot.X(wx), clientY: rc.top + plot.Y(wy) }); const e = new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], cancelable: true, bubbles: true }); cv.dispatchEvent(e); return e.defaultPrevented; };
  `;
  await run('inscribed-angle', new Function(`return (async () => { ${helpers}
    const L = window.SimLib['inscribed-angle'];
    let g = L.points(S.arc, S.p);
    await drag(g.P, L.pt(90), 'touch'); ok('P を真上へ（指）→ 位置', S.p, 50);
    await drag(L.pt(90), L.pt(L.pDeg(100, 20)), 'mouse'); ok('P を B 側へ（マウス）→ 位置', S.p, 20);
    g = L.points(S.arc, S.p);
    await drag(g.B, L.pt(0), 'touch'); ok('B を真横へ（指）→ 中心角（直径）', S.arc, 180);
    g = L.points(S.arc, S.p);
    await drag(g.A, L.pt(-90 - 30), 'touch'); ok('A を下へ（指）→ 中心角', S.arc, 60);
    await drag(L.points(60, S.p).A, L.pt(100), 'touch'); ok('A を上まで回しすぎ → 上限で止まる', S.arc, L.ARC_MAX);
    setValue('arc', 100); setValue('two', true); await wait();
    await drag(L.points(100, S.q).P, L.pt(L.pDeg(100, 85)), 'touch'); ok('Q を動かす（指）→ 位置', S.q, 85);
    const before = [S.arc, S.p, S.q];
    await drag([0.3, 0.2], [0.5, -0.4], 'touch'); ok('何もない所をなぞっても変わらない', [S.arc, S.p, S.q], before);
    ok('点 P の上のタッチ：スクロールを止める', touch.apply(null, L.points(S.arc, S.p).P), true);
    ok('何もない所のタッチ：スクロールできる', touch(0.3, 0.2), false);
    ok('測った円周角（図の下の数）', document.querySelectorAll('#readouts dd')[1].textContent, '50°');
    return out; })()`));
  await run('pythagoras', new Function(`return (async () => { ${helpers}
    await drag([S.a, 0], [6, 0.4], 'touch'); ok('B を右へ（指）→ a', S.a, 6);
    await drag([0, S.b], [0.3, 8], 'touch'); ok('A を上へ（指）→ b', S.b, 8);
    ok('式', document.querySelector('#formula').textContent.includes('36 + 64 = 100'), true);
    await drag([0, S.b], [0, -5], 'mouse'); ok('A を下に行きすぎ → 1 で止まる', S.b, 1);
    await drag([S.a, 0], [99, 0], 'mouse'); ok('B を右に行きすぎ → 12 で止まる', S.a, 12);
    ok('点 B の上のタッチ：スクロールを止める', touch(S.a, 0), true);
    ok('正方形の中のタッチ：スクロールできる', touch(S.a / 2, -S.a / 2), false);
    setValue('view', 'tile'); await wait();
    const before = [S.a, S.b];
    await drag([S.a, 0], [3, 0], 'touch'); ok('しきつめの図ではつかめない', [S.a, S.b], before);
    return out; })()`));
  console.log('errors:', errs.join('\n') || 'none');
  await b.close();
})();
