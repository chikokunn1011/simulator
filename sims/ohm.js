/* オームの法則（抵抗 1 つ・直列・並列）。回路図＋電流の流れ（点）＋ I-V グラフ */
(function () {
  'use strict';
  const L = window.SimLib.ohm;
  const U = window.SimApp.util;
  const { frac } = U;

  // ---------- 数の書き方（有効数字 3 桁、末尾の 0 は消す） ----------
  const n3 = (v) => L.sigStr(v, 3).text;
  const ex = (v) => L.sigStr(v, 3).exact;
  const approx = (...vs) => (vs.every(ex) ? '=' : '≒');
  const vv = (s) => '<i class="v">' + s + '</i>';
  const V_ = vv('V'), R_ = vv('R'), I_ = vv('I'), P_ = vv('P');
  const R1h = vv('R') + '₁', R2h = vv('R') + '₂', V1h = vv('V') + '₁', V2h = vv('V') + '₂', I1h = vv('I') + '₁', I2h = vv('I') + '₂';
  // 電流：'0.3 A'、1 A 未満は（300 mA）も
  function amp(I, small) {
    const c = L.current(I, 3);
    if (!c.mA) return c.a;
    return c.a + (small ? ' <small>(' + c.mA + ')</small>' : '（' + c.mA + '）');
  }
  const ampT = (I) => { const c = L.current(I, 3); return c.a + (c.mA ? '（' + c.mA + '）' : ''); };
  const MODE_NAME = { single: '抵抗 1 つ', series: '直列', parallel: '並列' };

  const solveS = (s) => L.solve(s.mode, s.V, s.R1, s.R2);

  // ---------- 見た目（この教材だけ：図を 2 段にする） ----------
  const css = document.createElement('style');
  css.textContent =
    'body[data-sim="ohm"] .stage{grid-template-rows:minmax(0,1.25fr) minmax(0,1fr)}' +
    '@media (max-width:899px){body[data-sim="ohm"] .stage{--stage-h:clamp(230px,33vh,380px)}}' +
    'body[data-sim="ohm"] .ro dd small{font-size:.78em;font-weight:600;color:var(--muted);white-space:nowrap}' +
    '@media (max-width:899px) and (min-height:560px){body[data-sim="ohm"] .ro dd small{display:block;line-height:1.1}}';
  document.head.append(css);

  let cvC, cvG, ctxC, plot;
  const ph = { main: 0, b1: 0, b2: 0 };   // 点の位置（道すじにそった長さ、点の間かくでわった余り）
  let capped = false;
  const SP = 30;          // 点の間かく（図の単位）
  const KV = 100;         // 1 A あたりの点の速さ（図の単位/秒）
  const VMAX = 400;       // 点の速さの上限（4 A 以上はこれで頭打ち。比は保つ）
  // 回路図の大きさ（図の単位）と部品の位置
  const W0 = 680, H0 = 320;
  const G = { xL: 70, xR: 610, yT: 82, yB: 262, yC: 172, xB1: 420, xA: 190 };

  window.SimApp.register({
    id: 'ohm',
    animated: true,
    intro:
      '<p>電池に抵抗（電熱線など）をつなぐと電流が流れる。電圧を大きくすると電流はどうなる？ 抵抗を大きくすると？ 抵抗を 2 つにして<b>直列</b>・<b>並列</b>につなぐと、電流と電圧はどう分かれる？</p>' +
      '<p>電流計 Ⓐ・電圧計 Ⓥ の値と、下の <b>I-V グラフ</b>（電圧と電流の関係）で確かめよう。▶ 再生で、導線を流れる電流のようすが点の動きで見える。</p>' +
      '<p class="hint">中2（電流と電圧・オームの法則・直列と並列・電力）〜高1 物理基礎（電気抵抗・消費電力）。</p>',
    assumptions: [
      '導線と電流計の抵抗は 0、電圧計には電流が流れない（理想的な計器）として計算している。',
      '電源（電池）の内部抵抗はないとしている。電源の電圧はつなぐものによらず一定。',
      '抵抗の値は温度で変わらないとしている（本物の電熱線や豆電球は、熱くなると抵抗が大きくなる）。',
      '抵抗は 1 Ω 以上。0 Ω（導線だけで + 極と − 極をつなぐショート）は、電流がとても大きくなって危ないので扱わない。',
      '動く点の速さは「電流の大きさのイメージ」で、電流に比例させている（4 A をこえると速さは上限で頭打ち、比はそのまま）。実際に導線の中を電子が動く速さではない（実際はとてもおそい）。',
      '数は有効数字 3 けたで表示している（割り切れないときは ≒）。'
    ],
    choices: [{ key: 'mode', label: 'つなぎ方', options: [['single', '抵抗 1 つ'], ['series', '直列（R₁・R₂）'], ['parallel', '並列（R₁・R₂）']], value: 'single' }],
    params: [
      { key: 'V', label: '電源の電圧 <i class="v">V</i>', min: 0, max: 12, step: 0.1, value: 6, unit: 'V', digits: 1 },
      { key: 'R1', label: '抵抗 <i class="v">R</i>₁', min: 1, max: 100, step: 1, value: 20, unit: 'Ω', digits: 0 },
      { key: 'R2', label: '抵抗 <i class="v">R</i>₂', min: 1, max: 100, step: 1, value: 30, unit: 'Ω', digits: 0, show: (s) => s.mode !== 'single' }
    ],
    toggles: [
      { key: 'flow', label: '電流の流れ（動く点）', value: true },
      { key: 'electron', label: '電子の流れにする', value: false },
      { key: 'meter', label: '電圧計 Ⓥ', value: true }
    ],
    presets: [
      { label: '6 V・20 Ω', values: { mode: 'single', V: 6, R1: 20 } },
      { label: '12 V・10 Ω', values: { mode: 'single', V: 12, R1: 10 } },
      { label: '直列 10 Ω＋20 Ω（12 V）', values: { mode: 'series', V: 12, R1: 10, R2: 20 } },
      { label: '並列 10 Ω と 10 Ω（合成 5 Ω）', values: { mode: 'parallel', V: 6, R1: 10, R2: 10 } },
      { label: '並列 20 Ω と 30 Ω（合成 12 Ω）', values: { mode: 'parallel', V: 12, R1: 20, R2: 30 } }
    ],

    init(api) {
      cvC = document.createElement('canvas');
      cvC.setAttribute('role', 'img');
      cvG = document.createElement('canvas');
      cvG.setAttribute('role', 'img');
      api.stage.append(cvC, cvG);
      ctxC = cvC.getContext('2d');
      plot = new window.SimPlot(cvG, { xmin: 0, xmax: 12.8, ymin: 0, ymax: 1, pad: { l: 4, r: 12, t: 6, b: 4 }, xlabel: 'V [V]', ylabel: 'I [A]' });
    },

    tick(dt, s) {
      const o = solveS(s);
      if (!o.ok) return;
      const dir = s.electron ? -1 : 1;
      const f = speedFactor(o);
      const adv = (I) => dir * KV * I * f * dt;
      ph.main = mod(ph.main + adv(o.I), SP);
      ph.b1 = mod(ph.b1 + adv(o.I1), SP);
      ph.b2 = mod(ph.b2 + adv(s.mode === 'parallel' ? o.I2 : 0), SP);
    },
    resetTime() { ph.main = 0; ph.b1 = 0; ph.b2 = 0; },

    draw(s) {
      const o = solveS(s);
      drawCircuit(s, o);
      drawGraph(s, o);
    },

    formula(s) {
      const o = solveS(s);
      if (!o.ok) return '—';
      const main = V_ + ' = ' + R_ + I_ + '　→　' + n3(o.V) + ' V ' + approx(o.R, o.I) + ' ' + n3(o.R) + ' Ω × ' + n3(o.I) + ' A';
      let sub = '';
      if (s.mode === 'single') {
        sub = I_ + ' = ' + frac(V_, R_) + ' = ' + n3(o.V) + ' ÷ ' + n3(o.R) + ' ' + approx(o.I) + ' ' + ampT(o.I);
      } else if (s.mode === 'series') {
        sub = '直列：' + R_ + ' = ' + R1h + ' + ' + R2h + ' = ' + n3(o.R1) + ' + ' + n3(o.R2) + ' = ' + n3(o.R) + ' Ω';
      } else {
        sub = '並列：' + frac('1', R_) + ' = ' + frac('1', R1h) + ' + ' + frac('1', R2h) + '　→　' + R_ + ' = ' +
          frac(R1h + R2h, R1h + ' + ' + R2h) + ' = ' + frac(n3(o.R1) + '×' + n3(o.R2), n3(o.R1) + '+' + n3(o.R2)) + ' ' + approx(o.R) + ' ' + n3(o.R) + ' Ω';
      }
      return main + '<span class="sub">' + sub + '</span>';
    },

    readouts(s) {
      const o = solveS(s);
      if (!o.ok) return [['電流', '—']];
      const rows = [
        ['全体の電流 ' + I_, amp(o.I, true)],
        [s.mode === 'single' ? '抵抗 ' + R_ : '合成抵抗 ' + R_, (ex(o.R) ? '' : '≒') + n3(o.R) + ' Ω'],
        ['全体の電力 ' + P_, (ex(o.P) ? '' : '≒') + n3(o.P) + ' W']
      ];
      if (s.mode === 'single') {
        rows.push(['抵抗にかかる電圧', n3(o.V1) + ' V']);
        return rows;
      }
      rows.push(
        [R1h + ' の電圧 ' + V1h, (ex(o.V1) ? '' : '≒') + n3(o.V1) + ' V'],
        [R2h + ' の電圧 ' + V2h, (ex(o.V2) ? '' : '≒') + n3(o.V2) + ' V'],
        [R1h + ' の電流 ' + I1h, amp(o.I1, true)],
        [R2h + ' の電流 ' + I2h, amp(o.I2, true)],
        [R1h + ' の電力 ' + P_ + '₁', (ex(o.P1) ? '' : '≒') + n3(o.P1) + ' W'],
        [R2h + ' の電力 ' + P_ + '₂', (ex(o.P2) ? '' : '≒') + n3(o.P2) + ' W']
      );
      return rows;
    },

    explain(s) { return explain(s); },
    quiz(s) { return quiz(s); }
  });

  function mod(a, m) { return ((a % m) + m) % m; }
  function speedFactor(o) {
    const v = KV * Math.abs(o.I);
    capped = v > VMAX;
    return capped ? VMAX / v : 1;
  }

  // =====================================================================
  // 回路図（図の単位：横 680 × たて 320 を、canvas に合わせて拡大・縮小）
  // =====================================================================

  function drawCircuit(s, o) {
    const C = window.SimPlot.colors();
    const r = cvC.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cvC.width !== Math.round(w * dpr) || cvC.height !== Math.round(h * dpr)) { cvC.width = Math.round(w * dpr); cvC.height = Math.round(h * dpr); }
    const c = ctxC;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = C.paper; c.fillRect(0, 0, w, h);
    const k = Math.min(w / W0, h / H0);
    c.setTransform(dpr * k, 0, 0, dpr * k, dpr * (w - W0 * k) / 2, dpr * (h - H0 * k) / 2);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const fs = Math.max(15, 11.5 / k);       // 画面で 11.5px 以上になる文字の大きさ
    const compact = fs > 18;                     // 小さい画面：ラベルを短くする
    const lw = Math.max(2.2, 1.6 / k);
    const font = (sz, b) => (b ? '700 ' : '500 ') + sz + 'px ' + C.font;
    const text = (t, x, y, al, bl, col, sz, b) => {
      c.font = font(sz || fs, b); c.textAlign = al || 'center'; c.textBaseline = bl || 'middle';
      c.lineWidth = 4; c.strokeStyle = C.paper; c.strokeText(t, x, y);
      c.fillStyle = col || C.ink; c.fillText(t, x, y);
    };
    const line = (pts, col, wd) => {
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.strokeStyle = col || C.ink; c.lineWidth = wd || lw; c.setLineDash([]); c.stroke();
    };
    const node = (x, y) => { c.beginPath(); c.arc(x, y, Math.max(4, 3 / k), 0, Math.PI * 2); c.fillStyle = C.ink; c.fill(); };
    const { xL, xR, yT, yB, yC, xB1, xA } = G;
    const par = s.mode === 'parallel';
    const bt = yC - 9, bb = yC + 9;     // 電池の + 極（長い線）・− 極（短い線）

    // ---- 導線の道すじ（電流の向き：+ 極 → 外の回路 → − 極） ----
    let paths;
    if (!par) {
      paths = [{ key: 'main', I: o.I, pts: [[xL, bt], [xL, yT], [xR, yT], [xR, yB], [xL, yB], [xL, bb]] }];
    } else {
      paths = [
        { key: 'main', I: o.I, pts: [[xL, bt], [xL, yT], [xB1, yT]] },
        { key: 'b1', I: o.I1, pts: [[xB1, yT], [xB1, yB]] },
        { key: 'b2', I: o.I2, pts: [[xB1, yT], [xR, yT], [xR, yB], [xB1, yB]] },
        { key: 'main', I: o.I, pts: [[xB1, yB], [xL, yB], [xL, bb]] }
      ];
    }
    paths.forEach((p) => line(p.pts));

    // ---- 電圧計の導線（電流は流れない） ----
    const meters = [];
    if (s.meter) {
      if (s.mode === 'single') meters.push({ kind: 'h', x: 400, a: 335, b: 465, y: 30, lab: 'V' });
      else if (s.mode === 'series') { meters.push({ kind: 'h', x: 290, a: 232, b: 348, y: 30, lab: 'V₁' }); meters.push({ kind: 'h', x: 490, a: 432, b: 548, y: 30, lab: 'V₂' }); }
      else { meters.push({ kind: 'v', x: xB1, side: -50, lab: 'V₁' }); meters.push({ kind: 'v', x: xR, side: 42, lab: 'V₂' }); }
      meters.forEach((m) => {
        if (m.kind === 'h') { line([[m.a, yT], [m.a, m.y], [m.b, m.y], [m.b, yT]], C.ink, lw * 0.8); node(m.a, yT); node(m.b, yT); }
        else { const xm = m.x + m.side; line([[m.x, yC - 60], [xm, yC - 60], [xm, yC + 60], [m.x, yC + 60]], C.ink, lw * 0.8); node(m.x, yC - 60); node(m.x, yC + 60); }
      });
    }

    // ---- 動く点（電流 or 電子） ----
    if (s.flow && o.ok) {
      speedFactor(o);
      c.save();
      const dotR = Math.max(4.2, 3.2 / k);
      paths.forEach((p) => {
        const segs = []; let total = 0;
        for (let i = 1; i < p.pts.length; i++) { const L0 = Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]); segs.push(L0); total += L0; }
        for (let d = ph[p.key]; d < total; d += SP) {
          let rem = d, i = 0;
          while (i < segs.length - 1 && rem > segs[i]) { rem -= segs[i]; i++; }
          const t = segs[i] ? rem / segs[i] : 0;
          const x = p.pts[i][0] + (p.pts[i + 1][0] - p.pts[i][0]) * t, y = p.pts[i][1] + (p.pts[i + 1][1] - p.pts[i][1]) * t;
          c.beginPath(); c.arc(x, y, dotR, 0, Math.PI * 2);
          if (s.electron) { c.fillStyle = C.paper; c.fill(); c.lineWidth = 2; c.strokeStyle = C.c4; c.stroke(); }
          else { c.fillStyle = C.c4; c.fill(); }
        }
      });
      c.restore();
    }

    // ---- 電流の向きの矢印（電流は + 極から出て − 極へ） ----
    const arrowAt = (x, y, ang, lab, pos) => {
      const sz = Math.max(11, 8 / k);
      c.save(); c.translate(x, y); c.rotate(ang);
      c.beginPath(); c.moveTo(sz * 0.6, 0); c.lineTo(-sz * 0.6, -sz * 0.5); c.lineTo(-sz * 0.6, sz * 0.5); c.closePath();
      c.fillStyle = C.c2; c.fill(); c.restore();
      if (lab) {
        const g = sz + 2;
        if (pos === 'n') text(lab, x, y - g, 'center', 'bottom', C.c2, fs, true);
        else if (pos === 'e') text(lab, x + g, y, 'left', 'middle', C.c2, fs, true);
        else text(lab, x - g, y, 'right', 'middle', C.c2, fs, true);
      }
    };
    if (o.ok && o.I > 0) {     // 電流が 0 のときは向きの矢印もかかない
      arrowAt(xL, yT + (bt - yT) * 0.45, -Math.PI / 2, '', '');
      arrowAt(150, yT, 0, 'I', 'n');
      if (par) { arrowAt(xB1, yT + 24, Math.PI / 2, 'I₁', 'e'); arrowAt(xR, yT + 24, Math.PI / 2, 'I₂', 'w'); }
    }
    if (par) { node(xB1, yT); node(xB1, yB); }

    // ---- 部品（導線と点の上にかく） ----
    const col1 = C.c1, col2 = C.c2;
    const resistor = (x, y, horiz, lab, col) => {
      const a = 86, b = Math.max(30, fs * 1.55);
      const ww = horiz ? a : b, hh = horiz ? b : a;
      c.fillStyle = C.paper; c.fillRect(x - ww / 2, y - hh / 2, ww, hh);
      c.lineWidth = lw; c.strokeStyle = col; c.strokeRect(x - ww / 2, y - hh / 2, ww, hh);
      text(lab, x, y + 1, 'center', 'middle', col, fs * 0.95, true);
    };
    const circleMeter = (x, y, lab, sub, below) => {
      const rr = Math.max(17, fs * 0.95);
      c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fillStyle = C.paper; c.fill();
      c.lineWidth = lw; c.strokeStyle = C.ink; c.stroke();
      c.font = '700 ' + (fs * 1.05) + 'px ' + C.fontEn; c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(lab, x, y + 1);
      if (sub && below) text(sub, x, y + rr + 3, 'center', 'top', C.muted, fs * 0.85, true);
      else if (sub) text(sub, x + rr + 4, y, 'left', 'middle', C.muted, fs * 0.85, true);
    };
    // 電池（長い線が + 極、短く太い線が − 極）
    c.fillStyle = C.paper; c.fillRect(xL - 30, bt + 1.5, 60, bb - bt - 3);
    line([[xL - 28, bt], [xL + 28, bt]], C.ink, lw * 1.1);
    line([[xL - 13, bb], [xL + 13, bb]], C.ink, lw * 2.6);
    text('+', xL - 36, bt - 4, 'center', 'middle', C.c2, fs * 1.1, true);
    text('−', xL - 36, bb + 5, 'center', 'middle', C.c1, fs * 1.1, true);
    text('電源', xL + 30, yC - fs * 0.75, 'left', 'middle', C.muted, fs * 0.9, false);
    text(n3(o.V) + ' V', xL + 30, yC + fs * 0.6, 'left', 'middle', C.ink, fs, true);
    // 電流計（回路に直列）
    circleMeter(xA, yB, 'A');
    text('I = ' + (compact ? n3(o.I) + ' A' : ampT(o.I)), xA + 26, yB - 12, 'left', 'bottom', C.ink, fs, true);
    // 抵抗とその電圧・電流
    const tag = (x, y, al, lines, col) => {
      lines.forEach((t, i) => text(t, x, y + i * fs * 1.25, al, 'top', i === 0 ? col : C.ink, fs * (i === 0 ? 0.95 : 1), i > 0));
    };
    const iTxt = (I) => (compact ? n3(I) + ' A' : ampT(I));
    if (s.mode === 'single') {
      resistor(400, yT, true, 'R₁', col1);
      tag(400, yT + 26, 'center', [n3(o.R1) + ' Ω', n3(o.V1) + ' V', iTxt(o.I1)], col1);
    } else if (s.mode === 'series') {
      resistor(290, yT, true, 'R₁', col1); resistor(490, yT, true, 'R₂', col2);
      tag(290, yT + 26, 'center', [n3(o.R1) + ' Ω', (ex(o.V1) ? '' : '≒') + n3(o.V1) + ' V', iTxt(o.I1)], col1);
      tag(490, yT + 26, 'center', [n3(o.R2) + ' Ω', (ex(o.V2) ? '' : '≒') + n3(o.V2) + ' V', iTxt(o.I2)], col2);
    } else {
      resistor(xB1, yC, false, 'R₁', col1); resistor(xR, yC, false, 'R₂', col2);
      const y0 = yC - fs * 1.9;
      tag(s.meter ? xB1 - 50 - 26 : xB1 - 26, y0, 'right', [n3(o.R1) + ' Ω', n3(o.V1) + ' V', iTxt(o.I1)], col1);
      tag(xB1 + 26, y0, 'left', [n3(o.R2) + ' Ω', n3(o.V2) + ' V', iTxt(o.I2)], col2);
    }
    meters.forEach((m) => {
      if (m.kind === 'h') circleMeter(m.x, m.y, 'V', m.lab === 'V' ? '' : m.lab);
      else circleMeter(m.x + m.side, yC, 'V', m.lab, true);
    });

    // ---- 下の説明（点の意味） ----
    let note;
    if (!s.flow) note = compact ? '▶ 電流の向き（+ 極 → − 極）' : '赤い矢印 ▶ は電流の向き（+ 極 → − 極）';
    else if (s.electron) note = compact ? '○ 電子の流れ：− 極 → + 極（電流と逆）' : '○ 電子の流れ：− 極から出て + 極へ（電流の向き ▶ と逆）';
    else note = compact ? '● 電流の流れ：+ 極 → − 極' : '● 電流の流れ：+ 極から出て − 極へ';
    if (s.flow && o.ok && o.I === 0) note += compact ? '　I = 0 で止まる' : '（電流が 0 なので動かない）';
    else if (s.flow && capped) note += compact ? '　速さは上限' : '（電流が大きいので点の速さは上限）';
    text(note, W0 / 2, H0 - 14, 'center', 'middle', C.muted, fs * 0.9, false);

    cvC.setAttribute('aria-label', '回路図：' + MODE_NAME[s.mode] + '、電源 ' + n3(o.V) + ' V、全体の電流 ' + ampT(o.I) +
      (s.mode === 'single' ? '、抵抗 ' + n3(o.R1) + ' Ω' : '、R₁ ' + n3(o.R1) + ' Ω に ' + n3(o.V1) + ' V・' + ampT(o.I1) + '、R₂ ' + n3(o.R2) + ' Ω に ' + n3(o.V2) + ' V・' + ampT(o.I2)));
  }

  // =====================================================================
  // I-V グラフ
  // =====================================================================
  function drawGraph(s, o) {
    const C = window.SimPlot.colors();
    plot.size();
    const g = L.graphLines(s.mode, s.R1, s.R2);
    const Imax = L.niceCeil(g.Imax);
    const xmax = 12.9, B = plot.plotBox;
    const padL = plot.w < 420 ? 40 : 46, padB = 20;
    // 0 の位置を左・下から少し内側にして、目もりの数字が軸の外に出るようにする
    const ytop = Imax * 1.2;    // 左上に凡例を書くすき間をあける
    const xmin = -padL * xmax / Math.max(40, B.w - padL);
    const ymin = -padB * ytop / Math.max(30, B.h - padB);
    plot.view = { xmin, xmax, ymin, ymax: ytop };
    plot.begin();
    plot.axes({ xlabel: 'V [V]', ylabel: 'I [A]', minPx: 40, origin: true });
    const sty = {
      R1: { color: C.c1, dash: null, width: 2.6, name: 'R₁', shape: 'ring' },
      R2: { color: C.c2, dash: [9, 6], width: 2.6, name: 'R₂', shape: 'square' },
      R: { color: C.c3, dash: [2, 6], width: 3.4, name: 'R', shape: 'diamond' }
    };
    if (s.mode === 'single') { sty.R1.name = 'R'; sty.R1.shape = 'dot'; }
    g.lines.forEach((ln) => {
      const st = sty[ln.key];
      plot.fn((V) => V / ln.R, { color: st.color, dash: st.dash, width: st.width, x0: 0, x1: 12 });
    });
    if (!o.ok) return;
    // 今の電圧での点（直列：○□ が同じ高さ＝電流が同じ。並列：同じたての線＝電圧が同じ）
    const cm = C.muted;
    const pts = { R1: [o.V1, o.I1], R2: [o.V2, o.I2], R: [o.V, o.I] };
    plot.seg(o.V, 0, o.V, o.I, { color: cm, width: 1.2, dash: [3, 4] });
    plot.seg(0, o.I, o.V, o.I, { color: cm, width: 1.2, dash: [3, 4] });
    if (s.mode === 'series') plot.seg(0, o.I, Math.max(o.V1, o.V2), o.I, { color: cm, width: 1.2, dash: [3, 4] });
    g.lines.slice().reverse().forEach((ln) => {
      const st = sty[ln.key], p = pts[ln.key];
      plot.point(p[0], p[1], { color: st.color, shape: st.shape, r: st.shape === 'square' ? 4.5 : st.shape === 'diamond' ? 5.5 : 5.5 });
    });
    // 凡例（線の見本・点の形・今の値）：線のない左上に
    const c = plot.ctx, fsz = plot.w < 420 ? 11.5 : 12.5, rowH = fsz + 6;
    const x0 = plot.X(0) + (plot.w < 420 ? 44 : 52), y0 = plot.plotBox.t + 4;
    g.lines.forEach((ln, i) => {
      const st = sty[ln.key], p = pts[ln.key], y = y0 + i * rowH + rowH / 2;
      c.save();
      c.strokeStyle = st.color; c.lineWidth = st.width; c.setLineDash(st.dash || []); c.lineCap = 'butt';
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + 24, y); c.stroke();
      c.restore();
      const name = st.name + ' ' + n3(ln.R) + ' Ω' + (ln.key === 'R' ? '（合成）' : '') + '：';
      plot.point(plot.wx(x0 + 34), plot.wy(y), { color: st.color, shape: st.shape, r: 4.2 });
      plot.label(name + n3(p[0]) + ' V, ' + n3(p[1]) + ' A', x0 + 42, y, { px: true, pos: 'e', gap: 0, color: st.color, size: fsz, bold: true });
    });
    cvG.setAttribute('aria-label', 'I-V グラフ：横軸 電圧 V [V]、縦軸 電流 I [A]。' + g.lines.map((l) => sty[l.key].name + ' ' + n3(l.R) + ' Ω の直線').join('、') + '。今の点 (' + n3(o.V) + ' V, ' + n3(o.I) + ' A)');
  }

  // =====================================================================
  // STEP 3 なぜ？
  // =====================================================================
  function explain(s) {
    const o = solveS(s);
    let h = '<h3>オームの法則 V = RI</h3>' +
      '<p>抵抗に流れる電流 ' + I_ + ' は、かかる電圧 ' + V_ + ' に比例する。比例定数の逆数が<b>電気抵抗</b> ' + R_ + '（単位 Ω、オーム）。</p>' +
      '<span class="eq">' + V_ + ' = ' + R_ + I_ + '　　' + I_ + ' = ' + frac(V_, R_) + '　　' + R_ + ' = ' + frac(V_, I_) + '</span>' +
      '<p>1 Ω は「1 V の電圧をかけると 1 A の電流が流れる」抵抗。抵抗が大きいほど、同じ電圧でも電流は<b>流れにくい</b>（小さくなる）。</p>';
    if (s.mode === 'single') {
      h += '<p class="now">今は ' + I_ + ' = ' + frac(n3(o.V) + ' V', n3(o.R1) + ' Ω') + ' ' + approx(o.I) + ' ' + ampT(o.I) + '。' +
        (o.V > 0 ? '抵抗を 2 倍の ' + n3(o.R1 * 2) + ' Ω にすると、電流は半分の ' + ampT(o.I / 2) + ' になる。' : '電圧が 0 なので電流も 0。') + '</p>';
    } else {
      h += '<p class="now">今は回路全体で ' + I_ + ' = ' + frac(n3(o.V) + ' V', n3(o.R) + ' Ω') + ' ' + approx(o.I) + ' ' + ampT(o.I) + '（' + R_ + ' は合成抵抗）。</p>';
    }
    h += '<h3>I-V グラフの傾きは 1/R</h3>' +
      '<p>' + I_ + ' = ' + frac('1', R_) + ' × ' + V_ + ' なので、横軸 ' + V_ + '・縦軸 ' + I_ + ' のグラフは原点を通る直線で、<b>傾きが ' + frac('1', R_) + '</b>。抵抗が小さいほど直線は急になる。</p>' +
      '<p>グラフの線：<span class="sw" style="color:var(--c1)"></span>実線 ' + R1h +
      (s.mode === 'single' ? '' : '、<span class="sw dash" style="color:var(--c2)"></span>破線 ' + R2h + '、<span class="sw dot" style="color:var(--c3)"></span>点線 合成抵抗 ' + R_) + '。</p>' +
      '<p class="now">今の傾きは ' + frac('1', n3(o.R) + ' Ω') + ' ' + approx(1 / o.R) + ' ' + n3(1 / o.R) + ' A/V。電圧を 1 V 上げるごとに電流が ' + n3(1 / o.R) + ' A 増える。</p>';

    // 直列・並列
    h += '<h3>直列：電流は同じ、電圧が分かれる</h3>' +
      '<p>直列は 1 本道。電流は途中でへったり増えたりしないので、<b>どこでも同じ大きさ</b>（' + I_ + ' = ' + I1h + ' = ' + I2h + '）。電源の電圧は 2 つの抵抗に<b>分かれて</b>かかり、合計すると電源の電圧になる（' + V_ + ' = ' + V1h + ' + ' + V2h + '）。大きい抵抗ほど大きい電圧がかかる。</p>' +
      '<span class="eq">' + R_ + ' = ' + R1h + ' + ' + R2h + '</span>' +
      '<h3>並列：電圧は同じ、電流が分かれる</h3>' +
      '<p>並列は道が 2 つに分かれる。どちらの抵抗も電源に直接つながっているので、<b>電圧はどちらも電源と同じ</b>（' + V_ + ' = ' + V1h + ' = ' + V2h + '）。分かれ道で電流は 2 つに<b>分かれ</b>、また合流する。分かれる前と後で電流の合計は変わらない（' + I_ + ' = ' + I1h + ' + ' + I2h + '）。小さい抵抗の方に多く流れる。</p>' +
      '<span class="eq">' + frac('1', R_) + ' = ' + frac('1', R1h) + ' + ' + frac('1', R2h) + '　→　' + R_ + ' = ' + frac(R1h + R2h, R1h + ' + ' + R2h) + '</span>' +
      '<p class="hint">「電流は分かれ道で消えたりわいたりしない」「1 周するとき、電源で上がった電圧と抵抗で下がった電圧はつりあう」。これが高校で学ぶ<b>キルヒホッフの法則</b>の考え方。</p>';
    if (s.mode === 'series') {
      h += '<p class="now">今は ' + R_ + ' = ' + n3(o.R1) + ' + ' + n3(o.R2) + ' = ' + n3(o.R) + ' Ω、' + I_ + ' ' + approx(o.I) + ' ' + ampT(o.I) + '（' + R1h + '・' + R2h + ' とも同じ）。<br>' +
        V1h + ' = ' + n3(o.R1) + ' Ω × ' + n3(o.I) + ' A ' + approx(o.V1) + ' ' + n3(o.V1) + ' V、' + V2h + ' = ' + n3(o.R2) + ' Ω × ' + n3(o.I) + ' A ' + approx(o.V2) + ' ' + n3(o.V2) + ' V。合計 ' + n3(o.V1 + o.V2) + ' V ＝ 電源の電圧。<br>' +
        'グラフでは ○ と □ が<b>同じ高さ</b>（電流が同じ）にならぶ。</p>';
    } else if (s.mode === 'parallel') {
      h += '<p class="now">今は ' + V1h + ' = ' + V2h + ' = ' + n3(o.V) + ' V。' + I1h + ' = ' + frac(n3(o.V), n3(o.R1)) + ' ' + approx(o.I1) + ' ' + ampT(o.I1) + '、' + I2h + ' = ' + frac(n3(o.V), n3(o.R2)) + ' ' + approx(o.I2) + ' ' + ampT(o.I2) +
        '、合計 ' + I_ + ' ' + approx(o.I) + ' ' + ampT(o.I) + '。<br>合成抵抗 ' + R_ + ' = ' + frac(n3(o.R1) + '×' + n3(o.R2), n3(o.R1) + '+' + n3(o.R2)) + ' ' + approx(o.R) + ' ' + n3(o.R) + ' Ω。<br>' +
        'グラフでは ○ と □ が<b>同じたての線の上</b>（電圧が同じ）にならぶ。</p>';
    }
    h += '<h3>並列の合成抵抗は、どちらの抵抗よりも小さい</h3>' +
      '<p>抵抗を並列に足すと、電流の通り道が増える。道が増えれば同じ電圧でも全体の電流は増えるので、回路全体の抵抗（' + V_ + ' ÷ ' + I_ + '）は小さくなる。式でも ' + frac('1', R_) + ' は ' + frac('1', R1h) + ' より大きいので、' + R_ + ' &lt; ' + R1h + '（' + R2h + ' についても同じ）。同じ抵抗 2 つなら、ちょうど半分になる。</p>';
    if (s.mode !== 'single') {
      const rp = L.parallelR(o.R1, o.R2);
      h += '<p class="now">' + n3(o.R1) + ' Ω と ' + n3(o.R2) + ' Ω を並列にすると ' + approx(rp) + ' ' + n3(rp) + ' Ω で、小さい方の ' + n3(Math.min(o.R1, o.R2)) + ' Ω よりさらに小さい。直列なら ' + n3(o.R1 + o.R2) + ' Ω で、大きい方より大きい。</p>';
    }
    // 電力
    h += '<h3>電力 P = VI</h3>' +
      '<p>1 秒あたりに使われる電気のエネルギーが<b>電力</b>（単位 W、ワット）。' + P_ + ' = ' + V_ + I_ + '。オームの法則を使うと ' + P_ + ' = ' + R_ + I_ + '² = ' + frac(V_ + '²', R_) + ' とも書ける。抵抗では電気のエネルギーが熱になる（電熱線が熱くなる）。</p>';
    if (s.mode === 'single') {
      h += '<p class="now">今は ' + P_ + ' = ' + n3(o.V) + ' V × ' + n3(o.I) + ' A ' + approx(o.P) + ' ' + n3(o.P) + ' W。</p>';
    } else {
      h += '<p class="now">' + R1h + '：' + n3(o.V1) + ' V × ' + n3(o.I1) + ' A ' + approx(o.P1) + ' ' + n3(o.P1) + ' W、' + R2h + '：' + n3(o.V2) + ' V × ' + n3(o.I2) + ' A ' + approx(o.P2) + ' ' + n3(o.P2) + ' W。合計 ' + n3(o.P1 + o.P2) + ' W は、全体の ' + n3(o.V) + ' V × ' + n3(o.I) + ' A ' + approx(o.P) + ' ' + n3(o.P) + ' W と同じ。' +
        (s.mode === 'series' ? '直列では大きい抵抗の方が電力が大きい（電流が同じで電圧が大きい）。' : '並列では小さい抵抗の方が電力が大きい（電圧が同じで電流が大きい）。') + '</p>';
    }
    h += '<h3>電流計・電圧計のつなぎ方</h3><p>電流計 Ⓐ は、はかりたい所に<b>直列</b>につなぐ（電流が電流計の中を通るように）。電圧計 Ⓥ は、はかりたい抵抗に<b>並列</b>につなぐ（抵抗の両はしの電圧をくらべる）。この教材では理想的な計器として、電流計の抵抗は 0、電圧計には電流が流れないとしている。</p>';
    return h;
  }

  // =====================================================================
  // STEP 4 確認問題（今の設定から）
  // =====================================================================
  function quiz(s0) {
    const V = s0.V > 0 ? s0.V : 6;
    const note = s0.V > 0 ? '' : '<p class="hint">今は電圧が 0 V なので、6 V で出題するね。</p>';
    const R1 = s0.R1, R2 = s0.mode === 'single' ? (s0.R1 === 30 ? 20 : 30) : s0.R2;
    const qs = [];
    const A = (v) => n3(v) + ' A';
    const Om = (v) => n3(v) + ' Ω';

    // 1. 電流の計算（今のつなぎ方）
    const o = L.solve(s0.mode, V, R1, R2);
    const desc = s0.mode === 'single' ? n3(R1) + ' Ω の抵抗' : s0.mode === 'series' ? n3(R1) + ' Ω と ' + n3(R2) + ' Ω を直列につないだもの' : n3(R1) + ' Ω と ' + n3(R2) + ' Ω を並列につないだもの';
    const wr1 = [
      [A(V * o.R), '電圧と抵抗をかけている。電流は ' + I_ + ' = ' + frac(V_, R_) + '（電圧 ÷ 抵抗）。'],
      [A(o.R / V), '割る順番が逆。' + I_ + ' = ' + frac(V_, R_) + '。'],
      [n3(o.I * 1000) + ' A', '単位に注意。' + n3(o.I * 1000) + ' は mA（ミリアンペア）で表したときの数。1 A = 1000 mA。']
    ];
    if (s0.mode === 'series') wr1.unshift([A(V / R1), R1h + ' だけで割っている。直列の全体の抵抗は ' + R1h + ' + ' + R2h + '。']);
    if (s0.mode === 'parallel') wr1.unshift([A(V / (R1 + R2)), '並列なのに、直列の合成抵抗 ' + R1h + ' + ' + R2h + ' で割っている。並列では全体の電流は ' + I1h + ' + ' + I2h + '。']);
    let m = U.mc(A(o.I), wr1);
    qs.push(Object.assign(m, { q: note + '<p>電源の電圧 ' + n3(V) + ' V に、' + desc + 'をつないだ。回路全体に流れる電流は？</p>',
      explain: '<p>' + (s0.mode === 'single' ? '' : '合成抵抗は ' + R_ + ' ' + approx(o.R) + ' ' + Om(o.R) + '。') + I_ + ' = ' + frac(V_, R_) + ' = ' + n3(V) + ' ÷ ' + n3(o.R) + ' ' + approx(o.I) + ' ' + ampT(o.I) + '。</p>' }));

    // 2. 直列の各抵抗の電圧
    // R₁ = R₂ だと半分ずつになって選択肢が作れないので、そのときは R₂ を変える
    const R2s = R2 !== R1 ? R2 : (R1 * 2 <= 100 ? R1 * 2 : Math.round(R1 / 2));
    const se = L.solve('series', V, R1, R2s);
    m = U.mc(n3(se.V1) + ' V', [
      [n3(V) + ' V', 'それは並列のとき。直列では電源の電圧が 2 つの抵抗に分かれてかかる。'],
      [n3(se.V2) + ' V', 'それは ' + R2h + '（' + n3(R2s) + ' Ω）にかかる電圧。大きい抵抗ほど大きい電圧がかかる。'],
      [n3(V / 2) + ' V', '半分ずつになるのは 2 つの抵抗が同じときだけ。電圧は抵抗の大きさに比例して分かれる。'],
      [n3(V * R1 / R2s) + ' V', '比の取り方がちがう。' + V1h + ' : ' + V_ + ' = ' + R1h + ' : (' + R1h + ' + ' + R2h + ')。']
    ]);
    qs.push(Object.assign(m, { q: '<p>' + n3(R1) + ' Ω の ' + R1h + ' と ' + n3(R2s) + ' Ω の ' + R2h + ' を<b>直列</b>につなぎ、' + n3(V) + ' V の電源につないだ。' + R1h + ' にかかる電圧は？</p>',
      explain: '<p>直列なので ' + R_ + ' = ' + n3(R1) + ' + ' + n3(R2s) + ' = ' + Om(se.R) + '、電流はどこでも ' + I_ + ' = ' + n3(V) + ' ÷ ' + n3(se.R) + ' ' + approx(se.I) + ' ' + ampT(se.I) + '。<br>' +
        V1h + ' = ' + R1h + I_ + ' = ' + n3(R1) + ' × ' + n3(se.I) + ' ' + approx(se.V1) + ' ' + n3(se.V1) + ' V（' + V2h + ' ' + approx(se.V2) + ' ' + n3(se.V2) + ' V と合わせると ' + n3(V) + ' V）。</p>' }));

    // 3. 並列の合成抵抗
    const rp = L.parallelR(R1, R2);
    m = U.mc(Om(rp), [
      [Om(R1 + R2), 'それは直列の合成抵抗。並列は通り道が増えるので、どちらの抵抗よりも小さくなる。'],
      [Om((R1 + R2) / 2), '平均ではない。' + frac('1', R_) + ' = ' + frac('1', R1h) + ' + ' + frac('1', R2h) + ' で求める。'],
      [n3(1 / R1 + 1 / R2) + ' Ω', 'それは ' + frac('1', R_) + ' の値。最後に逆数にして ' + R_ + ' を求めよう。'],
      [Om(R1 * R2), R1h + R2h + ' をさらに ' + R1h + ' + ' + R2h + ' で割る。']
    ]);
    qs.push(Object.assign(m, { q: '<p>' + n3(R1) + ' Ω と ' + n3(R2) + ' Ω の抵抗を<b>並列</b>につないだときの合成抵抗は？（有効数字 3 けた）</p>',
      explain: '<p>' + R_ + ' = ' + frac(R1h + R2h, R1h + ' + ' + R2h) + ' = ' + frac(n3(R1) + '×' + n3(R2), n3(R1) + '+' + n3(R2)) + ' ' + approx(rp) + ' ' + Om(rp) + '。' + n3(Math.min(R1, R2)) + ' Ω より小さいことも確かめよう。</p>' }));

    // 4. 抵抗を 2 倍にすると
    const I0 = V / R1;
    m = U.mc('半分になる（' + ampT(I0 / 2) + '）', [
      ['2 倍になる（' + ampT(I0 * 2) + '）', '電圧を 2 倍にしたときと取りちがえている。抵抗は電流の「流れにくさ」なので、大きくすると電流は小さくなる。'],
      ['変わらない', '電圧が同じでも、抵抗が変われば電流は変わる（' + I_ + ' = ' + frac(V_, R_) + '）。'],
      ['4 分の 1 になる（' + ampT(I0 / 4) + '）', I_ + ' = ' + frac(V_, R_) + ' は ' + R_ + ' に反比例するので、' + R_ + ' が 2 倍なら ' + I_ + ' は 1/2 倍。2 回半分にしてはいけない。']
    ]);
    qs.push(Object.assign(m, { q: '<p>' + n3(V) + ' V の電源に ' + n3(R1) + ' Ω の抵抗をつなぐと ' + ampT(I0) + ' 流れた。電圧はそのままで、抵抗を 2 倍の ' + n3(R1 * 2) + ' Ω にすると電流は？</p>',
      explain: '<p>' + I_ + ' = ' + frac(V_, R_) + ' なので、電圧が同じなら電流は抵抗に<b>反比例</b>する。' + n3(V) + ' ÷ ' + n3(R1 * 2) + ' ' + approx(I0 / 2) + ' ' + ampT(I0 / 2) + '。I-V グラフでは傾きが半分になる。</p>' }));

    // 5. 計器のつなぎ方
    m = U.mc('電流計は直列、電圧計は並列', [
      ['電流計は並列、電圧計は直列', '逆。電流計は電流が中を通るように直列、電圧計は抵抗の両はしにまたがるように並列につなぐ。'],
      ['どちらも直列', '電圧計を直列にすると、ほとんど電流が流れなくなって正しくはかれない（電圧計は電流をほとんど通さない）。'],
      ['どちらも並列', '電流計を並列にすると、抵抗の小さい電流計に大きな電流が流れてこわれることがある。']
    ]);
    qs.push(Object.assign(m, { q: '<p>抵抗に流れる電流と、抵抗にかかる電圧をはかりたい。電流計と電圧計は抵抗に対してどうつなぐ？</p>',
      explain: '<p>回路図を見てみよう。Ⓐ は回路の 1 本道の中に入っている（直列）。Ⓥ は抵抗の両はしから枝分かれしてつながっている（並列）。</p>' }));
    return qs;
  }
})();
