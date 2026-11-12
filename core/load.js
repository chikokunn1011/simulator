/* sim.html?s=<id> で、その教材の計算（lib/<id>.js）と画面（sims/<id>.js）を読みこむ */
(function () {
  'use strict';
  var V = '202611121400';   // 教材のファイルを直したらここも上げる（スマホに保存された古い版を入れかえるため）
  // 見た目（ほかのサイトと共通の ew:style）
  var pick = document.getElementById('style');
  if (pick) {
    pick.value = document.documentElement.dataset.style || 'note';
    pick.addEventListener('change', function () {
      try { localStorage.setItem('ew:style', JSON.stringify(pick.value)); } catch (e) { /* 保存できなくても動く */ }
      if (window.ewStyle) window.ewStyle(pick.value);
    });
  }
  var q0 = new URLSearchParams(location.search);
  var id = q0.get('s') || '';
  // 前の「一次関数・二次関数」（s=functions）は3つに分けた。前の URL・続きから・QR はそのまま開けるように送る
  if (id === 'functions') {
    var quad = q0.get('mode') === 'quad';
    var zero = function (k) { return !q0.has(k) || Number(q0.get(k)) === 0; };
    // 前は b のはじめの値が 1 だったので、二次で b を書いていない URL は y = ax² ではない
    var to = !quad ? 'linear' : (q0.has('b') && zero('b') && zero('c')) ? 'parabola' : 'quadratic';
    if (quad && to === 'quadratic') { if (!q0.has('a')) q0.set('a', '2'); if (!q0.has('b')) q0.set('b', '1'); if (!q0.has('c')) q0.set('c', '0'); }
    if (!quad && !q0.has('a')) q0.set('a', '2');
    if (to === 'parabola') { if (!q0.has('a')) q0.set('a', '2'); q0.delete('b'); q0.delete('c'); q0.delete('keys'); }
    q0.delete('mode'); q0.set('s', to);
    location.replace(location.pathname + '?' + q0.toString() + location.hash);
    return;
  }
  var info = (window.SIMS || []).find(function (x) { return x.id === id && x.status === 'open'; });
  if (!info || !/^[a-z0-9-]+$/.test(id)) {
    document.getElementById('sim').hidden = true;
    document.getElementById('missing').hidden = false;
    document.title = '見つからない｜シミュレーター｜SAPIA';
    return;
  }
  document.body.dataset.sim = id;
  function load(src, next) {
    var s = document.createElement('script');
    s.src = src + '?v=' + V;
    s.onload = next;
    s.onerror = function () {
      document.getElementById('stage').innerHTML = '<p class="empty">読みこめなかった。電波のよいところで開き直してね。</p>';
    };
    document.body.appendChild(s);
  }
  var file = info.file || id;   // 1ファイルで何個かの教材を作るとき（catalog.js の file）
  var go = function () { load('sims/' + file + '.js', function () {}); };
  if (info.lib) load('lib/' + file + '.js', go); else go();
})();
