// オームの法則の計算のテスト（node --test test/）
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/ohm.js');
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≒ ${b}`);

test('抵抗 1 つ：6 V / 20 Ω = 0.3 A、12 V / 10 Ω = 1.2 A', () => {
  const o = L.solve('single', 6, 20);
  assert.equal(o.ok, true); assert.equal(o.I, 0.3); assert.equal(o.R, 20);
  assert.equal(o.V1, 6); assert.equal(o.I1, 0.3); near(o.P, 1.8); near(o.P1, 1.8);
  assert.ok(Number.isNaN(o.V2)); assert.ok(Number.isNaN(o.P2));
  const b = L.solve('single', 12, 10);
  assert.equal(b.I, 1.2); near(b.P, 14.4);
});

test('直列 10 Ω + 20 Ω、12 V → 0.4 A・4 V・8 V', () => {
  const o = L.solve('series', 12, 10, 20);
  assert.equal(o.R, 30); assert.equal(o.I, 0.4);
  assert.equal(o.I1, 0.4); assert.equal(o.I2, 0.4);
  assert.equal(o.V1, 4); assert.equal(o.V2, 8);
  near(o.V1 + o.V2, 12);                       // 電圧の和は電源の電圧
  near(o.P, 4.8); near(o.P1 + o.P2, o.P);
});

test('並列 20 Ω ∥ 30 Ω = 12 Ω、12 V → 1 A, 0.6 A, 0.4 A', () => {
  assert.equal(L.parallelR(20, 30), 12);
  assert.equal(L.parallelR(10, 10), 5);
  const o = L.solve('parallel', 12, 20, 30);
  assert.equal(o.R, 12); assert.equal(o.I, 1); assert.equal(o.I1, 0.6); assert.equal(o.I2, 0.4);
  assert.equal(o.V1, 12); assert.equal(o.V2, 12);
  near(o.P, 12); near(o.P1 + o.P2, o.P);
});

test('並列の合成抵抗はどちらの抵抗よりも小さい', () => {
  for (const [a, b] of [[1, 1], [1, 100], [20, 30], [99, 100], [7, 13]]) {
    const r = L.parallelR(a, b);
    assert.ok(r < a && r < b, `${a}∥${b} = ${r}`);
    near(1 / r, 1 / a + 1 / b, 1e-9);
  }
});

test('V = 0 なら電流も電力も 0（NaN にならない）', () => {
  for (const m of ['single', 'series', 'parallel']) {
    const o = L.solve(m, 0, 20, 30);
    assert.equal(o.I, 0); assert.equal(o.P, 0); assert.equal(o.I1, 0);
  }
});

test('0.1 V きざみでも誤差が出ない', () => {
  assert.equal(L.solve('single', 0.3, 1).I, 0.3);
  assert.equal(L.solve('single', 0.7, 10).I, 0.07);
  assert.equal(L.solve('series', 0.3, 1, 2).V1, 0.1);
});

test('範囲外・数でない値は安全に', () => {
  const z = L.solve('single', 6, 0);            // 0 Ω（ショート）は扱わない → 1 Ω に直す
  assert.equal(z.R, 1); assert.equal(z.I, 6); assert.equal(z.clamped, true);
  const n = L.solve('single', 6, -5);
  assert.equal(n.R, 1); assert.ok(Number.isFinite(n.I));
  const big = L.solve('series', 99, 500, 30);
  assert.equal(big.V, 12); assert.equal(big.R1, 100); assert.equal(big.clamped, true);
  const neg = L.solve('parallel', -3, 10, 10);
  assert.equal(neg.V, 0); assert.equal(neg.I, 0);
  assert.equal(L.solve('single', NaN, 10).ok, false);
  assert.equal(L.solve('series', 6, 10, undefined).ok, false);
  assert.equal(L.solve('single', 6, 10, NaN).ok, true);   // 1 つのときは R₂ を見ない
  assert.equal(L.solve('weird', 6, 20).mode, 'single');
  assert.ok(Number.isNaN(L.parallelR(0, 10)));
  // 最大の電流：12 V、1 Ω ∥ 1 Ω = 0.5 Ω → 24 A
  const mx = L.solve('parallel', 12, 1, 1);
  assert.equal(mx.R, 0.5); assert.equal(mx.I, 24);
});

test('有効数字の表示', () => {
  assert.equal(L.sigStr(0.3).text, '0.3'); assert.equal(L.sigStr(0.3).exact, true);
  const s = L.sigStr(6 / 7);
  assert.equal(s.text, '0.857'); assert.equal(s.exact, false);
  assert.equal(L.sigStr(20 / 3).text, '6.67');
  assert.equal(L.sigStr(24).text, '24');
  assert.equal(L.sigStr(1234).text, '1230');
  assert.equal(L.sigStr(0).text, '0');
  assert.equal(L.sigStr(0.0005).text, '0.0005');
  assert.equal(L.sigStr(-1.5).text, '−1.5');
  assert.equal(L.sigStr(NaN).text, '—');
  assert.equal(L.sigStr(Infinity).text, '—');
  assert.equal(L.sigStr(0.12, 3).text, '0.12');
});

test('電流の表示：1 A 未満は mA も', () => {
  assert.deepEqual([L.current(0.3).a, L.current(0.3).mA], ['0.3 A', '300 mA']);
  assert.equal(L.current(0.12).mA, '120 mA');
  assert.equal(L.current(1.2).mA, '');
  assert.equal(L.current(0).a, '0 A'); assert.equal(L.current(0).mA, '');
  assert.equal(L.current(6 / 70).mA, '85.7 mA');
  assert.equal(L.current(NaN).a, '—');
});

test('グラフの縦軸', () => {
  assert.equal(L.niceCeil(0.3), 0.3);
  assert.equal(L.niceCeil(0.31), 0.4);
  assert.equal(L.niceCeil(24), 25);
  assert.equal(L.niceCeil(0.12), 0.12);
  assert.equal(L.niceCeil(0), 1);
  const g = L.graphLines('series', 10, 20);
  assert.equal(g.lines.length, 3); near(g.Imax, 1.2);           // いちばん急なのは 10 Ω
  const p = L.graphLines('parallel', 20, 30);
  near(p.Imax, 1);                                               // 合成 12 Ω がいちばん急
  assert.equal(L.graphLines('single', 20).lines.length, 1);
});
