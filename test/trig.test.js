// 三角関数と単位円の計算のテスト（node --test test/）
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/trig.js');
const near = (a, b, e = 1e-12) => assert.ok(Math.abs(a - b) < e, `${a} ≒ ${b}`);

test('度 ⇔ ラジアン', () => {
  near(L.degToRad(180), Math.PI);
  near(L.degToRad(-90), -Math.PI / 2);
  near(L.radToDeg(Math.PI / 6), 30);
  near(L.radToDeg(L.degToRad(123.4)), 123.4);
});

test('0〜360° に直す', () => {
  assert.equal(L.normDeg(390), 30);
  assert.equal(L.normDeg(-30), 330);
  assert.equal(L.normDeg(-360), 0);
  assert.equal(L.normDeg(720), 0);
  assert.ok(Number.isNaN(L.normDeg(NaN)));
});

test('ラジアンを π の分数で書く', () => {
  assert.equal(L.radText(30), 'π/6');
  assert.equal(L.radText(180), 'π');
  assert.equal(L.radText(0), '0');
  assert.equal(L.radText(360), '2π');
  assert.equal(L.radText(-30), '−π/6');
  assert.equal(L.radText(135), '3π/4');
  assert.equal(L.radText(390), '13π/6');
  assert.equal(L.radText(-270), '−3π/2');
  assert.equal(L.radText(15), 'π/12');
  assert.equal(L.radText(1), '0.0175');      // π/180 は分母が大きいので小数
  assert.equal(L.radText(57), '0.9948');
  assert.equal(L.radText(NaN), '—');
  assert.deepEqual(L.radFrac(120), { n: 2, den: 3 });
  assert.equal(L.radFrac(7), null);
});

test('有名角の正確な値', () => {
  const t = (d) => { const e = L.exact(d); return [e.sin.text, e.cos.text, e.tan ? e.tan.text : null]; };
  assert.deepEqual(t(0), ['0', '1', '0']);
  assert.deepEqual(t(30), ['1/2', '√3/2', '1/√3']);
  assert.deepEqual(t(45), ['√2/2', '√2/2', '1']);
  assert.deepEqual(t(60), ['√3/2', '1/2', '√3']);
  assert.deepEqual(t(90), ['1', '0', null]);
  assert.deepEqual(t(120), ['√3/2', '−1/2', '−√3']);
  assert.deepEqual(t(135), ['√2/2', '−√2/2', '−1']);
  assert.deepEqual(t(150), ['1/2', '−√3/2', '−1/√3']);
  assert.deepEqual(t(180), ['0', '−1', '0']);
  assert.deepEqual(t(210), ['−1/2', '−√3/2', '1/√3']);
  assert.deepEqual(t(225), ['−√2/2', '−√2/2', '1']);
  assert.deepEqual(t(270), ['−1', '0', null]);
  assert.deepEqual(t(300), ['−√3/2', '1/2', '−√3']);
  assert.deepEqual(t(-30), ['−1/2', '√3/2', '−1/√3']);
  assert.deepEqual(t(390), t(30));                   // θ + 360° は同じ点
  assert.deepEqual(t(-90), ['−1', '0', null]);
  assert.equal(L.exact(15), null);                    // 15° は扱わない
  assert.equal(L.exact(30.5), null);
});

test('正確な値は Math.sin / Math.cos / Math.tan と一致', () => {
  for (let d = -360; d <= 720; d += 15) {
    const e = L.exact(d);
    if (!e) continue;
    const r = L.degToRad(d);
    near(e.sin.value, Math.sin(r), 1e-12);
    near(e.cos.value, Math.cos(r), 1e-12);
    if (e.tan) near(e.tan.value, Math.tan(r), 1e-9);
  }
});

test('値：軸の上は誤差なし、sin² + cos² = 1', () => {
  assert.equal(L.values(180).sin, 0);
  assert.equal(L.values(90).cos, 0);
  assert.equal(L.values(270).sin, -1);
  for (const d of [-359, -200, -1, 0, 1, 17, 89, 91, 123.4, 200, 359, 500, 719.5]) {
    const v = L.values(d);
    near(v.sin * v.sin + v.cos * v.cos, 1, 1e-12);
    if (v.tan !== null) near(v.tan, v.sin / v.cos, 1e-9 * Math.max(1, Math.abs(v.tan)));
  }
  const bad = L.values(NaN);
  assert.ok(Number.isNaN(bad.sin)); assert.equal(bad.tan, null);
});

test('tan が定義されない角（90° + 180°×n）', () => {
  for (const d of [90, 270, -90, -270, 450, 630]) {
    assert.equal(L.tanDefined(d), false, d + '°');
    assert.equal(L.values(d).tan, null);
    assert.ok(Number.isNaN(L.tanOrNaN(d)));
  }
  // Math.cos(π/2) は 6e-17 で 0 にならないが、度で判定するので定義されないになる
  assert.notEqual(Math.cos(L.degToRad(90)), 0);
  for (const d of [0, 89, 91, 180, 89.5, 360]) assert.equal(L.tanDefined(d), true, d + '°');
  assert.equal(L.tanDefined(Infinity), false);
});

test('象限と符号', () => {
  assert.equal(L.quadrant(30), 1); assert.equal(L.quadrant(120), 2);
  assert.equal(L.quadrant(210), 3); assert.equal(L.quadrant(300), 4);
  assert.equal(L.quadrant(-30), 4); assert.equal(L.quadrant(390), 1);
  assert.equal(L.quadrant(0), 'x+'); assert.equal(L.quadrant(90), 'y+');
  assert.equal(L.quadrant(180), 'x-'); assert.equal(L.quadrant(-90), 'y-'); assert.equal(L.quadrant(720), 'x+');
  assert.deepEqual(L.signsOf(30), { sin: 1, cos: 1, tan: 1 });
  assert.deepEqual(L.signsOf(150), { sin: 1, cos: -1, tan: -1 });
  assert.deepEqual(L.signsOf(200), { sin: -1, cos: -1, tan: 1 });
  assert.deepEqual(L.signsOf(-45), { sin: -1, cos: 1, tan: -1 });
  assert.deepEqual(L.signsOf(90), { sin: 1, cos: 0, tan: null });
  assert.deepEqual(L.signsOf(180), { sin: 0, cos: -1, tan: 0 });
});

test('有名角の判定といちばん近い有名角', () => {
  for (const d of [0, 30, 45, 60, 90, 135, 330, -30, 390, 720]) assert.ok(L.isFamous(d), d + '°');
  for (const d of [15, 20, 75, 30.5, NaN]) assert.ok(!L.isFamous(d), d + '°');
  assert.equal(L.nearestFamous(32), 30);
  assert.equal(L.nearestFamous(40), 45);
  assert.equal(L.nearestFamous(-17), -30);
  assert.equal(L.nearestFamous(100), 90);
  assert.equal(L.nearestFamous(712), 720);
  assert.equal(L.nearestFamous(52.5), 45);     // 45 と 60 のまん中は小さい方
  assert.ok(L.isFamous(L.nearestFamous(1.5)));
});

test('グラフに出す周期', () => {
  assert.equal(L.graphStart(30), 0);
  assert.equal(L.graphStart(0), 0);
  assert.equal(L.graphStart(360), 0);          // 右はしちょうど
  assert.equal(L.graphStart(390), 360);
  assert.equal(L.graphStart(720), 360);
  assert.equal(L.graphStart(-30), -360);
  assert.equal(L.graphStart(-360), -360);
  assert.equal(L.graphStart(NaN), 0);
  assert.equal(L.PERIOD.sin, 360); assert.equal(L.PERIOD.tan, 180);
});
