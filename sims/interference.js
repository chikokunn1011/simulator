/* 波の干渉（水面波・2 つの波源） */
(function () {
  'use strict';
  const L = window.SimLib.interference;
  const U = window.SimApp.util;
  const { fmt, frac, MINUS } = U;
  const T = 1;                          // 1 周期を 1 秒で表示
  const W = 24, H = 16;                 // 表示範囲の目安 [cm]

  const v = (t) => '<i class="v">' + t + '</i>';
  const lam = v('λ'), dI = v('d'), mI = v('m');
  const r1I = v('r') + '₁', r2I = v('r') + '₂';
  const absD = '|' + r1I + ' ' + MINUS + ' ' + r2I + '|';
  const half = '(' + mI + ' + ½)' + lam;
  const isOpp = (s) => s.phase === 'opp';
  // 強め合う条件・弱め合う条件の右辺（HTML / 文字）
  const condS = (s) => isOpp(s) ? half : mI + lam;
  const condW = (s) => isOpp(s) ? mI + lam : half;
  const cm = (x, dg) => fmt(x, dg == null ? 2 : dg) + ' cm';

  let S0, api0, cv, cvG, plot, gplot, off, offCtx, img = null, cache = { key: '' };
  // 色（register より前に用意する：register の中ですぐ draw が呼ばれるため）
  let colorProbe = null, lut = null, lutKey = '';
  const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

  window.SimApp.register({
    id: 'interference',
    dragHint: '点 P を指で動かせる',
    animated: true,
    speeds: [0.25, 0.5, 1, 2],
    intro:
      '<p>水面の 2 か所 S₁・S₂ を同じリズムでたたくと、そこから円形の波が広がり、重なり合う。すると、<b>大きくゆれる所</b>と<b>ほとんどゆれない所</b>が、きれいな線の形にならぶ。これが<b>波の干渉</b>。</p>' +
      '<p>どこが強め合い、どこが弱め合うのかは、2 つの波源からの距離の差＝<b>経路差</b> ' + absD + ' で決まる。観測点 P を動かして、経路差が波長 ' + lam + ' の何倍かを確かめよう。</p>' +
      '<p class="hint">高校物理（波の干渉）。図の明るい所が山、暗い所が谷。</p>',
    assumptions: [
      '波は進んでも小さくならない（減衰しない）としている。実際の水面波は、波源から遠いほど振幅が小さくなる。',
      '2 つの波源は同じ振幅・同じ振動数。各波の振幅を 1 として、合成波は最大 2、最小 0 になる。',
      '水そうのかべでの反射は考えない。波は十分前から出つづけていて、図全体に広がりきった後の様子をかいている。',
      '水面を真上から見た平面の模式図。色の明るさが水面の高さ（変位）を表す：明るい＝山、暗い＝谷。',
      '時間はゆっくりにして、1 周期を 1 秒で表示している（実際の水面波より遅くしている場合がある）。再生の速さを変えると、さらに遅く・速くなる。',
      '図は横 約 24 cm × 縦 約 16 cm（画面の形に合わせて少し広がる）。原点は S₁S₂ の中点。'
    ],
    choices: [
      { key: 'phase', label: '波源の位相', options: [['same', '同位相'], ['opp', '逆位相']], value: 'same' },
      { key: 'view', label: '図に表すもの', options: [['wave', '瞬間の波'], ['amp', '振幅（ゆれの大きさ）']], value: 'wave' }
    ],
    params: [
      { key: 'd', label: '波源の間かく ' + dI, min: 1, max: 10, step: 0.5, value: 4, unit: 'cm', digits: 1 },
      { key: 'lam', label: '波長 ' + lam, min: 0.5, max: 4, step: 0.1, value: 1.5, unit: 'cm', digits: 1 },
      { key: 'px', label: '観測点 P の ' + v('x'), min: -12, max: 12, step: 0.1, value: 1.8, unit: 'cm', digits: 1, note: '図の P をドラッグ・タップしても動かせる' },
      { key: 'py', label: '観測点 P の ' + v('y'), min: -8, max: 8, step: 0.1, value: 4, unit: 'cm', digits: 1, note: '原点は S₁S₂ の中点' }
    ],
    toggles: [
      { key: 'anti', label: '強め合う線（実線）', value: true },
      { key: 'node', label: '弱め合う線（破線）', value: true },
      { key: 'paths', label: 'P までの距離 r₁・r₂', value: true }
    ],
    presets: [
      { label: 'd = 4, λ = 1（同位相）', values: { d: 4, lam: 1, phase: 'same' } },
      { label: 'd = 4, λ = 2', values: { d: 4, lam: 2, phase: 'same' } },
      { label: 'd = 2, λ = 1.5', values: { d: 2, lam: 1.5, phase: 'same' } },
      { label: '逆位相（d = 4, λ = 1.5）', values: { d: 4, lam: 1.5, phase: 'opp' } },
      { label: 'd = 8, λ = 1（線が多い）', values: { d: 8, lam: 1, phase: 'same' } }
    ],

    init(api) {
      S0 = api.S; api0 = api;
      const st = api.stage;
      st.style.gridTemplateRows = 'minmax(0, 1fr) clamp(84px, 27%, 136px)';
      cv = document.createElement('canvas');
      cv.className = 'drag';
      cv.setAttribute('role', 'img');
      cvG = document.createElement('canvas');
      cvG.setAttribute('role', 'img');
      st.append(cv, cvG);
      plot = new window.SimPlot(cv, { xmin: -W / 2, xmax: W / 2, ymin: -H / 2, ymax: H / 2, equal: true, pad: { l: 0, r: 0, t: 0, b: 0 } });
      gplot = new window.SimPlot(cvG, { xmin: 0, xmax: 2 * T, ymin: -2.45, ymax: 2.45, pad: { l: 34, r: 12, t: 6, b: 6 }, grid: true });
      off = document.createElement('canvas');
      offCtx = off.getContext('2d');

      // P を動かす：P の近く（半径 24px）をつかむとドラッグ。ほかの所はタップ（クリック）でそこへ移動
      let drag = false, tap = null;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const moveP = (x, y) => {
        api.set('px', Math.round(U.clamp(plot.wx(x), -12, 12) * 10) / 10);
        api.set('py', Math.round(U.clamp(plot.wy(y), -8, 8) * 10) / 10);
      };
      cv.addEventListener('pointerdown', (e) => {
        const [x, y] = pos(e);
        if (Math.hypot(x - plot.X(S0.px), y - plot.Y(S0.py)) <= 24) { drag = true; tap = null; }
        else { drag = false; tap = [x, y]; }
        try { cv.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ }
      });
      cv.addEventListener('pointermove', (e) => {
        if (drag) { const [x, y] = pos(e); moveP(x, y); }
        else if (tap) { const [x, y] = pos(e); if (Math.hypot(x - tap[0], y - tap[1]) > 12) tap = null; }
      });
      cv.addEventListener('pointerup', (e) => {
        if (tap) { const [x, y] = pos(e); moveP(x, y); }
        drag = false; tap = null;
      });
      cv.addEventListener('pointercancel', () => { drag = false; tap = null; });
    },
    onQuality() { cache.key = ''; },
    resize() { cache.key = ''; },
    tick(dt, s) { s.t += dt; },
    resetTime(s) { s.t = 0; },

    draw(s) {
      drawField(s);
      drawGraph(s);
    },

    formula(s) {
      const J = pInfo(s);
      const head = '<span style="display:inline-block">強め合う：' + absD + ' = ' + condS(s) + '</span>　<span style="display:inline-block">弱め合う：' + absD + ' = ' + condW(s) + '</span>';
      const sub = '<span class="sub">' + (isOpp(s) ? '逆位相' : '同位相') + '（' + mI + ' = 0, 1, 2, …）　' +
        '<span class="sw"></span>強め合う線　<span class="sw dash"></span>弱め合う線　</span>' +
        '<span class="sub">P：' + absD + ' = |' + U.fix(J.D.r1, 2) + ' ' + MINUS + ' ' + U.fix(J.D.r2, 2) + '| ≒ ' + U.fix(J.D.diff, 2) + ' cm ≒ ' + fmt(J.J.q, 2) + lam + ' → <b>' + J.J.label + '</b></span>';
      return head + sub;
    },

    readouts(s) {
      const J = pInfo(s), Ls = L.lines(s.d, s.lam, s.phase);
      const jl = J.J.label + (J.J.m != null && J.J.kind !== 'mid' ? '（' + mI + ' = ' + J.J.m + '）' : '');
      const edge = (o) => o.edge ? '<br><small>＋波源の外側の直線</small>' : '';
      return [
        ['波源の間かく ' + dI, cm(s.d, 1)],
        ['波長 ' + lam, cm(s.lam, 1)],
        [r1I + '（S₁ から P）', cm(J.D.r1)],
        [r2I + '（S₂ から P）', cm(J.D.r2)],
        ['経路差 ' + absD, cm(J.D.diff)],
        ['経路差 ÷ ' + lam, fmt(J.J.q, 2) + ' 倍'],
        ['P の判定', jl, J.J.kind === 'strong' ? 'ok' : ''],
        ['P の合成波の振幅', '1 つの波の ' + fmt(J.A, 2) + ' 倍'],
        ['強め合う線（S₁S₂ 間）', Ls.strong.count + ' 本' + edge(Ls.strong)],
        ['弱め合う線（S₁S₂ 間）', Ls.weak.count + ' 本' + edge(Ls.weak)],
        ['時間 ' + v('t'), fmt(s.t, 2) + ' s<br><small>1 周期 = 1 s で表示</small>']
      ];
    },

    explain(s) { return explain(s); },
    quiz(s) { return quiz(s); }
  });

  function pInfo(s) {
    const D = L.dists(s.d, s.px, s.py);
    return { D, J: L.judge(D.diff, s.lam, s.phase), A: L.amplitude(D.signed, s.lam, s.phase) };
  }

  // ---------- 色 ----------
  function rgb(col) {
    if (!colorProbe) colorProbe = document.createElement('canvas').getContext('2d');
    colorProbe.fillStyle = '#808080'; colorProbe.fillStyle = col;
    const c = colorProbe.fillStyle;
    if (c[0] === '#') return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const m = c.match(/[\d.]+/g) || [128, 128, 128];
    return [+m[0], +m[1], +m[2]];
  }
  function mix(a, b, w) { return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]; }
  function pack(c) {
    return little
      ? ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0
      : ((Math.round(c[0]) << 24) | (Math.round(c[1]) << 16) | (Math.round(c[2]) << 8) | 255) >>> 0;
  }
  // 256 段の色：wave は変位 −2〜2（谷＝暗い寒色、山＝明るい暖色）、amp は振幅 0〜2（0＝暗い、2＝明るい）
  function luts() {
    const C = window.SimPlot.colors();
    const k = C.c1 + C.c2 + C.c3;
    if (lut && lutKey === k) return lut;
    const crest = mix(rgb(C.c2), [255, 255, 255], 0.5), trough = mix(rgb(C.c1), [0, 0, 0], 0.5);
    const ampT = mix(rgb(C.c1), [255, 255, 255], 0.35);
    const wave = new Uint32Array(256), amp = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const u = i / 255, z = u * 2 - 1;              // z：−1（谷）〜 1（山）
      const g = 128 + 112 * z, w = 0.6 * Math.pow(Math.abs(z), 0.8);
      wave[i] = pack(mix([g, g, g], z > 0 ? crest : trough, w));
      const ga = 22 + 222 * u;
      amp[i] = pack(mix([ga, ga, ga], ampT, 0.3 * Math.sin(Math.PI * u) + 0.15));
    }
    lutKey = k; lut = { wave, amp };
    return lut;
  }

  // ---------- 水面の図 ----------
  function drawField(s) {
    const C = window.SimPlot.colors();
    const c = plot.begin();
    const R = plot.range, B = plot.plotBox;
    // 格子（値が変わったときだけ前計算）
    const q = api0 ? api0.quality : 1;
    const need = 4 * (R.xmax - R.xmin) / s.lam;      // 1 波長に 4 マス以上
    const nx = Math.max(60, Math.round(U.clamp(Math.max(B.w / 2, need), 160, 240) * q));
    const ny = Math.max(20, Math.round(nx * B.h / B.w));
    const key = [s.d, s.lam, s.phase, nx, ny, R.xmin, R.xmax, R.ymin, R.ymax].join('|');
    if (cache.key !== key) {
      const dx = (R.xmax - R.xmin) / nx, dy = (R.ymax - R.ymin) / ny;
      cache = { key, G: L.grid(s.d, s.lam, s.phase, R.xmin, R.ymax, dx, dy, nx, ny) };
      off.width = nx; off.height = ny;
      img = offCtx.createImageData(nx, ny);
    }
    const G = cache.G, px = new Uint32Array(img.data.buffer), LT = luts(), N = nx * ny;
    if (s.view === 'amp') {
      const T8 = LT.amp, a = G.amp;
      for (let i = 0; i < N; i++) { let k = (a[i] * 127.5) | 0; if (k > 255) k = 255; px[i] = T8[k]; }
    } else {
      const ph = 2 * Math.PI * ((s.t / T) % 1), co = Math.cos(ph), si = Math.sin(ph);
      const T8 = LT.wave, A = G.ca, Bb = G.cb;
      for (let i = 0; i < N; i++) {
        let k = ((A[i] * co - Bb[i] * si) * 63.75 + 128) | 0;
        if (k < 0) k = 0; else if (k > 255) k = 255;
        px[i] = T8[k];
      }
    }
    offCtx.putImageData(img, 0, 0);
    c.save();
    c.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in c) c.imageSmoothingQuality = 'medium';
    c.drawImage(off, B.l, B.t, B.w, B.h);
    c.restore();

    // 強め合う線・弱め合う線
    const Ls = L.lines(s.d, s.lam, s.phase);
    const ymax = Math.max(Math.abs(R.ymin), Math.abs(R.ymax)) + 1;
    const many = Ls.strong.count + Ls.weak.count > 24;
    const lw = many ? 1.5 : 2.2;
    const labels = [];
    const drawSet = (set, dash, atTop) => {
      set.list.forEach((ln) => {
        const pts = L.hyperbola(s.d, ln.signed, ymax, 120);
        if (!pts) return;
        haloPath(pts, dash, lw, C);
        // ラベル：上（または下）の端で、図の中に入っている点
        const seq = atTop ? pts.slice().reverse() : pts;
        for (const p of seq) {
          const X = plot.X(p[0]), Y = plot.Y(p[1]);
          if (X > 14 && X < plot.w - 14 && Y > 12 && Y < plot.h - 12) { labels.push({ X, Y, t: 'm=' + ln.m, top: atTop }); break; }
        }
      });
      if (set.edge) {
        L.edgeRays(s.d, Math.max(Math.abs(R.xmin), Math.abs(R.xmax)) + 1).forEach((r) => haloPath(r, dash, lw, C));
        const X = plot.X(R.xmax) - 18, Y = plot.Y(0);
        labels.push({ X, Y: Y + (atTop ? -10 : 10), t: 'm=' + set.edgeM, top: !atTop, edge: true });
      }
    };
    if (s.anti) drawSet(Ls.strong, null, true);
    if (s.node) drawSet(Ls.weak, [8, 6], false);
    // 番号（近すぎるものはとばす）
    //   ものさし（左下）・時間（右下）の箱の所にもかかない
    const fsb = plot.w < 420 ? 11 : 12;
    const placed = [[0, plot.h - boxRows() * (fsb + 8) - 16, plot.w < 420 ? 150 : 190, plot.h], [plot.w - 110, plot.h - fsb - 16, plot.w, plot.h]];
    c.save(); c.font = '700 11.5px ' + C.fontEn;
    labels.forEach((lb) => {
      const w = c.measureText(lb.t).width + 6, y0 = lb.edge ? lb.Y - 8 : lb.top ? lb.Y : lb.Y - 16;
      const r = [lb.X - w / 2, y0, lb.X + w / 2, y0 + 16];
      if (placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) return;
      placed.push(r);
      plot.label(lb.t, lb.X, lb.Y, { px: true, pos: lb.edge ? 'c' : lb.top ? 's' : 'n', gap: 2, size: 11.5, bold: true, color: C.ink, en: true });
    });
    c.restore();

    // P までの距離
    const J = pInfo(s), so = L.sources(s.d);
    if (s.paths) {
      plot.seg(so.s1[0], so.s1[1], s.px, s.py, { color: C.paper, width: 4 });
      plot.seg(so.s2[0], so.s2[1], s.px, s.py, { color: C.paper, width: 4 });
      plot.seg(so.s1[0], so.s1[1], s.px, s.py, { color: C.c1, width: 2, dash: [2, 4] });
      plot.seg(so.s2[0], so.s2[1], s.px, s.py, { color: C.c2, width: 2, dash: [2, 4] });
      plot.label('r₁', (so.s1[0] + s.px) / 2, (so.s1[1] + s.py) / 2, { pos: 'w', color: C.c1, bold: true, size: 13, en: true });
      plot.label('r₂', (so.s2[0] + s.px) / 2, (so.s2[1] + s.py) / 2, { pos: 'e', color: C.c2, bold: true, size: 13, en: true });
    }
    // 波源
    plot.point(so.s1[0], 0, { color: C.ink, r: 5, shape: 'square', label: 'S₁', pos: 's' });
    plot.point(so.s2[0], 0, { color: C.ink, r: 5, shape: 'square', label: 'S₂', pos: 's' });
    // 観測点 P（大きめの白ぬき＋中心の点）
    plot.point(s.px, s.py, { color: C.ink, r: 9, shape: 'ring' });
    plot.point(s.px, s.py, { color: C.c3, r: 5, grip: true, label: 'P', pos: s.py > R.ymax - 2 ? 'se' : 'ne' });

    // ものさし（λ と 5 cm）と時間の表示
    scaleBar(s, C);
    cv.setAttribute('aria-label', '水面の干渉の図：波源 S₁・S₂ の間かく ' + fmt(s.d, 1) + ' cm、波長 ' + fmt(s.lam, 1) + ' cm、' + (isOpp(s) ? '逆位相' : '同位相') +
      '。強め合う線 ' + Ls.strong.count + ' 本、弱め合う線 ' + Ls.weak.count + ' 本。点 P の経路差は ' + fmt(J.D.diff, 2) + ' cm（' + fmt(J.J.q, 2) + ' 波長）で ' + J.J.label);
  }

  function haloPath(pts, dash, lw, C) {
    plot.path(pts, { color: C.paper, width: lw + 2.6 });
    plot.path(pts, { color: C.ink, width: lw, dash });
  }

  function scaleBar(s, C) {
    const c = plot.ctx, sx = plot.sx;
    const x0 = 10, yb = plot.h - 10;
    const lpx = s.lam * sx, fpx = 5 * sx;
    const fs = plot.w < 420 ? 11 : 12;
    c.save();
    c.font = '700 ' + fs + 'px ' + C.font;
    const t1 = 'λ = ' + fmt(s.lam, 1) + ' cm', t2 = '5 cm';
    const amp = s.view === 'amp';
    const g0 = amp ? '振幅 0' : '谷', g1 = amp ? '2（大）' : '山', gw = 54;
    const tg = c.measureText(g0).width + gw + c.measureText(g1).width + 12;
    const rows = boxRows(), five = rows === 3;
    const tw = Math.max(c.measureText(t1).width + lpx, five ? c.measureText(t2).width + fpx : 0, tg) + 18;
    c.globalAlpha = 0.86; c.fillStyle = C.paper;
    roundRect(c, x0 - 6, yb - rows * (fs + 8) - 4, tw + 4, rows * (fs + 8) + 8, 6); c.fill();
    // 色の見本（暗い〜明るい）
    const LT = luts(), yg = yb - (rows - 1) * (fs + 8) - fs / 2 - 1, gx = x0 + c.measureText(g0).width + 6;
    c.globalAlpha = 1;
    for (let i = 0; i < gw; i++) {
      const p = (amp ? LT.amp : LT.wave)[Math.round(i / (gw - 1) * 255)];
      c.fillStyle = little ? 'rgb(' + (p & 255) + ',' + ((p >>> 8) & 255) + ',' + ((p >>> 16) & 255) + ')' : 'rgb(' + (p >>> 24) + ',' + ((p >>> 16) & 255) + ',' + ((p >>> 8) & 255) + ')';
      c.fillRect(gx + i, yg - 6, 1, 12);
    }
    c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(g0, x0, yg); c.fillText(g1, gx + gw + 6, yg);
    c.globalAlpha = 1; c.strokeStyle = C.ink; c.fillStyle = C.ink; c.lineWidth = 2.5; c.lineCap = 'butt';
    const bar = (y, len, txt) => {
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + len, y);
      c.moveTo(x0, y - 4); c.lineTo(x0, y + 4); c.moveTo(x0 + len, y - 4); c.lineTo(x0 + len, y + 4); c.stroke();
      c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, x0 + len + 6, y);
    };
    if (five) bar(yb - fs - 8 - fs / 2, fpx, t2);
    bar(yb - fs / 2, lpx, t1);
    // 時間（右下）
    c.textAlign = 'right'; c.textBaseline = 'bottom';
    const tt = 't = ' + fmt(s.t, 2) + ' s' + (s.speed !== 1 ? '（×' + fmt(s.speed, 2) + '）' : '');
    const w2 = c.measureText(tt).width;
    c.globalAlpha = 0.86; c.fillStyle = C.paper; roundRect(c, plot.w - w2 - 16, plot.h - fs - 14, w2 + 10, fs + 8, 6); c.fill();
    c.globalAlpha = 1; c.fillStyle = C.ink; c.fillText(tt, plot.w - 11, plot.h - 9);
    c.restore();
  }
  // 左下の箱の行数（せまい画面では 5 cm のものさしを省く。λ のものさしで大きさがわかる）
  function boxRows() { return plot.w < 420 ? 2 : 3; }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ---------- P での時間変化のグラフ ----------
  function drawGraph(s) {
    const C = window.SimPlot.colors();
    gplot.begin();
    gplot.axes({ xlabel: 't [s]', ylabel: '', xstep: 0.5, ystep: 1, minPx: 30, origin: false });
    const f = (k) => (t) => L.waveAt(s.d, s.lam, s.phase, s.px, s.py, t, T)[k];
    gplot.fn(f('y1'), { color: C.c1, width: 1.6, dash: [6, 4] });
    gplot.fn(f('y2'), { color: C.c2, width: 1.8, dash: [2, 4] });
    gplot.fn(f('y'), { color: C.ink, width: 3 });
    // 今の時刻（2 周期ごとにくり返す）
    const tc = ((s.t % (2 * T)) + 2 * T) % (2 * T), now = L.waveAt(s.d, s.lam, s.phase, s.px, s.py, tc, T);
    gplot.vline(tc, { color: C.muted, width: 1.2 });
    gplot.point(tc, now.y1, { color: C.c1, r: 3, shape: 'ring' });
    gplot.point(tc, now.y2, { color: C.c2, r: 3, shape: 'ring' });
    gplot.point(tc, now.y, { color: C.ink, r: 4 });
    // 凡例（線の種類でも見分けられるように）
    const g = gplot.ctx, fs = gplot.w < 420 ? 10.5 : 12;
    g.save(); g.font = '700 ' + fs + 'px ' + C.font; g.textBaseline = 'middle'; g.textAlign = 'left';
    const nar = gplot.w < 520;
    const items = [[nar ? 'y₁' : 'y₁（S₁ から）', C.c1, [6, 4], 1.6], [nar ? 'y₂' : 'y₂（S₂ から）', C.c2, [2, 4], 1.8], ['合成 y = y₁ + y₂', C.ink, [], 3]];
    let lx = 42; const ly = fs / 2 + 4;
    const head = 'P の変位' + (nar ? '' : '（各波の振幅 = 1）') + '：';
    g.globalAlpha = 0.88; g.fillStyle = C.paper;
    const hw = g.measureText(head).width;
    const totalW = hw + 6 + items.reduce((a, it) => a + 24 + g.measureText(it[0]).width + 10, 0);
    g.fillRect(lx - 4, 1, Math.min(totalW + 4, gplot.w - lx), fs + 6); g.globalAlpha = 1;
    g.fillStyle = C.muted; g.fillText(head, lx, ly); lx += hw + 6;
    items.forEach(([t, col, dash, w]) => {
      g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 20, ly); g.stroke();
      g.setLineDash([]); g.fillStyle = C.ink; g.fillText(t, lx + 24, ly);
      lx += 24 + g.measureText(t).width + 10;
    });
    g.restore();
    cvG.setAttribute('aria-label', 'P での変位の時間変化のグラフ。合成波の振幅は ' + fmt(pInfo(s).A, 2));
  }

  // ---------- なぜ？ ----------
  function explain(s) {
    const J = pInfo(s), Ls = L.lines(s.d, s.lam, s.phase), opp = isOpp(s);
    const ph = opp ? '逆位相' : '同位相';
    let h = '<h3>重ね合わせの原理</h3><p>2 つの波が重なった所の変位は、それぞれの波の変位の<b>和</b>になる。</p>' +
      '<span class="eq">' + v('y') + ' = ' + v('y') + '₁ + ' + v('y') + '₂</span>' +
      '<p>山（＋）と山（＋）が重なれば高い山、谷と谷なら深い谷になる＝<b>強め合う</b>。山（＋）と谷（' + MINUS + '）が重なると打ち消し合う＝<b>弱め合う</b>。</p>';
    h += '<h3>経路差が λ の整数倍なら、山と山が重なる</h3><p>S₁ からの波は ' + r1I + '、S₂ からの波は ' + r2I + ' だけ進んで P に着く。波は 1 波長 ' + lam + ' 進むごとに同じ形をくり返すので、' +
      '進む距離の差（<b>経路差</b>）が ' + lam + ' の整数倍なら、2 つの波は P に「同じタイミングの所」がとどく。同位相の波源なら、山と山・谷と谷がいつも重なる。</p>' +
      '<p>経路差が ' + lam + ' の整数倍 + ½' + lam + '（半整数倍）なら、半波長ずれた所がとどくので、山と谷が重なって打ち消し合う。</p>' +
      '<div class="tbl"><table><tr><th></th><th>強め合う</th><th>弱め合う</th></tr>' +
      '<tr><th>同位相</th><td>' + absD + ' = ' + mI + lam + '</td><td>' + absD + ' = ' + half + '</td></tr>' +
      '<tr><th>逆位相</th><td>' + absD + ' = ' + half + '</td><td>' + absD + ' = ' + mI + lam + '</td></tr></table></div>' +
      '<p class="hint">' + mI + ' = 0, 1, 2, …。逆位相の波源は、はじめから半波長ずれた波を出しているので、条件が入れかわる。</p>';
    h += '<h3>式で書くと</h3><p>各波の振幅を 1、' + v('k') + ' = 2π/' + lam + '、位相のずれを ' + v('φ') + '（同位相 0、逆位相 π）とすると</p>' +
      '<span class="eq">' + v('y') + ' = sin(' + v('k') + r1I + ' ' + MINUS + ' ' + v('ωt') + ') + sin(' + v('k') + r2I + ' ' + MINUS + ' ' + v('ωt') + ' + ' + v('φ') + ')</span>' +
      '<span class="eq">= 2cos(' + frac('π(' + r1I + ' ' + MINUS + ' ' + r2I + ')', lam) + ' ' + MINUS + ' ' + frac(v('φ'), '2') + ') × sin(' + frac('π(' + r1I + ' + ' + r2I + ')', lam) + ' ' + MINUS + ' ' + v('ωt') + ' + ' + frac(v('φ'), '2') + ')</span>' +
      '<p class="hint">' + v('ω') + ' = 2π/' + v('T') + '。この図では ' + v('T') + ' = 1 s として表示している。</p>' +
      '<p>前の 2cos(…) の部分は時間によらない＝その場所の<b>振幅</b>。これが ±2 になる所が強め合い、0 になる所が弱め合い。「図に表すもの」を「振幅」にすると、この部分だけを見られる。</p>';
    h += '<p class="now">今の P：' + r1I + ' = ' + cm(J.D.r1) + '、' + r2I + ' = ' + cm(J.D.r2) + '<br>経路差 ' + absD + ' = ' + cm(J.D.diff) + ' = (' + fmt(J.D.diff, 2) + ' ÷ ' + fmt(s.lam, 1) + ')' + lam + ' = ' + fmt(J.J.q, 2) + lam + '<br>' +
      ph + 'なので → <b>' + J.J.label + '</b>。合成波の振幅は 1 つの波の ' + fmt(J.A, 2) + ' 倍。' +
      (J.J.near ? '<br><small>（条件からのずれが ' + lam + ' の 5% 以内なので「ほぼ」としている）</small>' : '') + '</p>';
    // 線の数
    const mS = opp ? mI + ' + ½' : mI, mW = opp ? mI : mI + ' + ½';
    const kl = (set) => set.list.filter((l) => l.k >= 0).map((l) => l.k === 0 ? '0' : fmt(l.k, 1) + lam).join('、');
    const listS = kl(Ls.strong), listW = kl(Ls.weak);
    h += '<h3>線の数の数え方</h3><p>S₁S₂ を結ぶ線分の上では、S₁ から S₂ へ動くと経路差 ' + r1I + ' ' + MINUS + ' ' + r2I + ' は ' + MINUS + dI + ' から ' + dI + ' まで変わる（三角形の 2 辺の差は 3 辺目より小さいので、どこでも |' + r1I + ' ' + MINUS + ' ' + r2I + '| ≦ ' + dI + '）。だから S₁S₂ の間を横切る線は、条件の値が ' + dI + ' より小さいものだけ：</p>' +
      '<span class="eq">強め合う：|' + mS + '|' + lam + ' &lt; ' + dI + '　　弱め合う：|' + mW + '|' + lam + ' &lt; ' + dI + '</span>' +
      '<p>' + mI + ' には負の数も入れて数える（S₁ 側と S₂ 側の両方にある）。S₁S₂ 上では、となり合う強め合う点どうしの間かくは ' + lam + '/2。</p>' +
      '<p class="now">' + dI + ' = ' + fmt(s.d, 1) + ' cm、' + lam + ' = ' + fmt(s.lam, 1) + ' cm なので ' + dI + '/' + lam + ' = ' + fmt(s.d / s.lam, 3) + '<br>' +
      '強め合う線：経路差 = ' + (listS || 'なし') + '（とその反対側）→ <b>' + Ls.strong.count + ' 本</b><br>' +
      '弱め合う線：経路差 = ' + (listW || 'なし') + '（とその反対側）→ <b>' + Ls.weak.count + ' 本</b>' +
      (Ls.strong.edge || Ls.weak.edge ? '<br>' + (Ls.strong.edge ? '強め合う' : '弱め合う') + '条件の 1 つがちょうど ' + dI + ' に等しい。経路差がちょうど ' + dI + ' になるのは、S₁S₂ を延ばした直線の波源の外側の部分なので、そこも' + (Ls.strong.edge ? '強め合う' : '弱め合う') + '（本数には入れていない）。' : '') + '</p>' +
      '<p>' + lam + ' を大きくするか ' + dI + ' を小さくすると線の数は減り、' + lam + ' を小さくするか ' + dI + ' を大きくすると増える。</p>';
    h += '<h3>実際の水面波とのちがい</h3><ul>' +
      '<li>実際の波は広がるにつれて小さくなる（円形波では振幅がおよそ 1/√' + v('r') + ' で小さくなる）。だから遠くでは、弱め合う線の上でも 2 つの波の大きさが少しちがい、完全には 0 にならない。</li>' +
      '<li>波面の写真では、波源の近くに山と谷の同心円が、遠くに強め合う線・弱め合う線が見える。この図は減衰を無視しているので、遠くまで同じ濃さでかいている。</li>' +
      '<li>実際の水波の振動数は 1 秒に 10 回以上のことが多い。ここでは見やすいように 1 周期を 1 秒でゆっくり表示している。</li></ul>';
    return h;
  }

  // ---------- 確認問題 ----------
  function quiz(s) {
    const d = s.d, lm = s.lam, ph = s.phase, opp = isOpp(s), phn = opp ? '逆位相' : '同位相';
    const qs = [];
    const head = '<p class="hint">今の設定：' + dI + ' = ' + fmt(d, 1) + ' cm、' + lam + ' = ' + fmt(lm, 1) + ' cm、' + phn + '</p>';
    const STR = '強め合う', WEAK = '弱め合う', MID = 'どちらでもない（中間）';

    // 1. 経路差から判定
    const ks = [2, 1.5, 1, 2.5, 0.5, 1.25].filter((k) => k * lm < d - 1e-9);
    const k = ks.length ? ks[Math.floor(Math.random() * ks.length)] : 0;
    const diff = L.tidy(k * lm), r2 = Math.max(5, Math.ceil(d) + 2), r1 = L.tidy(r2 + diff);
    const J = L.judge(diff, lm, ph);
    const ans = J.kind === 'strong' ? STR : J.kind === 'weak' ? WEAK : MID;
    const whyOf = {};
    whyOf[STR] = '強め合うのは、経路差が ' + (opp ? '(' + mI + ' + ½)' + lam + '（逆位相）' : mI + lam + '（同位相）') + ' のとき。経路差 ÷ ' + lam + ' を計算してみよう。';
    whyOf[WEAK] = '弱め合うのは、経路差が ' + (opp ? mI + lam + '（逆位相）' : '(' + mI + ' + ½)' + lam + '（同位相）') + ' のとき。経路差 ÷ ' + lam + ' を計算してみよう。';
    whyOf[MID] = '経路差 ÷ ' + lam + ' が整数か「整数 + ½」になっているので、強め合うか弱め合うかのどちらかになる。';
    let m = U.mc(ans, [STR, WEAK, MID].filter((x) => x !== ans).map((x) => [x, whyOf[x]]), 3);
    qs.push(Object.assign(m, {
      q: head + '<p>ある点 Q は、S₁ から ' + cm(r1) + '、S₂ から ' + cm(r2) + ' はなれている。Q では波はどうなる？</p>',
      explain: '<p>経路差 = ' + fmt(r1, 2) + ' ' + MINUS + ' ' + fmt(r2, 2) + ' = ' + fmt(diff, 2) + ' cm。これは ' + fmt(diff, 2) + ' ÷ ' + fmt(lm, 1) + ' = ' + fmt(J.q, 2) + ' 波長分。' +
        (J.kind === 'mid' ? '整数でも「整数 + ½」でもないので、強め合いと弱め合いの中間（振幅は 1 つの波の ' + fmt(L.amplitude(diff, lm, ph), 2) + ' 倍）。' :
          phn + 'なので <b>' + ans + '</b>（' + (J.kind === 'strong' ? '振幅は 2 倍' : '振幅は 0') + '）。') + '</p>'
    }));

    // 2. 弱め合う線の本数
    const Ls = L.lines(d, lm, ph), nW = Ls.weak.count, nS = Ls.strong.count;
    const wrongs = [[nS !== nW ? nS + ' 本' : null, 'それは強め合う線の本数。'], [nW + 1 + ' 本', '|条件| &lt; ' + dI + ' の不等号は「より小さい」。' + (Ls.weak.edge ? 'ちょうど ' + dI + ' になる条件は S₁S₂ の間を横切らない（波源の外側の直線）。' : '1 本ずつ書き出して数えてみよう。')],
      [nW > 0 ? nW - 1 + ' 本' : null, '両側（S₁ 側と S₂ 側）を数え忘れていないかな。'],
      [Math.floor(nW / 2) + ' 本', 'それは片側だけの本数。負の ' + mI + ' もふくめよう。'],
      [nW + 2 + ' 本', '1 本ずつ書き出して数えてみよう。']];
    m = U.mc(nW + ' 本', wrongs.filter((w) => w[0] != null && w[0] !== nW + ' 本'), 4);
    const condWt = opp ? '|' + mI + '|' + lam : '|' + mI + ' + ½|' + lam;
    const kw = Ls.weak.list.filter((l) => l.k >= 0).map((l) => l.k === 0 ? '0' : fmt(l.k, 1) + lam);
    qs.push(Object.assign(m, {
      q: head + '<p>S₁ と S₂ を結ぶ線分を横切る<b>弱め合う線（節線）</b>は何本？</p>',
      explain: '<p>' + phn + 'の弱め合う条件は ' + absD + ' = ' + (opp ? mI + lam : half) + '。S₁S₂ の間では |経路差| &lt; ' + dI + ' なので、' + condWt + ' &lt; ' + fmt(d, 1) + ' をみたす ' + mI + ' を数える。</p>' +
        '<p>' + (kw.length ? '経路差 = ' + kw.join('、') + ' が片側、反対側にも同じだけ' + (kw[0] === '0' ? '（0 は中央の 1 本だけ）' : '') + ' → <b>' + nW + ' 本</b>。' : 'ひとつもないので 0 本。') + '</p>'
    }));

    // 3. λ を大きくすると
    m = U.mc('減る', [['増える', '線の間かくはだいたい波長に比例する。' + lam + ' が大きいほど間かくが広がり、S₁S₂ 間に入る本数は減る。'],
      ['変わらない', '本数は |条件| &lt; ' + dI + ' で決まり、条件の値は ' + lam + ' に比例する。' + lam + ' が大きいと ' + dI + ' より小さいものが減る。'],
      ['波源の振幅しだい', '振幅は強め合い・弱め合いの場所（線の位置）には関係しない。']]);
    qs.push(Object.assign(m, {
      q: head + '<p>' + dI + ' はそのままで、波長 ' + lam + ' を大きくすると、強め合う線・弱め合う線の数はどうなる？</p>',
      explain: '<p>S₁S₂ を横切る線は、経路差の条件の値が ' + dI + ' より小さいもの。たとえば' + phn + 'の強め合う線は |' + (opp ? mI + ' + ½' : mI) + '|' + lam + ' &lt; ' + dI + ' → |' + (opp ? mI + ' + ½' : mI) + '| &lt; ' + dI + '/' + lam + '。' + lam + ' が大きいと ' + dI + '/' + lam + ' が小さくなり、本数が減る（今は ' + dI + '/' + lam + ' = ' + fmt(d / lm, 2) + '）。「動かす」で ' + lam + ' を変えて確かめよう。</p>'
    }));

    // 4. 逆位相の中央線
    m = U.mc('弱め合う（ほとんどゆれない）', [['強め合う（大きくゆれる）', 'それは同位相のとき。逆位相では、同時にとどいた波がいつも山と谷になる。'],
      ['時間によって強め合ったり弱め合ったりする', '振幅 2cos(…) の部分は時間によらない。中央線ではいつも弱め合う。'],
      ['中間（1 つの波と同じ振幅）', '経路差 0 は、逆位相の弱め合う条件 |' + v('r') + '₁ ' + MINUS + ' ' + v('r') + '₂| = ' + mI + lam + '（' + mI + ' = 0）にちょうど当てはまる。']]);
    qs.push(Object.assign(m, {
      q: '<p>2 つの波源を<b>逆位相</b>で振動させる。S₁S₂ の垂直二等分線（中央線）上の点はどうなる？</p>',
      explain: '<p>中央線上の点は S₁・S₂ から同じ距離（経路差 0）なので、2 つの波は出たときのずれのまま重なる。逆位相なら一方が山のとき他方は谷 → いつも打ち消し合い、<b>弱め合う線</b>になる。「波源の位相」を逆位相にして確かめよう。</p>'
    }));

    // 5. S₁S₂ 上のとなり合う強め合う点の間かく
    if (nS >= 2) {
      const ans5 = cm(lm / 2), wr = [[cm(lm), '線分上で S₂ 側へ ' + v('x') + ' 動くと、' + r1I + ' は ' + v('x') + ' 増え ' + r2I + ' は ' + v('x') + ' 減るので、経路差は 2' + v('x') + ' 変わる。'],
        [cm(2 * lm), '経路差は動いた距離の 2 倍変わる。経路差が ' + lam + ' 変わるのに必要な移動は ' + lam + '/2。'],
        [cm(lm / 4), 'それは強め合う点ととなりの弱め合う点の間かく。'],
        [cm(d / nS), '間かくは ' + dI + ' ではなく波長で決まる。']];
      m = U.mc(ans5, wr.filter((w) => w[0] !== ans5), 4);
      qs.push(Object.assign(m, {
        q: head + '<p>線分 S₁S₂ の上で、となり合う強め合う点（強め合う線が横切る点）どうしの間かくは？</p>',
        explain: '<p>線分上で S₂ に向かって ' + v('x') + ' 動くと、' + r1I + ' が ' + v('x') + ' 増え、' + r2I + ' が ' + v('x') + ' 減るので、経路差は 2' + v('x') + ' 変わる。となりの強め合う点へは経路差が ' + lam + ' 変わればよいから、2' + v('x') + ' = ' + lam + ' → ' + v('x') + ' = ' + lam + '/2 = ' + ans5 + '。（定常波の腹の間かくと同じ）</p>'
      }));
    }
    return qs;
  }
})();
