/* 円周角と中心角（中3）。円周上の点 P・A・B を動かして、円周角が中心角の半分・同じ弧なら等しい・直径なら 90° を確かめる */
(function () {
  'use strict';
  const L = window.SimLib['inscribed-angle'];
  const U = window.SimApp.util;
  const { fmt, frac } = U;
  const RAD = Math.PI / 180;
  const dg = (v) => fmt(v, 1) + '°';
  const HALF = frac('1', '2');
  let plot, cv, S0;

  // 測った角（座標から）。小数第1位まで
  const measured = (s, t) => { const g = L.points(s.arc, t); return Math.round(L.angle(g.P, g.A, g.B) * 10) / 10; };

  window.SimApp.register({
    id: 'inscribed-angle',
    dragHint: '点 P・A・B を指で動かせる',
    intro:
      '<p>円周上の 2 点 A、B と、弧 AB の上にない円周上の点 P を結んでできる ∠APB を、弧 AB に対する<b>円周角</b>という。円の中心 O と結んだ ∠AOB は<b>中心角</b>。</p>' +
      '<p>P を動かすと円周角はどうなる？ A・B を動かして弧の長さを変えると？</p>',
    assumptions: [
      '角の大きさは図の点の座標から計算して、小数第1位まで出している。',
      '中心角は 2° きざみ（20°〜280°）。中心角が 180° より大きいときは、弧 AB の側（下側）ではかる。',
      '点 P・Q は、弧 AB の上にない円周上だけを動く。'
    ],
    params: [
      { key: 'arc', label: '中心角 ∠AOB', min: L.ARC_MIN, max: L.ARC_MAX, step: 2, value: 100, unit: '°', digits: 0 },
      { key: 'p', label: '点 P の位置', min: L.T_MIN, max: L.T_MAX, step: 1, value: 35, digits: 0 },
      { key: 'q', label: '点 Q の位置', min: L.T_MIN, max: L.T_MAX, step: 1, value: 72, digits: 0, show: (s) => s.two }
    ],
    toggles: [
      { key: 'center', label: '中心角', value: true },
      { key: 'two', label: '点 Q も出す', value: false },
      { key: 'radius', label: '半径 OP をひく', value: false }
    ],
    presets: [
      { label: '中心角 100°', values: { arc: 100, p: 35, two: false, center: true } },
      { label: '直径（180°）', values: { arc: 180, p: 35, center: true } },
      { label: '同じ弧の円周角', values: { arc: 80, p: 30, q: 70, two: true } },
      { label: '中心角 60°', values: { arc: 60, p: 50 } },
      { label: '中心角 240°', values: { arc: 240, p: 50, center: true } }
    ],

    init(api) {
      S0 = api.S;
      cv = document.createElement('canvas');
      cv.setAttribute('role', 'img');
      api.stage.append(cv);
      plot = new window.SimPlot(cv, { xmin: -1.3, xmax: 1.3, ymin: -1.3, ymax: 1.3, equal: true, pad: { l: 4, r: 4, t: 4, b: 4 } });
      api.plots.push(plot);

      // 点 P・Q・A・B を指やマウスでつかんで、円周にそって動かす
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      function grab(x, y, touch) {
        const R = touch ? 30 : 18, g = L.points(S0.arc, S0.p), cand = [['p', g.P], ['A', g.A], ['B', g.B]];
        if (S0.two) cand.push(['q', L.points(S0.arc, S0.q).P]);
        let best = null, bd = R;
        cand.forEach((c) => { const d = Math.hypot(x - plot.X(c[1][0]), y - plot.Y(c[1][1])); if (d <= bd) { bd = d; best = c[0]; } });
        return best;
      }
      function moveTo(kind, x, y) {
        const wx = plot.wx(x), wy = plot.wy(y);
        if (Math.hypot(wx, wy) < 0.12) return;   // 中心のすぐ近くは向きが決まらない
        const d = Math.atan2(wy, wx) / RAD;
        if (kind === 'p' || kind === 'q') api.set(kind, L.tOf(S0.arc, d));
        else api.set('arc', L.arcOf(d, kind));
      }
      let drag = null;
      // つかめる点の上から始まったタッチだけ、ページのスクロールを止める（ほかの所はふつうにスクロールできる）
      cv.addEventListener('touchstart', (e) => {
        const t = e.touches[0], r = cv.getBoundingClientRect();
        if (e.touches.length === 1 && grab(t.clientX - r.left, t.clientY - r.top, true)) e.preventDefault();
      }, { passive: false });
      cv.addEventListener('pointerdown', (e) => {
        const [x, y] = pos(e), k = grab(x, y, e.pointerType === 'touch');
        if (!k) return;
        drag = { kind: k, id: e.pointerId };
        try { cv.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ }
        cv.style.cursor = 'grabbing';
      });
      cv.addEventListener('pointermove', (e) => {
        const [x, y] = pos(e);
        if (!drag) { if (e.pointerType === 'mouse') cv.style.cursor = grab(x, y, false) ? 'grab' : ''; return; }
        if (e.pointerId === drag.id) moveTo(drag.kind, x, y);
      });
      const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; cv.style.cursor = ''; } };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    },

    draw(s) {
      const C = window.SimPlot.colors(), c = plot.begin();
      const g = L.points(s.arc, s.p), gq = s.two ? L.points(s.arc, s.q) : null;
      const small = plot.w < 420, fs = small ? 13 : 15;
      const X = (p) => plot.X(p[0]), Y = (p) => plot.Y(p[1]);
      const out = (deg) => { const a = ((deg % 360) + 360) % 360; return ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'][Math.round(a / 45) % 8]; };
      // 角のしるし（扇形）と大きさ。from → to の小さい方の向きにかく
      function mark(V, P1, P2, color, text, r, reflex) {
        const a1 = Math.atan2(Y(P1) - Y(V), X(P1) - X(V)), a2 = Math.atan2(Y(P2) - Y(V), X(P2) - X(V));
        let d = a2 - a1; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
        if (reflex) d = d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI;
        c.save();
        c.beginPath(); c.moveTo(X(V), Y(V)); c.arc(X(V), Y(V), r, a1, a1 + d, d < 0); c.closePath();
        c.globalAlpha = 0.22; c.fillStyle = color; c.fill(); c.globalAlpha = 1;
        c.beginPath(); c.arc(X(V), Y(V), r, a1, a1 + d, d < 0); c.strokeStyle = color; c.lineWidth = 2.2; c.stroke();
        c.restore();
        const m = a1 + d / 2, rr = r + (Math.abs(d) < 0.7 ? 22 : 15);
        plot.label(text, X(V) + Math.cos(m) * rr, Y(V) + Math.sin(m) * rr, { px: true, pos: 'c', color, bold: true, size: fs, keep: true });
      }
      // 直角のしるし
      function square(V, P1, P2, color) {
        const u = (P) => { const dx = X(P) - X(V), dy = Y(P) - Y(V), n = Math.hypot(dx, dy) || 1; return [dx / n, dy / n]; };
        const a = u(P1), b = u(P2), k = 13;
        c.save(); c.strokeStyle = color; c.lineWidth = 2.2; c.beginPath();
        c.moveTo(X(V) + a[0] * k, Y(V) + a[1] * k); c.lineTo(X(V) + (a[0] + b[0]) * k, Y(V) + (a[1] + b[1]) * k); c.lineTo(X(V) + b[0] * k, Y(V) + b[1] * k);
        c.stroke(); c.restore();
      }
      // 円
      const circle = []; for (let i = 0; i <= 180; i++) circle.push(L.pt(i * 2));
      plot.path(circle, { color: C.ink, width: 2 });
      // 弧 AB（太く）
      const arcPts = []; for (let i = 0; i <= 90; i++) arcPts.push(L.pt(L.aDeg(s.arc) + s.arc * i / 90));
      plot.path(arcPts, { color: C.c2, width: 5 });
      plot.label('弧 AB', 0, -1, { pos: 's', color: C.c2, bold: true, size: fs - 1, gap: 8 });
      // 中心角
      const insc = L.inscribed(s.arc);
      if (s.center) {
        plot.seg(0, 0, g.A[0], g.A[1], { color: C.c3, width: 2.4 });
        plot.seg(0, 0, g.B[0], g.B[1], { color: C.c3, width: 2.4 });
        if (s.arc !== 180) mark(g.O, g.A, g.B, C.c3, dg(s.arc), small ? 20 : 26, s.arc > 180);
        else plot.label('180°', 0, 0, { pos: 's', color: C.c3, bold: true, size: fs, gap: 10 });
      }
      // 円周角（Q は破線）
      if (gq) {
        plot.seg(gq.P[0], gq.P[1], g.A[0], g.A[1], { color: C.c4, width: 2.4, dash: [7, 5] });
        plot.seg(gq.P[0], gq.P[1], g.B[0], g.B[1], { color: C.c4, width: 2.4, dash: [7, 5] });
      }
      plot.seg(g.P[0], g.P[1], g.A[0], g.A[1], { color: C.c1, width: 2.8 });
      plot.seg(g.P[0], g.P[1], g.B[0], g.B[1], { color: C.c1, width: 2.8 });
      // 半径 OP（二等辺三角形が 2 つできる）
      if (s.radius) {
        plot.seg(0, 0, g.P[0], g.P[1], { color: C.muted, width: 2, dash: [3, 4] });
        if (!s.center) { plot.seg(0, 0, g.A[0], g.A[1], { color: C.muted, width: 2, dash: [3, 4] }); plot.seg(0, 0, g.B[0], g.B[1], { color: C.muted, width: 2, dash: [3, 4] }); }
      }
      const pa = measured(s, s.p);
      if (insc === 90) { square(g.P, g.A, g.B, C.c1); const m = [(g.A[0] + g.B[0]) / 2 - g.P[0], (g.A[1] + g.B[1]) / 2 - g.P[1]], n = Math.hypot(m[0], m[1]) || 1; plot.label('90°', X(g.P) + m[0] / n * 34, Y(g.P) - m[1] / n * 34, { px: true, pos: 'c', color: C.c1, bold: true, size: fs, keep: true }); }
      else mark(g.P, g.A, g.B, C.c1, dg(pa), small ? 24 : 30);
      if (gq) {
        const qa = measured(s, s.q);
        if (insc === 90) square(gq.P, g.A, g.B, C.c4); else mark(gq.P, g.A, g.B, C.c4, dg(qa), small ? 24 : 30);
      }
      // 点
      plot.point(0, 0, { color: C.ink, r: 3.5, label: 'O', pos: s.center && s.arc < 180 ? 'n' : 'ne' });
      plot.point(g.A[0], g.A[1], { color: C.c2, r: 6, grip: true, shape: 'square', label: 'A', pos: out(L.aDeg(s.arc)) });
      plot.point(g.B[0], g.B[1], { color: C.c2, r: 6, grip: true, shape: 'square', label: 'B', pos: out(L.bDeg(s.arc)) });
      if (gq) plot.point(gq.P[0], gq.P[1], { color: C.c4, r: 6.5, grip: true, shape: 'diamond', label: 'Q', pos: out(L.pDeg(s.arc, s.q)) });
      plot.point(g.P[0], g.P[1], { color: C.c1, r: 7, grip: true, label: 'P', pos: out(L.pDeg(s.arc, s.p)) });
      cv.setAttribute('aria-label', '円と弧 AB。中心角 ∠AOB は ' + s.arc + '度、円周角 ∠APB は ' + pa + '度' + (gq ? '、∠AQB は ' + measured(s, s.q) + '度' : '') + '。');
    },

    formula(s) {
      const a = L.inscribed(s.arc);
      let sub = '';
      if (s.arc === 180) sub = '<span class="sub">AB が直径 → 円周角は 90°</span>';
      else if (s.two) sub = '<span class="sub">同じ弧 AB に対する円周角 → ∠APB = ∠AQB = ' + dg(a) + '</span>';
      return '∠APB = ' + HALF + ' × ∠AOB = ' + HALF + ' × ' + s.arc + '° = ' + dg(a) + sub;
    },

    readouts(s) {
      const rows = [['中心角 ∠AOB', s.arc + '°'], ['円周角 ∠APB', dg(measured(s, s.p))]];
      if (s.two) rows.push(['円周角 ∠AQB', dg(measured(s, s.q))]);
      if (s.radius) {
        const k = L.split(s.arc, s.p), r1 = (v) => fmt(v, 1) + '°';
        rows.push(k.inside ? ['∠OPA + ∠OPB', r1(k.opa) + ' + ' + r1(k.opb)] : ['∠OP' + (k.opa > k.opb ? 'A' : 'B') + ' − ∠OP' + (k.opa > k.opb ? 'B' : 'A'), r1(Math.max(k.opa, k.opb)) + ' − ' + r1(Math.min(k.opa, k.opb))]);
      }
      rows.push(['弧 AB', s.arc === 180 ? '半円（AB は直径）' : s.arc > 180 ? '半円より長い' : '半円より短い']);
      return rows;
    },

    explain(s) {
      const a = L.inscribed(s.arc), k = L.split(s.arc, s.p), r1 = (v) => fmt(v, 1) + '°';
      let h = '<h3>円周角の定理</h3>' +
        '<span class="eq">円周角 = ' + HALF + ' × 中心角　　∠APB = ' + HALF + '∠AOB</span>' +
        '<p>1 つの弧に対する円周角の大きさは、その弧に対する中心角の半分。だから、同じ弧に対する円周角はどれも等しい。</p>' +
        '<p class="now">今は中心角が ' + s.arc + '° だから、円周角は ' + s.arc + '° ÷ 2 = ' + dg(a) + '。P を動かしても変わらない。</p>';
      if (s.arc > 180) h += '<p class="now">中心角が 180° より大きいときは、弧 AB の側（下側）の角をはかる。円周角は 90° より大きくなる。</p>';
      h += '<h3>なぜ半分になる？</h3>' +
        '<p>半径 OP をひくと、OA = OP = OB（半径）なので、△OPA と △OPB は二等辺三角形。底角が等しいことと、三角形の外角を使うと、中心角が円周角の 2 倍になることがわかる。「半径 OP をひく」をオンにして見てみよう。</p>' +
        '<p class="now">今は ∠OPA = ' + r1(k.opa) + '、∠OPB = ' + r1(k.opb) + '。' +
        (k.inside ? 'あわせて ' : '大きい方から小さい方をひいて ') + '∠APB = ' + dg(a) + '。その 2 倍が中心角 ' + s.arc + '°。</p>';
      h += '<h3>直径と円周角</h3>' +
        '<span class="eq">AB が直径 ⇒ ∠APB = 90°</span>' +
        '<p>直径のとき中心角は 180°（半円の弧）なので、円周角は 180° ÷ 2 = 90°。逆に、∠APB = 90° なら AB は直径。</p>';
      if (s.arc === 180) h += '<p class="now">今は AB が直径。P をどこに動かしても ∠APB = 90°。</p>';
      return h;
    },

    quiz(s) {
      const qs = [], d = (v) => fmt(v, 1) + '°';
      const pick = (correct, wrongs) => U.mc(d(correct), wrongs.filter((w) => w[0] > 0 && w[0] < 360 && w[0] !== correct).map((w) => [d(w[0]), w[1]]));
      // 1. 中心角 → 円周角
      const arc = s.arc;
      let m = pick(arc / 2, [[arc * 2 > 359 ? arc / 4 : arc * 2, '2 倍ではなく半分。円周角 = 中心角 ÷ 2。'], [arc, '円周角は中心角と同じではない。中心角の半分。'],
        [180 - arc / 2, '180° からひく必要はない。中心角を 2 でわるだけ。'], [arc / 2 + 10, '中心角を 2 でわろう。'], [arc / 4, '半分の半分になっている。2 でわるのは 1 回。']]);
      qs.push(Object.assign(m, { q: '<p>弧 AB に対する中心角 ∠AOB が ' + arc + '° のとき、円周角 ∠APB は？</p>',
        explain: '<p>円周角は中心角の半分だから、' + arc + '° ÷ 2 = ' + d(arc / 2) + '。</p>' }));
      // 2. 円周角 → 中心角
      const k = (arc / 2) % 40 + 25;
      m = pick(2 * k, [[k / 2, '中心角は円周角の 2 倍。半分にするのは逆。'], [k, '中心角は円周角と同じではない。2 倍。'], [180 - k, '180° からひく必要はない。円周角を 2 倍する。'], [180 - 2 * k, '円周角を 2 倍するだけでいい。'], [2 * k + 20, '円周角を 2 倍しよう。']]);
      qs.push(Object.assign(m, { q: '<p>弧 AB に対する円周角 ∠APB が ' + d(k) + ' のとき、中心角 ∠AOB は？</p>',
        explain: '<p>中心角は円周角の 2 倍だから、' + d(k) + ' × 2 = ' + d(2 * k) + '。</p>' }));
      // 3. 同じ弧
      const v = arc / 2 === 90 ? 55 : arc / 2;
      m = pick(v, [[2 * v, '2 倍になるのは中心角。∠AQB も円周角。'], [v / 2, '同じ弧に対する円周角は等しい。半分にはならない。'], [180 - v, '同じ弧に対する円周角は等しい。'], [90 - v, '同じ弧に対する円周角は等しい。'], [v + 15, 'Q の場所がちがっても、同じ弧 AB に対する円周角は等しい。']]);
      qs.push(Object.assign(m, { q: '<p>点 P、Q は、弧 AB の上にない円周上の点。∠APB = ' + d(v) + ' のとき、∠AQB は？</p>',
        explain: '<p>∠APB と ∠AQB は、同じ弧 AB に対する円周角だから等しい。∠AQB = ' + d(v) + '。「点 Q も出す」をオンにして確かめよう。</p>' }));
      // 4. 直径
      let j = 20 + (arc / 2) % 50; if (j === 45) j = 40;
      m = pick(90 - j, [[180 - j, 'AB が直径だから ∠APB = 90°。三角形の内角の和 180° から 90° と ' + d(j) + ' をひく。'], [j, '△PAB が二等辺三角形とはかぎらない。∠APB = 90° を使う。'],
        [90 + j, '∠APB = 90° と ' + d(j) + ' を 180° からひく。'], [2 * j, '∠APB = 90° を使おう。'], [90, '90° になるのは ∠APB（直径に対する円周角）。']]);
      qs.push(Object.assign(m, { q: '<p>AB が円の直径で、P は円周上の点。∠PAB = ' + d(j) + ' のとき、∠PBA は？</p>',
        explain: '<p>AB は直径だから ∠APB = 90°。△PAB の内角の和は 180° なので、∠PBA = 180° − 90° − ' + d(j) + ' = ' + d(90 - j) + '。</p>' }));
      // 5. P を動かす
      m = U.mc('変わらない', [['A に近づくほど大きくなる', '測った角を見ながら P を動かしてみよう。同じ弧 AB に対する円周角は、P がどこでも同じ。'],
        ['B に近づくほど大きくなる', '測った角を見ながら P を動かしてみよう。同じ弧 AB に対する円周角は、P がどこでも同じ。'],
        ['A と B の真ん中の上でいちばん大きくなる', '見た目は変わっても、角の大きさは同じ。中心角が変わらないから、その半分の円周角も変わらない。']]);
      qs.push(Object.assign(m, { q: '<p>A、B を動かさずに、点 P だけを（弧 AB の上にない）円周上で動かす。∠APB の大きさは？</p>',
        explain: '<p>弧 AB が同じなら中心角も同じ。円周角はその半分だから、P がどこにあっても変わらない。</p>' }));
      return qs;
    }
  });
})();
