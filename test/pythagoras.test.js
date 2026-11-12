// 三平方の定理の計算のテスト（node --test test/*.test.js）
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/pythagoras.js');
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≒ ${b}`);

test('斜辺：3・4・5、5・12・13、整数にならないときは √ の形', () => {
  const h = L.hyp(3, 4);
  assert.equal(h.c2, 25); assert.equal(h.c, 5); assert.equal(h.whole, true); assert.equal(h.text, '5');
  assert.equal(L.hyp(5, 12).text, '13');
  const g = L.hyp(2, 3);
  assert.equal(g.c2, 13); assert.equal(g.whole, false); assert.equal(g.text, '√13'); near(g.c, 3.605551275463989);
  assert.equal(L.hyp(4, 6).text, '2√13');
  assert.equal(L.hyp(1, 1).text, '√2');
  assert.equal(L.hyp(4, 4).text, '4√2');
});

test('√ を簡単にする', () => {
  assert.deepEqual(L.simplifyRoot(72), { k: 6, m: 2 });
  assert.deepEqual(L.simplifyRoot(49), { k: 7, m: 1 });
  assert.deepEqual(L.simplifyRoot(30), { k: 1, m: 30 });
  assert.equal(L.rootText(32), '4√2'); assert.equal(L.rootText(48), '4√3'); assert.equal(L.rootText(1), '1');
  for (let n = 1; n <= 300; n++) { const r = L.simplifyRoot(n); assert.equal(r.k * r.k * r.m, n); }
});

test('残りの辺：斜辺 13・1 辺 5 → 12。斜辺が短いときは null', () => {
  assert.equal(L.leg(13, 5).b, 12); assert.equal(L.leg(13, 5).text, '12');
  assert.equal(L.leg(6, 4).text, '2√5');
  assert.equal(L.leg(5, 5), null); assert.equal(L.leg(3, 4), null);
});

test('直角三角形かどうか（辺の順はどれでも）', () => {
  assert.equal(L.isRight(3, 4, 5), true); assert.equal(L.isRight(13, 5, 12), true); assert.equal(L.isRight(8, 15, 17), true);
  assert.equal(L.isRight(4, 5, 6), false); assert.equal(L.isRight(2, 3, 4), false); assert.equal(L.isRight(5, 6, 8), false);
});

test('図の正方形の面積が a²・b²・c²（a² + b² = c²）。a, b = 1〜12 の全部', () => {
  for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) {
    const f = L.figure(a, b);
    near(L.area(f.sqA), a * a); near(L.area(f.sqB), b * b); near(L.area(f.sqC), a * a + b * b);
    near(L.area(f.sqA) + L.area(f.sqB), L.area(f.sqC));
    // 斜辺の上の正方形：4 辺が同じ長さで、となりの辺と垂直
    const q = f.sqC, c = Math.hypot(a, b);
    for (let i = 0; i < 4; i++) {
      const p0 = q[i], p1 = q[(i + 1) % 4], p2 = q[(i + 2) % 4];
      near(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), c);
      near((p1[0] - p0[0]) * (p2[0] - p1[0]) + (p1[1] - p0[1]) * (p2[1] - p1[1]), 0);
    }
    // 全部が範囲に入る
    for (const p of [].concat(f.sqA, f.sqB, f.sqC)) assert.ok(p[0] >= f.box.xmin && p[0] <= f.box.xmax && p[1] >= f.box.ymin && p[1] <= f.box.ymax);
  }
});

test('しきつめ：左右とも 1 辺 a + b の正方形をちょうどうめる。三角形は 8 つとも面積 ab/2', () => {
  for (const [a, b] of [[3, 4], [5, 12], [2, 3], [1, 1], [7, 2], [12, 12]]) {
    const t = L.tiling(a, b), big = (a + b) ** 2;
    for (const tr of t.left.tris.concat(t.right.tris)) near(L.area(tr), a * b / 2);
    near(L.area(t.left.sqC), a * a + b * b);
    near(L.area(t.right.sqA), a * a); near(L.area(t.right.sqB), b * b);
    near(t.left.tris.reduce((s, x) => s + L.area(x), 0) + L.area(t.left.sqC), big);
    near(t.right.tris.reduce((s, x) => s + L.area(x), 0) + L.area(t.right.sqA) + L.area(t.right.sqB), big);
  }
});
