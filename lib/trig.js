/* 三角関数と単位円の計算（画面とは別。test/trig.test.js で確かめる）
   角はすべて「度」で受け取る（画面のスライダーが度なので）。ラジアンへの直しはここで行う。 */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  const MINUS = '−';
  const isInt = (v) => Math.abs(v - Math.round(v)) < EPS;

  // 度 ⇔ ラジアン（180° = π）
  function degToRad(d) { return d * Math.PI / 180; }
  function radToDeg(r) { return r * 180 / Math.PI; }

  // 0 以上 360 未満に直す（θ と θ + 360° は同じ点）
  function normDeg(d) {
    if (!Number.isFinite(d)) return NaN;
    let n = d % 360;
    if (n < 0) n += 360;
    if (Math.abs(n) < EPS || Math.abs(n - 360) < EPS) n = 0;
    return n;
  }

  // 有名角：30° か 45° の倍数（整数の度）
  function isFamous(d) {
    if (!Number.isFinite(d) || !isInt(d)) return false;
    const k = Math.round(d);
    return k % 30 === 0 || k % 45 === 0;
  }
  // いちばん近い有名角（同じ近さなら小さい方）
  function nearestFamous(d) {
    if (!Number.isFinite(d)) return 0;
    let best = null;
    const base = Math.floor(d / 15) * 15;
    for (let x = base - 45; x <= base + 60; x += 15) {
      if (!isFamous(x)) continue;
      if (best === null || Math.abs(x - d) < Math.abs(best - d) - EPS) best = x;
    }
    return best;
  }

  // 象限：1〜4、軸の上なら 'x+'（x 軸の正の部分）・'y+'・'x-'・'y-'
  function quadrant(d) {
    const n = normDeg(d);
    if (!Number.isFinite(n)) return null;
    for (const [a, name] of [[0, 'x+'], [90, 'y+'], [180, 'x-'], [270, 'y-']]) if (Math.abs(n - a) < EPS) return name;
    return n < 90 ? 1 : n < 180 ? 2 : n < 270 ? 3 : 4;
  }

  // tan θ が定義されるか：θ = 90° + 180°×n（cos θ = 0）では定義されない。
  // 浮動小数では cos 90° ≒ 6e-17 になってしまうので、度の値で判定する
  function tanDefined(d) {
    if (!Number.isFinite(d)) return false;
    return !isInt((d - 90) / 180);
  }

  // 正確な値（有名角だけ）。{ sign: −1|0|1, num: '√3', den: '2' か '' } の形
  const SIN_MAG = { 0: ['0', ''], 30: ['1', '2'], 45: ['√2', '2'], 60: ['√3', '2'], 90: ['1', ''] };
  const TAN_MAG = { 0: ['0', ''], 30: ['1', '√3'], 45: ['1', ''], 60: ['√3', ''] };
  const MAG_VAL = { '0': 0, '1': 1, '√2': Math.SQRT2, '√3': Math.sqrt(3), '2': 2, '': 1 };
  const refAngle = (n) => { const r = n % 180; return Math.min(r, 180 - r); };   // 0〜90 の「基準の角」
  const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  function signsOf(d) {
    const q = quadrant(d);
    const s = q === 'x+' || q === 'x-' ? 0 : (q === 'y+' || q === 1 || q === 2) ? 1 : -1;
    const c = q === 'y+' || q === 'y-' ? 0 : (q === 'x+' || q === 1 || q === 4) ? 1 : -1;
    const t = tanDefined(d) ? (s * c || 0) : null;
    return { sin: s, cos: c, tan: t };
  }
  function exact(d) {
    if (!isFamous(d)) return null;
    const n = Math.round(normDeg(d));
    const r = refAngle(n);
    const sg = signsOf(d);
    const mk = (sign, mag) => {
      const e = { sign, num: mag[0], den: mag[1] };
      e.value = sign === 0 ? 0 : sign * MAG_VAL[e.num] / MAG_VAL[e.den];
      e.text = exactText(e);
      return e;
    };
    return {
      sin: mk(sg.sin, SIN_MAG[r]),
      cos: mk(sg.cos, SIN_MAG[90 - r]),
      tan: sg.tan === null ? null : mk(sg.tan, TAN_MAG[r])
    };
  }
  function exactText(e) {
    if (!e) return '';
    if (e.sign === 0) return '0';
    return (e.sign < 0 ? MINUS : '') + e.num + (e.den ? '/' + e.den : '');
  }

  // 値（数）。有名角では正確な値から求める（sin 180° が 1.2e-16 にならないように）。tan が定義されないときは null
  function values(d) {
    if (!Number.isFinite(d)) return { sin: NaN, cos: NaN, tan: null };
    const ex = exact(d);
    if (ex) return { sin: ex.sin.value, cos: ex.cos.value, tan: ex.tan ? ex.tan.value : null };
    const r = degToRad(d);
    return { sin: Math.sin(r), cos: Math.cos(r), tan: tanDefined(d) ? Math.tan(r) : null };
  }
  // グラフ用：tan x（定義されないところは NaN）
  function tanOrNaN(d) { return tanDefined(d) ? Math.tan(degToRad(d)) : NaN; }

  // ラジアンを π の分数で：θ/180 = n/den（den は 12 以下）なら { n, den }、ちがえば null
  function radFrac(d, maxDen) {
    if (!Number.isFinite(d)) return null;
    maxDen = maxDen || 12;
    const v = d / 180;
    for (let den = 1; den <= maxDen; den++) {
      const k = v * den;
      if (isInt(k)) return { n: Math.round(k), den };
    }
    return null;
  }
  // 'π/6'・'−3π/4'・'2π'・'0'。π の分数で書けなければ小数（digits けた、ふつう 4）
  function radText(d, digits) {
    if (!Number.isFinite(d)) return '—';
    const f = radFrac(d);
    if (f) {
      if (f.n === 0) return '0';
      const a = Math.abs(f.n);
      return (f.n < 0 ? MINUS : '') + (a === 1 ? '' : a) + 'π' + (f.den === 1 ? '' : '/' + f.den);
    }
    let s = degToRad(d).toFixed(digits == null ? 4 : digits);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', MINUS);
  }

  // グラフに出す 1 周期ぶん（360°）の左はし。θ が 0〜360° なら 0。θ = 720° のように右はしちょうどなら前の周期
  function graphStart(d) {
    if (!Number.isFinite(d)) return 0;
    let a = Math.floor(d / 360 + EPS) * 360;
    if (a > 0 && Math.abs(d - a) < EPS) a -= 360;
    return a;
  }

  const PERIOD = { sin: 360, cos: 360, tan: 180 };

  const api = { degToRad, radToDeg, normDeg, isFamous, nearestFamous, quadrant, tanDefined, signsOf, exact, exactText,
    values, tanOrNaN, radFrac, radText, graphStart, PERIOD, EPS };
  root.SimLib = root.SimLib || {};
  root.SimLib.trig = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
