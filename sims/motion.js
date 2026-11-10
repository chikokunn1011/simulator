/* 等速直線運動・等加速度運動 */
(function () {
  'use strict';
  const L = window.SimLib.motion;
  const U = window.SimApp.util;
  const { fmt, frac, MINUS } = U;
  const SP = window.SimPlot;

  // ---------- 数・式の書き方 ----------
  const r2 = (v) => Math.round(v * 100) / 100;
  const n2 = (v) => fmt(v, 2);
  const par = (v, d) => (v < 0 ? '(' + fmt(v, d == null ? 2 : d) + ')' : fmt(v, d == null ? 2 : d));   // 代入するときの負の数はかっこ
  const approx = (v) => (Math.abs(v - r2(v)) > 1e-9 ? '≒ ' : '= ');
  const V = (s) => '<i class="v">' + s + '</i>';
  const HALF = frac('1', '2');
  const vt = V('v'), xt = V('x'), at = V('a'), tt = V('t'), v0 = V('v') + '₀';
  const UNIT = { x: 'm', v: 'm/s', a: 'm/s²', t: 's' };
  const nowT = (s) => Math.min(s.T, Math.max(0, r2(s.t)));   // 画面の数は 0.01 s に丸めた時刻で計算（式と答えがずれない）

  // 速さのようす
  const TREND = { rest: '止まったまま', const: '一定（変わらない）', faster: '速くなっている', slower: '遅くなっている', turn: 'この瞬間だけ v = 0' };

  // ---------- 図 ----------
  let cv, ctx, base, gp = {}, cache, cctx, cacheKey = '', themeN = 0, hatch = null, S0, API;
  let lay = null;   // 今の割りつけ（px）
  const GL = 42, GR = 44, SCRUB = 40;

  function trackH(s) {
    const ts = L.stopTime(s.v0, s.a);
    const rev = ts != null && ts < s.T;
    return s.strobe ? (rev ? 132 : 110) : 86;
  }

  // 値・大きさ・見た目が変わったときだけ：割りつけを決めて、背景（目もり・グラフの線）をかいてとっておく
  function rebuild(s) {
    const C = SP.colors();
    const W = base.w, H = base.h;
    const shown = ['x', 'v', 'a'].filter((k) => s['g' + k]);
    let th = trackH(s);
    if (!shown.length) th = Math.max(th, H - SCRUB);
    const gTop = th, gBot = H - SCRUB;
    const gh = shown.length ? (gBot - gTop) / shown.length : 0;
    // 時間の軸（3 つのグラフと下の時刻バーで共通）
    const Bl = 6, Bw = Math.max(40, W - 16);
    const ps = Math.max(1e-6, (Bw - GL - GR) / s.T);
    const txmin = -GL / ps, txmax = s.T + GR / ps;
    const tX = (t) => Bl + (t - txmin) * ps;
    // 線路（位置 x の目もり）
    const R = L.range(s.v0, s.a, s.T);
    const span0 = Math.max(R.max - R.min, 1e-9);
    const pr = L.pad(R.min, R.max, 0.04, 0.04, 1);
    const tl = 34, tr = W - 34;
    const mX = (x) => tl + (x - pr.min) / (pr.max - pr.min) * (tr - tl);
    const top = shown.length ? 0 : Math.max(0, (H - SCRUB - trackH(s)) / 2);
    lay = { W, H, th, top, gy: top + 64, shown, gh, gTop, gBot, tX, ps, txmin, txmax, mX, pr, span0, scrubY: H - 12 };

    base.begin();
    const c = ctx;
    // ---- 線路 ----
    const gy = lay.gy;
    c.save();
    c.strokeStyle = C.ink; c.lineWidth = 2;
    c.beginPath(); c.moveTo(8, gy + 0.5); c.lineTo(W - 8, gy + 0.5); c.stroke();
    const step = SP.niceStep(pr.max - pr.min, tr - tl, W < 420 ? 48 : 60);
    const fs = W < 420 ? 11 : 12;
    c.font = fs + 'px ' + C.fontEn; c.textAlign = 'center'; c.textBaseline = 'top';
    for (let x = Math.ceil(pr.min / step) * step; x <= pr.max + 1e-9; x += step) {
      const px = Math.round(mX(x)) + 0.5;
      const zero = Math.abs(x) < step / 2;
      c.fillStyle = zero ? C.ink : C.muted;
      c.fillRect(px - 0.5, gy, 1, zero ? 9 : 5);
      if (px > W - 44) continue;
      c.font = (zero ? '700 ' : '') + fs + 'px ' + C.fontEn;
      c.fillText(SP.tickLabel(zero ? 0 : x, step), px, gy + 7);
    }
    c.fillStyle = C.ink; c.font = '600 ' + (fs + 1) + 'px ' + C.font; c.textAlign = 'right';
    c.fillText('x [m]', W - 6, gy + 6);
    c.restore();
    // 0 の位置（スタート）
    c.save(); c.strokeStyle = C.muted; c.setLineDash([3, 3]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(Math.round(mX(0)) + 0.5, top + 36); c.lineTo(Math.round(mX(0)) + 0.5, gy); c.stroke(); c.restore();

    // ---- グラフ（背景・全体の線をうすく）----
    const ts = L.stopTime(s.v0, s.a);
    shown.forEach((k, i) => {
      const p = gp[k];
      const y0 = gTop + i * gh, y1 = y0 + gh;
      p.o.pad = { l: Bl, r: W - Bl - Bw, t: y0 + 4, b: H - y1 + 4 };
      let yr;
      if (k === 'x') yr = L.pad(R.min, R.max, 0.12, 0.32, 1);
      else if (k === 'v') { const vr = L.vRange(s.v0, s.a, s.T); yr = L.pad(vr.min, vr.max, 0.12, 0.32, 1); }
      else yr = L.pad(Math.min(0, s.a), Math.max(0, s.a), 0.2, 0.4, 2);
      p.setHome({ xmin: txmin, xmax: txmax, ymin: yr.min, ymax: yr.max });
      // 区切り線
      c.save(); c.fillStyle = C.rule; c.fillRect(8, Math.round(y0), W - 16, 1); c.restore();
      p.axes({ xlabel: 't [s]', ylabel: k === 'x' ? 'x [m]' : k === 'v' ? 'v [m/s]' : 'a [m/s²]', minPx: W < 420 ? 40 : 46 });
      const fine = { color: C.muted, width: 1.6, dash: [5, 5], x0: 0, x1: s.T };
      if (k === 'x') p.fn((t) => L.pos(s.v0, s.a, t), fine);
      else if (k === 'v') p.seg(0, s.v0, s.T, L.vel(s.v0, s.a, s.T), fine);
      else { p.seg(0, s.a, s.T, s.a, fine); p.label('a = ' + fmt(s.a, 1) + ' m/s²（一定）', p.X(s.T * 0.5), p.Y(s.a), { px: true, pos: s.a >= 0 ? 'n' : 's', size: 11, color: C.c2, gap: 5 }); }
      // 止まる時刻 t*
      if (ts != null && ts <= s.T) {
        if (k === 'v') p.point(ts, 0, { color: C.ink, r: 4, shape: 'ring', label: '止まる', pos: s.a < 0 ? 'ne' : 'se', bold: false });
        if (k === 'x') p.point(ts, L.pos(s.v0, s.a, ts), { color: C.ink, r: 3.5, shape: 'ring', label: '向きが変わる', pos: s.a < 0 ? 'n' : 's', bold: false });
      }
    });
    // ---- 時刻バー（下）----
    c.save();
    c.fillStyle = C.rule; c.fillRect(8, Math.round(H - SCRUB), W - 16, 1);
    const yb = lay.scrubY;
    c.strokeStyle = C.rule; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(tX(0), yb); c.lineTo(tX(s.T), yb); c.stroke();
    c.fillStyle = C.muted; c.font = '700 ' + fs + 'px ' + C.font; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('時刻', 8, yb);
    c.font = fs + 'px ' + C.fontEn; c.textAlign = 'left';
    c.fillText(fmt(s.T, 0) + ' s', tX(s.T) + 9, yb);
    c.restore();

    // とっておく
    if (cache.width !== cv.width || cache.height !== cv.height) { cache.width = cv.width; cache.height = cv.height; }
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, cache.width, cache.height);
    cctx.drawImage(cv, 0, 0);
  }

  function hatchPattern(color) {
    const p = document.createElement('canvas'); p.width = p.height = 8;
    const g = p.getContext('2d');
    g.strokeStyle = color; g.lineWidth = 1.6; g.globalAlpha = 0.75;
    g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
    return ctx.createPattern(p, 'repeat');
  }

  function pxArrow(c, x0, y, x1, color, dash, width) {
    const L0 = x1 - x0; if (Math.abs(L0) < 2) return;
    const dir = Math.sign(L0), h = Math.min(10, Math.abs(L0) * 0.6);
    c.save(); c.strokeStyle = c.fillStyle = color; c.lineWidth = width || 3; c.setLineDash(dash || []);
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x1 - dir * h * 0.7, y); c.stroke();
    c.setLineDash([]); c.beginPath(); c.moveTo(x1, y); c.lineTo(x1 - dir * h, y - h * 0.45); c.lineTo(x1 - dir * h, y + h * 0.45); c.closePath(); c.fill();
    c.restore();
  }
  function text(c, str, x, y, opt) {
    const C = SP.colors();
    opt = Object.assign({ color: C.ink, size: 12, bold: true, align: 'center', base: 'middle', en: false }, opt || {});
    c.save();
    c.font = (opt.bold ? '700 ' : '500 ') + opt.size + 'px ' + (opt.en ? C.fontEn : C.font);
    c.textAlign = opt.align; c.textBaseline = opt.base;
    const w = c.measureText(str).width;
    const lx = opt.align === 'left' ? x : opt.align === 'right' ? x - w : x - w / 2;
    if (lx < 2) x += 2 - lx; if (lx + w > lay.W - 2) x -= lx + w - (lay.W - 2);
    c.lineWidth = 4; c.strokeStyle = C.paper; c.lineJoin = 'round'; c.strokeText(str, x, y);
    c.fillStyle = opt.color; c.fillText(str, x, y);
    c.restore();
  }

  function draw(s) {
    if (s.t > s.T) s.t = s.T;
    if (s.t < 0) s.t = 0;
    base.size();
    const key = [base.w, base.h, base.dpr, s.v0, s.a, s.T, s.gx, s.gv, s.ga, s.strobe, themeN].join('|');
    if (key !== cacheKey || !lay) {
      Object.keys(gp).forEach((k) => gp[k].size());
      rebuild(s); cacheKey = key; hatch = null;
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(cache, 0, 0);
      ctx.setTransform(base.dpr, 0, 0, base.dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
    const C = SP.colors(), c = ctx, t = s.t, T = s.T;
    const x = L.pos(s.v0, s.a, t), v = L.vel(s.v0, s.a, t);
    const ts = L.stopTime(s.v0, s.a);
    const { mX, gy, top, W } = lay;

    // ---- ストロボ（1 秒ごとの位置）----
    if (s.strobe) {
      const pts = L.strobe(s.v0, s.a, t);
      let last1 = -1e9, last2 = -1e9;
      pts.forEach((p) => {
        const second = ts != null && p.t > ts + 1e-9;
        const X = mX(p.x), Y = second ? gy + 48 : gy + 26;
        c.save(); c.beginPath(); c.arc(X, Y, 3.6, 0, Math.PI * 2);
        c.lineWidth = 1.8; c.strokeStyle = C.ink; c.fillStyle = second ? C.paper : C.ink; c.fill(); c.stroke(); c.restore();
        const lastX = second ? last2 : last1;
        if (Math.abs(X - lastX) >= 17) {
          text(c, fmt(p.t, 0), X, Y + 12, { size: 10, bold: false, color: C.muted, en: true });
          if (second) last2 = X; else last1 = X;
        }
      });
    }

    // ---- 物体（台車）----
    const X = mX(x);
    const bw = W < 420 ? 30 : 36, bh = 15;
    c.save();
    c.fillStyle = C.c3; c.strokeStyle = C.ink; c.lineWidth = 1.6;
    roundRect(c, X - bw / 2, top + 40, bw, bh, 4); c.fill(); c.stroke();
    c.fillStyle = C.ink;
    [-bw / 2 + 7, bw / 2 - 7].forEach((dx) => { c.beginPath(); c.arc(X + dx, top + 59, 4.2, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = C.paper; c.beginPath(); c.arc(X, top + 47.5, 2.4, 0, Math.PI * 2); c.fill();
    c.restore();

    // ---- 速度・加速度の矢印 ----
    if (s.vec) {
      const vmax = Math.max(Math.abs(s.v0), Math.abs(L.vel(s.v0, s.a, T)));
      const kv = vmax > 0 ? Math.min(130, W * 0.26) / vmax : 0;
      const ka = Math.min(80, W * 0.17) / 5;
      const vy = top + 13, ay = top + 30;
      // 矢印は物体から出す。画面の外にはみ出すときだけ、長さはそのままで内側へずらす
      const fit = (x0, len) => { const lo = 4, hi = W - 18; let sh = 0; const tip = x0 + len; if (tip > hi) sh = hi - tip; if (tip < lo + 14) sh = lo + 14 - tip; return x0 + sh; };
      if (Math.abs(v) * kv >= 3) {
        const x0 = fit(X, v * kv);
        pxArrow(c, x0, vy, x0 + v * kv, C.c1, null, 3.2);
        text(c, 'v', x0 + v * kv + Math.sign(v) * 9, vy, { color: C.c1, size: 13, en: true });
      } else text(c, 'v = 0', X + 4, vy, { color: C.c1, size: 11, align: 'left', en: true });
      if (s.a !== 0) {
        const x0 = fit(X, s.a * ka);
        pxArrow(c, x0, ay, x0 + s.a * ka, C.c2, [5, 4], 2.6);
        text(c, 'a', x0 + s.a * ka + Math.sign(s.a) * 9, ay, { color: C.c2, size: 13, en: true });
      } else text(c, 'a = 0', X + 4, ay, { color: C.c2, size: 11, align: 'left', en: true });
    }

    // ---- グラフ ----
    lay.shown.forEach((k) => {
      const p = gp[k];
      if (k === 'v' && s.area && t > 0) {
        if (!hatch) hatch = hatchPattern(C.c4);
        const v1 = v;
        const parts = [];
        if (ts != null && ts < t) { parts.push([[0, 0], [0, s.v0], [ts, 0]]); parts.push([[ts, 0], [t, v1], [t, 0]]); }
        else parts.push([[0, 0], [0, s.v0], [t, v1], [t, 0]]);
        parts.forEach((poly) => {
          const sgn = poly.reduce((m, q) => (Math.abs(q[1]) > Math.abs(m) ? q[1] : m), 0);
          if (sgn === 0) return;
          c.save();
          if (sgn > 0) { c.globalAlpha = 0.22; p.path(poly, { fill: C.c1, color: null, width: 0, close: true }); }
          else p.path(poly, { fill: hatch, color: C.c4, width: 1, close: true });
          c.restore();
          // 面積の値（符号つき）
          const tA = poly[0][0], tB = poly[poly.length - 1][0];
          const area = tB === tA ? 0 : (k === 'v' ? L.pos(s.v0, s.a, tB) - L.pos(s.v0, s.a, tA) : 0);
          const cxp = p.X((tA + tB) / 2), cyp = p.Y(sgn / 3);
          if (Math.abs(p.X(tB) - p.X(tA)) > 54 && Math.abs(p.Y(sgn) - p.Y(0)) > 16) {
            text(c, (area > 0 ? '+' : '') + fmt(r2(area), 1) + ' m', cxp, cyp, { size: 11, color: sgn > 0 ? C.c1 : C.c4, en: true });
          }
        });
      }
      // ここまでの線（太く）
      if (k === 'x') p.fn((u) => L.pos(s.v0, s.a, u), { color: C.c3, width: 3, x0: 0, x1: t });
      else if (k === 'v') p.seg(0, s.v0, t, v, { color: C.c1, width: 3 });
      else p.seg(0, s.a, t, s.a, { color: C.c2, width: 3 });
      // 今の時刻
      p.vline(t, { color: C.muted, width: 1.3, dash: [3, 4] });
      if (k === 'x') {
        if (s.tan) {
          const dt = 34 / p.sx;
          p.seg(t - dt, x - v * dt, t + dt, x + v * dt, { color: C.c1, width: 2.4 });
          const right = t < T * 0.62;
          text(c, '傾き = v', p.X(right ? t + dt : t - dt) + (right ? 4 : -4), p.Y(right ? x + v * dt : x - v * dt), { size: 11, color: C.c1, align: right ? 'left' : 'right', base: (v >= 0) === right ? 'bottom' : 'top' });
        }
        p.point(t, x, { color: C.c3, r: 5 });
      } else if (k === 'v') p.point(t, v, { color: C.c1, r: 4.5, shape: 'square' });
      else p.point(t, s.a, { color: C.c2, r: 4.5, shape: 'diamond' });
    });

    // ---- 時刻バーのつまみ ----
    const kx = lay.tX(t), yb = lay.scrubY;
    c.save();
    c.strokeStyle = C.accent; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(lay.tX(0), yb); c.lineTo(kx, yb); c.stroke();
    c.fillStyle = C.accent; c.strokeStyle = C.paper; c.lineWidth = 2.5;
    c.beginPath(); c.arc(kx, yb, 8.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
    text(c, 't = ' + U.fix(t, 2) + ' s', kx, yb - 17, { size: 12, en: true, color: C.ink });
    if (!s.playing && kx < W * 0.6 && W > 360) text(c, '← ドラッグで時刻を動かせる →', lay.tX(T), yb - 17, { size: 11, bold: false, color: C.muted, align: 'right' });

    cv.setAttribute('aria-label', '時刻 ' + U.fix(t, 2) + ' 秒、位置 ' + fmt(x, 2) + ' メートル、速度 ' + fmt(v, 2) + ' メートル毎秒、加速度 ' + fmt(s.a, 1) + ' メートル毎秒毎秒。左右の矢印キーで時刻を動かせる。');
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }

  // 時刻を動かす（params ではなく S.t を直接）
  function setT(t, done) {
    S0.t = Math.min(S0.T, Math.max(0, t));
    if (done) API.changed(); else API.redraw();
  }

  window.SimApp.register({
    id: 'motion',
    dragHint: 'グラフを横になぞると時間が動く',
    animated: true,
    intro:
      '<p>一直線の上を走る物体（台車）の動きを調べよう。<b>等速直線運動</b>は速さも向きも変わらない運動、<b>等加速度直線運動</b>は速度が 1 秒あたり同じだけ変わる運動だよ。</p>' +
      '<p>初速度 ' + v0 + ' と加速度 ' + at + ' を決めて「再生」すると、物体と <b>x-t グラフ</b>（位置）・<b>v-t グラフ</b>（速度）・<b>a-t グラフ</b>（加速度）がいっしょに進む。1 秒ごとの位置を点で残す「ストロボ」は、記録タイマーやストロボ写真と同じ見方ができる。</p>' +
      '<p>止めているときは、いちばん下の「時刻」のつまみやグラフを横にドラッグすると、好きな時刻にできる。</p>' +
      '<p class="hint">中3 の「運動のようす（記録タイマー・ストロボ写真）」から、高校 物理基礎の「等加速度直線運動の 3 つの式」まで。</p>',
    assumptions: [
      '摩擦や空気の抵抗はない。加速度 ' + at + ' は最初から最後までずっと同じ（一定）。',
      'ブレーキのように止まる例でも、止まったあとも同じ ' + at + ' が続くモデルにしている（だから逆向きに動き出す）。本物の車は止まったら止まったまま。',
      '物体は大きさのない点とみなし、台車の中心の位置を ' + xt + ' とする。図の台車の大きさは見やすさのためで、目もりとは関係ない。',
      '出発点を ' + xt + ' = 0、右向きを正（＋）とする。速度・加速度は向きを符号で表す（負なら左向き）。',
      '矢印の長さは ' + vt + '・' + at + ' の大きさに比例するが、' + vt + ' と ' + at + ' で倍率がちがう（長さどうしをくらべられるのは同じ種類の矢印だけ）。',
      '再生の速さ ×1 が実際の時間と同じ速さ。×0.25・×0.5 はスロー、×2 は早送り。位置と速度は毎回、式から計算している。'
    ],
    params: [
      { key: 'v0', label: '初速度 ' + v0, min: -10, max: 20, step: 0.5, value: 2, unit: 'm/s', digits: 1 },
      { key: 'a', label: '加速度 ' + at, min: -5, max: 5, step: 0.1, value: 1, unit: 'm/s²', digits: 1 },
      { key: 'T', label: '観察する時間 ' + V('T'), min: 5, max: 20, step: 1, value: 10, unit: 's', digits: 0 }
    ],
    toggles: [
      { key: 'strobe', label: 'ストロボ（1 秒ごとの位置）', value: true },
      { key: 'vec', label: '速度・加速度の矢印', value: true },
      { key: 'gx', label: 'x-t グラフ', value: true },
      { key: 'gv', label: 'v-t グラフ', value: true },
      { key: 'ga', label: 'a-t グラフ', value: true },
      { key: 'area', label: 'v-t の面積（＝変位）', value: true, show: (s) => s.gv },
      { key: 'tan', label: 'x-t の接線（傾き＝v）', value: true, show: (s) => s.gx }
    ],
    presets: [
      { label: '等速直線運動（a = 0）', values: { v0: 3, a: 0, T: 10 } },
      { label: '静止から加速', values: { v0: 0, a: 2, T: 10 } },
      { label: 'ブレーキ（t = 5 s で止まる）', values: { v0: 15, a: -3, T: 10 } },
      { label: '投げ上げと同じ式（a = −5）', values: { v0: 10, a: -5, T: 6 } },
      { label: '負の向きに出発', values: { v0: -6, a: 2, T: 10 } }
    ],

    init(api) {
      S0 = api.S; API = api;
      cv = document.createElement('canvas');
      cv.setAttribute('role', 'img');
      cv.tabIndex = 0;
      api.stage.append(cv);
      base = new SP(cv, { pad: { l: 0, r: 0, t: 0, b: 0 } });
      ctx = base.ctx;
      ['x', 'v', 'a'].forEach((k) => { gp[k] = new SP(cv, { xlabel: 't [s]' }); });
      cache = document.createElement('canvas'); cctx = cache.getContext('2d');
      SP.onTheme(() => { themeN++; });
      // この教材は図とグラフを縦に積むので、スマホでは図を少し高くする（最小限）
      if (!document.getElementById('motion-style')) {
        const st = document.createElement('style'); st.id = 'motion-style';
        st.textContent = '@media (max-width: 899px) and (min-height: 560px) { body[data-sim="motion"] .stage { --stage-h: clamp(240px, 37vh, 400px); } }' +
          '@media (min-width: 900px) { body[data-sim="motion"] .stage { --stage-h: clamp(420px, calc(100vh - 300px), 680px); } }' +
          'body[data-sim="motion"] .mo-line { display: block; } body[data-sim="motion"] .mo-eq { display: inline-block; white-space: nowrap; }' +
          'body[data-sim="motion"] .mo-sm { display: none; } @media (max-width: 520px) { body[data-sim="motion"] .mo-eq.mo-gen { display: none; } body[data-sim="motion"] .mo-sm { display: inline; } }' +
          'body[data-sim="motion"] .stage canvas:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }';
        document.head.append(st);
      }
      // 時刻を動かす：時刻バーかグラフを横にドラッグ（マウスはそのまま、指は横に動かしたとき・タップしたとき）
      const tAt = (px) => lay ? lay.txmin + (px - 6) / lay.ps : 0;
      const inScrub = (y) => lay && y >= lay.gTop - 2 && (lay.shown.length || y >= lay.H - SCRUB - 4);
      let drag = null;
      cv.addEventListener('pointerdown', (e) => {
        const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (!inScrub(y) && !(lay && y >= lay.H - SCRUB - 4)) return;
        drag = { id: e.pointerId, x0: x, y0: y, on: e.pointerType !== 'touch' };
        if (drag.on) { setT(tAt(x)); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } }
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (!drag.on) {
          if (Math.abs(x - drag.x0) > 8 && Math.abs(x - drag.x0) > Math.abs(y - drag.y0) * 1.5) drag.on = true; else return;
        }
        setT(tAt(x));
      });
      const end = (e) => {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        const r = cv.getBoundingClientRect();
        const was = drag; drag = null;
        if (e && e.type === 'pointerup' && !was.on && Math.abs(e.clientX - r.left - was.x0) < 10 && Math.abs(e.clientY - r.top - was.y0) < 10) { setT(tAt(e.clientX - r.left), true); return; }
        if (was.on) API.changed();
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', () => { drag = null; });
      cv.addEventListener('keydown', (e) => {
        const big = e.shiftKey ? 1 : 0.1;
        if (e.key === 'ArrowRight') { e.preventDefault(); setT(r2(S0.t + big), true); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); setT(r2(S0.t - big), true); }
        else if (e.key === 'Home') { e.preventDefault(); setT(0, true); }
        else if (e.key === 'End') { e.preventDefault(); setT(S0.T, true); }
      });
    },
    resize() { cacheKey = ''; },
    draw,
    tick(dt, s) {
      s.t = Math.min(s.T, s.t + dt);
      return s.t < s.T;
    },
    resetTime(s) { s.t = 0; },
    atEnd(s) { return s.t >= s.T - 1e-9; },

    formula(s) {
      const t = nowT(s), v = L.vel(s.v0, s.a, t), x = L.pos(s.v0, s.a, t);
      const tS = U.fix(t, 2);
      const P = (h) => '<span class="mo-eq">' + h + '</span>';
      const G = (h) => '<span class="mo-eq mo-gen">' + h + '</span>';
      const e1 = P(vt + ' = ' + v0 + ' + ' + at + tt) + ' ' + P('= ' + fmt(s.v0, 1) + ' + ' + par(s.a, 1) + ' × ' + tS + ' ' + approx(v) + n2(v) + ' m/s');
      const e2 = G(xt + ' = ' + v0 + tt + ' + ' + HALF + at + tt + '²') + ' ' + P('<span class="mo-sm">' + xt + ' </span>= ' + par(s.v0, 1) + ' × ' + tS + ' + ' + HALF + ' × ' + par(s.a, 1) + ' × ' + tS + '² ' + approx(x) + n2(x) + ' m');
      return '<span class="mo-line">' + e1 + '</span><span class="mo-line">' + e2 + '</span>' +
        '<span class="sub"><span class="sw" style="border-color:var(--c1)"></span>' + vt + ' 速度　<span class="sw dash" style="border-color:var(--c2)"></span>' + at + ' 加速度' +
        (s.strobe ? '　● 1 秒ごと' + (L.turned(s.v0, s.a, s.T) ? '（○ 向きが変わった後）' : '') : '') + '</span>';
    },

    readouts(s) {
      const t = nowT(s), v = L.vel(s.v0, s.a, t), x = L.pos(s.v0, s.a, t);
      const d = L.distance(s.v0, s.a, t), turned = L.turned(s.v0, s.a, t);
      const ck = L.check(s.v0, s.a, t);
      const same = Math.abs(ck.lhs - ck.rhs) < 1e-6;
      return [
        ['時刻 ' + tt, U.fix(t, 2) + ' s'],
        ['位置 ' + xt + '（＝変位）', n2(x) + ' m'],
        ['速度 ' + vt, n2(v) + ' m/s'],
        ['加速度 ' + at, fmt(s.a, 1) + ' m/s²'],
        ['道のり（動いた距離）', n2(d) + ' m' + (turned ? '<br><small>向きが変わったので変位とちがう</small>' : ''), turned ? 'ng' : ''],
        ['速さのようす', TREND[L.trend(v, s.a)]],
        [vt + '² − ' + v0 + '² と 2' + at + xt, n2(ck.lhs) + ' と ' + n2(ck.rhs) + (same ? '（等しい）' : ''), same ? 'ok' : ''],
        ['再生の速さ', '×' + fmt(s.speed, 2) + (s.speed === 1 ? '（実際と同じ）' : s.speed < 1 ? '（スロー）' : '（早送り）') + '<br><small>×1 = 実際と同じ速さ</small>']
      ];
    },

    explain(s) { return explain(s); },
    quiz(s) { return quiz(s); }
  });

  // ---------- なぜ？ ----------
  function explain(s) {
    const t = nowT(s), a = s.a, u = s.v0;
    const v = L.vel(u, a, t), x = L.pos(u, a, t);
    const ts = L.stopTime(u, a);
    let h = '';
    h += '<h3>等速直線運動と等加速度直線運動</h3>' +
      '<p><b>等速直線運動</b>（' + at + ' = 0）は速度が変わらない。だから同じ時間に同じ距離だけ進み、' + xt + ' = ' + v0 + tt + '。x-t グラフは直線、v-t グラフは ' + tt + ' 軸に平行な直線になる。</p>' +
      '<p><b>等加速度直線運動</b>（' + at + ' が一定で 0 でない）は、速度が 1 秒ごとに ' + at + ' ずつ変わる。v-t グラフは傾いた直線、x-t グラフは放物線になる。</p>' +
      '<p class="now">今は ' + at + ' = ' + fmt(a, 1) + ' m/s² なので' + (a === 0 ? '<b>等速直線運動</b>' + (u === 0 ? '（' + v0 + ' = 0 なので止まったまま）' : '') + '。' : '<b>等加速度直線運動</b>。速度は 1 秒ごとに ' + fmt(a, 1) + ' m/s ずつ変わる。') + '</p>';

    h += '<h3>v-t グラフの傾き ＝ 加速度</h3>' +
      '<p>加速度は「1 秒あたりの速度の変化」。v-t グラフの傾きは「' + vt + ' の増加量 ÷ ' + tt + ' の増加量」なので、ちょうど加速度になる。</p>' +
      '<span class="eq">' + at + ' = ' + frac(vt + ' − ' + v0, tt) + '　→　' + vt + ' = ' + v0 + ' + ' + at + tt + '</span>';
    if (t > 0) h += '<p class="now">' + tt + ' = 0 から ' + U.fix(t, 2) + ' s までに、速度は ' + n2(u) + ' m/s → ' + n2(v) + ' m/s。傾き ＝ ' + frac(n2(v) + ' − ' + par(u), U.fix(t, 2)) + ' = ' + fmt(a, 1) + ' m/s²。a-t グラフの高さ（' + fmt(a, 1) + '）と同じだね。</p>';
    else h += '<p class="now">再生するか時刻を動かすと、ここに今の値で計算した傾きが出るよ。</p>';

    h += '<h3>v-t グラフの面積 ＝ 変位</h3>' +
      '<p>短い時間 Δ' + tt + ' の間の変位は 速度 × Δ' + tt + '。これは v-t グラフの細い長方形の面積。全部足すと、<b>v-t グラフと ' + tt + ' 軸の間の面積が変位</b>になる。v-t グラフは直線なので、0〜' + tt + ' の部分は台形：</p>' +
      '<span class="eq">' + xt + ' = ' + HALF + '(' + v0 + ' + ' + vt + ')' + tt + ' = ' + HALF + '(' + v0 + ' + ' + v0 + ' + ' + at + tt + ')' + tt + ' = ' + v0 + tt + ' + ' + HALF + at + tt + '²</span>' +
      '<p>' + tt + ' 軸より下（' + vt + ' &lt; 0）の部分は、負の向きに進んだ分なので<b>マイナスの面積</b>として数える（図ではしま模様）。面積を符号つきで足したものが変位、符号を気にせず足したものが道のり。</p>';
    if (t > 0) {
      h += '<p class="now">' + tt + ' = ' + U.fix(t, 2) + ' s：' + xt + ' = ' + par(u) + ' × ' + U.fix(t, 2) + ' + ' + HALF + ' × ' + par(a, 1) + ' × ' + U.fix(t, 2) + '² ' + approx(x) + n2(x) + ' m';
      if (ts != null && ts < t) {
        const xs = L.pos(u, a, ts), A2 = x - xs;
        h += '<br>' + tt + ' = ' + n2(ts) + ' s で向きが変わるので、面積は 2 つに分かれる：' + (xs >= 0 ? '+' : '') + n2(xs) + ' m と ' + (A2 >= 0 ? '+' : '') + n2(A2) + ' m。<br>変位 ＝ ' + n2(xs) + ' + ' + par(A2) + ' = ' + n2(x) + ' m、道のり ＝ ' + n2(Math.abs(xs)) + ' + ' + n2(Math.abs(A2)) + ' = ' + n2(L.distance(u, a, t)) + ' m';
      }
      h += '</p>';
    }

    h += '<h3>x-t グラフの傾き ＝ 速度</h3>' +
      '<p>速度は「1 秒あたりの位置の変化」。x-t グラフのある点での<b>接線の傾き</b>が、その時刻の速度になる。' + (a === 0 ? '等速なら x-t グラフは直線なので、傾きはどこでも同じ。' : '等加速度では速度が変わるので、放物線の接線の傾きも時刻とともに変わる。') + '</p>' +
      '<p class="now">' + tt + ' = ' + U.fix(t, 2) + ' s での接線の傾き ＝ ' + vt + ' = ' + n2(v) + ' m/s。' + (v > 0 ? '右上がり（＋の向きに進んでいる）。' : v < 0 ? '右下がり（−の向きに進んでいる）。' : '傾き 0（この瞬間は止まっている）。') + '</p>';

    h += '<h3>3 つの式</h3><p>上の 2 つの式から ' + tt + ' を消すと（' + tt + ' = ' + frac(vt + ' − ' + v0, at) + ' を代入）、時間を使わない式ができる：</p>' +
      '<span class="eq">' + vt + ' = ' + v0 + ' + ' + at + tt + '<br>' + xt + ' = ' + v0 + tt + ' + ' + HALF + at + tt + '²<br>' + vt + '² − ' + v0 + '² = 2' + at + xt + '</span>';
    const ck = L.check(u, a, t);
    h += '<p class="now">今の値で確かめる：' + vt + '² − ' + v0 + '² = ' + par(v) + '² − ' + par(u, 1) + '² ' + approx(ck.lhs) + n2(ck.lhs) + '、2' + at + xt + ' = 2 × ' + par(a, 1) + ' × ' + par(x) + ' ' + approx(ck.rhs) + n2(ck.rhs) + '。同じになる。</p>';

    h += '<h3>速くなる？ 遅くなる？</h3><p>' + vt + ' と ' + at + ' が<b>同じ向き（同じ符号）なら速くなり</b>、<b>逆向きなら遅くなる</b>。' + at + ' が負でも「遅くなる」とは限らない（' + vt + ' も負なら、負の向きにどんどん速くなる）。</p>' +
      '<p class="now">' + tt + ' = ' + U.fix(t, 2) + ' s：' + vt + ' = ' + n2(v) + ' m/s、' + at + ' = ' + fmt(a, 1) + ' m/s² → ' + TREND[L.trend(v, a)] + '。</p>';

    if (ts != null) {
      const xs = L.pos(u, a, ts);
      h += '<h3>止まる時刻・向きが変わる時刻</h3><p>' + vt + ' = 0 になる時刻は ' + v0 + ' + ' + at + tt + ' = 0 より ' + tt + '* = ' + frac(MINUS + v0, at) + '。このとき x-t グラフは山（または谷）の頂点になる。</p>' +
        '<p class="now">' + tt + '* = ' + frac(MINUS + par(u, 1), par(a, 1)) + ' = ' + n2(ts) + ' s、そのときの位置 ' + xt + ' = ' + n2(xs) + ' m。' +
        (ts < s.T ? 'そのあとは同じ加速度のまま逆向きに動く（' + tt + ' = ' + fmt(s.T, 0) + ' s で ' + xt + ' = ' + n2(L.pos(u, a, s.T)) + ' m、道のりは ' + n2(L.distance(u, a, s.T)) + ' m）。' : '観察する時間 ' + V('T') + ' = ' + fmt(s.T, 0) + ' s の中では、まだ止まらない。') + '</p>';
      if (u > 0 && a < 0) h += '<p class="hint">本物のブレーキでは、止まったら止まったまま（逆向きには動かない）。このモデルは「同じ加速度がずっと続く」約束なので逆向きに動き出す。逆に、ボールを真上に投げ上げたとき（上向きを正、' + at + ' = −' + V('g') + ' = −9.8 m/s²）は本当にこの通りになる。最高点で ' + vt + ' = 0、そのあと落ちてくる。この教材の ' + at + ' は −5 までなので、重力の半分くらいの星で投げ上げたのと同じ動きと考えてね。</p>';
    }

    if (a !== 0 || u !== 0) {
      const d1 = L.pos(u, a, 1) - L.pos(u, a, 0), d2 = L.pos(u, a, 2) - L.pos(u, a, 1), d3 = L.pos(u, a, 3) - L.pos(u, a, 2);
      h += '<h3>ストロボ・記録タイマーで見ると</h3><p>1 秒ごとの点の間隔は「その 1 秒間の平均の速度 × 1 s」。等速なら間隔はいつも同じ、等加速度なら間隔が毎秒 ' + at + ' × (1 s)² ずつ変わる。</p>' +
        '<p class="now">0〜1 s：' + n2(d1) + ' m、1〜2 s：' + n2(d2) + ' m、2〜3 s：' + n2(d3) + ' m。となりどうしの差は ' + n2(L.tidy(d2 - d1)) + ' m ＝ ' + at + ' × 1² = ' + fmt(a, 1) + ' m' + (ts != null && ts < 3 ? '（向きが変わると間隔は負＝もどる向き。点が重なって見えるので、向きが変わった後の点は下の段にかいている）' : '') + '。</p>';
    }
    return h;
  }

  // ---------- 確認問題 ----------
  function quiz(s0) {
    let u = s0.v0, a = s0.a, T = s0.T, note = '';
    if (u === 0 && a === 0) { u = 2; a = 1; note = '<p class="hint">今は止まったまま（' + v0 + ' = ' + at + ' = 0）なので、' + v0 + ' = 2 m/s、' + at + ' = 1 m/s² で出題するね。</p>'; }
    const cond = '<p>' + v0 + ' = ' + fmt(u, 1) + ' m/s、' + at + ' = ' + fmt(a, 1) + ' m/s² で、' + xt + ' = 0 から動き出す。</p>';
    const qs = [];
    const t1 = 4, v1 = L.vel(u, a, t1), x1 = L.pos(u, a, t1);
    const ms = (v) => n2(L.tidy(v)) + ' m/s', mm = (v) => n2(L.tidy(v)) + ' m';
    // 1. 速度
    let m = U.mc(ms(v1), [
      [ms(u + a), at + ' は 1 秒あたりの変化。' + t1 + ' 秒なら ' + at + ' × ' + t1 + ' だけ変わる。'],
      [ms(a * t1), '初速度 ' + v0 + ' を足すのを忘れている。'],
      [ms(u - a * t1), at + ' の符号に気をつけよう。' + vt + ' = ' + v0 + ' + ' + at + tt + '。'],
      [ms(u * t1 + 0.5 * a * t1 * t1), 'それは位置 ' + xt + ' の式で計算した値（単位も m になるはず）。'],
      [ms(u + 0.5 * a * t1), HALF + ' がつくのは ' + xt + ' の式。速度は ' + v0 + ' + ' + at + tt + '。'],
      [ms(u * t1), '速度 × 時間は変位（m）。' + at + ' = 0 なら速度は変わらず ' + v0 + ' のまま。'],
      [ms(0), at + ' = 0 は「速度が変わらない」ということ。止まるわけではない。'],
      [ms(-u), '速度の符号は向きを表す。' + at + ' = 0 なら向きも大きさも変わらない。']
    ]);
    qs.push(Object.assign(m, { q: note + cond + '<p>' + tt + ' = ' + t1 + ' s のときの速度 ' + vt + ' は？</p>',
      explain: '<p>' + vt + ' = ' + v0 + ' + ' + at + tt + ' = ' + fmt(u, 1) + ' + ' + par(a, 1) + ' × ' + t1 + ' = ' + ms(v1) + '。v-t グラフで ' + tt + ' = ' + t1 + ' の高さを読んでも同じ。</p>' }));
    // 2. 変位
    m = U.mc(mm(x1), [
      [mm(u * t1 + a * t1 * t1), HALF + ' をかけ忘れている。' + xt + ' = ' + v0 + tt + ' + ' + HALF + at + tt + '²。'],
      [mm(v1 * t1), '最後の速度 × 時間は、ずっとその速度で動いた場合。速度は変わるので、v-t グラフの台形の面積で考えよう。'],
      [mm(0.5 * a * t1 * t1), v0 + tt + '（はじめの速度で進む分）を忘れている。'],
      [mm(u * t1), '加速度の分 ' + HALF + at + tt + '² が入っていない。'],
      [mm(u * t1 - 0.5 * a * t1 * t1), '符号に気をつけよう。'],
      [mm(0.5 * u * t1 + 0.5 * a * t1 * t1), HALF + ' がかかるのは ' + at + tt + '² の項だけ。' + v0 + tt + ' にはかからない。'],
      [mm(u * t1 * t1), v0 + tt + '² ではなく ' + v0 + tt + '（速度 × 時間）。'],
      [mm(v1), 'それは速度 ' + vt + ' の値。変位は速度 × 時間（v-t グラフの面積）。']
    ]);
    qs.push(Object.assign(m, { q: cond + '<p>' + tt + ' = 0〜' + t1 + ' s の変位（' + tt + ' = ' + t1 + ' s での位置 ' + xt + '）は？</p>',
      explain: '<p>' + xt + ' = ' + v0 + tt + ' + ' + HALF + at + tt + '² = ' + par(u, 1) + ' × ' + t1 + ' + ' + HALF + ' × ' + par(a, 1) + ' × ' + t1 + '² = ' + mm(x1) + '。v-t グラフの 0〜' + t1 + ' s の台形の面積 ' + HALF + '(' + fmt(u, 1) + ' + ' + par(v1) + ') × ' + t1 + ' と同じ。</p>' }));
    // 3. v-t グラフの傾き
    const ac = '加速度 ' + at + '、' + fmt(a, 1) + ' m/s²';
    m = U.mc(ac, [
      ['速度 ' + vt + '、' + fmt(u, 1) + ' m/s', '速度は v-t グラフの「高さ（縦軸の値）」。傾きは 1 秒あたりの速度の変化。'],
      ['変位、' + mm(L.pos(u, a, T)), '変位は v-t グラフの「面積」で表される。'],
      ['加速度 ' + at + '、' + n2(L.tidy(L.vel(u, a, T) / T)) + ' m/s²', '傾きは (' + vt + ' − ' + v0 + ') ÷ ' + tt + '。' + v0 + ' を引き忘れている。'],
      ['位置 ' + xt + '、' + mm(L.pos(u, a, T)), '位置は x-t グラフの高さ。v-t グラフの傾きではない。']
    ]);
    qs.push(Object.assign(m, { q: cond + '<p>このときの v-t グラフの<b>傾き</b>は何を表していて、いくつ？</p>',
      explain: '<p>v-t グラフの傾き ＝ ' + frac(vt + ' の変化', tt + ' の変化') + ' ＝ 加速度。どの時刻で見ても ' + fmt(a, 1) + ' m/s²（直線なので一定）。ちなみに v-t グラフの面積は変位、x-t グラフの傾きは速度。</p>' }));
    // 4. 速さの増減
    let t2 = 2;
    for (let k = 2; k <= T; k++) { if (L.vel(u, a, k) !== 0) { t2 = k; break; } }
    const v2 = L.vel(u, a, t2), tr = L.trend(v2, a);
    const opts = { faster: '速くなっている', slower: '遅くなっている', const: '一定（変わらない）' };
    const whyOf = {
      faster: vt + ' と ' + at + ' が同じ向き（同じ符号）のときだけ速くなる。今は ' + (tr === 'const' ? at + ' = 0。' : '逆向き。'),
      slower: vt + ' と ' + at + ' が逆向き（ちがう符号）のときに遅くなる。' + (tr === 'faster' && a < 0 ? at + ' が負でも、' + vt + ' も負なら負の向きに速くなる。' : tr === 'const' ? '今は ' + at + ' = 0。' : ''),
      const: '速さが一定なのは ' + at + ' = 0 のときだけ。'
    };
    m = U.mc(opts[tr], Object.keys(opts).filter((k) => k !== tr).map((k) => [opts[k], whyOf[k]]).concat([['止まっている', vt + ' = ' + ms(v2) + ' なので止まってはいない。']]));
    qs.push(Object.assign(m, { q: cond + '<p>' + tt + ' = ' + t2 + ' s のとき、物体の速さ（速度の大きさ）はどうなっている？</p>',
      explain: '<p>' + tt + ' = ' + t2 + ' s で ' + vt + ' = ' + ms(v2) + '、' + at + ' = ' + fmt(a, 1) + ' m/s²。' + (tr === 'const' ? at + ' = 0 なので速さは変わらない。' : vt + ' と ' + at + ' が' + (tr === 'faster' ? '同じ向きなので速くなる。' : '逆向きなので遅くなる。')) + '</p>' }));
    // 5. 向きが変わるなら道のり、変わらないなら x-t グラフの形
    const ts = L.stopTime(u, a);
    if (ts != null && ts < T) {
      const d = L.distance(u, a, T), xT = L.pos(u, a, T), xs = L.pos(u, a, ts);
      m = U.mc(mm(d), [
        [mm(Math.abs(xT)), 'それは変位の大きさ（スタートからの距離）。' + tt + ' = ' + n2(ts) + ' s で向きが変わるので、行きと帰りを足す。'],
        [mm(Math.abs(xs)), 'それは向きが変わるまでの分だけ。そのあと逆向きに動いた分も足す。'],
        [mm(xT), '変位は符号つき。道のりは動いた距離の合計で、いつも 0 以上。'],
        [mm(2 * Math.abs(xT) + Math.abs(xs)), '向きが変わるまで ' + n2(Math.abs(xs)) + ' m、そのあと ' + n2(Math.abs(xT - xs)) + ' m。'],
        [mm(Math.abs(u) * T), '速度は変わるので「' + v0 + ' × 時間」ではない。v-t グラフの面積で考えよう。'],
        [mm(Math.abs(xT - xs)), 'それは向きが変わった後の分だけ。その前の ' + n2(Math.abs(xs)) + ' m も足す。']
      ]);
      qs.push(Object.assign(m, { q: cond + '<p>' + tt + ' = 0〜' + fmt(T, 0) + ' s に物体が動いた<b>道のり</b>は？（変位ではなく、動いた距離の合計）</p>',
        explain: '<p>' + vt + ' = 0 になるのは ' + tt + '* = ' + n2(ts) + ' s（' + xt + ' = ' + mm(xs) + '）。そのあと逆向きに動いて ' + tt + ' = ' + fmt(T, 0) + ' s で ' + xt + ' = ' + mm(xT) + '。道のり ＝ ' + n2(Math.abs(xs)) + ' + ' + n2(Math.abs(xT - xs)) + ' = ' + mm(d) + '。v-t グラフの面積を、符号を気にせず足したものと同じ。</p>' }));
    } else {
      const shapes = a > 0 ? '下に凸の放物線（だんだん傾きが大きくなる）' : a < 0 ? '上に凸の放物線（だんだん傾きが小さくなる）' : u > 0 ? '右上がりの直線' : '右下がりの直線';
      m = U.mc(shapes, [
        ['右上がりの直線', '直線になるのは速度が一定（' + at + ' = 0）のとき。'],
        ['右下がりの直線', '直線になるのは速度が一定（' + at + ' = 0）のとき。右下がりなら負の向きに等速。'],
        ['下に凸の放物線（だんだん傾きが大きくなる）', '下に凸になるのは ' + at + ' &gt; 0 のとき（傾き＝速度がふえていく）。'],
        ['上に凸の放物線（だんだん傾きが小さくなる）', '上に凸になるのは ' + at + ' &lt; 0 のとき（傾き＝速度がへっていく）。'],
        [tt + ' 軸に平行な直線', 'それは止まっているとき（' + vt + ' = 0 のまま）。']
      ]);
      qs.push(Object.assign(m, { q: cond + '<p>このときの x-t グラフの形は？</p>',
        explain: '<p>x-t グラフの傾きは速度。' + (a === 0 ? at + ' = 0 なら速度は ' + fmt(u, 1) + ' m/s のまま変わらないので、傾き一定の直線（' + xt + ' = ' + fmt(u, 1) + tt + '）。' : xt + ' = ' + v0 + tt + ' + ' + HALF + at + tt + '² は ' + tt + ' の二次関数で、' + at + ' ' + (a > 0 ? '&gt;' : '&lt;') + ' 0 なので' + (a > 0 ? '下に凸。' : '上に凸。')) + '</p>' }));
    }
    return qs;
  }
})();
