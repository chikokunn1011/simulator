// 円周角と中心角の計算のテスト（node --test test/*.test.js）
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/inscribed-angle.js');
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} ≒ ${b}`);

test('円周角は中心角の半分：座標から測った ∠APB が、P がどこでも arc/2', () => {
  for (let arc = L.ARC_MIN; arc <= L.ARC_MAX; arc += 2) {
    for (let t = L.T_MIN; t <= L.T_MAX; t += 5) {
      const g = L.points(arc, t);
      near(L.angle(g.P, g.A, g.B), L.inscribed(arc));
    }
  }
});

test('点はすべて円周上（半径 1）にある。A と B は左右対称で、中心角は arc', () => {
  const g = L.points(100, 35);
  for (const k of ['A', 'B', 'P']) near(Math.hypot(g[k][0], g[k][1]), 1);
  near(g.A[0], -g.B[0]); near(g.A[1], g.B[1]);
  near(L.angle(g.O, g.A, g.B), 100);
  // 180° より大きい中心角：測った角（小さい側）は 360 − arc
  const h = L.points(240, 50);
  near(L.angle(h.O, h.A, h.B), 120);
  near(L.angle(h.P, h.A, h.B), 120);   // 円周角は 240 ÷ 2
});

test('直径（中心角 180°）に対する円周角は 90°', () => {
  for (let t = 10; t <= 90; t += 10) { const g = L.points(180, t); near(L.angle(g.P, g.A, g.B), 90); }
  const g = L.points(180, 50);
  near(g.A[0], -1); near(g.B[0], 1); near(g.A[1], 0);
});

test('P は弧 AB と反対側の弧の上：t = 50 でいちばん上', () => {
  const g = L.points(100, 50);
  near(g.P[0], 0); near(g.P[1], 1);
  near(L.pDeg(100, 0), L.bDeg(100)); near(L.pDeg(100, 100), L.aDeg(100) + 360);
});

test('指で動かす：向き → P の位置（もどすと同じ）・弧 AB の側では止まる', () => {
  for (const arc of [20, 100, 180, 280]) for (let t = 10; t <= 90; t += 7) assert.equal(L.tOf(arc, L.pDeg(arc, t)), t);
  assert.equal(L.tOf(100, 90), 50);
  const mid = L.tOf(100, -90);   // 真下（弧 AB の真ん中）でも範囲の中
  assert.ok(mid === L.T_MIN || mid === L.T_MAX);
  assert.ok(L.tOf(100, -80) === L.T_MIN);    // B のすぐ先（弧 AB の中）→ B 側のはし
  assert.ok(L.tOf(100, -100) === L.T_MAX);   // A のすぐ手前（弧 AB の中）→ A 側のはし
});

test('指で動かす：A・B の向き → 中心角（2° きざみ・範囲内）', () => {
  for (let arc = 20; arc <= 280; arc += 2) {
    assert.equal(L.arcOf(L.aDeg(arc), 'A'), arc);
    assert.equal(L.arcOf(L.bDeg(arc), 'B'), arc);
  }
  assert.equal(L.arcOf(-90, 'A'), L.ARC_MIN);
  assert.equal(L.arcOf(90, 'A'), L.ARC_MAX);
  assert.equal(L.arcOf(-50.4, 'B') % 2, 0);
});

test('半径 OP で分ける：O が角の中なら和、外なら差が円周角', () => {
  const a = L.split(100, 50);   // P が真上：O は中、左右同じ
  assert.equal(a.inside, true); near(a.opa, 25); near(a.opb, 25); near(a.opa + a.opb, 50);
  const b = L.split(60, 15);    // P が B のそば：O は外
  assert.equal(b.inside, false); near(Math.abs(b.opa - b.opb), 30);
  for (let arc = 20; arc <= 280; arc += 10) for (let t = 10; t <= 90; t += 5) {
    const s = L.split(arc, t);
    near(s.inside ? s.opa + s.opb : Math.abs(s.opa - s.opb), arc / 2, 1e-6);
  }
});
