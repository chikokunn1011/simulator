/* 円周角と中心角の計算（画面とは別。test/inscribed-angle.test.js で確かめる）
   円は中心 O(0, 0)・半径 1。角は x 軸の正の向きから反時計回りの度。
   弧 AB（点 P のない側）は円の下側に置く：A は −90° − arc/2、B は −90° + arc/2（arc ＝ 弧 AB に対する中心角）。
   点 P は残りの弧（B から反時計回りに A まで）の上。位置 t は その弧の何 % のところか（B 側が 0、A 側が 100） */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  const ARC_MIN = 20, ARC_MAX = 280, T_MIN = 10, T_MAX = 90;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mod360 = (d) => ((d % 360) + 360) % 360;
  const pt = (deg) => [Math.cos(deg * RAD), Math.sin(deg * RAD)];

  const aDeg = (arc) => -90 - arc / 2;
  const bDeg = (arc) => -90 + arc / 2;
  // 点 P の向き（度）
  const pDeg = (arc, t) => bDeg(arc) + (360 - arc) * t / 100;
  // 円周角：中心角の半分
  const inscribed = (arc) => arc / 2;

  // 図の点
  function points(arc, t) {
    return { O: [0, 0], A: pt(aDeg(arc)), B: pt(bDeg(arc)), P: pt(pDeg(arc, t)) };
  }
  // ∠AVB の大きさ（度、0〜180）。座標から求める（定理を使わない）
  function angle(V, A, B) {
    const ux = A[0] - V[0], uy = A[1] - V[1], vx = B[0] - V[0], vy = B[1] - V[1];
    return Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) / RAD;
  }
  // 指で動かしたとき：向き deg から P の位置 t（弧 AB の側に入ったら近いはしで止める）
  function tOf(arc, deg) {
    const far = 360 - arc, d = mod360(deg - bDeg(arc));
    let t;
    if (d <= far) t = d / far * 100;
    else t = d - far < arc / 2 ? 100 : 0;
    return clamp(Math.round(t), T_MIN, T_MAX);
  }
  // 指で A か B を動かしたとき：向き deg から中心角（A と B は左右対称に動く。2° きざみ）
  function arcOf(deg, which) {
    let half = which === 'A' ? mod360(-90 - deg) : mod360(deg + 90);   // 真下からの角
    if (half > 180) half = half > 270 ? 0 : 180;
    return clamp(Math.round(half) * 2, ARC_MIN, ARC_MAX);
  }
  // 半径 OP をひいたときの 2 つの角と、O が ∠APB の中にあるか
  //   中にある：∠APB = ∠OPA + ∠OPB／外にある：∠APB = 大きい方 − 小さい方
  function split(arc, t) {
    const g = points(arc, t);
    const opa = angle(g.P, g.O, g.A), opb = angle(g.P, g.O, g.B), apb = angle(g.P, g.A, g.B);
    const inside = Math.abs(opa + opb - apb) < 1e-6;
    return { opa, opb, apb, inside };
  }

  const api = { ARC_MIN, ARC_MAX, T_MIN, T_MAX, pt, aDeg, bDeg, pDeg, inscribed, points, angle, tOf, arcOf, split };
  root.SimLib = root.SimLib || {};
  root.SimLib['inscribed-angle'] = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
