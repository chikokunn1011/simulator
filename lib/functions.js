/* 一次関数・二次関数の計算（画面とは別。test/functions.test.js で確かめる） */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  // スライダーは 0.1 きざみなので、0.1 × 0.1 などの小さな誤差を丸める
  const tidy = (v) => (Math.abs(v) < EPS ? 0 : Number(v.toPrecision(12)));

  // 分数にできるなら [分子, 分母]（分母 > 0、約分ずみ）。できなければ null
  function toFrac(v, maxDen) {
    if (!Number.isFinite(v)) return null;
    maxDen = maxDen || 400;
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(v * d);
      if (Math.abs(n / d - v) < 1e-9 * Math.max(1, Math.abs(v))) return [n, d];
    }
    return null;
  }

  function linear(a, b) {
    a = tidy(a); b = tidy(b);
    let xInt;
    if (a !== 0) xInt = tidy(-b / a);
    else xInt = b === 0 ? 'all' : null;   // a = 0：b = 0 なら x 軸と重なる、それ以外は交わらない
    return { a, b, slope: a, yInt: b, xInt, f: (x) => a * x + b };
  }

  function quadratic(a, b, c) {
    a = tidy(a); b = tidy(b); c = tidy(c);
    const f = (x) => (a * x + b) * x + c;
    if (a === 0) return { a, b, c, degenerate: true, f, yInt: c, line: linear(b, c) };
    const p = tidy(-b / (2 * a));
    const D = tidy(b * b - 4 * a * c);
    const q = tidy(c - b * b / (4 * a));    // = −D / 4a
    let roots = [];
    if (D > 0) {
      // 引き算で桁が落ちないよう、大きい方の解を先に求める
      const s = Math.sqrt(D);
      const t = -(b + (b >= 0 ? s : -s)) / 2;
      const r1 = t / a, r2 = t !== 0 ? c / t : -b / a - r1;
      roots = [tidy(r1), tidy(r2)].sort((x, y) => x - y);
    } else if (D === 0) roots = [p];
    return { a, b, c, degenerate: false, f, p, q, D, roots, yInt: c, opens: a > 0 ? 'up' : 'down',
      extreme: a > 0 ? 'min' : 'max' };
  }

  // x1 から x2 までの変化の割合（平均変化率）
  function avgRate(f, x1, x2) {
    if (x1 === x2) return NaN;
    return tidy((f(x2) - f(x1)) / (x2 - x1));
  }

  const api = { toFrac, linear, quadratic, avgRate, tidy };
  root.SimLib = root.SimLib || {};
  root.SimLib.functions = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
