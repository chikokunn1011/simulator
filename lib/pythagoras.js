/* 三平方の定理の計算（画面とは別。test/pythagoras.test.js で確かめる）
   直角三角形 ABC：∠C = 90°、BC = a、CA = b、斜辺 AB = c */
(function (root) {
  'use strict';
  // n = k² × m（m は平方数でわれない）。√n = k√m
  function simplifyRoot(n) {
    if (!Number.isInteger(n) || n < 0) return null;
    if (n === 0) return { k: 0, m: 1 };
    let k = 1, m = n;
    for (let d = 2; d * d <= m; d++) while (m % (d * d) === 0) { m /= d * d; k *= d; }
    return { k, m };
  }
  // √n の書き方：5 / √13 / 2√13
  function rootText(n) {
    const r = simplifyRoot(n);
    if (!r) return '√' + n;
    return r.m === 1 ? String(r.k) : (r.k === 1 ? '' : r.k) + '√' + r.m;
  }
  // 斜辺
  function hyp(a, b) {
    const c2 = a * a + b * b;
    return { a2: a * a, b2: b * b, c2, c: Math.sqrt(c2), whole: Number.isInteger(Math.sqrt(c2)), text: rootText(c2) };
  }
  // 斜辺 c と 1 辺 a から残りの辺（c ≦ a なら直角三角形にならないので null）
  function leg(c, a) {
    const n = c * c - a * a;
    if (!(n > 0)) return null;
    return { n, b: Math.sqrt(n), text: rootText(n) };
  }
  // 3 辺で直角三角形になるか（いちばん長い辺が斜辺）
  function isRight(x, y, z) {
    const s = [x, y, z].sort((p, q) => p - q);
    return s[0] > 0 && s[0] * s[0] + s[1] * s[1] === s[2] * s[2];
  }
  // 図：C(0,0)・B(a,0)・A(0,b) と、各辺の外側の正方形（頂点の列）、全体が入る範囲
  function figure(a, b) {
    const A = [0, b], B = [a, 0], C = [0, 0];
    return {
      A, B, C,
      sqA: [[0, 0], [a, 0], [a, -a], [0, -a]],            // BC の上（下側）：面積 a²
      sqB: [[0, 0], [0, b], [-b, b], [-b, 0]],            // CA の上（左側）：面積 b²
      sqC: [[0, b], [a, 0], [a + b, a], [b, a + b]],      // AB の上（右上）：面積 c²
      box: { xmin: -b, xmax: a + b, ymin: -a, ymax: a + b }
    };
  }
  // 多角形の面積（頂点の列から）
  function area(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(s) / 2;
  }
  // しきつめ：1 辺 a + b の正方形 2 つ。左は三角形 4 つと c² の正方形、右は三角形 4 つと a²・b² の正方形
  function tiling(a, b) {
    const n = a + b;
    return {
      n,
      left: {
        tris: [[[0, 0], [a, 0], [0, b]], [[a, 0], [n, 0], [n, a]], [[n, a], [n, n], [b, n]], [[b, n], [0, n], [0, b]]],
        sqC: [[a, 0], [n, a], [b, n], [0, b]]
      },
      right: {
        tris: [[[a, 0], [n, 0], [n, a]], [[a, 0], [n, a], [a, a]], [[0, a], [a, a], [a, n]], [[0, a], [a, n], [0, n]]],
        sqA: [[0, 0], [a, 0], [a, a], [0, a]],
        sqB: [[a, a], [n, a], [n, n], [a, n]]
      }
    };
  }

  const api = { simplifyRoot, rootText, hyp, leg, isRight, figure, area, tiling };
  root.SimLib = root.SimLib || {};
  root.SimLib.pythagoras = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
