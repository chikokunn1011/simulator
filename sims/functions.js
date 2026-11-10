/* 一次関数・二次関数 */
(function () {
  'use strict';
  const L = window.SimLib.functions;
  const U = window.SimApp.util;
  const { fmt, term, frac, MINUS } = U;

  // 数の見せ方：分数で書けて分母が小さければ分数、それ以外は小数（割り切れないときは ≒）
  function nf(v) {
    const fr = L.toFrac(v, 60);
    if (fr && fr[1] === 1) return { html: fmt(fr[0], 0), text: fmt(fr[0], 0), exact: true };
    if (fr && fr[1] <= 40) {
      const s = fr[0] < 0 ? MINUS : '';
      return { html: s + frac(Math.abs(fr[0]), fr[1]), text: s + Math.abs(fr[0]) + '/' + fr[1], exact: true };
    }
    const r = Number(v.toFixed(2));
    const ex = Math.abs(r - v) < 1e-9;
    return { html: (ex ? '' : '≒ ') + fmt(v, 2), text: (ex ? '' : '≒') + fmt(v, 2), exact: ex };
  }
  const coordH = (x, y) => '(' + nf(x).html + ', ' + nf(y).html + ')';
  const coordT = (x, y) => '(' + nf(x).text + ', ' + nf(y).text + ')';
  // 式（HTML）
  function linEq(a, b) {
    const s = term(a, '<i class="v">x</i>', true, 1) + term(b, '', !a, 1);
    return '<i class="v">y</i> = ' + (s || '0');
  }
  function quadEq(a, b, c) {
    const s = term(a, '<i class="v">x</i>²', true, 1) + term(b, '<i class="v">x</i>', !a, 1) + term(c, '', !a && !b, 1);
    return '<i class="v">y</i> = ' + (s || '0');
  }
  // 頂点の形 y = a(x − p)² + q
  function vertexEq(Q) {
    const pn = nf(Q.p), qn = nf(Q.q);
    const inner = Q.p === 0 ? '<i class="v">x</i>' : '(<i class="v">x</i> ' + (Q.p > 0 ? MINUS + ' ' + pn.html : '+ ' + nf(-Q.p).html) + ')';
    const aa = Q.a === 1 ? '' : Q.a === -1 ? MINUS : fmt(Q.a, 1);
    const qq = Q.q === 0 ? '' : Q.q > 0 ? ' + ' + qn.html : ' ' + MINUS + ' ' + nf(-Q.q).html;
    return '<i class="v">y</i> = ' + aa + inner + '²' + qq;
  }

  let plot, cv, S0;
  const isQuad = (s) => s.mode === 'quad';

  window.SimApp.register({
    id: 'functions',
    zoom: true,
    dragHint: '点（P・切片・頂点）を指で動かせる',
    intro:
      '<p><b>一次関数</b> <i class="v">y</i> = <i class="v">ax</i> + <i class="v">b</i> のグラフは直線、<b>二次関数</b> <i class="v">y</i> = <i class="v">ax</i>² + <i class="v">bx</i> + <i class="v">c</i> のグラフは放物線になる。</p>' +
      '<p>式の中の数（係数）を変えると、グラフはどう動く？ 傾き・切片・頂点・軸・<i class="v">x</i> 軸との交点が、式のどこに表れているかを見つけよう。</p>' +
      '<p class="hint">中学（中2 一次関数・中3 <i class="v">y</i> = <i class="v">ax</i>²）は「一次関数」と、二次関数で <i class="v">b</i> = <i class="v">c</i> = 0 のとき。高校（数学Ⅰ）は二次関数の全部。</p>',
    assumptions: [
      'グラフは <i class="v">x</i> と <i class="v">y</i> の目もり 1 の長さを同じにしてかいている（傾きの見た目がそのまま正しい）。',
      '分数で書ける値は分数で、割り切れない値は小数第2位までの近い値（≒）で出している。',
      '<i class="v">a</i> = 0 のとき、一次関数は <i class="v">x</i> 軸に平行な直線（定数）、二次関数の式は二次関数ではなくなる（一次関数になる）。'
    ],
    choices: [{ key: 'mode', label: '関数', options: [['lin', '一次関数 y = ax + b'], ['quad', '二次関数 y = ax² + bx + c']], value: 'lin' }],
    params: [
      { key: 'a', label: '<i class="v">a</i>', min: -5, max: 5, step: 0.1, value: 2, digits: 1,
        labelOf: (s) => isQuad(s) ? '<i class="v">a</i>（<i class="v">x</i>² の係数）' : '<i class="v">a</i>（傾き）' },
      { key: 'b', label: '<i class="v">b</i>', min: -10, max: 10, step: 0.1, value: 1, digits: 1,
        labelOf: (s) => isQuad(s) ? '<i class="v">b</i>（<i class="v">x</i> の係数）' : '<i class="v">b</i>（切片）' },
      { key: 'c', label: '<i class="v">c</i>（定数項）', min: -10, max: 10, step: 0.1, value: 0, digits: 1, show: isQuad },
      { key: 'x0', label: '点 P の <i class="v">x</i>', min: -10, max: 10, step: 0.1, value: 1, digits: 1 },
      { key: 'dx', label: '<i class="v">x</i> の増加量', min: 0.5, max: 6, step: 0.5, value: 2, digits: 1, show: (s) => s.rate }
    ],
    toggles: [
      { key: 'keys', label: '頂点・軸・交点', value: true },
      { key: 'rate', label: '変化の割合', value: false },
      { key: 'base', label: '基本のグラフ（y = x / y = x²）を重ねる', value: false },
      { key: 'grid', label: '方眼', value: true }
    ],
    presets: [
      { label: 'y = 2x + 1', values: { mode: 'lin', a: 2, b: 1 } },
      { label: 'y = −x + 3', values: { mode: 'lin', a: -1, b: 3 } },
      { label: 'y = 0.5x − 2', values: { mode: 'lin', a: 0.5, b: -2 } },
      { label: 'y = x²', values: { mode: 'quad', a: 1, b: 0, c: 0 } },
      { label: 'y = −2x²', values: { mode: 'quad', a: -2, b: 0, c: 0 } },
      { label: 'y = x² − 2x − 3', values: { mode: 'quad', a: 1, b: -2, c: -3 } },
      { label: 'y = x² + 4x + 4（重解）', values: { mode: 'quad', a: 1, b: 4, c: 4 } },
      { label: 'y = x² + 1（交点なし）', values: { mode: 'quad', a: 1, b: 0, c: 1 } }
    ],

    init(api) {
      S0 = api.S;
      cv = document.createElement('canvas');
      cv.setAttribute('role', 'img');
      api.stage.append(cv);
      plot = new window.SimPlot(cv, { xmin: -10, xmax: 10, ymin: -10, ymax: 10, equal: true, xlabel: 'x', ylabel: 'y' });
      api.plots.push(plot);
      // スマホの幅では少し拡大して始める（縮小ボタンで広く見られる）
      if (cv.clientWidth < 520) plot.setHome({ xmin: -7, xmax: 7, ymin: -7, ymax: 7 });
      // 指・マウスで直接さわる：
      //   ・点 P をつかむ → グラフにそって動かす（x 座標）
      //   ・切片（一次関数）をつかむ → 上下に動かして b を変える
      //   ・頂点（二次関数）をつかむ → 頂点ごと動かす（a はそのまま、b・c が変わる）
      //   ・ほかの所をドラッグ → 表示を動かす。2本指でひろげる・ちぢめる → 拡大・縮小
      //   ・タップ → その x に点 P を動かす
      cv.className = 'drag';
      const r10 = (v) => Math.round(v * 10) / 10;
      const pts = new Map();
      let drag = null, pinch = null;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      function grab(x, y, touch) {
        const R = touch ? 26 : 16, f = curF(S0), cand = [];
        cand.push(['p', plot.X(S0.x0), plot.Y(f(S0.x0))]);
        if (!S0.keys) { /* 切片・頂点をかいていないときはつかめない */ } else if (!isQuad(S0)) cand.push(['b', plot.X(0), plot.Y(S0.b)]);
        else { const Q = L.quadratic(S0.a, S0.b, S0.c); if (!Q.degenerate) cand.push(['v', plot.X(Q.p), plot.Y(Q.q)]); }
        let best = null, bd = R;
        cand.forEach((c) => { const d = Math.hypot(x - c[1], y - c[2]); if (d <= bd) { bd = d; best = c[0]; } });
        return best;
      }
      function moveTo(kind, x, y) {
        const wx = plot.wx(x), wy = plot.wy(y);
        if (kind === 'p') api.set('x0', r10(wx));
        else if (kind === 'b') api.set('b', r10(wy));
        else if (kind === 'v') {
          const p = r10(wx), q = r10(wy), a = S0.a;
          api.setMany({ b: r10(-2 * a * p), c: r10(a * p * p + q) });
        }
      }
      cv.addEventListener('pointerdown', (e) => {
        const [x, y] = pos(e);
        pts.set(e.pointerId, [x, y]);
        try { cv.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ }
        if (pts.size === 2) {   // 2本指：拡大・縮小
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 };
          drag = null; return;
        }
        const k = grab(x, y, e.pointerType === 'touch');
        drag = k ? { kind: k } : { kind: 'pan', x, y, x0: x, y0: y, moved: false };
        if (k) cv.style.cursor = 'grabbing';
      });
      cv.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) {   // マウスがのっているだけ：つかめる所でカーソルを変える
          if (e.pointerType === 'mouse') { const [x, y] = pos(e); cv.style.cursor = grab(x, y, false) ? 'grab' : 'move'; }
          return;
        }
        const [x, y] = pos(e);
        pts.set(e.pointerId, [x, y]);
        if (pinch && pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
          plot.zoom(pinch.d / d, plot.wx((a[0] + b[0]) / 2), plot.wy((a[1] + b[1]) / 2));
          pinch.d = d; api.redraw(); return;
        }
        if (!drag) return;
        if (drag.kind === 'pan') {
          if (Math.hypot(x - drag.x0, y - drag.y0) > 6) drag.moved = true;
          plot.pan(x - drag.x, y - drag.y); drag.x = x; drag.y = y; api.redraw();
        } else moveTo(drag.kind, x, y);
      });
      const end = (e) => {
        const was = drag;
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (pts.size === 0) {
          drag = null; cv.style.cursor = '';
          if (e.type === 'pointerup' && was && was.kind === 'pan' && !was.moved) { const [x] = pos(e); api.set('x0', r10(plot.wx(x))); }
        } else drag = null;
      };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      cv.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) return;   // ふつうのホイールはページのスクロール。Ctrl＋ホイールで拡大・縮小
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        plot.zoom(e.deltaY > 0 ? 1.15 : 0.87, plot.wx(e.clientX - r.left), plot.wy(e.clientY - r.top));
        api.redraw();
      }, { passive: false });
    },
    zoomBy(f) { plot.zoom(f); },
    resetView() { plot.resetView(); },

    draw(s) {
      const C = window.SimPlot.colors();
      plot.begin();
      plot.axes({ grid: s.grid });
      const quad = isQuad(s);
      const Q = quad ? L.quadratic(s.a, s.b, s.c) : null;
      const Li = quad ? null : L.linear(s.a, s.b);
      const f = quad ? Q.f : Li.f;
      // 基本のグラフ（点線）
      if (s.base) {
        plot.fn(quad ? (x) => x * x : (x) => x, { color: C.muted, width: 2, dash: [6, 6] });
        const R = plot.range;
        plot.label(quad ? 'y = x²' : 'y = x', quad ? Math.min(R.xmax * 0.6, 2.6) : R.xmax * 0.7, quad ? Math.min(R.xmax * 0.6, 2.6) ** 2 : R.xmax * 0.7, { color: C.muted, pos: 'w', size: 12 });
      }
      // 軸（二次）
      if (quad && !Q.degenerate && s.keys) {
        plot.vline(Q.p, { color: C.c4, width: 1.8, dash: [8, 5] });
        const R = plot.range;
        plot.label('軸 x = ' + nf(Q.p).text, Q.p, R.ymax - (R.ymax - R.ymin) * 0.06, { color: C.c4, pos: Q.p > (R.xmin + R.xmax) / 2 ? 'w' : 'e', size: 12, bold: true });
      }
      // 本体
      plot.fn(f, { color: C.c1, width: 3.2 });
      // 変化の割合（P から dx 進む）
      if (s.rate) {
        const x1 = s.x0, x2 = s.x0 + s.dx, y1 = f(x1), y2 = f(x2);
        plot.seg(x1, y1, x2, y1, { color: C.c2, width: 2.4 });
        plot.seg(x2, y1, x2, y2, { color: C.c3, width: 2.4 });
        if (quad) plot.seg(x1 - (x2 - x1) * 0.4, y1 - (y2 - y1) * 0.4, x2 + (x2 - x1) * 0.4, y2 + (y2 - y1) * 0.4, { color: C.c2, width: 1.8, dash: [3, 4] });
        plot.label('x の増加量 ' + fmt(s.dx, 1), (x1 + x2) / 2, y1, { color: C.c2, pos: y2 >= y1 ? 's' : 'n', size: 12, bold: true });
        plot.label('y の増加量 ' + fmt(y2 - y1, 2), x2, (y1 + y2) / 2, { color: C.c3, pos: 'e', size: 12, bold: true });
        plot.point(x2, y2, { color: C.c3, r: 4.5, shape: 'square' });
      }
      // 切片・交点・頂点
      if (s.keys) {
        if (!quad) {
          plot.point(0, Li.b, { color: C.c2, shape: 'diamond', grip: true, label: '切片 (0, ' + fmt(Li.b, 1) + ')', pos: s.a >= 0 ? 'nw' : 'ne' });
          if (typeof Li.xInt === 'number') plot.point(Li.xInt, 0, { color: C.c3, shape: 'square', label: '(' + nf(Li.xInt).text + ', 0)', pos: s.a >= 0 ? 'se' : 'sw' });
        } else if (!Q.degenerate) {
          plot.point(Q.p, Q.q, { color: C.c4, shape: 'diamond', r: 6, grip: true, label: '頂点 ' + coordT(Q.p, Q.q), pos: Q.a > 0 ? 's' : 'n' });
          Q.roots.forEach((r, i) => plot.point(r, 0, { color: C.c3, shape: 'square', label: Q.roots.length === 1 ? '接点 (' + nf(r).text + ', 0)' : '(' + nf(r).text + ', 0)', pos: i === 0 && Q.roots.length > 1 ? 'sw' : 'se' }));
          if (Q.p !== 0) plot.point(0, Q.c, { color: C.c2, r: 4, shape: 'ring' });
        }
      }
      // 点 P
      const y0 = f(s.x0);
      plot.point(s.x0, y0, { color: C.c2, r: 7, grip: true, label: 'P' + coordT(s.x0, y0), pos: (quad ? Q.a : s.a) >= 0 ? 'nw' : 'ne' });
      cv.setAttribute('aria-label', 'グラフ：' + (quad ? quadEq(s.a, s.b, s.c) : linEq(s.a, s.b)).replace(/<[^>]+>/g, '') + '。点P ' + coordT(s.x0, y0));
    },

    formula(s) {
      if (!isQuad(s)) {
        const sub = s.a === 0 ? '<span class="sub">a = 0 なので、x 軸に平行な直線（x がいくつでも y は同じ）</span>' : '';
        return linEq(s.a, s.b) + sub;
      }
      const Q = L.quadratic(s.a, s.b, s.c);
      if (Q.degenerate) return quadEq(s.a, s.b, s.c) + '<span class="sub">a = 0 なので二次関数ではない（' + linEq(s.b, s.c).replace(/<[^>]+>/g, '') + ' の直線になる）</span>';
      return quadEq(s.a, s.b, s.c) + '<span class="sub">' + vertexEq(Q) + '（頂点の形）</span>';
    },

    readouts(s) {
      const f = isQuad(s) ? L.quadratic(s.a, s.b, s.c).f : L.linear(s.a, s.b).f;
      const P = ['点 P', coordH(s.x0, f(s.x0))];
      if (!isQuad(s)) {
        const Li = L.linear(s.a, s.b);
        return [
          ['傾き（変化の割合）', fmt(s.a, 1)],
          ['切片', fmt(s.b, 1)],
          ['x 軸との交点', typeof Li.xInt === 'number' ? '(' + nf(Li.xInt).html + ', 0)' : Li.xInt === 'all' ? 'x 軸と重なる' : 'なし'],
          ['向き', s.a > 0 ? '右上がり' : s.a < 0 ? '右下がり' : '水平'],
          P
        ];
      }
      const Q = L.quadratic(s.a, s.b, s.c);
      if (Q.degenerate) return [['頂点', 'なし（直線）'], ['y 軸との交点', '(0, ' + fmt(s.c, 1) + ')'], P];
      const nR = Q.roots.length;
      return [
        ['頂点', coordH(Q.p, Q.q)],
        ['軸', 'x = ' + nf(Q.p).html],
        ['グラフの形', Q.a > 0 ? '下に凸（∪）' : '上に凸（∩）'],
        [Q.a > 0 ? '最小値' : '最大値', nf(Q.q).html + '（x = ' + nf(Q.p).html + '）'],
        ['判別式 D = b² − 4ac', fmt(Q.D, 2), Q.D > 0 ? '' : ''],
        ['x 軸との共有点', nR === 2 ? '2 個' : nR === 1 ? '1 個（接する）' : '0 個'],
        P
      ];
    },

    explain(s) {
      if (!isQuad(s)) return explainLin(s);
      const Q = L.quadratic(s.a, s.b, s.c);
      if (Q.degenerate) return '<p class="now">今は <i class="v">a</i> = 0 なので、式は ' + linEq(s.b, s.c) + ' という一次関数（直線）。二次関数の説明は <i class="v">a</i> を 0 以外にして見てね。</p>' + explainLinCore(s.b, s.c);
      return explainQuad(Q, s);
    },

    quiz(s) {
      return isQuad(s) ? quizQuad(s) : quizLin(s);
    }
  });

  function curF(s) { return isQuad(s) ? L.quadratic(s.a, s.b, s.c).f : L.linear(s.a, s.b).f; }

  // ---------- なぜ？（一次関数） ----------
  function explainLinCore(a, b) {
    const Li = L.linear(a, b);
    let h = '<h3>傾き ＝ 変化の割合</h3><p><i class="v">x</i> が 1 増えると、<i class="v">y</i> は <i class="v">a</i> だけ増える。だから、<i class="v">x</i> の増加量がいくつでも</p>' +
      '<span class="eq">変化の割合 = ' + frac('<i class="v">y</i> の増加量', '<i class="v">x</i> の増加量') + ' = <i class="v">a</i>（いつも同じ）</span>';
    h += '<p class="now">今の式では <i class="v">a</i> = ' + fmt(a, 1) + '。<i class="v">x</i> が 1 増えると <i class="v">y</i> は ' + fmt(a, 1) + '、<i class="v">x</i> が 3 増えると ' + fmt(3 * a, 1) + ' 増える。' +
      (a > 0 ? '<i class="v">a</i> &gt; 0 なので右上がり。' : a < 0 ? '<i class="v">a</i> &lt; 0 なので右下がり（増える量がマイナス＝減る）。' : '<i class="v">a</i> = 0 なので <i class="v">y</i> は変わらず、水平な直線。') + '</p>';
    h += '<h3>切片は「x = 0 のときの y」</h3><p><i class="v">x</i> = 0 を代入すると <i class="v">y</i> = <i class="v">a</i>×0 + <i class="v">b</i> = <i class="v">b</i>。だからグラフは点 (0, <i class="v">b</i>) を通る。<i class="v">b</i> を変えると、傾きはそのままでグラフが上下に平行移動する。</p>';
    h += '<h3>x 軸との交点は y = 0 とおいて解く</h3><p><i class="v">ax</i> + <i class="v">b</i> = 0 より <i class="v">x</i> = ' + frac(MINUS + '<i class="v">b</i>', '<i class="v">a</i>') + '（<i class="v">a</i> ≠ 0 のとき）。</p>';
    if (typeof Li.xInt === 'number') h += '<p class="now">今は ' + fmt(a, 1) + '<i class="v">x</i> ' + (b < 0 ? MINUS + ' ' + fmt(-b, 1) : '+ ' + fmt(b, 1)) + ' = 0 → <i class="v">x</i> = ' + nf(Li.xInt).html + '。</p>';
    else h += '<p class="now">今は <i class="v">a</i> = 0 なので ' + (Li.xInt === 'all' ? 'グラフは <i class="v">x</i> 軸そのもの。' : '<i class="v">x</i> 軸と交わらない。') + '</p>';
    return h;
  }
  function explainLin(s) {
    return explainLinCore(s.a, s.b) +
      '<h3>「変化の割合」で確かめよう</h3><p>「表示」の「変化の割合」をオンにして、点 P や <i class="v">x</i> の増加量を変えてみよう。赤い横線（<i class="v">x</i> の増加量）と緑のたて線（<i class="v">y</i> の増加量）の比は、どこでも <i class="v">a</i> になる。これが「グラフがまっすぐ」ということ。</p>';
  }

  // ---------- なぜ？（二次関数） ----------
  function explainQuad(Q, s) {
    const a = Q.a, b = Q.b, c = Q.c;
    let h = '<h3>平方完成で頂点がわかる</h3><p>式を <i class="v">y</i> = <i class="v">a</i>(<i class="v">x</i> − <i class="v">p</i>)² + <i class="v">q</i> の形に直すと、(<i class="v">x</i> − <i class="v">p</i>)² は 0 以上なので、<i class="v">x</i> = <i class="v">p</i> のときに <i class="v">y</i> = <i class="v">q</i> となる点が「いちばん下（または上）」＝<b>頂点</b>。</p>' +
      '<span class="eq"><i class="v">y</i> = <i class="v">a</i>(<i class="v">x</i> + ' + frac('<i class="v">b</i>', '2<i class="v">a</i>') + ')² ' + MINUS + ' ' + frac('<i class="v">b</i>² − 4<i class="v">ac</i>', '4<i class="v">a</i>') + '</span>';
    h += '<p class="now">今の式：' + quadEq(a, b, c) + '<br>→ ' + vertexEq(Q) + '<br>頂点 ' + coordH(Q.p, Q.q) + '、軸は直線 <i class="v">x</i> = ' + nf(Q.p).html + '</p>';
    h += '<h3>a の符号と大きさ</h3><p><i class="v">a</i> &gt; 0 なら下に凸（∪）で頂点が最小値、<i class="v">a</i> &lt; 0 なら上に凸（∩）で頂点が最大値。|<i class="v">a</i>| が大きいほど、グラフのはばはせまくなる。</p>' +
      '<p class="now"><i class="v">a</i> = ' + fmt(a, 1) + ' なので ' + (a > 0 ? '下に凸。最小値は ' + nf(Q.q).html + '（<i class="v">x</i> = ' + nf(Q.p).html + ' のとき）。' : '上に凸。最大値は ' + nf(Q.q).html + '（<i class="v">x</i> = ' + nf(Q.p).html + ' のとき）。') + '</p>';
    h += '<h3>x 軸との共有点と判別式</h3><p><i class="v">y</i> = 0 とおいた二次方程式 <i class="v">ax</i>² + <i class="v">bx</i> + <i class="v">c</i> = 0 の実数解が、<i class="v">x</i> 軸との共有点の <i class="v">x</i> 座標。解がいくつあるかは判別式 <i class="v">D</i> = <i class="v">b</i>² − 4<i class="v">ac</i> の符号で決まる。</p>' +
      '<div class="tbl"><table><tr><th>D の符号</th><th>D &gt; 0</th><th>D = 0</th><th>D &lt; 0</th></tr><tr><th>共有点</th><td>2 個</td><td>1 個（接する）</td><td>0 個</td></tr></table></div>';
    const D = Q.D;
    h += '<p class="now">今は <i class="v">D</i> = (' + fmt(b, 1) + ')² − 4×(' + fmt(a, 1) + ')×(' + fmt(c, 1) + ') = ' + fmt(D, 2) + '。' +
      (D > 0 ? '<i class="v">D</i> &gt; 0 なので共有点は 2 個：<i class="v">x</i> = ' + Q.roots.map((r) => nf(r).html).join('、') + '。' :
        D === 0 ? '<i class="v">D</i> = 0 なので <i class="v">x</i> 軸に接する（重解 <i class="v">x</i> = ' + nf(Q.p).html + '）。' :
          '<i class="v">D</i> &lt; 0 なので <i class="v">x</i> 軸と共有点をもたない。') + '</p>';
    h += '<p>頂点の <i class="v">y</i> 座標は <i class="v">q</i> = ' + frac(MINUS + '<i class="v">D</i>', '4<i class="v">a</i>') + '。だから「下に凸で頂点が <i class="v">x</i> 軸より下（<i class="v">q</i> &lt; 0）」のとき、ちょうど <i class="v">D</i> &gt; 0 になる。図で頂点の位置と共有点の数を見比べてみよう。</p>';
    if (b === 0 && c === 0) h += '<p class="hint">中3 の <i class="v">y</i> = <i class="v">ax</i>² は、この <i class="v">b</i> = <i class="v">c</i> = 0 の場合。頂点は原点、軸は <i class="v">y</i> 軸。</p>';
    h += '<h3>変化の割合は一定ではない</h3><p>二次関数では、<i class="v">x</i> が <i class="v">x</i>₁ から <i class="v">x</i>₂ まで増えるときの変化の割合は <i class="v">a</i>(<i class="v">x</i>₁ + <i class="v">x</i>₂) + <i class="v">b</i> になり、場所によって変わる。「変化の割合」をオンにして、点 P を動かして確かめよう。</p>';
    return h;
  }

  // ---------- 確認問題 ----------
  function quizLin(s0) {
    let a = s0.a, b = s0.b, note = '';
    if (a === 0) { a = 2; note = '<p class="hint">今は a = 0 なので、a = 2 で出題するね。</p>'; }
    const eq = linEq(a, b);
    const qs = [];
    // 1. 増加量
    let m = U.mc(fmt(3 * a, 1), [[fmt(a, 1), '<i class="v">a</i> は <i class="v">x</i> が 1 増えたときの増加量。3 増えたら 3 倍になる。'],
      [fmt(3 * a + b, 1), '切片 <i class="v">b</i> は増加量には入らない（<i class="v">x</i> = 0 のときの <i class="v">y</i> の値）。'],
      [fmt(3, 0), '<i class="v">x</i> の増加量と <i class="v">y</i> の増加量が同じになるのは <i class="v">a</i> = 1 のときだけ。'],
      [fmt(a + 3, 1), '足すのではなく、<i class="v">a</i> × 3 で求める。']]);
    qs.push(Object.assign(m, { q: note + '<p>' + eq + ' で、<i class="v">x</i> が 3 増えると <i class="v">y</i> はいくつ増える？</p>',
      explain: '<p>変化の割合（傾き）は <i class="v">a</i> = ' + fmt(a, 1) + '。<i class="v">y</i> の増加量 = <i class="v">a</i> × (<i class="v">x</i> の増加量) = ' + fmt(a, 1) + ' × 3 = ' + fmt(3 * a, 1) + '。</p>' }));
    // 2. x 軸との交点
    const xi = -b / a;
    m = U.mc('(' + nf(xi).html + ', 0)', [['(' + nf(b / a).html + ', 0)', '<i class="v">ax</i> + <i class="v">b</i> = 0 を解くと <i class="v">x</i> = −<i class="v">b</i>/<i class="v">a</i>。符号に気をつけよう。'],
      ['(0, ' + fmt(b, 1) + ')', 'それは <i class="v">y</i> 軸との交点（切片）。<i class="v">x</i> 軸との交点は <i class="v">y</i> = 0 とおく。'],
      ['(' + nf(-a / (b || 1)).html + ', 0)', '<i class="v">a</i> と <i class="v">b</i> が逆になっている。'],
      ['(' + nf(-b).html + ', 0)', '<i class="v">a</i> で割るのを忘れている。']]);
    qs.push(Object.assign(m, { q: '<p>' + eq + ' のグラフと <i class="v">x</i> 軸との交点は？</p>',
      explain: '<p><i class="v">y</i> = 0 とおくと ' + fmt(a, 1) + '<i class="v">x</i> ' + (b < 0 ? MINUS + ' ' + fmt(-b, 1) : '+ ' + fmt(b, 1)) + ' = 0 → <i class="v">x</i> = ' + nf(xi).html + '。</p>' }));
    // 3. b を変えると
    m = U.mc('上に 2 だけ平行移動する', [['右に 2 だけ平行移動する', '<i class="v">b</i> は <i class="v">y</i> 軸との交点。変わるのは上下の位置。'],
      ['傾きが急になる', '傾きは <i class="v">a</i> で決まる。<i class="v">b</i> を変えても傾きは同じ。'],
      ['下に 2 だけ平行移動する', '<i class="v">b</i> が大きくなると、<i class="v">y</i> の値がどこでも 2 ずつ大きくなる＝上へ。']]);
    qs.push(Object.assign(m, { q: '<p>' + eq + ' の <i class="v">b</i> だけを 2 大きくすると、グラフはどうなる？</p>',
      explain: '<p>どの <i class="v">x</i> でも <i class="v">y</i> の値が 2 ずつ大きくなるので、傾きはそのままで上に 2 平行移動する。「動かす」で <i class="v">b</i> を変えて確かめよう。</p>' }));
    // 4. 点を通るか
    const xp = Math.round(a) === a ? 2 : 1, yp = a * xp + b;
    m = U.mc('(' + xp + ', ' + nf(yp).html + ')', [['(' + xp + ', ' + nf(a * xp - b).html + ')', '<i class="v">b</i> の符号に気をつけて代入しよう。'],
      ['(' + nf(yp).html + ', ' + xp + ')', '<i class="v">x</i> 座標と <i class="v">y</i> 座標が逆。'],
      ['(' + xp + ', ' + nf(a + b + xp).html + ')', '<i class="v">a</i> × <i class="v">x</i> のかけ算をしよう。']]);
    qs.push(Object.assign(m, { q: '<p>' + eq + ' のグラフが通る点はどれ？</p>',
      explain: '<p><i class="v">x</i> = ' + xp + ' を代入すると <i class="v">y</i> = ' + fmt(a, 1) + ' × ' + xp + (b < 0 ? ' ' + MINUS + ' ' + fmt(-b, 1) : ' + ' + fmt(b, 1)) + ' = ' + nf(yp).html + '。</p>' }));
    return qs;
  }

  function quizQuad(s0) {
    let a = s0.a, b = s0.b, c = s0.c, note = '';
    if (a === 0) { a = 1; b = -2; c = -3; note = '<p class="hint">今は a = 0（二次関数ではない）なので、y = x² − 2x − 3 で出題するね。</p>'; }
    const Q = L.quadratic(a, b, c), eq = quadEq(a, b, c);
    const qs = [];
    // 1. 頂点
    let m = U.mc(coordH(Q.p, Q.q), [[coordH(-Q.p, Q.q), '平方完成すると (<i class="v">x</i> − <i class="v">p</i>)² の形。頂点の <i class="v">x</i> 座標は −<i class="v">b</i>/2<i class="v">a</i> で、符号が逆になりやすい。'],
      [coordH(Q.p, -Q.q), '頂点の <i class="v">y</i> 座標は、<i class="v">x</i> = <i class="v">p</i> を式に代入して求めよう。'],
      [coordH(Q.p, Q.c), '<i class="v">c</i> は <i class="v">y</i> 軸との交点の <i class="v">y</i> 座標。頂点とはちがう（<i class="v">b</i> = 0 のときだけ同じ）。'],
      [coordH(-Q.p, -Q.q), '頂点の形 <i class="v">a</i>(<i class="v">x</i> − <i class="v">p</i>)² + <i class="v">q</i> から読みとるときは、かっこの中の符号に注意。'],
      [coordH(Q.p + 1, Q.q), '頂点の <i class="v">x</i> 座標は −<i class="v">b</i>/2<i class="v">a</i>。平方完成して確かめよう。'],
      [coordH(Q.p, Q.q + 1), '頂点の <i class="v">y</i> 座標は、<i class="v">x</i> = <i class="v">p</i> を式に代入した値。'],
      [coordH(Q.p - 1, Q.q - 1), '平方完成して、<i class="v">a</i>(<i class="v">x</i> − <i class="v">p</i>)² + <i class="v">q</i> の形から読みとろう。']]);
    qs.push(Object.assign(m, { q: note + '<p>' + eq + ' のグラフの頂点は？</p>',
      explain: '<p>平方完成すると ' + vertexEq(Q) + '。だから頂点は ' + coordH(Q.p, Q.q) + '。</p>' }));
    // 2. 共有点の数
    const nR = Q.roots.length;
    const lab = ['0 個', '1 個', '2 個'];
    m = U.mc(lab[nR], lab.filter((x, i) => i !== nR).map((t) => [t, '判別式 <i class="v">D</i> = <i class="v">b</i>² − 4<i class="v">ac</i> を計算して、その符号で決まる。']).concat([['わからない（グラフをかかないと決まらない）', '計算だけで決まる。<i class="v">D</i> &gt; 0 で 2 個、<i class="v">D</i> = 0 で 1 個、<i class="v">D</i> &lt; 0 で 0 個。']]));
    qs.push(Object.assign(m, { q: '<p>' + eq + ' のグラフと <i class="v">x</i> 軸との共有点はいくつ？</p>',
      explain: '<p><i class="v">D</i> = (' + fmt(b, 1) + ')² − 4×(' + fmt(a, 1) + ')×(' + fmt(c, 1) + ') = ' + fmt(Q.D, 2) + '。' + (Q.D > 0 ? 'D &gt; 0 なので 2 個。' : Q.D === 0 ? 'D = 0 なので 1 個（接する）。' : 'D &lt; 0 なので 0 個。') + '</p>' }));
    // 3. 軸
    m = U.mc('直線 <i class="v">x</i> = ' + nf(Q.p).html, [['直線 <i class="v">x</i> = ' + nf(-Q.p).html, '軸は頂点を通る。頂点の <i class="v">x</i> 座標 −<i class="v">b</i>/2<i class="v">a</i> の符号を確かめよう。'],
      ['直線 <i class="v">y</i> = ' + nf(Q.p).html, '軸は <i class="v">y</i> 軸に平行な直線なので「<i class="v">x</i> = ○」の形。'],
      ['直線 <i class="v">x</i> = ' + nf(Q.q).html, 'それは頂点の <i class="v">y</i> 座標。'],
      ['直線 <i class="v">x</i> = ' + nf(Q.p + 1).html, '軸は頂点を通る。頂点の <i class="v">x</i> 座標 −<i class="v">b</i>/2<i class="v">a</i> を計算しよう。'],
      ['直線 <i class="v">y</i> = ' + nf(Q.q).html, '軸は <i class="v">y</i> 軸に平行な直線（<i class="v">x</i> = ○）。<i class="v">y</i> = ○ は横の直線。'],
      ['直線 <i class="v">x</i> = ' + nf(Q.p - 1).html, '軸は頂点を通る。頂点の <i class="v">x</i> 座標 −<i class="v">b</i>/2<i class="v">a</i> を計算しよう。']]);
    qs.push(Object.assign(m, { q: '<p>' + eq + ' のグラフの軸は？</p>',
      explain: '<p>軸は頂点を通り <i class="v">y</i> 軸に平行な直線。頂点の <i class="v">x</i> 座標が ' + nf(Q.p).html + ' なので、軸は直線 <i class="v">x</i> = ' + nf(Q.p).html + '。</p>' }));
    // 4. 最大・最小
    const ext = a > 0 ? '最小値' : '最大値', other = a > 0 ? '最大値' : '最小値';
    m = U.mc(ext + ' ' + nf(Q.q).html + '（<i class="v">x</i> = ' + nf(Q.p).html + ' のとき）', [
      [other + ' ' + nf(Q.q).html + '（<i class="v">x</i> = ' + nf(Q.p).html + ' のとき）', '<i class="v">a</i> ' + (a > 0 ? '&gt;' : '&lt;') + ' 0 なので' + (a > 0 ? '下に凸（∪）。頂点がいちばん下＝最小値。' : '上に凸（∩）。頂点がいちばん上＝最大値。')],
      [ext + ' ' + fmt(c, 1) + '（<i class="v">x</i> = 0 のとき）', '<i class="v">x</i> = 0 のときの値は <i class="v">y</i> 軸との交点。頂点のときがいちばん' + (a > 0 ? '小さい' : '大きい') + '。'],
      [ext + ' ' + nf(Q.p).html + '（<i class="v">x</i> = ' + nf(Q.q).html + ' のとき）', '<i class="v">x</i> 座標と <i class="v">y</i> 座標が逆。'],
      ['最大値も最小値もない', '<i class="v">x</i> がすべての実数のとき、放物線は頂点で' + (a > 0 ? 'いちばん下' : 'いちばん上') + 'になるので' + ext + 'はある（' + other + 'はない）。'],
      [ext + ' ' + nf(Q.q + 1).html + '（<i class="v">x</i> = ' + nf(Q.p).html + ' のとき）', '頂点の <i class="v">y</i> 座標を、<i class="v">x</i> = <i class="v">p</i> を代入して計算し直そう。']]);
    qs.push(Object.assign(m, { q: '<p>' + eq + ' について正しいのは？（<i class="v">x</i> はすべての実数）</p>',
      explain: '<p><i class="v">a</i> = ' + fmt(a, 1) + (a > 0 ? ' &gt; 0 なので下に凸。頂点で最小になる。' : ' &lt; 0 なので上に凸。頂点で最大になる。') + ext + 'は ' + nf(Q.q).html + '（<i class="v">x</i> = ' + nf(Q.p).html + ' のとき）。' + other + 'はない。</p>' }));
    // 5. c を変えると
    m = U.mc('上に 1 だけ平行移動する（頂点の y 座標が 1 増える）', [
      ['右に 1 だけ平行移動する', '<i class="v">c</i> を増やすと、どの <i class="v">x</i> でも <i class="v">y</i> が 1 増える＝上へ。左右に動くのは (<i class="v">x</i> − <i class="v">p</i>) の <i class="v">p</i> が変わるとき。'],
      ['グラフのはばがせまくなる', 'はばを決めるのは <i class="v">a</i>。'],
      ['頂点の x 座標が 1 増える', '頂点の <i class="v">x</i> 座標 −<i class="v">b</i>/2<i class="v">a</i> に <i class="v">c</i> は入っていない。']]);
    qs.push(Object.assign(m, { q: '<p>' + eq + ' の <i class="v">c</i> だけを 1 大きくすると、グラフはどうなる？</p>',
      explain: '<p><i class="v">c</i> が 1 増えると、どの <i class="v">x</i> でも <i class="v">y</i> の値が 1 増える。形はそのままで上に 1 平行移動し、頂点は ' + coordH(Q.p, Q.q) + ' → ' + coordH(Q.p, Q.q + 1) + ' になる。</p>' }));
    return qs;
  }
})();
