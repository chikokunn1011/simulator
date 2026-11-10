/* オームの法則の計算（画面とは別。test/ohm.test.js で確かめる）
   つなぎ方 mode：'single'（抵抗 1 つ）・'series'（直列 R₁, R₂）・'parallel'（並列 R₁, R₂）
   理想化：導線・電流計の抵抗 0、電圧計に電流は流れない、電源の内部抵抗なし、R は温度で変わらない */
(function (root) {
  'use strict';
  const LIM = { Vmin: 0, Vmax: 12, Rmin: 1, Rmax: 100 };
  // 0.1 きざみの電圧などで出る小さな誤差（0.30000000000000004 など）を丸める
  const tidy = (v) => (Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(12)));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // 並列の合成抵抗 R₁R₂/(R₁+R₂)（= 1/(1/R₁ + 1/R₂)）
  function parallelR(r1, r2) {
    if (!(r1 > 0) || !(r2 > 0)) return NaN;
    return tidy(r1 * r2 / (r1 + r2));
  }
  function seriesR(r1, r2) {
    if (!(r1 > 0) || !(r2 > 0)) return NaN;
    return tidy(r1 + r2);
  }

  // 回路を解く。入力が数でなければ ok:false（画面では「—」）。範囲外は範囲内に直して clamped:true
  function solve(mode, V, R1, R2) {
    const bad = { ok: false, mode, V: NaN, R: NaN, I: NaN, R1: NaN, R2: NaN, V1: NaN, V2: NaN, I1: NaN, I2: NaN, P: NaN, P1: NaN, P2: NaN, clamped: false };
    V = Number(V); R1 = Number(R1); R2 = Number(R2);
    if (mode !== 'series' && mode !== 'parallel') mode = 'single';
    bad.mode = mode;
    if (!Number.isFinite(V) || !Number.isFinite(R1) || (mode !== 'single' && !Number.isFinite(R2))) return bad;
    let clamped = false;
    const cl = (v, a, b) => { const c = clamp(v, a, b); if (c !== v) clamped = true; return c; };
    V = cl(V, LIM.Vmin, LIM.Vmax);
    R1 = cl(R1, LIM.Rmin, LIM.Rmax);
    if (mode !== 'single') R2 = cl(R2, LIM.Rmin, LIM.Rmax);
    const o = { ok: true, mode, V, R1, R2: mode === 'single' ? NaN : R2, clamped };
    if (mode === 'single') {
      o.R = R1; o.I = tidy(V / R1);
      o.V1 = V; o.I1 = o.I; o.V2 = NaN; o.I2 = NaN;
    } else if (mode === 'series') {
      // 直列：電流はどこでも同じ。電圧は抵抗の大きさに比例して分かれる
      o.R = seriesR(R1, R2); o.I = tidy(V / o.R);
      o.I1 = o.I; o.I2 = o.I;
      o.V1 = tidy(V * R1 / o.R); o.V2 = tidy(V * R2 / o.R);
    } else {
      // 並列：電圧はどちらも電源と同じ。電流は抵抗に反比例して分かれる
      o.R = parallelR(R1, R2);
      o.V1 = V; o.V2 = V;
      o.I1 = tidy(V / R1); o.I2 = tidy(V / R2);
      o.I = tidy(o.I1 + o.I2);
    }
    o.P = tidy(V * o.I);
    o.P1 = tidy(o.V1 * o.I1);
    o.P2 = mode === 'single' ? NaN : tidy(o.V2 * o.I2);
    return o;
  }

  // 有効数字 n 桁に丸めた数
  function sig(v, n) {
    n = n || 3;
    if (!Number.isFinite(v)) return NaN;
    if (v === 0) return 0;
    return Number(v.toPrecision(n));
  }
  // 表示用の文字：有効数字 n 桁で丸め、小数の末尾の 0 は消す。exact は丸めずに同じ値か
  // 例 0.3 → '0.3'、6/7 → '0.857'（exact:false）、24 → '24'、1234 → '1230'（exact:false）
  function sigStr(v, n) {
    n = n || 3;
    if (!Number.isFinite(v)) return { text: '—', exact: false };
    const r = sig(v, n);
    let s;
    if (r === 0) s = '0';
    else {
      const e = Math.floor(Math.log10(Math.abs(r)));
      const d = Math.max(0, n - 1 - e);
      s = r.toFixed(Math.min(d, 12));
      if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    }
    s = s.replace('-', '−');
    return { text: s, exact: Math.abs(r - v) <= 1e-9 * Math.max(1, Math.abs(v)) };
  }
  // 電流の表示：'0.3 A'、1 A 未満なら mA も（sub）。0 は '0 A'
  function current(I, n) {
    const a = sigStr(I, n);
    if (!Number.isFinite(I)) return { a: '—', mA: '', exact: false };
    const showMA = I !== 0 && Math.abs(I) < 1;
    return { a: a.text + ' A', mA: showMA ? sigStr(I * 1000, n).text + ' mA' : '', exact: a.exact };
  }

  // グラフの縦軸の上限：x 以上で、1・1.5・2・2.5・3・4・5・6・8 ×10ⁿ のうち小さいもの
  function niceCeil(x) {
    if (!(x > 0) || !Number.isFinite(x)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const m = x / p;
    const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (const s of steps) if (m <= s + 1e-9) return tidy(s * p);
    return tidy(10 * p);
  }
  // I-V グラフにかく直線の抵抗（R₁・R₂・合成）と、V = Vmax のときの電流の最大
  function graphLines(mode, R1, R2) {
    const o = solve(mode, 0, R1, R2);
    if (!o.ok) return { lines: [], Imax: 1 };
    const lines = [{ key: 'R1', R: o.R1 }];
    if (mode !== 'single') { lines.push({ key: 'R2', R: o.R2 }); lines.push({ key: 'R', R: o.R }); }
    const minR = Math.min.apply(null, lines.map((l) => l.R));
    return { lines, Imax: LIM.Vmax / minR };
  }

  const api = { LIM, tidy, solve, parallelR, seriesR, sig, sigStr, current, niceCeil, graphLines };
  root.SimLib = root.SimLib || {};
  root.SimLib.ohm = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
