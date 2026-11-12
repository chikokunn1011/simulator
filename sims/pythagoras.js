/* 三平方の定理（中3）。直角三角形の 2 辺を動かして、各辺の上の正方形の面積の関係 a² + b² = c² を見る。
   「しきつめ」では、同じ大きさの正方形から同じ三角形 4 つをとった残りをくらべて、成り立つわけを確かめる */
(function () {
  'use strict';
  const L = window.SimLib.pythagoras;
  const U = window.SimApp.util;
  const { fmt } = U;
  const V = (t) => '<i class="v">' + t + '</i>';
  let plot, cv, S0, dragging = false;

  // 斜辺の書き方：5 / √13 ≒ 3.61
  const cText = (h) => h.text + (h.whole ? '' : ' ≒ ' + fmt(h.c, 2));

  window.SimApp.register({
    id: 'pythagoras',
    dragHint: '点 A・B を指で動かせる',
    intro:
      '<p>直角三角形の直角をはさむ 2 辺を ' + V('a') + '、' + V('b') + '、斜辺（直角の向かいの、いちばん長い辺）を ' + V('c') + ' とすると、' + V('a') + '² + ' + V('b') + '² = ' + V('c') + '² が成り立つ。これが<b>三平方の定理</b>。</p>' +
      '<p>' + V('a') + '²・' + V('b') + '²・' + V('c') + '² は、それぞれの辺を 1 辺とする正方形の面積。辺の長さを変えて、面積の関係を見てみよう。</p>',
    assumptions: [
      '辺 ' + V('a') + '・' + V('b') + ' は 1 cm きざみ（1〜12 cm）。',
      '斜辺が整数にならないときは √ の形で出して、小数第2位までの近い値（≒）もそえている。',
      '図は辺の長さに合わせて大きさを変えている（1 目もりの長さは場合によってちがう）。'
    ],
    choices: [{ key: 'view', label: '図', options: [['sq', '正方形の面積'], ['tile', 'しきつめて確かめる']], value: 'sq' }],
    params: [
      { key: 'a', label: '辺 ' + V('a') + '（BC）', min: 1, max: 12, step: 1, value: 3, unit: 'cm', digits: 0 },
      { key: 'b', label: '辺 ' + V('b') + '（CA）', min: 1, max: 12, step: 1, value: 4, unit: 'cm', digits: 0 }
    ],
    toggles: [{ key: 'grid', label: '1 cm の方眼', value: true }],
    presets: [
      { label: '3・4・5', values: { a: 3, b: 4 } },
      { label: '5・12・13', values: { a: 5, b: 12 } },
      { label: '6・8・10', values: { a: 6, b: 8 } },
      { label: '2・3・√13', values: { a: 2, b: 3 } },
      { label: '直角二等辺（1・1・√2）', values: { a: 1, b: 1 } }
    ],

    init(api) {
      S0 = api.S;
      cv = document.createElement('canvas');
      cv.setAttribute('role', 'img');
      api.stage.append(cv);
      plot = new window.SimPlot(cv, { xmin: -5, xmax: 8, ymin: -4, ymax: 8, equal: true, pad: { l: 6, r: 6, t: 6, b: 6 } });
      api.plots.push(plot);

      // 点 A（上下）・点 B（左右）をつかんで辺の長さを変える（「正方形の面積」の図だけ）
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      function grab(x, y, touch) {
        if (S0.view !== 'sq') return null;
        const R = touch ? 30 : 18, cand = [['b', 0, S0.b], ['a', S0.a, 0]];
        let best = null, bd = R;
        cand.forEach((c) => { const d = Math.hypot(x - plot.X(c[1]), y - plot.Y(c[2])); if (d <= bd) { bd = d; best = c[0]; } });
        return best;
      }
      let drag = null;
      cv.addEventListener('touchstart', (e) => {
        const t = e.touches[0], r = cv.getBoundingClientRect();
        if (e.touches.length === 1 && grab(t.clientX - r.left, t.clientY - r.top, true)) e.preventDefault();
      }, { passive: false });
      cv.addEventListener('pointerdown', (e) => {
        const [x, y] = pos(e), k = grab(x, y, e.pointerType === 'touch');
        if (!k) return;
        drag = { kind: k, id: e.pointerId }; dragging = true;   // 動かしている間は図の大きさを変えない（指の下で点がにげないように）
        try { cv.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ }
        cv.style.cursor = 'grabbing';
      });
      cv.addEventListener('pointermove', (e) => {
        const [x, y] = pos(e);
        if (!drag) { if (e.pointerType === 'mouse') cv.style.cursor = grab(x, y, false) ? 'grab' : ''; return; }
        if (e.pointerId !== drag.id) return;
        api.set(drag.kind, U.clamp(Math.round(drag.kind === 'a' ? plot.wx(x) : plot.wy(y)), 1, 12));
      });
      const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; dragging = false; cv.style.cursor = ''; api.redraw(); } };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    },

    draw(s) {
      const C = window.SimPlot.colors();
      const a = s.a, b = s.b, h = L.hyp(a, b);
      const small = plot.w < 420, fs = small ? 12.5 : 14.5;
      const fit = (box) => {
        if (dragging) return;
        const mx = (box.xmax - box.xmin) * 0.06 + 0.25, my = (box.ymax - box.ymin) * 0.06 + 0.25;
        plot.setHome({ xmin: box.xmin - mx, xmax: box.xmax + mx, ymin: box.ymin - my, ymax: box.ymax + my });
      };
      const stacked = plot.w < plot.h * 1.25;   // たて長の画面：しきつめの 2 つを上下に
      if (s.view === 'tile') { const n = a + b, gap = Math.max(1, n * 0.16); fit(stacked ? { xmin: 0, xmax: n, ymin: -(n + gap), ymax: n } : { xmin: 0, xmax: 2 * n + gap, ymin: 0, ymax: n }); }
      else fit(L.figure(a, b).box);
      const c = plot.begin();
      const X = (x) => plot.X(x), Y = (y) => plot.Y(y);
      // 多角形（うすくぬる＋ふち）
      function poly(pts, color, alpha, width, dash) {
        c.save(); c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))));
        c.closePath();
        if (alpha) { c.globalAlpha = alpha; c.fillStyle = color; c.fill(); c.globalAlpha = 1; }
        if (width) { c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []); c.lineJoin = 'round'; c.stroke(); }
        c.restore();
      }
      // 正方形の中の 1 cm の方眼。o：かど、u・v：となり合う 2 辺の向き（長さ 1）、n：1 辺の長さ（整数のときだけ）
      function cells(o, u, v, n, color) {
        if (!s.grid || !Number.isInteger(n) || n * plot.sx < n * 5) return;
        c.save(); c.strokeStyle = color; c.globalAlpha = 0.45; c.lineWidth = 1; c.beginPath();
        for (let i = 1; i < n; i++) {
          c.moveTo(X(o[0] + u[0] * i), Y(o[1] + u[1] * i)); c.lineTo(X(o[0] + u[0] * i + v[0] * n), Y(o[1] + u[1] * i + v[1] * n));
          c.moveTo(X(o[0] + v[0] * i), Y(o[1] + v[1] * i)); c.lineTo(X(o[0] + v[0] * i + u[0] * n), Y(o[1] + v[1] * i + u[1] * n));
        }
        c.stroke(); c.restore();
      }
      const mid = (pts) => [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
      const tag = (text, p, color, size) => plot.label(text, p[0], p[1], { pos: 'c', color, bold: true, size: size || fs, keep: true });
      // 面積の文字：正方形が小さいときは短く
      const areaTag = (name, val, side) => (side * plot.sx > (small ? 58 : 70) ? name + '² = ' + val : side * plot.sx > 26 ? String(val) : '');
      const uc = [a / h.c, -b / h.c], vc = [b / h.c, a / h.c];   // 斜辺の向きと、それに垂直な向き

      if (s.view === 'tile') {
        const T = L.tiling(a, b), n = T.n, gap = Math.max(1, n * 0.16);
        const off = stacked ? [0, -(n + gap)] : [n + gap, 0];
        const sh = (pts) => pts.map((p) => [p[0] + off[0], p[1] + off[1]]);
        // 左（上）：三角形 4 つ ＋ c²
        T.left.tris.forEach((t) => poly(t, C.muted, 0.28, 1.6));
        poly(T.left.sqC, C.c2, 0.3, 2.6);
        cells(T.left.sqC[0], vc, [-vc[1], vc[0]], h.whole ? h.c : NaN, C.c2);
        poly([[0, 0], [n, 0], [n, n], [0, n]], C.ink, 0, 2.2);
        tag(areaTag('c', h.c2, h.c) || 'c²', mid(T.left.sqC), C.c2);
        // 右（下）：三角形 4 つ ＋ a² ＋ b²
        T.right.tris.forEach((t) => poly(sh(t), C.muted, 0.28, 1.6));
        poly(sh(T.right.sqA), C.c1, 0.3, 2.6); poly(sh(T.right.sqB), C.c3, 0.3, 2.6);
        cells(sh(T.right.sqA)[0], [1, 0], [0, 1], a, C.c1); cells(sh(T.right.sqB)[0], [1, 0], [0, 1], b, C.c3);
        poly(sh([[0, 0], [n, 0], [n, n], [0, n]]), C.ink, 0, 2.2);
        tag(areaTag('a', h.a2, a) || (a * plot.sx > 16 ? 'a²' : ''), mid(sh(T.right.sqA)), C.c1);
        tag(areaTag('b', h.b2, b) || (b * plot.sx > 16 ? 'b²' : ''), mid(sh(T.right.sqB)), C.c3);
        // 説明（図の外）
        const cap = { color: C.ink, size: fs - 1, bold: true, keep: true };
        if (stacked) {
          plot.label('三角形 4 つ ＋ c²', n / 2, 0, Object.assign({ pos: 's', gap: 4 }, cap));
          plot.label('同じ三角形 4 つ ＋ a² ＋ b²', n / 2, off[1], Object.assign({ pos: 's', gap: 4 }, cap));
        } else {
          plot.label('三角形 4 つ ＋ c²', n / 2, 0, Object.assign({ pos: 's', gap: 4 }, cap));
          plot.label('同じ三角形 4 つ ＋ a² ＋ b²', off[0] + n / 2, 0, Object.assign({ pos: 's', gap: 4 }, cap));
        }
        cv.setAttribute('aria-label', '1 辺 ' + n + ' cm の正方形が 2 つ。1 つは直角三角形 4 つと面積 ' + h.c2 + ' の正方形、もう 1 つは同じ三角形 4 つと面積 ' + h.a2 + ' と ' + h.b2 + ' の正方形に分けてある。');
        return;
      }

      const F = L.figure(a, b);
      poly(F.sqA, C.c1, 0.26, 2.2); cells([0, -a], [1, 0], [0, 1], a, C.c1);
      poly(F.sqB, C.c3, 0.26, 2.2); cells([-b, 0], [1, 0], [0, 1], b, C.c3);
      poly(F.sqC, C.c2, 0.26, 2.2); cells(F.A, uc, vc, h.whole ? h.c : NaN, C.c2);
      // 三角形
      poly([F.A, F.B, F.C], C.ink, 0, 3);
      // 直角のしるし
      const k = Math.min(0.5, Math.min(a, b) * 0.28);
      plot.path([[k, 0], [k, k], [0, k]], { color: C.ink, width: 1.8 });
      // 面積
      tag(areaTag('a', h.a2, a), mid(F.sqA), C.c1);
      tag(areaTag('b', h.b2, b), mid(F.sqB), C.c3);
      tag(areaTag('c', h.c2, h.c), mid(F.sqC), C.c2);
      // 辺の長さ（三角形の内側）
      const inS = small ? fs - 1 : fs - 0.5;
      if (a * plot.sx > 44 && b * plot.sy > 44) {
        plot.label('a=' + a, a / 2, 0, { pos: 'n', color: C.c1, bold: true, size: inS, gap: 3 });
        plot.label('b=' + b, 0, b / 2, { pos: 'e', color: C.c3, bold: true, size: inS, gap: 4 });
      }
      plot.label('c=' + h.text, (a + b * 0.16) / 2 + vc[0] * 0.1, (b + a * 0.16) / 2 + vc[1] * 0.1, { pos: 'ne', color: C.c2, bold: true, size: inS, gap: 2 });
      // 点
      plot.point(0, 0, { color: C.ink, r: 3.5, label: 'C', pos: 'sw' });
      plot.point(0, b, { color: C.ink, r: 6.5, grip: true, label: 'A', pos: 'nw' });
      plot.point(a, 0, { color: C.ink, r: 6.5, grip: true, shape: 'square', label: 'B', pos: 'se' });
      cv.setAttribute('aria-label', '直角三角形 ABC（BC = ' + a + ' cm、CA = ' + b + ' cm、斜辺 AB = ' + cText(h) + ' cm）と、3 辺の上の正方形。面積は ' + h.a2 + '、' + h.b2 + '、' + h.c2 + ' 平方センチメートル。');
    },
    resize() { dragging = false; },

    formula(s) {
      const h = L.hyp(s.a, s.b);
      return V('a') + '² + ' + V('b') + '² = ' + V('c') + '²　→　' + s.a + '² + ' + s.b + '² = ' + h.a2 + ' + ' + h.b2 + ' = ' + h.c2 +
        '<span class="sub">' + V('c') + ' = √' + h.c2 + (h.text === '√' + h.c2 ? '' : ' = ' + h.text) + (h.whole ? '' : ' ≒ ' + fmt(h.c, 2)) + '（cm）</span>';
    },

    readouts(s) {
      const h = L.hyp(s.a, s.b);
      const rows = [['a²（BC の正方形）', h.a2 + ' cm²'], ['b²（CA の正方形）', h.b2 + ' cm²'], ['c²（AB の正方形）', h.c2 + ' cm²'], ['斜辺 c', cText(h) + ' cm']];
      if (s.view === 'tile') rows.push(['三角形 4 つ', (2 * s.a * s.b) + ' cm²'], ['大きい正方形', (s.a + s.b) + '² = ' + (s.a + s.b) ** 2 + ' cm²']);
      return rows;
    },

    explain(s) {
      const a = s.a, b = s.b, h = L.hyp(a, b), n = a + b;
      let x = '<h3>三平方の定理</h3>' +
        '<span class="eq">' + V('a') + '² + ' + V('b') + '² = ' + V('c') + '²（' + V('c') + ' は斜辺）</span>' +
        '<p>直角をはさむ 2 辺の上の正方形の面積をたすと、斜辺の上の正方形の面積になる。</p>' +
        '<p class="now">今は ' + a + '² + ' + b + '² = ' + h.a2 + ' + ' + h.b2 + ' = ' + h.c2 + '。だから ' + V('c') + '² = ' + h.c2 + '、' + V('c') + ' &gt; 0 より ' + V('c') + ' = ' + cText(h) + '。</p>';
      if (a === b) x += '<p class="now">今は ' + V('a') + ' = ' + V('b') + ' の直角二等辺三角形。辺の比は 1 : 1 : √2（斜辺は 1 辺の √2 倍）。</p>';
      x += '<h3>辺の長さを求める</h3>' +
        '<span class="eq">斜辺：' + V('c') + '² = ' + V('a') + '² + ' + V('b') + '²　　ほかの辺：' + V('a') + '² = ' + V('c') + '² − ' + V('b') + '²</span>' +
        '<p>斜辺を求めるときは 2 乗をたす。斜辺がわかっていてほかの辺を求めるときは、斜辺の 2 乗からひく。最後に √ をとるのを忘れない。</p>' +
        '<p class="now">今の三角形なら、' + V('c') + ' と ' + V('b') + ' から ' + V('a') + '² = ' + h.c2 + ' − ' + h.b2 + ' = ' + h.a2 + '、' + V('a') + ' = ' + a + '。</p>';
      x += '<h3>なぜ成り立つ？</h3>' +
        '<p>1 辺 ' + V('a') + ' + ' + V('b') + ' の正方形を 2 つ用意する。1 つは同じ直角三角形 4 つと ' + V('c') + '² の正方形に、もう 1 つは同じ三角形 4 つと ' + V('a') + '²・' + V('b') + '² の正方形に分けられる。同じものから同じものをとった残りは等しい。図を「しきつめて確かめる」にして見てみよう。</p>' +
        '<p class="now">今は 1 辺 ' + n + ' の正方形（面積 ' + n * n + '）から、三角形 4 つ（' + (2 * a * b) + '）をとると、どちらも ' + n * n + ' − ' + (2 * a * b) + ' = ' + h.c2 + ' 残る。</p>';
      return x;
    },

    quiz(s) {
      const a = s.a, b = s.b, h = L.hyp(a, b), qs = [], rt = L.rootText;
      const TRI = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]];
      const i0 = (a + 2 * b) % TRI.length;
      // 1. 斜辺
      let m = U.mc(h.text, [[String(a + b), '辺の長さをそのままたしてはいけない。2 乗をたしてから √ をとる。'],
        [String(h.c2), 'それは ' + V('c') + '²。最後に √ をとって ' + V('c') + ' にする。'],
        [rt(a * b * 2), V('a') + ' と ' + V('b') + ' をかけるのではなく、それぞれ 2 乗してたす。'],
        [a === b ? null : rt(Math.abs(a * a - b * b)), '斜辺を求めるときは、2 乗を「たす」。ひくのはほかの辺を求めるとき。'],
        [rt(h.c2 + 1), '2 乗の計算を確かめよう。' + a + '² = ' + h.a2 + '、' + b + '² = ' + h.b2 + '。'],
        [rt(h.c2 + 2), '2 乗の計算を確かめよう。' + a + '² = ' + h.a2 + '、' + b + '² = ' + h.b2 + '。']]);
      qs.push(Object.assign(m, { q: '<p>直角をはさむ 2 辺が ' + a + ' cm と ' + b + ' cm の直角三角形。斜辺の長さ（cm）は？</p>',
        explain: '<p>斜辺を ' + V('c') + ' とすると ' + V('c') + '² = ' + a + '² + ' + b + '² = ' + h.c2 + '。' + V('c') + ' &gt; 0 より ' + V('c') + ' = ' + cText(h) + '。</p>' }));
      // 2. 斜辺とほかの 1 辺 → 残りの辺
      const t = TRI[i0], lg = L.leg(t[2], t[0]);
      m = U.mc(lg.text, [[String(t[2] - t[0]), '辺の長さをそのままひいてはいけない。2 乗どうしをひいてから √ をとる。'],
        [rt(t[2] * t[2] + t[0] * t[0]), t[2] + ' cm は斜辺（いちばん長い辺）。斜辺の 2 乗から、もう 1 辺の 2 乗を「ひく」。'],
        [String(lg.n), 'それは求める辺の 2 乗。最後に √ をとる。'],
        [String(t[2] + t[0]), '2 乗どうしをひいてから √ をとる。'],
        [String(t[1] + 1), '2 乗の計算を確かめよう。']]);
      qs.push(Object.assign(m, { q: '<p>斜辺が ' + t[2] + ' cm、ほかの 1 辺が ' + t[0] + ' cm の直角三角形。残りの辺の長さ（cm）は？</p>',
        explain: '<p>残りの辺を ' + V('x') + ' とすると ' + V('x') + '² + ' + t[0] + '² = ' + t[2] + '²。' + V('x') + '² = ' + t[2] * t[2] + ' − ' + t[0] * t[0] + ' = ' + lg.n + '、' + V('x') + ' &gt; 0 より ' + V('x') + ' = ' + lg.text + '。</p>' }));
      // 3. 正方形の面積
      m = U.mc(h.c2 + ' cm²', [[(a + b) ** 2 + ' cm²', '(' + V('a') + ' + ' + V('b') + ')² ではない。面積どうしをたす。'],
        [h.a2 * h.b2 + ' cm²', '面積をかけるのではなく、たす。'],
        [Math.abs(h.a2 - h.b2) === 0 ? h.c2 + 4 + ' cm²' : Math.abs(h.a2 - h.b2) + ' cm²', '斜辺の上の正方形は、2 つの面積の「和」。'],
        [2 * h.c2 + ' cm²', '2 つの正方形の面積をたすだけでいい。'],
        [h.text + ' cm²', 'それは斜辺の長さ。正方形の面積は ' + V('c') + '²。']]);
      qs.push(Object.assign(m, { q: '<p>直角三角形の、直角をはさむ 2 辺の上にかいた正方形の面積が ' + h.a2 + ' cm² と ' + h.b2 + ' cm²。斜辺の上にかいた正方形の面積は？</p>',
        explain: '<p>三平方の定理 ' + V('a') + '² + ' + V('b') + '² = ' + V('c') + '² は、正方形の面積の関係。' + h.a2 + ' + ' + h.b2 + ' = ' + h.c2 + '（cm²）。</p>' }));
      // 4. 直角三角形はどれ？
      const r = TRI[(i0 + 1) % TRI.length], tri = (p) => p[0] + ' cm、' + p[1] + ' cm、' + p[2] + ' cm';
      const why = (p) => p[0] + '² + ' + p[1] + '² = ' + (p[0] * p[0] + p[1] * p[1]) + ' で、' + p[2] + '² = ' + p[2] * p[2] + ' と等しくない。';
      const NOT = [[4, 5, 6], [5, 6, 8], [2, 3, 4], [6, 7, 9], [7, 10, 12]].filter((p) => !L.isRight(p[0], p[1], p[2]));
      m = U.mc(tri(r), NOT.slice(0, 3).map((p) => [tri(p), why(p)]));
      qs.push(Object.assign(m, { q: '<p>3 辺の長さが次のような三角形のうち、直角三角形はどれ？</p>',
        explain: '<p>いちばん長い辺を ' + V('c') + ' として、' + V('a') + '² + ' + V('b') + '² = ' + V('c') + '² が成り立てば直角三角形（三平方の定理の逆）。' + r[0] + '² + ' + r[1] + '² = ' + (r[0] * r[0] + r[1] * r[1]) + ' = ' + r[2] + '²。</p>' }));
      // 5. 正方形の対角線
      const n = a + 1, dg = rt(2 * n * n);
      m = U.mc(dg, [[String(2 * n), '対角線は 1 辺の 2 倍ではない。直角二等辺三角形の斜辺として求める。'],
        [String(n * n), 'それは正方形の面積。'], [String(2 * n * n), 'それは対角線の 2 乗。√ をとる。'], [rt(2 * n), n + '² + ' + n + '² を計算してから √ をとる。'], [rt(3 * n * n), n + '² + ' + n + '² = ' + 2 * n * n + '。']]);
      qs.push(Object.assign(m, { q: '<p>1 辺が ' + n + ' cm の正方形の対角線の長さ（cm）は？</p>',
        explain: '<p>対角線は、2 辺が ' + n + ' cm の直角二等辺三角形の斜辺。' + n + '² + ' + n + '² = ' + 2 * n * n + ' だから、√' + 2 * n * n + ' = ' + dg + '。（1 辺の √2 倍。）</p>' }));
      return qs;
    }
  });
})();
