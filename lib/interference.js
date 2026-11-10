/* 波の干渉の計算（画面とは別。test/interference.test.js で確かめる）
   座標は cm。波源 S₁ = (−d/2, 0)、S₂ = (d/2, 0)。各波の振幅を 1 とする。
   変位 z = sin(k r₁ − ωt) + sin(k r₂ − ωt + φ)   （k = 2π/λ、ω = 2π/T、φ = 0（同位相）または π（逆位相））
         = 2cos(k(r₁ − r₂)/2 − φ/2) · sin(k(r₁ + r₂)/2 − ωt + φ/2) */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  const TOL = 0.05;          // 判定の許容：経路差が λ の 5% 以内なら「ほぼ」
  const TAU = Math.PI * 2;
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  // 0.1 きざみの値の割り算（4 / 0.8 = 5.000000000000001 など）の誤差を丸める
  const tidy = (v) => (Math.abs(v) < EPS ? 0 : Number(v.toPrecision(12)));

  function phiOf(phase) { return phase === 'opp' ? Math.PI : 0; }

  function sources(d) { return { s1: [-d / 2, 0], s2: [d / 2, 0] }; }

  // 点 (x, y) から 2 つの波源までの距離と経路差（signed = r₁ − r₂。正なら S₂ に近い側＝右側）
  function dists(d, x, y) {
    if (!ok(d) || !ok(x) || !ok(y)) return null;
    const r1 = Math.hypot(x + d / 2, y), r2 = Math.hypot(x - d / 2, y);
    return { r1, r2, signed: r1 - r2, diff: Math.abs(r1 - r2) };
  }

  // 経路差 diff（≥ 0）の判定。
  //   q = diff / λ。同位相：q が整数 → 強め合う、整数 + ½ → 弱め合う。逆位相は入れかわる。
  //   ずれ |q − 一番近い整数（または整数+½）| が 1e-6 以下なら「強め合う／弱め合う」、TOL（0.05）以下なら「ほぼ〜」、
  //   どちらからも 0.05 より大きく離れていれば「中間」。0.05 ちょうどは「ほぼ」に入れる。
  function judge(diff, lambda, phase, tol) {
    tol = tol == null ? TOL : tol;
    if (!ok(diff) || !ok(lambda) || lambda <= 0 || diff < 0) return { kind: 'undef', label: '定義されない', q: NaN };
    const q = tidy(diff / lambda);
    const mi = Math.round(q);                      // 一番近い整数
    const mh = Math.floor(q);                      // 一番近い「整数 + ½」は mh + ½
    const di = Math.abs(q - mi), dh = Math.abs(q - (mh + 0.5));
    const opp = phase === 'opp';
    // 強め合う条件のずれ・弱め合う条件のずれ
    const ds = opp ? dh : di, dw = opp ? di : dh;
    const ms = opp ? mh : mi, mw = opp ? mi : mh;   // それぞれの条件の m（|r₁ − r₂| = mλ または (m + ½)λ）
    if (ds <= 1e-6) return { kind: 'strong', near: false, label: '強め合う', q, m: ms, off: ds };
    if (dw <= 1e-6) return { kind: 'weak', near: false, label: '弱め合う', q, m: mw, off: dw };
    if (ds <= tol + EPS) return { kind: 'strong', near: true, label: 'ほぼ強め合う', q, m: ms, off: ds };
    if (dw <= tol + EPS) return { kind: 'weak', near: true, label: 'ほぼ弱め合う', q, m: mw, off: dw };
    return { kind: 'mid', near: false, label: '中間', q, m: null, off: Math.min(ds, dw) };
  }

  // 合成波の振幅（各波の振幅 1 に対して何倍か）：|2cos(π(r₁ − r₂)/λ − φ/2)|
  function amplitude(signed, lambda, phase) {
    if (!ok(signed) || !ok(lambda) || lambda <= 0) return NaN;
    const v = Math.abs(2 * Math.cos(Math.PI * signed / lambda - phiOf(phase) / 2));
    return v < 1e-12 ? 0 : v;
  }

  // |(m + off)λ| < d となる整数 m の範囲（off = 0 か 0.5）。S₁S₂ の間を横切る線の m。
  // ない場合は { min: 0, max: −1, count: 0 }
  function mRange(d, lambda, off) {
    if (!ok(d) || !ok(lambda) || lambda <= 0 || d <= 0) return { min: 0, max: -1, count: 0 };
    const r = tidy(d / lambda);                     // |m + off| < r
    const max = Math.ceil(r - off) - 1;             // m + off < r のいちばん大きい m
    const min = -Math.ceil(r + off) + 1;            // m + off > −r のいちばん小さい m
    return max >= min ? { min, max, count: max - min + 1 } : { min: 0, max: -1, count: 0 };
  }

  // 強め合う線・弱め合う線（S₁S₂ 間を横切るもの）。各線は signed（r₁ − r₂）と、ラベル用の m（≥ 0）
  //   同位相：強め合う |Δ| = mλ（off 0）、弱め合う |Δ| = (m + ½)λ（off ½）。逆位相は入れかわる。
  //   edge：|Δ| = d ちょうどになる条件があるか（そのときは波源の外側の直線上がその条件をみたす）
  function lines(d, lambda, phase) {
    const opp = phase === 'opp';
    const offS = opp ? 0.5 : 0, offW = opp ? 0 : 0.5;
    const make = (off) => {
      const R = mRange(d, lambda, off), list = [];
      for (let m = R.min; m <= R.max; m++) {
        const k = m + off;                           // Δ = kλ
        list.push({ signed: tidy(k * lambda), m: k >= 0 ? m : -m - 2 * off, k });
      }
      // edge：(m + off) = ±d/λ になる整数 m があるか
      let edge = false;
      if (ok(d) && ok(lambda) && lambda > 0 && d > 0) {
        const r = tidy(d / lambda) - off;
        edge = Math.abs(r - Math.round(r)) < 1e-9;
      }
      return { range: R, list, count: R.count, edge, edgeM: edge ? Math.round(tidy(d / lambda) - off) : null };
    };
    return { strong: make(offS), weak: make(offW), offS, offW };
  }

  // 双曲線 |r₁ − r₂| 一定（signed = r₁ − r₂）の点列。|signed| < d のときだけ。
  //   焦点 (±c, 0)、c = d/2、2a = |signed|、b² = c² − a²。x = ±a cosh u、y = b sinh u（u を等間隔にすると頂点の近くも細かくなる）
  //   ymax：かく範囲の |y| の最大
  function hyperbola(d, signed, ymax, n) {
    n = n || 160;
    if (!ok(d) || !ok(signed) || !ok(ymax) || d <= 0 || ymax <= 0) return null;
    const c = d / 2, a = Math.abs(signed) / 2;
    if (a >= c - EPS) return null;                     // 双曲線にならない（|Δ| ≥ d）
    if (a < EPS) {                                      // 垂直二等分線（x = 0 の直線。ほかと同じく n + 1 点）
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push([0, -ymax + 2 * ymax * i / n]);
      return pts;
    }
    const b = Math.sqrt(c * c - a * a), sg = signed > 0 ? 1 : -1;
    const U = Math.asinh(ymax / b), pts = [];
    for (let i = 0; i <= n; i++) {
      const u = -U + 2 * U * i / n;
      pts.push([sg * a * Math.cosh(u), b * Math.sinh(u)]);
    }
    return pts;
  }

  // |r₁ − r₂| = d ちょうど：x 軸上の波源の外側（x ≤ −d/2 と x ≥ d/2）の半直線。xmax まで
  function edgeRays(d, xmax) {
    if (!ok(d) || !ok(xmax) || d <= 0) return [];
    return [[[-xmax, 0], [-d / 2, 0]], [[d / 2, 0], [xmax, 0]]];
  }

  // 1 点の変位：y₁、y₂、合成 y（T：1 周期の秒数）
  function waveAt(d, lambda, phase, x, y, t, T) {
    T = T || 1;
    const D = dists(d, x, y);
    if (!D || !(lambda > 0)) return { y1: NaN, y2: NaN, y: NaN };
    const k = TAU / lambda, w = TAU / T, phi = phiOf(phase);
    const y1 = Math.sin(k * D.r1 - w * t), y2 = Math.sin(k * D.r2 - w * t + phi);
    return { y1, y2, y: y1 + y2 };
  }

  // 格子の前計算。z = A sin(P − ωt) = (A sin P) cos ωt − (A cos P) sin ωt なので
  //   ca = A sin P、cb = A cos P を覚えておけば、毎フレームは z = ca·cos ωt − cb·sin ωt（かけ算だけ）。
  //   amp = |A|（振幅の分布）。i 列 j 行の点 x = x0 + (i + ½)dx、y = y0 − (j + ½)dy（上の行から）
  function grid(d, lambda, phase, x0, y1top, dx, dy, nx, ny) {
    const N = nx * ny, ca = new Float32Array(N), cb = new Float32Array(N), amp = new Float32Array(N);
    if (!(lambda > 0) || !(nx > 0) || !(ny > 0)) return { ca, cb, amp, nx, ny };
    const k = TAU / lambda, half = phiOf(phase) / 2, c = d / 2;
    for (let j = 0; j < ny; j++) {
      const y = y1top - (j + 0.5) * dy, yy = y * y;
      for (let i = 0; i < nx; i++) {
        const x = x0 + (i + 0.5) * dx;
        const r1 = Math.sqrt((x + c) * (x + c) + yy), r2 = Math.sqrt((x - c) * (x - c) + yy);
        const A = 2 * Math.cos(k * (r1 - r2) / 2 - half), P = k * (r1 + r2) / 2 + half;
        const id = j * nx + i;
        ca[id] = A * Math.sin(P); cb[id] = A * Math.cos(P); amp[id] = Math.abs(A);
      }
    }
    return { ca, cb, amp, nx, ny };
  }

  const api = { TOL, tidy, phiOf, sources, dists, judge, amplitude, mRange, lines, hyperbola, edgeRays, waveAt, grid };
  root.SimLib = root.SimLib || {};
  root.SimLib.interference = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
