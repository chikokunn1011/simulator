// 一次関数・二次関数の計算のテスト（node --test test/）
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/functions.js');
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≒ ${b}`);

test('一次関数：傾き・切片・x 軸との交点', () => {
  const l = L.linear(2, 1);
  assert.equal(l.slope, 2); assert.equal(l.yInt, 1); near(l.xInt, -0.5);
  assert.equal(L.linear(0, 3).xInt, null);          // 水平で交わらない
  assert.equal(L.linear(0, 0).xInt, 'all');         // x 軸と重なる
  near(L.linear(-0.3, 0.6).xInt, 2);                // 0.1 きざみの誤差が出ない
  near(L.linear(0.5, -2).f(4), 0);
});

test('二次関数：y = x² − 2x − 3 の頂点・軸・判別式・解', () => {
  const q = L.quadratic(1, -2, -3);
  assert.equal(q.p, 1); assert.equal(q.q, -4); assert.equal(q.D, 16);
  assert.deepEqual(q.roots, [-1, 3]); assert.equal(q.extreme, 'min');
});

test('二次関数：重解・解なし・上に凸', () => {
  const q1 = L.quadratic(1, 4, 4);
  assert.equal(q1.D, 0); assert.deepEqual(q1.roots, [-2]); assert.equal(q1.q, 0);
  const q2 = L.quadratic(1, 0, 1);
  assert.equal(q2.D, -4); assert.deepEqual(q2.roots, []);
  const q3 = L.quadratic(-2, 0, 0);
  assert.equal(q3.opens, 'down'); assert.equal(q3.p, 0); assert.equal(q3.q, 0);
  // 0.1 きざみの係数でも D = 0 を正しく判定（0.1² − 4×0.1×0.025 など）
  const q4 = L.quadratic(0.1, 0.2, 0.1);
  assert.equal(q4.D, 0); assert.deepEqual(q4.roots, [-1]);
});

test('二次関数：解と係数の関係・頂点の値が式と一致', () => {
  for (const [a, b, c] of [[2, -3, 1], [-1.5, 4.2, 2.3], [0.3, -7.1, -9.9], [5, 10, -10], [-5, -10, 10]]) {
    const q = L.quadratic(a, b, c);
    near(q.f(q.p), q.q, 1e-9);
    if (q.roots.length === 2) {
      near(q.roots[0] + q.roots[1], -b / a, 1e-9);
      near(q.roots[0] * q.roots[1], c / a, 1e-9);
      q.roots.forEach((r) => near(q.f(r), 0, 1e-8));
    }
  }
});

test('二次関数：a = 0 は二次関数ではない', () => {
  const q = L.quadratic(0, 2, 1);
  assert.equal(q.degenerate, true); near(q.line.xInt, -0.5);
});

test('分数・変化の割合', () => {
  assert.deepEqual(L.toFrac(-0.5), [-1, 2]);
  assert.deepEqual(L.toFrac(1 / 3), [1, 3]);
  assert.equal(L.toFrac(Math.SQRT2, 60), null);
  const f = (x) => x * x;
  near(L.avgRate(f, 1, 3), 4);                      // a(x1 + x2) + b = 1×(1+3)
  assert.ok(Number.isNaN(L.avgRate(f, 2, 2)));
});
