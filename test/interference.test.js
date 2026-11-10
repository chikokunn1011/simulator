// 波の干渉の計算のテスト（node --test test/）
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/interference.js');
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≒ ${b}`);

test('距離と経路差', () => {
  // d = 4：S₁(−2, 0)、S₂(2, 0)。点 (2, 3) は r₁ = 5、r₂ = 3、経路差 2
  const D = L.dists(4, 2, 3);
  near(D.r1, 5); near(D.r2, 3); near(D.diff, 2); near(D.signed, 2);
  near(L.dists(4, -2, 3).signed, -2);                  // 左右対称で符号が逆
  near(L.dists(4, 0, 7).diff, 0);                      // 垂直二等分線上は 0
  near(L.dists(4, 9, 0).diff, 4);                      // 波源の外側の x 軸上は d
  assert.equal(L.dists(NaN, 0, 0), null);
});

test('判定：同位相', () => {
  assert.equal(L.judge(3, 1.5, 'same').kind, 'strong');           // 2λ
  assert.equal(L.judge(3, 1.5, 'same').m, 2);
  assert.equal(L.judge(3, 1.5, 'same').near, false);
  const w = L.judge(2.25, 1.5, 'same');                             // 1.5λ
  assert.equal(w.kind, 'weak'); assert.equal(w.m, 1); assert.equal(w.label, '弱め合う');
  assert.equal(L.judge(0, 1.5, 'same').kind, 'strong');            // 経路差 0
  assert.equal(L.judge(0.75, 1.5, 'same').kind, 'weak');           // ½λ → m = 0
  assert.equal(L.judge(0.75, 1.5, 'same').m, 0);
  const mid = L.judge(1.2, 1.5, 'same');                            // 0.8λ
  assert.equal(mid.kind, 'mid'); near(mid.q, 0.8);
});

test('判定：許容誤差 5% の境界', () => {
  // λ = 1 で 1.05λ はほぼ強め合う（境界をふくむ）、1.06λ は中間、1.46λ はほぼ弱め合う
  assert.equal(L.judge(1.05, 1, 'same').label, 'ほぼ強め合う');
  assert.equal(L.judge(0.95, 1, 'same').label, 'ほぼ強め合う');
  assert.equal(L.judge(1.06, 1, 'same').kind, 'mid');
  assert.equal(L.judge(1.46, 1, 'same').label, 'ほぼ弱め合う');
  assert.equal(L.judge(1.55, 1, 'same').label, 'ほぼ弱め合う');
  assert.equal(L.judge(1.56, 1, 'same').kind, 'mid');
  // 0.1 きざみの誤差：0.3 / 0.1 などでも「ちょうど」と判定
  assert.equal(L.judge(0.3, 0.1, 'same').label, '強め合う');
  assert.equal(L.judge(4.5, 0.6, 'same').kind, 'weak');            // 7.5λ
});

test('判定：逆位相は入れかわる', () => {
  assert.equal(L.judge(0, 1.5, 'opp').kind, 'weak');               // 中央線は弱め合う
  assert.equal(L.judge(3, 1.5, 'opp').kind, 'weak');
  const s = L.judge(2.25, 1.5, 'opp');
  assert.equal(s.kind, 'strong'); assert.equal(s.m, 1);            // (1 + ½)λ
  assert.equal(L.judge(1.2, 1.5, 'opp').kind, 'mid');
});

test('判定：おかしな入力は「定義されない」', () => {
  assert.equal(L.judge(1, 0, 'same').kind, 'undef');
  assert.equal(L.judge(NaN, 1, 'same').kind, 'undef');
  assert.equal(L.judge(1, -1, 'same').kind, 'undef');
  assert.equal(L.judge(-1, 1, 'same').kind, 'undef');
});

test('合成波の振幅', () => {
  near(L.amplitude(0, 1.5, 'same'), 2);
  near(L.amplitude(0.75, 1.5, 'same'), 0);
  near(L.amplitude(0, 1.5, 'opp'), 0);
  near(L.amplitude(0.75, 1.5, 'opp'), 2);
  near(L.amplitude(-3, 1.5, 'same'), 2);
  near(L.amplitude(0.375, 1.5, 'same'), Math.SQRT2);               // ¼λ → 2cos(π/4)
  assert.ok(Number.isNaN(L.amplitude(1, 0, 'same')));
});

test('線の本数：d = 4、λ = 1.5、同位相（自分で検算した例）', () => {
  // 強め合う：|m|×1.5 < 4 → m = −2..2 の 5 本。弱め合う：|m + ½|×1.5 < 4 → m = −3..2 の 6 本
  const Ls = L.lines(4, 1.5, 'same');
  assert.deepEqual([Ls.strong.range.min, Ls.strong.range.max, Ls.strong.count], [-2, 2, 5]);
  assert.deepEqual([Ls.weak.range.min, Ls.weak.range.max, Ls.weak.count], [-3, 2, 6]);
  assert.deepEqual(Ls.weak.list.map((l) => l.signed), [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75]);
  assert.deepEqual(Ls.weak.list.map((l) => l.m), [2, 1, 0, 0, 1, 2]);
  assert.equal(Ls.strong.edge, false); assert.equal(Ls.weak.edge, false);
});

test('線の本数：逆位相は入れかわる', () => {
  const Ls = L.lines(4, 1.5, 'opp');
  assert.equal(Ls.strong.count, 6); assert.equal(Ls.weak.count, 5);
  assert.ok(Ls.weak.list.some((l) => l.signed === 0));             // 中央線は弱め合う
});

test('線の本数：|Δ| = d ちょうどは数えない（波源の外側の直線）', () => {
  // d = 4、λ = 1：強め合う |m| < 4 → 7 本。m = ±4 は x 軸上の外側
  const a = L.lines(4, 1, 'same');
  assert.equal(a.strong.count, 7); assert.equal(a.strong.edge, true); assert.equal(a.strong.edgeM, 4);
  assert.equal(a.weak.count, 8); assert.equal(a.weak.edge, false);
  // d = 4、λ = 2：強め合う m = −1..1 の 3 本、弱め合う ±½λ, ±1.5λ の 4 本
  const b = L.lines(4, 2, 'same');
  assert.equal(b.strong.count, 3); assert.equal(b.weak.count, 4); assert.equal(b.strong.edge, true);
  // d = 2、λ = 1.5：強め合う 3 本（0, ±1.5）、弱め合う 2 本（±0.75）
  const c = L.lines(2, 1.5, 'same');
  assert.equal(c.strong.count, 3); assert.equal(c.weak.count, 2);
  // d = 8、λ = 1：強め合う 15 本、弱め合う 16 本
  const e = L.lines(8, 1, 'same');
  assert.equal(e.strong.count, 15); assert.equal(e.weak.count, 16);
  // 0.1 きざみの誤差：d = 3、λ = 0.6（d/λ = 5）→ 強め合う 9 本（m = −4..4）、edge あり
  const f = L.lines(3, 0.6, 'same');
  assert.equal(f.strong.count, 9); assert.equal(f.strong.edge, true);
  // d = 1、λ = 4：強め合うのは中央線 1 本だけ、弱め合う線は ½λ = 2 > 1 なのでない
  const g = L.lines(1, 4, 'same');
  assert.equal(g.strong.count, 1); assert.equal(g.weak.count, 0);
  assert.deepEqual(L.mRange(0, 1, 0), { min: 0, max: -1, count: 0 });
  assert.equal(L.mRange(4, 0, 0).count, 0);
});

test('双曲線の点列：どの点も |r₁ − r₂| が一定', () => {
  for (const sg of [1.5, -2.25, 3.9, 0.3]) {
    const pts = L.hyperbola(4, sg, 8, 80);
    assert.equal(pts.length, 81);
    pts.forEach(([x, y]) => near(L.dists(4, x, y).signed, sg, 1e-9));
    assert.ok(Math.abs(pts[0][1] + 8) < 1e-9 && Math.abs(pts[80][1] - 8) < 1e-9);
  }
  const v = L.hyperbola(4, 0, 8, 4);                               // 垂直二等分線
  assert.deepEqual(v, [[0, -8], [0, -4], [0, 0], [0, 4], [0, 8]]);
  assert.equal(L.hyperbola(4, 4, 8), null);                         // |Δ| = d は双曲線でない
  assert.equal(L.hyperbola(4, 5, 8), null);
  assert.equal(L.hyperbola(4, NaN, 8), null);
  assert.equal(L.edgeRays(4, 12).length, 2);
});

test('格子の前計算：分解した式が直接の和と一致', () => {
  const d = 4, lam = 1.5;
  for (const ph of ['same', 'opp']) {
    const G = L.grid(d, lam, ph, -6, 4, 1.2, 1.0, 10, 8);
    for (const t of [0, 0.13, 0.5, 0.77]) {
      const w = 2 * Math.PI * t;
      for (const [i, j] of [[0, 0], [3, 5], [9, 7], [5, 2]]) {
        const x = -6 + (i + 0.5) * 1.2, y = 4 - (j + 0.5) * 1.0, id = j * 10 + i;
        const z = G.ca[id] * Math.cos(w) - G.cb[id] * Math.sin(w);
        near(z, L.waveAt(d, lam, ph, x, y, t, 1).y, 1e-5);           // Float32 の誤差
        near(G.amp[id], L.amplitude(L.dists(d, x, y).signed, lam, ph), 1e-5);
      }
    }
  }
});

test('1 点の変位：強め合う点・弱め合う点', () => {
  // d = 4、λ = 2、点 (2, 3)：r₁ = 5、r₂ = 3、経路差 2 = λ → 同位相で y₁ = y₂
  for (const t of [0, 0.2, 0.45]) {
    const a = L.waveAt(4, 2, 'same', 2, 3, t, 1);
    near(a.y1, a.y2); near(a.y, 2 * a.y1);
    const b = L.waveAt(4, 2, 'opp', 2, 3, t, 1);
    near(b.y, 0);
  }
  assert.ok(Number.isNaN(L.waveAt(4, 0, 'same', 1, 1, 0).y));
});
