/* グラフ・図をかく小さな部品（Canvas 2D）。全シミュレーター共通。
   - 座標（数学の x, y）と画面の点（px）の変換、目もり（1・2・5 の倍数）、軸ラベルと単位
   - 端末の画面の細かさ（devicePixelRatio）に合わせてくっきりかく
   - 色は今の見た目（11種・ライト/ダーク）の CSS 変数から取る（SimPlot.colors()）
   - 拡大・縮小・移動（zoom / pan）。範囲外・計算できない値（NaN・∞）は線を切ってかかない
   使い方:
     const p = new SimPlot(canvas, { xmin:-10, xmax:10, ymin:-10, ymax:10, equal:true, xlabel:'x', ylabel:'y' });
     p.begin(); p.axes(); p.fn(x => x*x, { color: c.c1 }); p.point(1, 1, { label: 'A' });
*/
(function (root) {
  'use strict';

  // ---------- 色（見た目ごと）----------
  let colorCache = null;
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    const body = getComputedStyle(document.body || document.documentElement);
    return {
      paper: v('--paper', '#fff'), desk: v('--desk', '#eef2f8'), ink: v('--ink', '#1d2740'), muted: v('--muted', '#5d6781'),
      rule: v('--rule', '#d5deee'), accent: v('--accent', '#2c4fa3'),
      c1: v('--c1', '#2c4fa3'), c2: v('--c2', '#d23a3a'), c3: v('--c3', '#2e8a5c'), c4: v('--c4', '#8a4bb5'),
      grid: v('--grid', 'rgba(120,130,160,.18)'),
      font: body.fontFamily || 'sans-serif', fontEn: v('--font-en', 'sans-serif')
    };
  }
  function colors() { return colorCache || (colorCache = readColors()); }
  const listeners = new Set();
  function themeChanged() { colorCache = null; listeners.forEach((f) => { try { f(); } catch (e) { /* つぎへ */ } }); }
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-style', 'data-theme', 'class'] });
  }
  if (root.matchMedia) {
    const mq = root.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', themeChanged);
  }

  // ---------- 目もり ----------
  // 1 目もりの幅：画面上で minPx 以上あく 1・2・5×10^n
  function niceStep(range, px, minPx) {
    if (!(range > 0) || !(px > 0)) return 1;
    const raw = range * minPx / px;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  // 目もりの数字：小数の誤差（0.30000000004 など）を出さない。−（マイナス記号）は全角でなく U+2212
  function tickLabel(v, step) {
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    let s = Math.abs(v) < step * 1e-6 ? '0' : v.toFixed(Math.min(d, 6));
    return s.replace('-', '−');
  }

  class SimPlot {
    constructor(canvas, opt) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ xmin: -10, xmax: 10, ymin: -10, ymax: 10, equal: false, pad: { l: 8, r: 8, t: 8, b: 8 },
        xlabel: '', ylabel: '', grid: true, axesAt: 'zero' }, opt || {});
      this.home = { xmin: this.o.xmin, xmax: this.o.xmax, ymin: this.o.ymin, ymax: this.o.ymax };
      this.view = Object.assign({}, this.home);
      this.w = 0; this.h = 0; this.dpr = 1; this._boxes = [];
      this.size();
    }
    // 画面の大きさに合わせる（大きさが変わったら true）
    size() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === this.w && h === this.h && dpr === this.dpr) return false;
      this.w = w; this.h = h; this.dpr = dpr;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      return true;
    }
    setHome(v) { this.home = Object.assign({}, this.home, v); this.view = Object.assign({}, this.home); }
    resetView() { this.view = Object.assign({}, this.home); }
    get plotBox() {
      const p = this.o.pad;
      return { l: p.l, t: p.t, r: this.w - p.r, b: this.h - p.b, w: Math.max(1, this.w - p.l - p.r), h: Math.max(1, this.h - p.t - p.b) };
    }
    // 実際にかく範囲（equal のときは x と y の 1 の長さをそろえるために、短い方を広げる）
    get range() {
      const v = this.view, B = this.plotBox;
      if (!this.o.equal) return v;
      const cx = (v.xmin + v.xmax) / 2, cy = (v.ymin + v.ymax) / 2;
      const sx = (v.xmax - v.xmin) / B.w, sy = (v.ymax - v.ymin) / B.h;
      const s = Math.max(sx, sy);
      return { xmin: cx - s * B.w / 2, xmax: cx + s * B.w / 2, ymin: cy - s * B.h / 2, ymax: cy + s * B.h / 2 };
    }
    X(x) { const R = this.range, B = this.plotBox; return B.l + (x - R.xmin) / (R.xmax - R.xmin) * B.w; }
    Y(y) { const R = this.range, B = this.plotBox; return B.b - (y - R.ymin) / (R.ymax - R.ymin) * B.h; }
    wx(px) { const R = this.range, B = this.plotBox; return R.xmin + (px - B.l) / B.w * (R.xmax - R.xmin); }
    wy(py) { const R = this.range, B = this.plotBox; return R.ymin + (B.b - py) / B.h * (R.ymax - R.ymin); }
    // 1 あたりの画面の長さ
    get sx() { const R = this.range; return this.plotBox.w / (R.xmax - R.xmin); }
    get sy() { const R = this.range; return this.plotBox.h / (R.ymax - R.ymin); }

    zoom(f, wxc, wyc) {
      const v = this.view;
      const cx = wxc == null ? (v.xmin + v.xmax) / 2 : wxc, cy = wyc == null ? (v.ymin + v.ymax) / 2 : wyc;
      const hw = (this.home.xmax - this.home.xmin), hh = (this.home.ymax - this.home.ymin);
      const nw = (v.xmax - v.xmin) * f, nh = (v.ymax - v.ymin) * f;
      // 拡大しすぎ・縮小しすぎを防ぐ（元の 1/20〜20 倍）
      if (nw < hw / 20 || nw > hw * 20 || nh < hh / 20 || nh > hh * 20) return false;
      this.view = { xmin: cx - (cx - v.xmin) * f, xmax: cx + (v.xmax - cx) * f, ymin: cy - (cy - v.ymin) * f, ymax: cy + (v.ymax - cy) * f };
      return true;
    }
    pan(dxPx, dyPx) {
      const dx = dxPx / this.sx, dy = dyPx / this.sy, v = this.view;
      this.view = { xmin: v.xmin - dx, xmax: v.xmax - dx, ymin: v.ymin + dy, ymax: v.ymax + dy };
    }

    begin(bg) {
      this.size();
      const c = this.ctx, C = colors();
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.clearRect(0, 0, this.w, this.h);
      if (bg !== false) { c.fillStyle = bg || C.paper; c.fillRect(0, 0, this.w, this.h); }
      c.lineCap = 'round'; c.lineJoin = 'round';
      this._boxes = [];
      return c;
    }
    clip(on) {
      const c = this.ctx, B = this.plotBox;
      if (on) { c.save(); c.beginPath(); c.rect(B.l, B.t, B.w, B.h); c.clip(); } else c.restore();
    }

    // 方眼・軸・目もり・軸の名前（単位つき）
    axes(opt) {
      opt = Object.assign({ xlabel: this.o.xlabel, ylabel: this.o.ylabel, grid: this.o.grid, minPx: 46, xfmt: null, yfmt: null, origin: true }, opt || {});
      const c = this.ctx, C = colors(), R = this.range, B = this.plotBox;
      const xs = opt.xstep || niceStep(R.xmax - R.xmin, B.w, opt.minPx);
      const ys = opt.ystep || niceStep(R.ymax - R.ymin, B.h, opt.minPx * 0.8);
      const fs = this.w < 420 ? 11 : 12.5;
      c.save();
      // 方眼
      if (opt.grid) {
        c.strokeStyle = C.grid; c.lineWidth = 1; c.beginPath();
        for (let x = Math.ceil(R.xmin / xs) * xs; x <= R.xmax + 1e-9; x += xs) { const px = Math.round(this.X(x)) + .5; c.moveTo(px, B.t); c.lineTo(px, B.b); }
        for (let y = Math.ceil(R.ymin / ys) * ys; y <= R.ymax + 1e-9; y += ys) { const py = Math.round(this.Y(y)) + .5; c.moveTo(B.l, py); c.lineTo(B.r, py); }
        c.stroke();
      }
      // 軸の位置（0 が画面の外なら端に寄せる）
      const ax = Math.min(B.b, Math.max(B.t, this.Y(0)));   // x 軸の画面 y
      const ay = Math.min(B.r, Math.max(B.l, this.X(0)));   // y 軸の画面 x
      c.strokeStyle = C.ink; c.lineWidth = 1.5; c.beginPath();
      c.moveTo(B.l, ax); c.lineTo(B.r, ax); c.moveTo(ay, B.t); c.lineTo(ay, B.b); c.stroke();
      // 矢印
      c.fillStyle = C.ink;
      tri(c, B.r, ax, 0); tri(c, ay, B.t, -Math.PI / 2);
      // 目もりの数字
      c.font = fs + 'px ' + C.fontEn; c.fillStyle = C.muted;
      const below = ax + 4 + fs < B.b;
      c.textAlign = 'center'; c.textBaseline = below ? 'top' : 'bottom';
      for (let x = Math.ceil(R.xmin / xs) * xs; x <= R.xmax + 1e-9; x += xs) {
        if (Math.abs(x) < xs / 2) continue;
        const px = this.X(x); if (px < B.l + 10 || px > B.r - 22) continue;
        c.fillRect(px - .5, ax - 3, 1, 6);
        c.fillText(opt.xfmt ? opt.xfmt(x, xs) : tickLabel(x, xs), px, below ? ax + 5 : ax - 5);
      }
      const left = ay - 6 - 30 > B.l;
      c.textAlign = left ? 'right' : 'left'; c.textBaseline = 'middle';
      for (let y = Math.ceil(R.ymin / ys) * ys; y <= R.ymax + 1e-9; y += ys) {
        if (Math.abs(y) < ys / 2) continue;
        const py = this.Y(y); if (py < B.t + 18 || py > B.b - 6) continue;
        c.fillRect(ay - 3, py - .5, 6, 1);
        c.fillText(opt.yfmt ? opt.yfmt(y, ys) : tickLabel(y, ys), left ? ay - 6 : ay + 6, py);
      }
      // 原点 O
      if (opt.origin && R.xmin < 0 && R.xmax > 0 && R.ymin < 0 && R.ymax > 0) {
        c.textAlign = 'right'; c.textBaseline = 'top'; c.font = 'italic ' + fs + 'px ' + C.fontEn;
        c.fillText('O', this.X(0) - 4, this.Y(0) + 3);
      }
      // 軸の名前
      c.fillStyle = C.ink; c.font = '600 ' + (fs + 1) + 'px ' + C.font;
      if (opt.xlabel) { c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(opt.xlabel, B.r - 2, ax - 6); }
      if (opt.ylabel) { c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(opt.ylabel, ay + 8, B.t + 1); }
      c.restore();
      return { xs, ys };
    }

    // y = f(x) の線。値がない・とぶ（tan の漸近線など）ところで線を切る
    fn(f, opt) {
      opt = Object.assign({ color: colors().c1, width: 2.6, dash: null, x0: -Infinity, x1: Infinity, jump: null }, opt || {});
      const c = this.ctx, R = this.range, B = this.plotBox;
      const a = Math.max(R.xmin, opt.x0), b = Math.min(R.xmax, opt.x1);
      if (!(b > a)) return;
      const n = Math.max(2, Math.ceil((this.X(b) - this.X(a)) * 1.5));
      const lim = (R.ymax - R.ymin) * 4;
      c.save(); this.clip(true);
      c.strokeStyle = opt.color; c.lineWidth = opt.width; c.setLineDash(opt.dash || []);
      c.beginPath();
      let pen = false, py = null;
      for (let i = 0; i <= n; i++) {
        const x = a + (b - a) * i / n, y = f(x);
        if (!Number.isFinite(y) || Math.abs(y - (R.ymin + R.ymax) / 2) > lim) { pen = false; py = null; continue; }
        if (pen && opt.jump && opt.jump(py, y)) pen = false;
        const X = this.X(x), Y = this.Y(y);
        if (pen) c.lineTo(X, Y); else c.moveTo(X, Y);
        pen = true; py = y;
      }
      c.stroke();
      this.clip(false); c.restore();
      void B;
    }
    // 折れ線（点の列）。点は [x, y]
    path(pts, opt) {
      opt = Object.assign({ color: colors().c1, width: 2.4, dash: null, fill: null, close: false }, opt || {});
      const c = this.ctx;
      c.save(); this.clip(true);
      c.beginPath();
      let pen = false;
      for (const p of pts) {
        if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) { pen = false; continue; }
        if (pen) c.lineTo(this.X(p[0]), this.Y(p[1])); else c.moveTo(this.X(p[0]), this.Y(p[1]));
        pen = true;
      }
      if (opt.close) c.closePath();
      if (opt.fill) { c.fillStyle = opt.fill; c.fill(); }
      if (opt.color && opt.width) { c.strokeStyle = opt.color; c.lineWidth = opt.width; c.setLineDash(opt.dash || []); c.stroke(); }
      this.clip(false); c.restore();
    }
    seg(x0, y0, x1, y1, opt) { this.path([[x0, y0], [x1, y1]], opt); }
    vline(x, opt) { const R = this.range; this.seg(x, R.ymin, x, R.ymax, opt); }
    hline(y, opt) { const R = this.range; this.seg(R.xmin, y, R.xmax, y, opt); }
    // 矢印（ベクトルなど）
    arrow(x0, y0, x1, y1, opt) {
      opt = Object.assign({ color: colors().c1, width: 2.6, head: 10 }, opt || {});
      const c = this.ctx, X0 = this.X(x0), Y0 = this.Y(y0), X1 = this.X(x1), Y1 = this.Y(y1);
      const L = Math.hypot(X1 - X0, Y1 - Y0); if (!(L > 1)) return;
      const ang = Math.atan2(Y1 - Y0, X1 - X0), h = Math.min(opt.head, L * .6);
      c.save(); this.clip(true);
      c.strokeStyle = c.fillStyle = opt.color; c.lineWidth = opt.width; c.setLineDash(opt.dash || []);
      c.beginPath(); c.moveTo(X0, Y0); c.lineTo(X1 - Math.cos(ang) * h * .7, Y1 - Math.sin(ang) * h * .7); c.stroke();
      c.setLineDash([]); tri(c, X1, Y1, ang, h);
      this.clip(false); c.restore();
    }
    // 点（shape: 'dot' 塗り・'ring' 白ぬき・'square'・'diamond'。色だけで見分けなくていいように形も変えられる。grip: true でつかめる点の輪）
    point(x, y, opt) {
      opt = Object.assign({ color: colors().c1, r: 5.5, shape: 'dot', label: '', pos: 'ne', labelColor: null, bold: true }, opt || {});
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const c = this.ctx, C = colors(), X = this.X(x), Y = this.Y(y), B = this.plotBox;
      if (X < B.l - 2 || X > B.r + 2 || Y < B.t - 2 || Y > B.b + 2) return;
      c.save();
      // grip:true → 指でつかめる点。まわりにうすい輪をかいて「さわれる」ことを見せる
      if (opt.grip) { c.globalAlpha = 0.2; c.fillStyle = opt.color; c.beginPath(); c.arc(X, Y, opt.r + 10, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
      c.lineWidth = 2.2; c.strokeStyle = opt.color; c.fillStyle = opt.shape === 'ring' ? C.paper : opt.color;
      c.beginPath();
      if (opt.shape === 'square') c.rect(X - opt.r, Y - opt.r, opt.r * 2, opt.r * 2);
      else if (opt.shape === 'diamond') { c.moveTo(X, Y - opt.r * 1.3); c.lineTo(X + opt.r * 1.3, Y); c.lineTo(X, Y + opt.r * 1.3); c.lineTo(X - opt.r * 1.3, Y); c.closePath(); }
      else c.arc(X, Y, opt.r, 0, Math.PI * 2);
      c.fill(); c.stroke();
      if (opt.label) this.label(opt.label, X, Y, { pos: opt.pos, color: opt.labelColor || C.ink, bold: opt.bold, px: true, gap: opt.r + 4 });
      c.restore();
    }
    // 文字（背景に紙の色のふちどり＝線と重なっても読める）。px:true なら画面の点で指定
    //   ほかの文字と重なるときは、まわりの別の位置をさがす（どこも重なるなら、keep:true のときだけ重ねてかく）
    label(text, x, y, opt) {
      opt = Object.assign({ pos: 'ne', color: colors().ink, size: this.w < 420 ? 12 : 13.5, bold: false, px: false, gap: 6, en: false, halo: true, keep: false }, opt || {});
      const c = this.ctx, C = colors();
      const X = opt.px ? x : this.X(x), Y = opt.px ? y : this.Y(y);
      if (!Number.isFinite(X) || !Number.isFinite(Y)) return false;
      const g = opt.gap;
      const map = { n: [0, -g, 'center', 'bottom'], s: [0, g, 'center', 'top'], e: [g, 0, 'left', 'middle'], w: [-g, 0, 'right', 'middle'],
        ne: [g * .7, -g * .7, 'left', 'bottom'], nw: [-g * .7, -g * .7, 'right', 'bottom'], se: [g * .7, g * .7, 'left', 'top'], sw: [-g * .7, g * .7, 'right', 'top'], c: [0, 0, 'center', 'middle'] };
      c.save();
      c.font = (opt.bold ? '700 ' : '500 ') + opt.size + 'px ' + (opt.en ? C.fontEn : C.font);
      const tw = c.measureText(text).width, th = opt.size * 1.15;
      const place = (pos) => {
        const m = map[pos] || map.ne;
        let tx = X + m[0], ty = Y + m[1];
        let lx = m[2] === 'left' ? tx : m[2] === 'right' ? tx - tw : tx - tw / 2;
        // 画面からはみ出さない
        if (lx < 2) { tx += 2 - lx; lx = 2; }
        if (lx + tw > this.w - 2) { tx -= lx + tw - (this.w - 2); lx = this.w - 2 - tw; }
        let top = m[3] === 'top' ? ty : m[3] === 'bottom' ? ty - th : ty - th / 2;
        if (top < 2) { ty += 2 - top; top = 2; }
        if (top + th > this.h - 2) { ty -= top + th - (this.h - 2); top = this.h - 2 - th; }
        return { m, tx, ty, box: [lx - 2, top - 1, tw + 4, th + 2] };
      };
      const hit = (b) => this._boxes.some((o) => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1]);
      const order = [opt.pos, 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
      let P = null;
      if (opt.pos === 'c') P = place('c');
      else for (const pos of order) { const q = place(pos); if (!hit(q.box)) { P = q; break; } }
      if (!P) { if (!opt.keep) { c.restore(); return false; } P = place(opt.pos); }
      this._boxes.push(P.box);
      c.textAlign = P.m[2]; c.textBaseline = P.m[3];
      if (opt.halo) { c.lineWidth = 4; c.strokeStyle = C.paper; c.strokeText(text, P.tx, P.ty); }
      c.fillStyle = opt.color; c.fillText(text, P.tx, P.ty);
      c.restore();
      return true;
    }
  }
  function tri(c, x, y, ang, s) {
    s = s || 9;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-s, -s * .45); c.lineTo(-s, s * .45); c.closePath(); c.fill();
    c.restore();
  }

  SimPlot.colors = colors;
  SimPlot.onTheme = (f) => listeners.add(f);
  SimPlot.niceStep = niceStep;
  SimPlot.tickLabel = tickLabel;
  root.SimPlot = SimPlot;
})(window);
