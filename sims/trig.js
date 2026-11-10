/* 三角関数と単位円 */
(function () {
  'use strict';
  const L = window.SimLib.trig;
  const U = window.SimApp.util;
  const { fmt, fix, frac, MINUS } = U;
  const V = (x) => '<i class="v">' + x + '</i>';
  const TH = V('θ');

  // ---------- 数の見せ方 ----------
  const isRad = (s) => s.unit === 'rad';
  const tidyDeg = (d) => Math.round(d * 10) / 10;          // 再生中は小数になるので 0.1° まで
  const degText = (d) => fmt(tidyDeg(d), 1) + '°';
  const radT = (d) => L.radText(tidyDeg(d));
  const radIsFrac = (d) => !!L.radFrac(tidyDeg(d));
  // 角を「今の表し方」で
  const angleText = (d, s) => (isRad(s) ? radT(d) + (radIsFrac(d) ? '' : ' rad') : degText(d));
  // 正確な値 → HTML（分数）
  function exH(e) {
    if (!e) return '';
    if (e.sign === 0) return '0';
    const s = e.sign < 0 ? MINUS : '';
    return s + (e.den ? frac(e.num, e.den) : e.num);
  }
  // 値（有名角なら正確な値＝、それ以外は小数4けた≒）。{ rel:'=' か '≒', html, text }
  function valOf(d, which) {
    const dd = tidyDeg(d);
    if (which === 'tan' && !L.tanDefined(dd)) return { rel: '', html: '定義されない', text: '定義されない', undef: true };
    const ex = L.exact(dd);
    if (ex) return { rel: '=', html: exH(ex[which]), text: ex[which].text };
    const v = L.values(dd)[which];
    const r = Number(v.toFixed(4));
    return { rel: r === v ? '=' : '≒', html: fix(v, 4), text: fix(v, 4) };
  }
  const eqv = (name, d) => { const v = valOf(d, name); return v.undef ? name + ' ' + TH + ' は定義されない' : name + ' ' + TH + ' ' + v.rel + ' ' + v.html; };
  function quadName(q) {
    return { 'x+': 'x 軸上（正の部分）', 'x-': 'x 軸上（負の部分）', 'y+': 'y 軸上（正の部分）', 'y-': 'y 軸上（負の部分）' }[q] || '第' + q + '象限';
  }
  const sg = (v) => (v === null ? '定義されない' : v > 0 ? '＋' : v < 0 ? MINUS : '0');

  // ---------- 図 ----------
  let cvC, cvG, pc, pg, apiR;
  let drag = null;
  // 再生：θ(t) = θ₀ + ωt（毎コマ t から計算し、足し算の誤差をためない）
  let run = { base: null, omega: null, last: null };

  window.SimApp.register({
    id: 'trig',
    animated: true,
    intro:
      '<p>原点を中心とする半径 1 の円（<b>単位円</b>）の上を、点 P が回る。<i class="v">x</i> 軸の正の向きから角 ' + TH + ' だけ回った点 P の座標を (cos ' + TH + ', sin ' + TH + ') と決めるのが、三角関数の考え方だよ。</p>' +
      '<p>点 P を回すと、右（スマホでは下）のグラフに sin・cos・tan の値が同時にかかれていく。90° をこえても、マイナスの角でも、1 周以上回っても値が決まることを確かめよう。</p>' +
      '<p class="hint">高1（数学Ⅰ 三角比：0°〜180°）から高2（数学Ⅱ 三角関数：一般角・弧度法・グラフ）まで。</p>',
    assumptions: [
      '単位円は半径 1。だから点 P の座標がそのまま (cos ' + TH + ', sin ' + TH + ')。',
      '角は <i class="v">x</i> 軸の正の向きから、反時計回りを正（＋）、時計回りを負（−）としてはかる（一般角）。',
      '単位円は縦横の目もり 1 の長さを同じにしてかいている。PC など横に並ぶときは、グラフのたての目もりも単位円と同じ縮尺にそろえている（P の高さ＝sin の高さが水平線でつながる）。スマホで上下に並ぶときは、グラフのたての縮尺は単位円とちがう。',
      'グラフの横軸は角（度なら °、ラジアンなら π を使った目もり）。今の ' + TH + ' がふくまれる 1 周期ぶん（360°）を出している。',
      'tan のグラフは、値の大きい所（図の外）は切ってかいていない。たての細い点線は漸近線（tan が定義されない 90° + 180°×<i class="v">n</i>）。',
      '30°・45° の倍数の角では正確な値（√ や分数）を、それ以外では小数第4位までの近い値（≒）を出している。'
    ],
    choices: [{ key: 'unit', label: '角の表し方', options: [['deg', '度（°）'], ['rad', 'ラジアン（弧度法）']], value: 'deg' }],
    params: [
      { key: 'theta', label: '角 ' + TH, min: -360, max: 720, step: 1, value: 30, unit: '°', digits: 1, note: '単位円の点 P をドラッグしても動かせる',
        labelOf: (s) => '角 ' + TH + (isRad(s) ? '（= ' + radT(s.theta) + (radIsFrac(s.theta) ? '' : ' rad') + '）' : '') },
      { key: 'omega', label: '回る速さ ' + V('ω'), min: 10, max: 90, step: 5, value: 45, unit: '°/s', digits: 0, note: '再生したときに 1 秒で回る角' }
    ],
    toggles: [
      { key: 'gsin', label: 'y = sin x', value: true },
      { key: 'gcos', label: 'y = cos x', value: true },
      { key: 'gtan', label: 'y = tan x', value: false }
    ],
    presets: [
      { label: '30°', values: { theta: 30 } },
      { label: '45°', values: { theta: 45 } },
      { label: '60°', values: { theta: 60 } },
      { label: '90°', values: { theta: 90 } },
      { label: '120°', values: { theta: 120 } },
      { label: '135°', values: { theta: 135 } },
      { label: '150°', values: { theta: 150 } },
      { label: '180°', values: { theta: 180 } },
      { label: '210°', values: { theta: 210 } },
      { label: '270°', values: { theta: 270 } },
      { label: MINUS + '30°', values: { theta: -30 } },
      { label: '390°', values: { theta: 390 } }
    ],

    init(api) {
      apiR = api;
      const st = document.createElement('style');
      // 単位円とグラフを並べる：スマホ縦は上下、横に広いときは左右（単位円 : グラフ ≒ 1 : 1.6）
      st.textContent =
        'body[data-sim="trig"] .stage{grid-template-rows:minmax(0,1fr) minmax(0,1fr)}' +
        '@media (max-width:599px){html:not(.stage-small) body[data-sim="trig"] .stage{--stage-h:clamp(260px,42vh,380px)}}' +
        '@media (min-width:600px){body[data-sim="trig"] .stage{grid-template-rows:none;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)}}' +
        'html.stage-small body[data-sim="trig"] .stage{grid-template-rows:none;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)}';
      document.head.append(st);
      cvC = document.createElement('canvas');
      cvC.className = 'drag';
      cvC.setAttribute('role', 'img');
      cvG = document.createElement('canvas');
      cvG.setAttribute('role', 'img');
      api.stage.append(cvC, cvG);
      const pad = { l: 8, r: 8, t: 10, b: 10 };
      pc = new window.SimPlot(cvC, { xmin: -1.32, xmax: 1.32, ymin: -1.32, ymax: 1.32, equal: true, pad, xlabel: 'x', ylabel: 'y' });
      pg = new window.SimPlot(cvG, { xmin: -20, xmax: 385, ymin: -2, ymax: 2, pad: { l: 8, r: 10, t: 10, b: 10 }, xlabel: '', ylabel: 'y' });

      // 点 P のドラッグ（P の近く 24px 以内をつかむ）。P 以外をタップ・クリックすると、その向きに P を動かす
      const pos = (e) => { const r = cvC.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const angleAt = (x, y) => L.radToDeg(Math.atan2(pc.wy(y), pc.wx(x)));
      // 今の θ にいちばん近い「同じ向きの角」（ぐるっと回しても θ が飛ばない）
      const near = (a) => { const s = api.S; return a + 360 * Math.round((s.theta - a) / 360); };
      cvC.addEventListener('pointerdown', (e) => {
        const [x, y] = pos(e);
        const v = L.values(api.S.theta);
        const d = Math.hypot(x - pc.X(v.cos), y - pc.Y(v.sin));
        if (d <= 24) { drag = { id: e.pointerId }; cvC.setPointerCapture(e.pointerId); e.preventDefault(); }
        else drag = { tap: [x, y], id: e.pointerId };
      });
      cvC.addEventListener('pointermove', (e) => {
        if (!drag || drag.tap || drag.id !== e.pointerId) return;
        const [x, y] = pos(e);
        if (Math.hypot(pc.wx(x), pc.wy(y)) < 0.08) return;     // 中心の近くは向きが決まらない
        api.set('theta', U.clamp(Math.round(near(angleAt(x, y))), -360, 720));
      });
      const end = (e) => {
        if (drag && drag.tap && e.type === 'pointerup') {
          const [x, y] = pos(e);
          if (Math.hypot(x - drag.tap[0], y - drag.tap[1]) < 10 && Math.hypot(pc.wx(x), pc.wy(y)) > 0.25)
            api.set('theta', U.clamp(Math.round(near(angleAt(x, y))), -360, 720));
        }
        drag = null;
      };
      cvC.addEventListener('pointerup', end); cvC.addEventListener('pointercancel', end);
    },

    tick(dt, s) {
      // ドラッグ・入力・速さの変更があったら、そこを新しい出発点にする
      if (run.base === null || s.theta !== run.last || s.omega !== run.omega) { run.base = s.theta; run.omega = s.omega; s.t = 0; }
      s.t += dt;
      let th = run.base + s.omega * s.t;
      const end = th >= 720;
      if (end) th = 720;
      run.last = th;
      apiR.set('theta', th);
      run.last = s.theta;
      return !end;
    },
    resetTime(s) {
      // 「時間を最初にもどす」：再生を始めた角にもどす。プリセットなどで θ を変えたときは、その角が出発点
      if (run.base !== null && s.theta === run.last && run.base !== s.theta) {
        const b = run.base < 720 ? run.base : 0;
        run = { base: null, omega: null, last: null };
        s.t = 0;
        apiR.set('theta', b);
        return;
      }
      if (s.theta >= 720) { run = { base: null, omega: null, last: null }; s.t = 0; apiR.set('theta', 0); return; }
      run = { base: null, omega: null, last: null };
    },
    atEnd(s) { return s.theta >= 720; },

    draw(s) {
      drawCircle(s);
      drawGraph(s);
    },

    formula(s) {
      const th = s.theta;
      const head = TH + ' = ' + (isRad(s) ? radT(th) + (radIsFrac(th) ? '' : ' rad') + '<span style="font-weight:500;font-size:.8em">（' + degText(th) + '）</span>' : degText(th));
      const nw = (x) => '<span style="display:inline-block;white-space:nowrap;margin:0 .45em">' + x + '</span>';
      return nw(head) + nw(eqv('sin', th)) + nw(eqv('cos', th)) + nw(eqv('tan', th));
    },

    readouts(s) {
      const th = tidyDeg(s.theta), v = L.values(th), sn = L.signsOf(th);
      const sq = (x) => fix(x * x, 4);
      return [
        [TH + '（度・ラジアン）', degText(th) + ' = ' + radT(th) + (radIsFrac(th) ? '' : ' rad')],
        ['P の位置', quadName(L.quadrant(th))],
        ['点 P (cos ' + TH + ', sin ' + TH + ')', '(' + fix(v.cos, 4) + ', ' + fix(v.sin, 4) + ')'],
        ['符号', 'sin ' + sg(sn.sin) + '　cos ' + sg(sn.cos) + '　tan ' + (sn.tan === null ? '×' : sg(sn.tan))],
        ['sin²' + TH + ' + cos²' + TH, sq(v.sin) + ' + ' + sq(v.cos) + ' = ' + fmt(v.sin * v.sin + v.cos * v.cos, 6), 'ok']
      ];
    },

    explain(s) { return explain(s); },
    quiz(s) { return quiz(s); }
  });

  // ---------- 単位円 ----------
  function drawCircle(s) {
    const C = window.SimPlot.colors();
    const th = s.theta, v = L.values(th), tanOk = L.tanDefined(tidyDeg(th));
    const c = pc.begin();
    pc.axes({ xstep: 1, ystep: 1, grid: false, xlabel: 'x', ylabel: 'y' });
    const X0 = pc.X(0), Y0 = pc.Y(0), R = pc.sx;
    // 円
    c.save(); c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.arc(X0, Y0, R, 0, Math.PI * 2); c.stroke(); c.restore();
    // x = 1 の直線（tan をはかる線）
    const Rg = pc.range;
    pc.seg(1, Rg.ymin, 1, Rg.ymax, { color: C.c3, width: 1.2, dash: [2, 5] });
    // 角の弧（何周しても見えるよう、回るほど少し外へ）
    drawAngleArc(c, th, X0, Y0, R, C);
    // tan：原点から OP の向きにのばした直線と x = 1 の交点 T
    if (tanOk) {
      const tval = v.tan;
      pc.seg(0, 0, 1, tval, { color: C.c3, width: 2.2, dash: [8, 5] });
      if (v.cos < 0) pc.seg(0, 0, v.cos, v.sin, { color: C.c3, width: 2.2, dash: [8, 5] });
      if (tval <= Rg.ymax && tval >= Rg.ymin) {
        pc.point(1, tval, { color: C.c3, shape: 'diamond', r: 5, label: 'T', pos: 'e' });
      } else {
        pc.label('T は図の外（tan ' + 'θ ' + (Math.abs(tval) >= 1e4 ? (tval > 0 ? '＞ 10000' : '＜ ' + MINUS + '10000') : '≒ ' + fmt(tval, 2)) + '）', 1, tval > 0 ? Rg.ymax : Rg.ymin,
          { pos: tval > 0 ? 'sw' : 'nw', color: C.c3, size: 11.5, bold: true, gap: 6 });
      }
    } else {
      pc.label('tan θ は定義されない（OP が x = 1 と平行）', 0, Rg.ymax, { pos: 's', color: C.c3, size: 11.5, bold: true, gap: 4 });
    }
    pc.label('x = 1', 1, !tanOk || v.tan > 0 ? Rg.ymin : Rg.ymax, { pos: !tanOk || v.tan > 0 ? 'ne' : 'se', color: C.c3, size: 11, gap: 4 });
    // 動径 OP
    pc.seg(0, 0, v.cos, v.sin, { color: C.ink, width: 2.4 });
    // cos：x 軸上の線分、sin：P からのたての線分
    pc.seg(0, 0, v.cos, 0, { color: C.c1, width: 4.5 });
    pc.seg(v.cos, 0, v.cos, v.sin, { color: C.c2, width: 4.5 });
    if (Math.abs(v.cos) > 0.12) pc.label('cos θ', v.cos / 2, 0, { pos: v.sin >= 0 ? 's' : 'n', color: C.c1, size: 12, bold: true });
    if (Math.abs(v.sin) > 0.12) pc.label('sin θ', v.cos, v.sin / 2, { pos: v.cos >= 0 ? 'e' : 'w', color: C.c2, size: 12, bold: true });
    // 補助線：P の高さ（＝ sin θ）をグラフへ
    if (s.gsin && sideBySide()) pc.seg(v.cos, v.sin, Rg.xmax, v.sin, { color: C.c2, width: 1.2, dash: [3, 4] });
    // 点 P
    pc.point(v.cos, v.sin, { color: C.ink, r: 7, label: 'P', pos: v.sin >= 0 ? 'n' : 's' });
    // つかめることがわかるよう、P のまわりに輪
    c.save(); c.strokeStyle = C.muted; c.globalAlpha = 0.35; c.lineWidth = 1.5; c.beginPath(); c.arc(pc.X(v.cos), pc.Y(v.sin), 13, 0, Math.PI * 2); c.stroke(); c.restore();
    cvC.setAttribute('aria-label', '単位円：角 ' + degText(th) + '、点P(' + fix(v.cos, 3) + ', ' + fix(v.sin, 3) + ')。' + (tanOk ? 'T(1, ' + fix(v.tan, 3) + ')' : 'tan は定義されない'));
  }
  function drawAngleArc(c, th, X0, Y0, R, C) {
    if (Math.abs(th) < 0.5) return;
    const r0 = Math.min(0.24 * R, 34);
    const n = Math.max(12, Math.ceil(Math.abs(th) / 3));
    const rad = (a) => r0 + (Math.abs(a) / 360) * Math.min(0.09 * R, 10);
    c.save(); c.strokeStyle = C.c4; c.fillStyle = C.c4; c.lineWidth = 2; c.beginPath();
    let px = 0, py = 0;
    for (let i = 0; i <= n; i++) {
      const a = th * i / n, r = rad(a), ar = L.degToRad(a);
      px = X0 + r * Math.cos(ar); py = Y0 - r * Math.sin(ar);
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.stroke();
    // 矢じり（回る向き）
    const ar = L.degToRad(th), dir = th > 0 ? 1 : -1;
    const tx = -Math.sin(ar) * dir, ty = -Math.cos(ar) * dir;    // 画面での接線の向き
    const ang = Math.atan2(ty, tx);
    c.translate(px, py); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-8, -3.8); c.lineTo(-8, 3.8); c.closePath(); c.fill();
    c.restore();
    // θ の文字：弧の中ほど（今の向きの半分の角）
    const mid = L.degToRad(Math.abs(th) <= 360 ? th / 2 : th > 0 ? 135 : -135);
    const lr = rad(th) + 12;
    pcLabel('θ', X0 + lr * Math.cos(mid), Y0 - lr * Math.sin(mid), C.c4);
  }
  function pcLabel(t, x, y, color) { pc.label(t, x, y, { px: true, pos: 'c', color, size: 14, bold: true }); }

  function sideBySide() {
    if (!cvC || !cvG) return false;
    const a = cvC.getBoundingClientRect(), b = cvG.getBoundingClientRect();
    return Math.abs(a.top - b.top) < 2 && b.left > a.right - 2;
  }

  // ---------- グラフ ----------
  function drawGraph(s) {
    const C = window.SimPlot.colors();
    const th = s.theta, v = L.values(th);
    const a0 = L.graphStart(th);
    const side = sideBySide();
    pg.size();
    const narrow = pg.w < 420;
    const xmin = a0 - (narrow ? 34 : 26), xmax = a0 + 360 + (narrow ? 34 : 26);
    let ymin = -2, ymax = 2;
    if (side) {
      // 単位円と同じ縮尺・同じ高さに y = 0 をそろえる
      const rc = cvC.getBoundingClientRect(), rg = cvG.getBoundingClientRect();
      const y0px = rc.top + pc.Y(0) - rg.top, k = pc.sy, B = pg.plotBox;
      ymax = (y0px - B.t) / k; ymin = -(B.b - y0px) / k;
    }
    pg.view = { xmin, xmax, ymin, ymax };
    pg.begin();
    const rad = isRad(s);
    const xfmt = (x) => (rad ? L.radText(x) : fmt(x, 0) + '°');
    const ystep = pg.sy >= 70 ? 0.5 : 1;
    pg.axes({ xstep: 90, ystep, xfmt, xlabel: rad ? 'x [rad]' : 'x [°]', ylabel: 'y' });
    const c = pg.ctx, R = pg.range, B = pg.plotBox;
    // 30° ごとの小さな目もり
    c.save(); c.fillStyle = C.muted;
    const ax = Math.min(B.b, Math.max(B.t, pg.Y(0)));
    for (let x = Math.ceil(R.xmin / 30) * 30; x <= R.xmax; x += 30) { if (x % 90) c.fillRect(pg.X(x) - 0.5, ax - 2.5, 1, 5); }
    c.restore();
    // 今の周期の始まり（y 軸が見えないとき）
    if (a0 !== 0) {
      pg.vline(a0, { color: C.muted, width: 1, dash: [2, 3] });
      pg.vline(a0 + 360, { color: C.muted, width: 1, dash: [2, 3] });
    }
    const f = (fn) => (x) => fn(L.degToRad(x));
    // tan：漸近線と本体（点線）
    if (s.gtan) {
      for (let x = Math.ceil((R.xmin - 90) / 180) * 180 + 90; x <= R.xmax; x += 180) pg.vline(x, { color: C.c3, width: 1, dash: [1, 4] });
      const span = R.ymax - R.ymin;
      pg.fn(L.tanOrNaN, { color: C.c3, width: 2.6, dash: [2, 5], jump: (p, q) => Math.abs(q - p) > span });
    }
    if (s.gcos) pg.fn(f(Math.cos), { color: C.c1, width: 2.6, dash: [9, 6] });
    if (s.gsin) pg.fn(f(Math.sin), { color: C.c2, width: 3 });
    // 今の θ
    pg.vline(th, { color: C.ink, width: 1.2, dash: [4, 4] });
    if (s.gsin && side) pg.seg(R.xmin, v.sin, th, v.sin, { color: C.c2, width: 1.2, dash: [3, 4] });
    else if (s.gsin) pg.seg(a0, v.sin, th, v.sin, { color: C.c2, width: 1.2, dash: [3, 4] });
    const right = th - a0 > 250;
    if (s.gtan && v.tan !== null) pg.point(th, v.tan, { color: C.c3, shape: 'diamond', r: 5, label: 'tan', pos: right ? 'w' : 'e', labelColor: C.c3 });
    if (s.gcos) pg.point(th, v.cos, { color: C.c1, shape: 'square', r: 4.5, label: 'cos', pos: right ? 'sw' : 'se', labelColor: C.c1 });
    if (s.gsin) pg.point(th, v.sin, { color: C.c2, r: 5.5, label: 'sin', pos: right ? 'nw' : 'ne', labelColor: C.c2 });
    drawLegend(s, C);
    cvG.setAttribute('aria-label', 'グラフ：横軸は角 x（' + xfmt(a0) + '〜' + xfmt(a0 + 360) + '）。' +
      [s.gsin ? 'y = sin x（実線）' : '', s.gcos ? 'y = cos x（破線）' : '', s.gtan ? 'y = tan x（点線）' : ''].filter(Boolean).join('、') + '。今の角 ' + degText(th) + ' にたて線');
  }
  function drawLegend(s, C) {
    const items = [s.gsin && ['y = sin x', C.c2, []], s.gcos && ['y = cos x', C.c1, [9, 6]], s.gtan && ['y = tan x', C.c3, [2, 5]]].filter(Boolean);
    if (!items.length) return;
    const c = pg.ctx, fs = pg.w < 420 ? 11 : 12;
    c.save(); c.font = '600 ' + fs + 'px ' + C.fontEn;
    const w = Math.max(...items.map((i) => c.measureText(i[0]).width)) + 36, h = items.length * (fs + 6) + 6;
    const x0 = s.theta - L.graphStart(s.theta) > 180 && L.graphStart(s.theta) < 0 ? pg.plotBox.l + 30 : pg.w - w - 12, y0 = 12;
    c.fillStyle = C.paper; c.globalAlpha = 0.9; c.fillRect(x0, y0, w, h); c.globalAlpha = 1;
    c.strokeStyle = C.rule; c.lineWidth = 1; c.strokeRect(x0 + .5, y0 + .5, w, h);
    items.forEach((it, i) => {
      const y = y0 + 6 + i * (fs + 6) + fs / 2;
      c.strokeStyle = it[1]; c.lineWidth = 2.6; c.setLineDash(it[2]); c.beginPath(); c.moveTo(x0 + 6, y); c.lineTo(x0 + 28, y); c.stroke();
      c.setLineDash([]); c.fillStyle = it[1]; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(it[0], x0 + 32, y);
    });
    c.restore();
  }

  const LEG = '<span class="sw" style="color:var(--c2)"></span>y = sin <i class="v">x</i>（実線）　<span class="sw dash" style="color:var(--c1)"></span>y = cos <i class="v">x</i>（破線）　<span class="sw dot" style="color:var(--c3)"></span>y = tan <i class="v">x</i>（点線）';
  // ---------- なぜ？ ----------
  function explain(s) {
    const th = tidyDeg(s.theta), v = L.values(th), q = L.quadrant(th), sn = L.signsOf(th);
    const n = L.normDeg(th);
    let h = '<h3>単位円で sin・cos・tan を決める</h3>' +
      '<p>半径 1 の円の上で、<i class="v">x</i> 軸の正の向きから ' + TH + ' だけ回った点を P(<i class="v">x</i>, <i class="v">y</i>) とする。このとき</p>' +
      '<span class="eq">cos ' + TH + ' = <i class="v">x</i>　　sin ' + TH + ' = <i class="v">y</i>　　tan ' + TH + ' = ' + frac(V('y'), V('x')) + '（OP の傾き）</span>' +
      '<p>直角三角形の三角比（高1）は 0° &lt; ' + TH + ' &lt; 90° のときだけ。単位円で決めると、90° より大きい角でも、マイナスの角でも同じように値が決まる。' +
      'tan ' + TH + ' は、直線 OP を <i class="v">x</i> = 1 までのばした点 T(1, tan ' + TH + ') の高さとしても見える（T も OP の上にあるので、傾き ' + frac(V('y'), V('x')) + ' = ' + frac('tan ' + TH, '1') + '）。</p>';
    h += '<p class="now">今は ' + TH + ' = ' + degText(th) + ' = ' + radT(th) + (radIsFrac(th) ? '' : ' rad') + '。P(' + fix(v.cos, 4) + ', ' + fix(v.sin, 4) + ') なので<br>' +
      eqv('cos', th) + '、' + eqv('sin', th) + '、' + (v.tan === null ? 'tan ' + TH + ' は定義されない（<i class="v">x</i> = 0 で割り算ができない）。' : eqv('tan', th) + '。') + '</p>';
    // 符号
    h += '<h3>象限ごとの符号</h3><p>P がどの象限にあるかで、<i class="v">x</i>（cos）・<i class="v">y</i>（sin）の符号が決まる。tan = <i class="v">y</i>/<i class="v">x</i> は「同じ符号なら＋、ちがえば −」。</p>' +
      '<div class="tbl"><table><tr><th></th><th>第1象限</th><th>第2象限</th><th>第3象限</th><th>第4象限</th></tr>' +
      '<tr><th>sin ' + TH + '</th><td>＋</td><td>＋</td><td>' + MINUS + '</td><td>' + MINUS + '</td></tr>' +
      '<tr><th>cos ' + TH + '</th><td>＋</td><td>' + MINUS + '</td><td>' + MINUS + '</td><td>＋</td></tr>' +
      '<tr><th>tan ' + TH + '</th><td>＋</td><td>' + MINUS + '</td><td>＋</td><td>' + MINUS + '</td></tr></table></div>';
    h += '<p class="now">今の P は ' + quadName(q) + '。sin ' + sg(sn.sin) + '、cos ' + sg(sn.cos) + '、tan ' + (sn.tan === null ? 'は定義されない' : sg(sn.tan)) + '。' +
      (typeof q === 'string' ? '軸の上の点はどの象限にも入らない。' : '') + '</p>';
    // 三平方
    h += '<h3>sin²θ + cos²θ = 1 になるわけ</h3><p>P から <i class="v">x</i> 軸に垂線を下ろすと、たて |sin ' + TH + '|、横 |cos ' + TH + '|、斜辺（半径）1 の直角三角形ができる。三平方の定理で</p>' +
      '<span class="eq">sin²' + TH + ' + cos²' + TH + ' = 1²= 1</span>' +
      '<p>これは「P が半径 1 の円 <i class="v">x</i>² + <i class="v">y</i>² = 1 の上にある」ということそのもの。どんな角でも成り立つ。</p>' +
      '<p class="now">今は (' + fix(v.sin, 4) + ')² + (' + fix(v.cos, 4) + ')² = ' + fix(v.sin * v.sin, 4) + ' + ' + fix(v.cos * v.cos, 4) + ' = ' + fmt(v.sin * v.sin + v.cos * v.cos, 6) + '</p>';
    // 周期
    h += '<h3>周期：θ と θ + 360° は同じ点</h3><p>360° 回るとちょうど 1 周して同じ点 P にもどる。だから sin・cos は 360° ごとに同じ値をくり返す（<b>周期 360°＝2π</b>）。' +
      'tan は、180° 回った点（原点について反対側の点）でも OP の直線は同じなので、<b>周期 180°＝π</b>。</p>' +
      '<span class="eq">sin(' + TH + ' + 360°) = sin ' + TH + '　cos(' + TH + ' + 360°) = cos ' + TH + '　tan(' + TH + ' + 180°) = tan ' + TH + '</span>';
    h += '<p class="now">今の ' + TH + ' = ' + degText(th) + ' は、' + (th === n ? '0° 以上 360° 未満の角。' : degText(n) + ' と同じ点（' + degText(th) + ' = ' + plus360(n, th) + '）。') +
      (v.tan === null ? '' : 'また tan(' + degText(th) + ' + 180°) = tan' + (th < 0 ? '(' + degText(th) + ')' : ' ' + degText(th)) + ' ' + valOf(th, 'tan').rel + ' ' + valOf(th, 'tan').html + '。') + '</p>';
    // ラジアン
    const rf = L.radFrac(th);
    h += '<h3>度とラジアン（弧度法）</h3><p>半径 1 の円で、角 ' + TH + ' に対する弧の長さを角の大きさとするのがラジアン。1 周 360° の弧の長さは 2π なので</p>' +
      '<span class="eq">180° = π（rad）　1° = ' + frac('π', '180') + '　1 rad = ' + frac('180°', 'π') + ' ≒ 57.3°</span>' +
      '<p class="now">今は ' + degText(th) + ' × ' + frac('π', '180') + ' = ' + (rf ? radT(th) : '≒ ' + radT(th)) + (rf ? '（≒ ' + fix(L.degToRad(th), 4) + '）' : '') + '。単位円で P までの弧の長さ（' + TH + ' &gt; 0 なら）がこの値になる。</p>';
    h += '<h3>グラフとのつながり</h3><p>' + LEG + '</p><p>グラフの横軸は角 <i class="v">x</i>、たて軸は値。sin のグラフの高さは単位円の P の高さ、cos のグラフの高さは P の横の位置。P を回すと sin は 0 → 1 → 0 → −1 → 0 と波になる。cos は sin を 90° 左にずらした形（cos <i class="v">x</i> = sin(<i class="v">x</i> + 90°)）。tan は 90° + 180°×<i class="v">n</i> で T が無限に遠くなるので、そこに漸近線ができる。</p>';
    return h;
  }

  // ---------- 確認問題 ----------
  const POOL = ['0', '1/2', '√2/2', '√3/2', '1', '−1/2', '−√2/2', '−√3/2', '−1'];
  const TPOOL = ['0', '1/√3', '1', '√3', '−1/√3', '−1', '−√3'];
  const neg = (t) => (t === '0' ? '0' : t[0] === MINUS ? t.slice(1) : MINUS + t);
  const tH = (t) => {   // '−√3/2' → HTML
    if (t === '定義されない') return t;
    const m = t.match(/^(−?)([^/]+)(?:\/(.+))?$/);
    return m[1] + (m[3] ? frac(m[2], m[3]) : m[2]);
  };
  // 選択肢が 4 つに足りないときに足す。足した選択肢にも「その値になるのはどんな角か」の説明をつける
  function fill(m, pool, fn, n) {
    for (const t of pool) {
      if (m.choices.length >= (n || 4)) break;
      if (m.choices.indexOf(t) >= 0) continue;
      m.why[m.choices.length] = whyVal(fn, t);
      m.choices.push(t);
    }
    return m;
  }
  // 0°〜359° で fn の値が t になる有名角
  function whyVal(fn, t) {
    const hit = [];
    for (let a = 0; a < 360; a += 15) {
      const e = L.exact(a);
      if (e && e[fn] && e[fn].text === t) hit.push(a + '°');
    }
    return hit.length ? fn + ' が ' + tH(t) + ' になるのは ' + hit.join('、') + ' など。単位円で P の位置を確かめよう（' + (fn === 'sin' ? 'sin は <i class="v">y</i> 座標' : fn === 'cos' ? 'cos は <i class="v">x</i> 座標' : 'tan は OP の傾き') + '）。'
      : 'その値にはならない。単位円で確かめよう。';
  }
  function htmlize(m) { m.choices = m.choices.map(tH); return m; }

  // 370° → '10° + 360°'、−90° → '270° − 360°'
  function plus360(n, d) {
    const k = Math.round((d - n) / 360);
    return fmt(n, 1) + '° ' + (k > 0 ? '+' : MINUS) + ' 360°' + (Math.abs(k) === 1 ? '' : '×' + Math.abs(k));
  }
  function quiz(s0) {
    let d = tidyDeg(s0.theta), note = '';
    if (!L.isFamous(d)) {
      const f = L.nearestFamous(d);
      note = '<p class="hint">今の ' + TH + ' = ' + degText(d) + ' は有名角ではないので、近い ' + TH + ' = ' + f + '° で出題するね。</p>';
      d = f;
    }
    const D = degText(d), DA = d < 0 ? '(' + D + ')' : ' ' + D, ex = L.exact(d), q = L.quadrant(d), sn = L.signsOf(d), n = L.normDeg(d);
    const ref = Math.min(n % 180, 180 - (n % 180));
    const qs = [];
    const qInfo = typeof q === 'number' ? 'P は第' + q + '象限にある' : 'P は' + quadName(q) + 'にある';
    // 1. sin
    let m = U.mc(ex.sin.text, [
      [ex.cos.text, 'それは cos' + DA + '（P の <i class="v">x</i> 座標）。sin は P の <i class="v">y</i> 座標。'],
      [neg(ex.sin.text), '符号に注意。' + qInfo + 'ので、<i class="v">y</i> 座標（sin）は ' + (sn.sin > 0 ? '正' : sn.sin < 0 ? '負' : '0') + '。'],
      [neg(ex.cos.text), 'cos の値で、しかも符号もちがう。sin は P の <i class="v">y</i> 座標。']
    ]);
    fill(m, POOL.slice().sort(() => Math.random() - 0.5), 'sin');
    qs.push(Object.assign(htmlize(m), { q: note + '<p>sin' + DA + ' の値は？</p>',
      explain: '<p>' + D + ' 回った点 P は (' + tH(ex.cos.text) + ', ' + tH(ex.sin.text) + ')。sin は P の <i class="v">y</i> 座標なので sin' + DA + ' = ' + tH(ex.sin.text) + '。' +
        (ref ? '基準になる角は ' + ref + '°（sin ' + ref + '° = ' + tH(L.exact(ref).sin.text) + '）で、符号は象限で決まる。' : '') + '</p>' }));
    // 2. tan（定義されないときは「定義されない」が正解）
    if (ex.tan) {
      const t = ex.tan.text;
      const inv = { '1/√3': '√3', '√3': '1/√3', '−1/√3': '−√3', '−√3': '−1/√3' }[t];
      m = U.mc(t, [
        [neg(t), '符号に注意。tan = <i class="v">y</i>/<i class="v">x</i>。' + qInfo + 'ので、' + (sn.tan > 0 ? 'sin と cos が同じ符号 → ＋。' : sn.tan < 0 ? 'sin と cos がちがう符号 → ' + MINUS + '。' : 'sin = 0 なので 0。')],
        [inv, 'tan = ' + frac('sin', 'cos') + '（<i class="v">y</i>/<i class="v">x</i>）。' + frac('cos', 'sin') + ' と逆にしていない？'],
        ['定義されない', 'tan が定義されないのは cos ' + TH + ' = 0（90°、270° など）のときだけ。今は cos' + DA + ' = ' + tH(ex.cos.text) + ' ≠ 0。']
      ]);
      fill(m, TPOOL.slice().sort(() => Math.random() - 0.5), 'tan');
      qs.push(Object.assign(htmlize(m), { q: '<p>tan' + DA + ' の値は？</p>',
        explain: '<p>tan' + DA + ' = ' + frac('sin' + DA, 'cos' + DA) + ' = ' + tH(ex.sin.text) + ' ÷ ' + (sn.cos < 0 ? '(' + tH(ex.cos.text) + ')' : tH(ex.cos.text)) + ' = ' + tH(t) + '。単位円では、OP をのばして <i class="v">x</i> = 1 と交わる点 T の高さ。</p>' }));
    } else {
      m = U.mc('定義されない', [
        ['0', 'cos' + DA + ' = 0 なので、tan = sin/cos は 0 で割ることになる。0 にはならない。'],
        [sn.sin > 0 ? '1' : MINUS + '1', 'sin' + DA + ' = ' + tH(ex.sin.text) + ' だけど、tan は sin ÷ cos。cos = 0 で割れない。'],
        [sn.sin > 0 ? '∞' : MINUS + '∞', '∞ は数ではないので「値」にはならない。OP は <i class="v">x</i> = 1 と平行で、T ができない。']
      ]);
      qs.push(Object.assign(m, { q: '<p>tan' + DA + ' の値は？</p>',
        explain: '<p>' + D + ' のとき P = (0, ' + tH(ex.sin.text) + ')。tan = <i class="v">y</i>/<i class="v">x</i> で <i class="v">x</i> = 0 なので割り算ができない。単位円でも OP（<i class="v">y</i> 軸）は直線 <i class="v">x</i> = 1 と平行で、交点 T がない。だから tan' + DA + ' は定義されない（グラフでは漸近線）。</p>' }));
    }
    // 3. 象限と符号
    if (typeof q === 'number') {
      const lab = (s, c, t) => 'sin ' + s + '、cos ' + c + '、tan ' + t;
      const P = '＋';
      const table = { 1: [P, P, P], 2: [P, MINUS, MINUS], 3: [MINUS, MINUS, P], 4: [MINUS, P, MINUS] };
      const right = table[q];
      const wr = [1, 2, 3, 4].filter((k) => k !== q).map((k) => [lab(...table[k]), 'それは第' + k + '象限の符号。' + D + ' の動径は第' + q + '象限にある。']);
      m = U.mc(lab(...right), wr);
      qs.push(Object.assign(m, { q: '<p>' + TH + ' = ' + D + ' のとき、sin ' + TH + '・cos ' + TH + '・tan ' + TH + ' の符号の組み合わせは？</p>',
        explain: '<p>' + D + (d !== n ? ' は ' + n + '° と同じ向きで、' : ' の') + '動径は第' + q + '象限。P の <i class="v">x</i> 座標（cos）は ' + (right[1] === P ? '正' : '負') + '、<i class="v">y</i> 座標（sin）は ' + (right[0] === P ? '正' : '負') + '。tan = <i class="v">y</i>/<i class="v">x</i> は ' + (right[2] === P ? '同じ符号どうしで正' : 'ちがう符号どうしで負') + '。</p>' }));
    } else {
      const pt = (x, y) => '(' + x + ', ' + y + ')';
      const cx = ex.cos.text, sy = ex.sin.text;
      const AX = [['1', '0', 0], ['0', '1', 90], [MINUS + '1', '0', 180], ['0', MINUS + '1', 270]];
      const wr = AX.filter((a) => a[2] !== Math.round(n)).map((a) => {
        const diff = Math.abs(a[2] - n);
        const why = a[0] === sy && a[1] === cx ? '<i class="v">x</i> 座標が cos、<i class="v">y</i> 座標が sin。逆になっている（それは ' + a[2] + '° の点）。' :
          diff === 180 ? 'それは 180° 先（原点の反対側）の点。' : 'それは ' + a[2] + '° の点。回る向き（反時計回りが正）と大きさを確かめよう。';
        return [pt(a[0], a[1]), why];
      });
      m = U.mc(pt(cx, sy), wr);
      qs.push(Object.assign(m, { q: '<p>単位円で ' + D + ' 回った点 P の座標は？</p>',
        explain: '<p>' + D + (d !== n ? '（= ' + plus360(n, d) + '）' : '') + ' 回ると P は' + quadName(q) + 'にくる。P = (cos' + DA + ', sin' + DA + ') = ' + pt(cx, sy) + '。</p>' }));
    }
    // 4. ラジアン（0° のときは sin² + cos²）
    if (d !== 0) {
      const rf = L.radFrac(d);
      const rt = (k, den) => L.radText(180 * k / den);
      const cands = [
        [rt(rf.n * 2, rf.den), '180° = π。2 倍にしてしまっている（360° = π ではない）。'],
        [rt(rf.n, rf.den * 2), '180° = π なので、' + D + ' = ' + fmt(d, 0) + ' × π/180。半分にしている。'],
        [fmt(d, 0) + 'π', '度の数に π をかけるのではなく、' + frac('π', '180') + ' をかける。'],
        [rt(-rf.n, rf.den), '符号に注意。度がマイナスならラジアンもマイナス。']
      ];
      m = U.mc(L.radText(d), cands);
      qs.push(Object.assign(m, { q: '<p>' + D + ' をラジアン（弧度法）で表すと？</p>',
        explain: '<p>180° = π なので、' + D + ' × ' + frac('π', '180') + ' = ' + L.radText(d) + '。</p>' }));
    } else {
      m = U.mc('1', [['0', '0° でも P(1, 0) は円の上。sin²0° + cos²0° = 0 + 1 = 1。'], ['2', 'sin と cos がどちらも 1 になる角はない。'], ['sin 0° + cos 0° と同じ', '2 乗の和と、ただの和はちがう。']]);
      qs.push(Object.assign(m, { q: '<p>sin²0° + cos²0° の値は？</p>', explain: '<p>どんな角でも sin²' + TH + ' + cos²' + TH + ' = 1（単位円で三平方の定理）。</p>' }));
    }
    // 5. 周期
    const per = [
      ['sin(' + D + ' + 360°)', ex.sin.text, '360° 回るとちょうど 1 周して同じ点 P にもどる。だから sin の値は同じ。'],
      ['cos(' + D + ' + 180°)', neg(ex.cos.text), '180° 回ると原点について反対側の点になる。<i class="v">x</i> 座標（cos）は符号が逆。']
    ];
    const pick = per[Math.abs(Math.round(d / 30)) % 2];
    const ans = pick[1];
    m = U.mc(ans, [
      [neg(ans), pick === per[0] ? '360° 回ると同じ点にもどる。符号は変わらない。' : '180° 回ると P は原点の反対側へ。cos は符号が逆になる（0 なら 0）。'],
      [ex.cos.text, pick === per[0] ? 'sin を聞いている。cos ではない。' : 'cos の周期は 360°。180° ずらすと同じにはならない（符号が逆）。'],
      [pick === per[0] ? neg(ex.cos.text) : ex.sin.text, pick === per[0] ? 'sin を聞いていて、符号も変わらない。' : 'cos を聞いている。sin ではない。']
    ]);
    fill(m, POOL.slice().sort(() => Math.random() - 0.5), pick === per[0] ? 'sin' : 'cos');
    qs.push(Object.assign(htmlize(m), { q: '<p>' + pick[0] + ' の値は？</p>',
      explain: '<p>' + pick[2] + ' ' + pick[0] + ' = ' + (pick === per[0] ? 'sin' + DA : MINUS + 'cos' + DA) + ' = ' + tH(ans) + '。sin・cos の周期は 360°、tan の周期は 180°。</p>' }));
    return qs;
  }
})();
