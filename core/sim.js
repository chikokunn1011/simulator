/* シミュレーターの共通の作り（ページの枠・操作パネル・再生・確認問題）。
   各教材（sims/*.js）は SimApp.register({...}) で中身だけを書く。ここは全教材で共通。

   教材の書き方（くわしくは README.md）:
   SimApp.register({
     id: 'functions',
     intro: '<p>…</p>',                      // くわしい説明（「なぜ？」の「くわしく読む」で出る）
     assumptions: ['…', '…'],                 // このモデルの約束・簡単にしたところ（「くわしく読む」で出る）
     dragHint: '点を指で動かせる',              // 図を直接さわれるとき、はじめの数回だけ図の上に出す
     params: [{ key:'a', label:'傾き a', min:-5, max:5, step:0.1, value:1, unit:'', digits:1, show:(s)=>true }],
     choices: [{ key:'mode', label:'関数', options:[['lin','一次関数'],['quad','二次関数']], value:'lin' }],
     toggles: [{ key:'grid', label:'方眼', value:true }],
     presets: [{ label:'y = x²', values:{ mode:'quad', a:1, b:0, c:0 } }],
     animated: false,                          // true なら 再生・一時停止・速さ・時間をもどす を出す
     zoom: true,                               // true なら 拡大・縮小・表示をもどす を出す（sim.zoom(f) と sim.resetView() を書く）
     init(api) {},                             // 図を作る（api.stage に canvas などを入れる）
     draw(s) {},                               // 今の状態 s をかく（値が変わったときと再生中に呼ばれる）
     tick(dt, s) {},                           // 再生中：dt 秒（シミュレーションの中の時間）進める。false を返すと止まる
     resetTime(s) {},                          // 時間を 0 にもどす
     formula(s) { return 'HTML' },             // いつも見える式（図の上）
     readouts(s) { return [['ラベル','値'], …] }, // いつも見える数値（図の下）
     explain(s) { return 'HTML' },             // なぜ？（今の値を使って説明）。はじめは見出し・式（.eq）・今の値（.now）だけ見せ、ほかは「くわしく読む」で出る
     quiz(s) { return [{ q:'HTML', choices:['…'], answer:0, explain:'HTML', why:{ 1:'まちがえたときの説明' } }] }  // 確認問題
   });
   状態 s は params・choices・toggles の値と、t（時間）・playing・speed を持つ。 */
(function (root) {
  'use strict';
  const $ = (q, el) => (el || document).querySelector(q);
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても動く */ } }
  };

  // ---------- 数の書き方 ----------
  const MINUS = '−';
  // 小数 digits けたまで（末尾の 0 はけす）。-0 は 0。マイナスは −
  function fmt(v, digits) {
    if (v === Infinity) return '∞';
    if (v === -Infinity) return MINUS + '∞';
    if (!Number.isFinite(v)) return '—';
    const d = digits == null ? 2 : digits;
    let s = v.toFixed(d);
    if (d > 0) s = s.replace(/\.?0+$/, '');
    if (/^-0(\.0*)?$/.test(s)) s = '0';
    return s.replace('-', MINUS);
  }
  // 決まったけた数（末尾の 0 も残す）
  function fix(v, digits) {
    if (!Number.isFinite(v)) return '—';
    let s = v.toFixed(digits);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', MINUS);
  }
  // 式の項： ax² + bx + c の「+ 3x」「− 3x」など。first は先頭の項
  function term(coef, sym, first, digits) {
    if (!Number.isFinite(coef)) return '';
    const r = Number(coef.toFixed(digits == null ? 2 : digits));
    if (r === 0) return '';
    const abs = Math.abs(r);
    const num = sym && abs === 1 ? '' : fmt(abs, digits);
    const sign = r < 0 ? (first ? MINUS : ' ' + MINUS + ' ') : (first ? '' : ' + ');
    return sign + num + (sym || '');
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // 分数（HTML）
  function frac(a, b) { return '<span class="frac"><span>' + a + '</span><span>' + b + '</span></span>'; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  // 入力された文字を数に（全角数字・全角マイナス・カンマの小数点もOK）。数でなければ NaN
  function parseNum(str) {
    let t = String(str == null ? '' : str).trim()
      .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[−ー－‐]/g, '-').replace(/[＋]/g, '+').replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const still = () => (root.studyStill ? root.studyStill() : (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches));

  // 選択肢を作る：correct が正解、wrongs は [文字, まちがえたときの説明] の列。同じ文字はけして、n 個にそろえる
  function mc(correct, wrongs, n) {
    n = n || 4;
    const choices = [correct], why = {};
    (wrongs || []).forEach((w) => {
      const t = Array.isArray(w) ? w[0] : w;
      if (choices.length >= n || t == null || t === '' || choices.indexOf(t) >= 0) return;
      if (Array.isArray(w) && w[1]) why[choices.length] = w[1];
      choices.push(t);
    });
    return { choices, answer: 0, why };
  }

  const util = { fmt, fix, term, esc, frac, clamp, parseNum, shuffle, mc, MINUS };

  // ---------- 本体 ----------
  function register(def) {
    const sim = Object.assign({ params: [], choices: [], toggles: [], presets: [], assumptions: [], animated: false, zoom: false,
      speeds: [0.25, 0.5, 1, 2], speed: 1 }, def);
    const S = {};          // 今の状態
    const defaults = {};
    sim.params.forEach((p) => { defaults[p.key] = p.value; });
    sim.choices.forEach((c) => { defaults[c.key] = c.value; });
    sim.toggles.forEach((t) => { defaults[t.key] = !!t.value; });
    Object.assign(S, defaults, { t: 0, playing: false, speed: sim.speed });

    const info = (root.SIMS || []).find((x) => x.id === sim.id) || { title: sim.title || sim.id };
    document.title = info.title + '｜シミュレーター｜SAPIA';
    $('#title').textContent = info.title;
    $('#lede').textContent = info.lede || info.desc || '';
    const meta = $('#meta');
    if (meta) meta.textContent = [info.subject, info.grades, info.unit, info.minutes ? '目安 ' + info.minutes + '分' : ''].filter(Boolean).join('・');

    document.body.classList.toggle('animated', !!sim.animated);
    const stage = $('#stage');
    const api = {
      S, util, stage, still,
      quality: 1,           // 端末が重いとき 0.6 になる（細かさを下げる）
      redraw: () => requestDraw(),
      changed: () => onChange(),       // 教材の中で値を変えたとき（ドラッグなど）
      set: (k, v) => setValue(k, v),
      setMany: (o) => applyValues(o, false),   // いくつかの値を一度に変える（ドラッグで x・y をいっしょに動かすときなど）
      plots: [],
      colors: () => root.SimPlot.colors()
    };

    // ---------- 操作パネル ----------
    const box = $('#controls');
    const inputs = {};
    // プリセット
    if (sim.presets.length) {
      const g = el('div', 'group presets-g');
      g.append(el('span', 'label', '例'));
      const row = el('div', 'chips presets');
      sim.presets.forEach((p) => {
        const b = el('button', 'chip', p.label);
        b.type = 'button';
        b.addEventListener('click', () => { applyValues(p.values, true); toast(p.label + ' にした'); });
        row.append(b);
      });
      g.append(row); box.append(g);
    }
    // えらぶもの（モードなど）
    sim.choices.forEach((c) => {
      const g = el('div', 'group choice');
      g.append(el('span', 'label', c.label));
      const seg = el('div', 'seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', c.label);
      c.options.forEach(([v, lab]) => {
        const b = el('button', '', lab); b.type = 'button'; b.dataset.v = v;
        b.addEventListener('click', () => setValue(c.key, v));
        seg.append(b);
      });
      g.append(seg); box.append(g);
      inputs[c.key] = { kind: 'choice', def: c, g, sync() { seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(S[c.key])))); } };
    });
    // スライダー＋数を直接入れる欄
    sim.params.forEach((p) => {
      const id = 'p-' + p.key;
      const g = el('div', 'group param');
      const lab = el('label', 'label'); lab.htmlFor = id; lab.innerHTML = p.label;
      const num = el('input', 'num'); num.type = 'text'; num.inputMode = 'decimal'; num.id = id; num.autocomplete = 'off';
      num.setAttribute('aria-describedby', id + '-r');
      const unit = el('span', 'unit', p.unit || '');
      const nw = el('span', 'num-wrap'); nw.append(num, unit);
      const rng = el('input', 'slider'); rng.type = 'range'; rng.min = p.min; rng.max = p.max; rng.step = p.step;
      rng.setAttribute('aria-label', lab.textContent);
      const rangeNote = el('span', 'sr'); rangeNote.id = id + '-r';
      rangeNote.textContent = fmt(p.min, p.digits) + ' 〜 ' + fmt(p.max, p.digits) + (p.unit ? ' ' + p.unit : '');
      rng.title = num.title = rangeNote.textContent;
      g.append(lab, rng, nw, rangeNote); box.append(g);
      rng.addEventListener('input', () => setValue(p.key, Number(rng.value)));
      // 直接入力：Enter か欄を出たときに反映。範囲外はいちばん近い値に
      const commit = () => {
        const v = parseNum(num.value);
        if (Number.isNaN(v)) { num.value = fmt(S[p.key], p.digits); toast('数を入れてね（' + fmt(p.min, p.digits) + '〜' + fmt(p.max, p.digits) + '）'); return; }
        const c = clamp(v, p.min, p.max);
        if (c !== v) toast(p.label.replace(/<[^>]+>/g, '') + ' は ' + fmt(p.min, p.digits) + '〜' + fmt(p.max, p.digits) + ' の範囲だよ');
        setValue(p.key, c);
      };
      num.addEventListener('change', commit);
      num.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); num.select(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const k = (e.key === 'ArrowUp' ? 1 : -1) * p.step * (e.shiftKey ? 10 : 1);
          setValue(p.key, clamp(round(S[p.key] + k, p.step), p.min, p.max));
        }
      });
      inputs[p.key] = { kind: 'param', def: p, g, sync() {
        rng.value = S[p.key];
        if (document.activeElement !== num) num.value = fmt(S[p.key], p.digits);
        const l = typeof p.labelOf === 'function' ? p.labelOf(S) : null;
        if (l) { lab.innerHTML = l; rng.setAttribute('aria-label', lab.textContent); }
      } };
    });
    // 表示の切りかえ
    if (sim.toggles.length) {
      const g = el('div', 'group toggles-g');
      const row = el('div', 'toggles'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', '表示');
      sim.toggles.forEach((t) => {
        const l = el('label', 'switch');
        const cb = el('input'); cb.type = 'checkbox';
        cb.addEventListener('change', () => setValue(t.key, cb.checked));
        l.append(cb, el('span', '', t.label));
        row.append(l);
        inputs[t.key] = { kind: 'toggle', def: t, g: l, sync() { cb.checked = !!S[t.key]; } };
      });
      g.append(row); box.append(g);
    }
    const acts = el('div', 'ctrl-acts');
    const resetAll = el('button', 'mini', '↺ はじめにもどす'); resetAll.type = 'button';
    resetAll.addEventListener('click', () => { applyValues(defaults, true); toast('はじめの値にもどした'); });
    const share = el('button', 'mini ghost', 'URLをコピー'); share.type = 'button'; share.title = 'この設定で開くURLをコピー';
    share.addEventListener('click', copyUrl);
    acts.append(resetAll, share);
    box.append(acts);

    function round(v, step) { const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return Number(v.toFixed(d + 2)); }

    function setValue(k, v) {
      const inp = inputs[k];
      if (inp && inp.kind === 'param') { if (!Number.isFinite(v)) return; v = clamp(v, inp.def.min, inp.def.max); }
      if (S[k] === v) { if (inp) inp.sync(); return; }
      S[k] = v;
      onChange(k);
    }
    function applyValues(vals, resetTime) {
      Object.keys(vals).forEach((k) => {
        if (!(k in defaults)) return;
        const inp = inputs[k];
        let v = vals[k];
        if (inp && inp.kind === 'param') { v = Number(v); if (!Number.isFinite(v)) return; v = clamp(v, inp.def.min, inp.def.max); }
        if (inp && inp.kind === 'choice' && !inp.def.options.some((o) => String(o[0]) === String(v))) return;
        if (inp && inp.kind === 'toggle') v = !!v;
        S[k] = v;
      });
      if (resetTime) doResetTime(false);
      onChange();
    }
    function syncInputs() {
      Object.keys(inputs).forEach((k) => {
        const inp = inputs[k];
        inp.sync();
        const show = typeof inp.def.show === 'function' ? !!inp.def.show(S) : true;
        inp.g.hidden = !show;
      });
    }

    // ---------- 再生・ツールバー ----------
    const tb = $('#toolbar');
    let playBtn = null, speedSel = null;
    if (sim.animated) {
      playBtn = tbtn('▶', '再生', 'play');
      playBtn.addEventListener('click', () => setPlaying(!S.playing));
      const rt = tbtn('⟲', '時間を最初にもどす', 'rewind');
      rt.addEventListener('click', () => doResetTime(true));
      speedSel = el('select', 'speed'); speedSel.setAttribute('aria-label', '再生の速さ');
      sim.speeds.forEach((v) => { const o = el('option', '', '×' + fmt(v, 2)); o.value = v; speedSel.append(o); });
      speedSel.value = S.speed;
      speedSel.addEventListener('change', () => { S.speed = Number(speedSel.value) || 1; requestDraw(); });
      const sl = el('label', 'speed-wrap'); sl.append(el('span', '', '速さ'), speedSel);
      tb.append(playBtn, rt, sl);
    }
    if (sim.zoom) {
      const zo = tbtn('−', '縮小', 'zoom-out'); zo.addEventListener('click', () => zoom(1.25));
      const zi = tbtn('＋', '拡大', 'zoom-in'); zi.addEventListener('click', () => zoom(0.8));
      const zr = tbtn('⌖', '表示を元の大きさにもどす', 'zoom-reset'); zr.addEventListener('click', () => { if (sim.resetView) sim.resetView(S); requestDraw(); });
      tb.append(el('span', 'tb-sep'), zo, zi, zr);
    }
    // スマホ：図を小さくして、下の説明・操作を広く見る
    const sizeBtn = tbtn('▭', '図を小さくする', 'size');
    const small = () => document.documentElement.classList.contains('stage-small');
    sizeBtn.addEventListener('click', () => {
      document.documentElement.classList.toggle('stage-small');
      sizeBtn.querySelector('.tb-t').textContent = small() ? '図を大きくする' : '図を小さくする';
      sizeBtn.setAttribute('aria-label', sizeBtn.querySelector('.tb-t').textContent); sizeBtn.title = sizeBtn.querySelector('.tb-t').textContent;
      sizeBtn.setAttribute('aria-pressed', String(small()));
      afterLayout();
    });
    const fsBtn = tbtn('⛶', '全画面', 'full');
    fsBtn.addEventListener('click', toggleFull);
    tb.append(el('span', 'tb-gap'), sizeBtn, fsBtn);

    function tbtn(sym, label, cls) {
      const b = el('button', 'tb ' + cls); b.type = 'button';
      b.innerHTML = '<span aria-hidden="true">' + sym + '</span><span class="tb-t">' + label + '</span>';
      b.setAttribute('aria-label', label); b.title = label;
      return b;
    }
    function zoom(f) { if (sim.zoom && sim.zoomBy) { sim.zoomBy(f, S); requestDraw(); } }

    function setPlaying(on) {
      if (!sim.animated) return;
      if (on && sim.atEnd && sim.atEnd(S)) doResetTime(false);   // 最後まで行っていたら最初から
      S.playing = !!on;
      playBtn.querySelector('[aria-hidden]').textContent = S.playing ? '❚❚' : '▶';
      playBtn.querySelector('.tb-t').textContent = S.playing ? '一時停止' : '再生';
      playBtn.setAttribute('aria-label', S.playing ? '一時停止' : '再生');
      playBtn.classList.toggle('is-on', S.playing);
      last = 0;
      if (S.playing && root.studyAwake) root.studyAwake();
      loop();
    }
    function doResetTime(draw) {
      S.t = 0;
      if (sim.resetTime) sim.resetTime(S);
      if (draw !== false) requestDraw();
    }

    // ---------- 全画面（授業でプロジェクターに映す） ----------
    const simEl = $('#sim');
    function isFull() { return document.fullscreenElement === simEl || simEl.classList.contains('is-full'); }
    function toggleFull() {
      if (isFull()) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        simEl.classList.remove('is-full'); document.documentElement.classList.remove('sim-full');
      } else if (simEl.requestFullscreen && document.fullscreenEnabled) {
        simEl.requestFullscreen().catch(() => fakeFull());
      } else fakeFull();
    }
    function fakeFull() { simEl.classList.add('is-full'); document.documentElement.classList.add('sim-full'); afterLayout(); }
    document.addEventListener('fullscreenchange', () => {
      fsBtn.querySelector('.tb-t').textContent = isFull() ? '全画面をやめる' : '全画面';
      afterLayout();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && simEl.classList.contains('is-full')) toggleFull();
    });

    // ---------- なぜ？・確認問題 のタブ ----------
    const tabs = Array.from(document.querySelectorAll('.steps [role="tab"]'));
    const seen = store.get('sm:seen', {});
    let cur = 0;
    function showStep(i, focus) {
      cur = i;
      tabs.forEach((t, j) => {
        const on = j === i;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tabs[i].focus();
      if (i === 0) setTimeout(renderExplain, 0);   // 教材のファイルを読み終わってから（register の中で呼ばれるときがある）
      if (i === 1 && !quizState) startQuiz();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => showStep(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); showStep((i + 1) % tabs.length, true); }
        if (e.key === 'Home') { e.preventDefault(); showStep(0, true); }
        if (e.key === 'End') { e.preventDefault(); showStep(tabs.length - 1, true); }
      });
    });
    // なぜ？：はじめは要点（式・今の値）だけ。「くわしく読む」で全部
    const moreBtn = $('#moreBtn'), moreBox = $('#moreBox'), exEl = $('#explain');
    moreBtn.addEventListener('click', () => {
      const open = moreBtn.getAttribute('aria-expanded') !== 'true';
      moreBtn.setAttribute('aria-expanded', String(open));
      moreBtn.textContent = open ? '短くする' : 'くわしく読む';
      exEl.classList.toggle('brief', !open);
      moreBox.hidden = !open;
    });
    $('#intro').innerHTML = sim.intro || '';
    const asm = (sim.assumptions || []).map((a) => '<li>' + a + '</li>').join('');
    document.querySelectorAll('.assume-list').forEach((u) => { u.innerHTML = asm; u.closest('.assume').hidden = !asm; });

    // なぜ？
    let explainDirty = true;
    function renderExplain() {
      if (!explainDirty || cur !== 0 || !sim.explain) return;
      explainDirty = false;
      $('#explain').innerHTML = sim.explain(S);
    }

    // ---------- 確認問題 ----------
    let quizState = null;
    const qBox = $('#quiz');
    function startQuiz() {
      let qs = [];
      try { qs = (sim.quiz ? sim.quiz(Object.assign({}, S)) : []).filter(Boolean); } catch (e) { qs = []; }
      if (!qs.length) { qBox.innerHTML = '<p class="hint">この教材の確認問題は準備中。</p>'; return; }
      quizState = { qs, i: 0, ok: 0 };
      showQ();
    }
    function showQ() {
      const st = quizState, q = st.qs[st.i];
      qBox.innerHTML = '';
      const head = el('div', 'quiz-head');
      head.append(el('span', 'quiz-n', '問題 ' + (st.i + 1) + ' / ' + st.qs.length), el('span', 'quiz-score', '正解 ' + st.ok));
      const bar = el('div', 'quiz-bar'); const bi = el('i'); bi.style.width = (st.i / st.qs.length * 100) + '%'; bar.append(bi);
      const ask = el('div', 'quiz-q'); ask.innerHTML = q.q;
      const ch = el('div', 'quiz-choices'); ch.setAttribute('role', 'group'); ch.setAttribute('aria-label', '答えを選ぶ');
      const order = shuffle(q.choices.map((c, i) => i));
      const fb = el('div', 'quiz-fb'); fb.setAttribute('aria-live', 'polite');
      const next = el('button', 'btn primary quiz-next', st.i + 1 < st.qs.length ? '次の問題' : '結果を見る'); next.type = 'button'; next.hidden = true;
      order.forEach((ci, k) => {
        const b = el('button', 'quiz-choice'); b.type = 'button';
        b.innerHTML = '<span class="qc-k" aria-hidden="true">' + 'ABCDEF'[k] + '</span><span class="qc-t">' + q.choices[ci] + '</span>';
        b.addEventListener('click', () => {
          if (ch.dataset.done) return;
          ch.dataset.done = '1';
          const right = ci === q.answer;
          if (right) st.ok++;
          if (root.studyBuzz) root.studyBuzz(right);
          ch.querySelectorAll('.quiz-choice').forEach((x) => { x.disabled = true; });
          b.classList.add(right ? 'is-ok' : 'is-ng');
          b.insertAdjacentHTML('beforeend', '<span class="qc-mark">' + (right ? '○ 正解' : '× ちがう') + '</span>');
          if (!right) {
            const rb = ch.children[order.indexOf(q.answer)];
            rb.classList.add('is-ans'); rb.insertAdjacentHTML('beforeend', '<span class="qc-mark">○ 正解はこれ</span>');
          }
          const why = !right && q.why && q.why[ci] ? '<p class="quiz-why"><b>このまちがいについて：</b>' + q.why[ci] + '</p>' : '';
          fb.className = 'quiz-fb ' + (right ? 'ok' : 'ng');
          fb.innerHTML = '<p class="quiz-res">' + (right ? '○ 正解！' : '× おしい！') + '</p>' + why + '<div class="quiz-ex">' + (q.explain || '') + '</div>';
          next.hidden = false;
          head.querySelector('.quiz-score').textContent = '正解 ' + st.ok;
          next.focus({ preventScroll: true });
        });
        ch.append(b);
      });
      next.addEventListener('click', () => { st.i++; if (st.i < st.qs.length) showQ(); else endQuiz(); });
      qBox.append(head, bar, ask, ch, fb, next);
    }
    function endQuiz() {
      const st = quizState, n = st.qs.length;
      const best = store.get('sm:quiz', {});
      const prev = best[sim.id];
      if (!prev || st.ok / n >= prev.ok / prev.n) best[sim.id] = { ok: st.ok, n, t: Date.now() };
      store.set('sm:quiz', best);
      qBox.innerHTML = '';
      const r = el('div', 'quiz-end');
      r.innerHTML = '<p class="quiz-big">' + st.ok + ' / ' + n + '</p><p>' +
        (st.ok === n ? '全問正解！' : st.ok >= n * 0.6 ? 'いい感じ。まちがえた所は「なぜ？」を見てみよう。' : '値を動かして図を見てから、もう一度やってみよう。') +
        '</p><p class="hint">値を変えてからやると、ちがう数の問題になる。</p>';
      const again = el('button', 'btn primary', 'もう一度'); again.type = 'button';
      again.addEventListener('click', startQuiz);
      const back = el('button', 'btn', '動かしてみる'); back.type = 'button';
      back.addEventListener('click', () => { const c = $('.ctrl-box'); if (c) c.scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' }); });
      const a = el('div', 'actions'); a.append(again, back); r.append(a);
      qBox.append(r);
      if (root.Celebrate) root.Celebrate.result(r, { score: st.ok, n, prevBest: prev && prev.n === n ? prev.ok : null });
      noteResume();
    }

    // ---------- 描画（必要なときだけ。再生中は requestAnimationFrame） ----------
    let drawReq = 0, raf = 0, last = 0, visible = true, roStarted = false;
    const ro = $('#readouts'), fo = $('#formula');
    let lastDom = 0;
    function paint(domToo) {
      try { sim.draw(S); } catch (e) { console.error(e); }
      if (domToo) {
        if (sim.formula) fo.innerHTML = sim.formula(S);
        if (sim.readouts) {
          const rows = sim.readouts(S) || [];
          ro.innerHTML = rows.map((r) => '<div class="ro' + (r[2] ? ' ' + r[2] : '') + '"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('');
        }
      }
    }
    function requestDraw() {
      if (drawReq || (S.playing && raf)) return;
      drawReq = requestAnimationFrame(() => { drawReq = 0; paint(true); });
    }
    function onChange() {
      syncInputs();
      explainDirty = true;
      requestDraw();
      renderExplainSoon();
      saveUrlSoon();
    }
    let exT = 0;
    function renderExplainSoon() { clearTimeout(exT); exT = setTimeout(renderExplain, 120); }

    // 重さを見る：1 コマが続けて重いときは細かさを下げる
    let slow = 0;
    function loop() {
      if (raf || !S.playing || !visible || document.hidden) return;
      raf = requestAnimationFrame(step);
    }
    function step(ts) {
      raf = 0;
      if (!S.playing || !visible || document.hidden) { last = 0; return; }
      // 前のコマからの実際の時間（タブを離れたあとなどで大きく飛ばないよう 0.1 秒まで）
      const real = last ? Math.min(0.1, (ts - last) / 1000) : 0;
      if (last && ts - last > 34) { if (++slow > 40 && api.quality > 0.6) { api.quality = 0.6; if (sim.onQuality) sim.onQuality(S); } } else slow = Math.max(0, slow - 1);
      last = ts;
      let go = true;
      if (real > 0 && sim.tick) go = sim.tick(real * S.speed, S) !== false;
      const now = performance.now();
      const dom = now - lastDom > 66;   // 数値の表示は 1 秒に 15 回まで
      if (dom) lastDom = now;
      paint(dom);
      if (!go) { setPlaying(false); paint(true); explainDirty = true; renderExplainSoon(); return; }
      loop();
    }
    document.addEventListener('visibilitychange', () => { last = 0; if (!document.hidden) loop(); });
    if ('IntersectionObserver' in root) {
      new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; last = 0; if (visible) loop(); }).observe(stage);
    }

    // 大きさが変わったらかき直す
    let rT = 0;
    function afterLayout() { clearTimeout(rT); rT = setTimeout(() => { if (sim.resize) sim.resize(S); requestDraw(); }, 60); }
    if ('ResizeObserver' in root) new ResizeObserver(() => { if (roStarted) afterLayout(); }).observe(stage);
    root.SimPlot.onTheme(() => requestDraw());

    // ---------- キーボード ----------
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      const onBtn = t && t.tagName === 'BUTTON';
      if (e.key === ' ' && sim.animated && !onBtn) { e.preventDefault(); setPlaying(!S.playing); }
      else if ((e.key === 'f' || e.key === 'F') && !e.repeat) { toggleFull(); }
      else if (sim.zoom && (e.key === '+' || e.key === ';')) zoom(0.8);
      else if (sim.zoom && e.key === '-') zoom(1.25);
      else if (sim.zoom && e.key === '0') { if (sim.resetView) sim.resetView(S); requestDraw(); }
    });

    // ---------- URL（この設定を共有） ----------
    function urlParams() {
      const u = new URLSearchParams();
      u.set('s', sim.id);
      Object.keys(defaults).forEach((k) => {
        if (S[k] === defaults[k]) return;
        u.set(k, typeof S[k] === 'boolean' ? (S[k] ? '1' : '0') : String(S[k]));
      });
      return u.toString();
    }
    let uT = 0;
    function saveUrlSoon() { clearTimeout(uT); uT = setTimeout(() => { try { history.replaceState(null, '', '?' + urlParams() + location.hash); } catch (e) { /* なくても動く */ } noteResume(); }, 400); }
    function copyUrl() {
      const url = location.origin + location.pathname + '?' + urlParams();
      const done = () => toast('URLをコピーした。開くとこの設定で始まる');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => prompt('このURLをコピーしてね', url));
      else prompt('このURLをコピーしてね', url);
    }
    function readUrl() {
      const q = new URLSearchParams(location.search), v = {};
      Object.keys(defaults).forEach((k) => {
        if (!q.has(k)) return;
        const raw = q.get(k);
        if (typeof defaults[k] === 'boolean') v[k] = raw === '1';
        else if (typeof defaults[k] === 'number') { const n = parseNum(raw); if (!Number.isNaN(n)) v[k] = n; }
        else v[k] = raw;
      });
      return v;
    }

    // ---------- 続きから（ホームの「続きから」・下のナビ） ----------
    function noteResume() {
      try {
        const all = store.get('study:resume', {}) || {};
        const q = store.get('sm:quiz', {})[sim.id];
        all.simulator = { t: Date.now(), n: '数学・理科シミュレーター', v: info.title, s: q ? '確認問題 ' + q.ok + '/' + q.n : '', u: location.origin + location.pathname + '?' + urlParams() };
        store.set('study:resume', all);
      } catch (e) { /* 保存できなくても動く */ }
    }

    // ---------- 小さなお知らせ ----------
    const toastEl = $('#toast'); let toT = 0;
    function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toT); toT = setTimeout(() => { toastEl.hidden = true; }, 2200); }
    api.toast = toast;

    // ---------- はじめる ----------
    // URL の値は applyValues で確かめてから入れる（範囲外の数は範囲内へ、ない選択肢・数でない値は使わない）
    applyValues(readUrl(), false);
    sim.init(api);
    syncInputs();
    roStarted = true;
    paint(true);
    showStep(0);
    seen[sim.id] = 1; store.set('sm:seen', seen);
    // 図を指でさわれる教材：はじめの数回だけ「さわれる」を図の上に出す（さわったら消える）
    if (sim.dragHint) {
      const hint = $('#dragHint'), hs = store.get('sm:hint', {});
      if ((hs[sim.id] || 0) < 3) {
        hint.textContent = sim.dragHint; hint.hidden = false;
        hs[sim.id] = (hs[sim.id] || 0) + 1; store.set('sm:hint', hs);
        const off = () => { hint.hidden = true; hs[sim.id] = 3; store.set('sm:hint', hs); };
        stage.addEventListener('pointerdown', off, { once: true });
      }
    }
    noteResume();
    document.body.classList.add('ready');
    root.__sim = { S, api, sim, setValue, setPlaying, startQuiz };   // 確認用（テスト）
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  root.SimApp = { register, util };
  if (typeof module !== 'undefined') module.exports = { util };
})(typeof window !== 'undefined' ? window : globalThis);
