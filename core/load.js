/* sim.html?s=<id> で、その教材の計算（lib/<id>.js）と画面（sims/<id>.js）を読みこむ */
(function () {
  'use strict';
  var V = '202611101400';   // 教材のファイルを直したらここも上げる（スマホに保存された古い版を入れかえるため）
  // 見た目（ほかのサイトと共通の ew:style）
  var pick = document.getElementById('style');
  if (pick) {
    pick.value = document.documentElement.dataset.style || 'note';
    pick.addEventListener('change', function () {
      try { localStorage.setItem('ew:style', JSON.stringify(pick.value)); } catch (e) { /* 保存できなくても動く */ }
      if (window.ewStyle) window.ewStyle(pick.value);
    });
  }
  var id = new URLSearchParams(location.search).get('s') || '';
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
  var go = function () { load('sims/' + id + '.js', function () {}); };
  if (info.lib) load('lib/' + id + '.js', go); else go();
})();
