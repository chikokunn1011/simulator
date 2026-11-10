/* 等速直線運動・等加速度直線運動の計算（画面とは別。test/motion.test.js で確かめる）
   x₀ = 0、a は一定。位置・速度はいつも解析解（積分しない）：
     v = v₀ + at、 x = v₀t + ½at² */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  // スライダーは 0.1・0.5 きざみなので、小さな誤差（0.30000000000000004 など）を丸める
  const tidy = (v) => (!Number.isFinite(v) ? v : Math.abs(v) < EPS ? 0 : Number(v.toPrecision(12)));
  const ok = (...xs) => xs.every(Number.isFinite);

  function pos(v0, a, t) { return ok(v0, a, t) ? tidy(v0 * t + 0.5 * a * t * t) : NaN; }
  function vel(v0, a, t) { return ok(v0, a, t) ? tidy(v0 + a * t) : NaN; }

  // 速度が 0 になる時刻 t* = −v₀/a（t* > 0 のときだけ。そうでなければ null）
  // a = 0 なら速度は変わらないので null。v₀ = 0 なら t* = 0（出発の瞬間）なので null
  function stopTime(v0, a) {
    if (!ok(v0, a) || a === 0) return null;
    const ts = tidy(-v0 / a);
    return ts > 0 ? ts : null;
  }
  // 0 から t までに向きが変わったか（0 < t* < t）
  function turned(v0, a, t) {
    const ts = stopTime(v0, a);
    return ts != null && ts < t;
  }

  // 道のり（動いた距離の合計）。向きが変わったら、行きと帰りを足す
  function distance(v0, a, t) {
    if (!ok(v0, a, t) || t <= 0) return ok(v0, a, t) ? 0 : NaN;
    const ts = stopTime(v0, a);
    const xt = pos(v0, a, t);
    if (ts != null && ts < t) { const xs = pos(v0, a, ts); return tidy(Math.abs(xs) + Math.abs(xt - xs)); }
    return tidy(Math.abs(xt));
  }

  // 0〜T で x(t) がとる最小・最大（0 をふくむ）
  function range(v0, a, T) {
    if (!ok(v0, a, T)) return { min: 0, max: 0 };
    const xs = [0, pos(v0, a, Math.max(0, T))];
    const ts = stopTime(v0, a);
    if (ts != null && ts < T) xs.push(pos(v0, a, ts));
    return { min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) };
  }
  // 0〜T で v(t) がとる最小・最大（0 をふくむ。v は t の一次式なので両はしだけ見ればよい）
  function vRange(v0, a, T) {
    if (!ok(v0, a, T)) return { min: 0, max: 0 };
    const v1 = vel(v0, a, Math.max(0, T));
    return { min: Math.min(0, v0, v1), max: Math.max(0, v0, v1) };
  }
  // 図の範囲：min〜max に余白をつける。幅が 0（止まったまま）でも広がりをもたせる
  function pad(min, max, lo, hi, minSpan) {
    lo = lo == null ? 0.1 : lo; hi = hi == null ? lo : hi; minSpan = minSpan || 1;
    if (!ok(min, max)) { min = 0; max = 0; }
    let span = max - min;
    if (span < minSpan) { const c = (min + max) / 2; min = c - minSpan / 2; max = c + minSpan / 2; span = minSpan; if (min > 0) { max -= min; min = 0; } if (max < 0) { min -= max; max = 0; } }
    return { min: min - span * lo, max: max + span * hi };
  }

  // 1 秒ごと（step 秒ごと）の時刻と位置：ストロボ写真・記録タイマーの点
  function strobe(v0, a, tEnd, step) {
    step = step || 1;
    const out = [];
    if (!ok(v0, a, tEnd) || tEnd < 0 || !(step > 0)) return out;
    const n = Math.floor(tEnd / step + 1e-9);
    for (let k = 0; k <= n && k <= 10000; k++) { const t = tidy(k * step); out.push({ t, x: pos(v0, a, t), v: vel(v0, a, t) }); }
    return out;
  }

  // 速さのようす：'rest'（止まったまま）・'const'（一定）・'faster'（速くなる）・'slower'（遅くなる）・'turn'（この瞬間 v = 0、向きが変わる・動き出す）
  function trend(v, a) {
    v = tidy(v); a = tidy(a);
    if (a === 0) return v === 0 ? 'rest' : 'const';
    if (v === 0) return 'turn';
    return v * a > 0 ? 'faster' : 'slower';
  }

  // v² − v₀² と 2ax（同じになるはず）
  function check(v0, a, t) {
    const v = vel(v0, a, t), x = pos(v0, a, t);
    return { lhs: tidy(v * v - v0 * v0), rhs: tidy(2 * a * x) };
  }

  const api = { pos, vel, stopTime, turned, distance, range, vRange, pad, strobe, trend, check, tidy };
  root.SimLib = root.SimLib || {};
  root.SimLib.motion = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
