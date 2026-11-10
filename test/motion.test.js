// 等速直線運動・等加速度運動の計算のテスト（node --test test/）
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/motion.js');
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≒ ${b}`);

test('静止から加速：v₀ = 0, a = 2, t = 3 → x = 9 m, v = 6 m/s', () => {
  assert.equal(L.pos(0, 2, 3), 9);
  assert.equal(L.vel(0, 2, 3), 6);
  assert.equal(L.stopTime(0, 2), null);          // t* = 0 は「向きが変わる」ではない
  assert.equal(L.distance(0, 2, 3), 9);
});

test('等速直線運動：a = 0 なら x = v₀t、v は一定', () => {
  assert.equal(L.pos(3, 0, 10), 30);
  assert.equal(L.vel(3, 0, 7.5), 3);
  assert.equal(L.stopTime(3, 0), null);
  assert.equal(L.trend(3, 0), 'const');
  assert.equal(L.trend(0, 0), 'rest');
  assert.equal(L.distance(-2, 0, 5), 10);        // 負の向きでも道のりは正
  assert.equal(L.pos(-2, 0, 5), -10);
});

test('ブレーキ：v₀ = 15, a = −3 は t = 5 s で止まり、そのあと逆向き', () => {
  assert.equal(L.stopTime(15, -3), 5);
  assert.equal(L.pos(15, -3, 5), 37.5);
  assert.equal(L.vel(15, -3, 5), 0);
  assert.equal(L.pos(15, -3, 10), 0);            // 変位は 0 にもどる
  assert.equal(L.distance(15, -3, 10), 75);      // 道のりは 37.5 + 37.5
  assert.equal(L.distance(15, -3, 4), L.pos(15, -3, 4));   // 止まる前は道のり = 変位
  assert.equal(L.distance(15, -3, 5), 37.5);
  assert.equal(L.turned(15, -3, 10), true);
  assert.equal(L.turned(15, -3, 5), false);
  assert.deepEqual(L.range(15, -3, 10), { min: 0, max: 37.5 });
});

test('鉛直投げ上げと同じ式：v₀ = 10, a = −5', () => {
  assert.equal(L.stopTime(10, -5), 2);
  assert.equal(L.pos(10, -5, 2), 10);            // 最高点
  assert.equal(L.pos(10, -5, 4), 0);             // もどってくる
  assert.equal(L.vel(10, -5, 4), -10);           // 同じ速さで逆向き
  assert.equal(L.distance(10, -5, 6), 50);       // 10 + 40
});

test('負の向きに出発して向きが変わる：v₀ = −6, a = 2', () => {
  assert.equal(L.stopTime(-6, 2), 3);
  assert.deepEqual(L.range(-6, 2, 10), { min: -9, max: 40 });
  assert.equal(L.distance(-6, 2, 10), 9 + 49);
  assert.deepEqual(L.vRange(-6, 2, 10), { min: -6, max: 14 });
});

test('0.1 きざみの誤差を出さない', () => {
  assert.equal(L.vel(2, 0.1, 3), 2.3);
  assert.equal(L.pos(0.5, 0.3, 2), 1.6);
  assert.equal(L.stopTime(1.5, -0.3), 5);
  near(L.distance(1.5, -0.3, 10), 7.5);
});

test('v² − v₀² = 2ax がいつも成り立つ', () => {
  for (const [v0, a, t] of [[2, 1, 3.37], [15, -3, 8], [-10, 5, 20], [0, -4.9, 2], [7, 0, 4]]) {
    const c = L.check(v0, a, t);
    near(c.lhs, c.rhs, 1e-6);
  }
});

test('ストロボ（1 秒ごとの位置）', () => {
  assert.deepEqual(L.strobe(0, 2, 3).map((p) => p.x), [0, 1, 4, 9]);
  assert.deepEqual(L.strobe(0, 2, 3.99).map((p) => p.t), [0, 1, 2, 3]);
  assert.equal(L.strobe(1, 1, 0).length, 1);
  assert.equal(L.strobe(1, 1, -1).length, 0);
  // 等加速度なら、となりの間隔の差はいつも a×(1 s)²
  const s = L.strobe(1, 0.4, 10).map((p) => p.x);
  for (let k = 2; k < s.length; k++) near((s[k] - s[k - 1]) - (s[k - 1] - s[k - 2]), 0.4, 1e-9);
});

test('範囲の自動決定：0 をふくみ、止まったままでも幅がある', () => {
  assert.deepEqual(L.range(2, 1, 10), { min: 0, max: 70 });
  assert.deepEqual(L.range(0, 0, 10), { min: 0, max: 0 });
  const p = L.pad(0, 0, 0.1);
  assert.ok(p.max - p.min > 0 && p.min <= 0 && p.max >= 0);
  const q = L.pad(0, 70, 0.1);
  near(q.min, -7); near(q.max, 77);
});

test('安全性：NaN・∞ を入れても落ちない', () => {
  assert.ok(Number.isNaN(L.pos(NaN, 1, 1)));
  assert.ok(Number.isNaN(L.vel(1, Infinity, 1)));
  assert.equal(L.stopTime(NaN, 1), null);
  assert.equal(L.stopTime(1, 0), null);
  assert.deepEqual(L.range(NaN, 1, 1), { min: 0, max: 0 });
  assert.deepEqual(L.strobe(1, 1, NaN), []);
  assert.equal(L.distance(1, 1, 0), 0);
  const p = L.pad(NaN, NaN);
  assert.ok(Number.isFinite(p.min) && Number.isFinite(p.max) && p.max > p.min);
});

test('速さのようす（v と a の向き）', () => {
  assert.equal(L.trend(3, 1), 'faster');
  assert.equal(L.trend(-3, -1), 'faster');
  assert.equal(L.trend(3, -1), 'slower');
  assert.equal(L.trend(-3, 1), 'slower');
  assert.equal(L.trend(0, 2), 'turn');
});
