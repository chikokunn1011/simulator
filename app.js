/* シミュレーター一覧ページ：教科・学校段階・単元・キーワードでしぼりこんで、教材カードを出す */
(function () {
  'use strict';
  const $ = (q) => document.querySelector(q);
  const SIMS = window.SIMS || [];
  const SUB = window.SIM_SUBJECTS || {};
  const SUBJECTS = Object.keys(SUB);
  const LEVELS = ['中学', '高校'];
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても動く */ } }
  };
  const saved = store.get('sm:filter', {});
  const qs = new URLSearchParams(location.search);
  // ホームのカード（?k=math / ?k=sci）から来たときは、その教科でしぼる
  const k = qs.get('k');
  const st = {
    subj: k === 'math' ? '数学' : k === 'sci' ? 'sci' : (SUBJECTS.includes(saved.subj) || saved.subj === 'sci' ? saved.subj : ''),
    lv: LEVELS.includes(saved.lv) ? saved.lv : '',
    unit: '', q: '', soon: !!saved.soon
  };
  if (k) history.replaceState(null, '', location.pathname);

  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s・　]/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  $('#total').textContent = SIMS.filter((s) => s.status === 'open').length;

  // 教科のタブ（すべて・数学・理科（物理・化学・地学）・各教科）
  const subjBox = $('#subj');
  const subjTabs = [['', 'すべて'], ['数学', '数学'], ['sci', '理科（全部）'], ['物理', '物理'], ['化学', '化学'], ['地学', '地学']];
  subjTabs.forEach(([v, lab]) => {
    const b = el('button'); b.type = 'button'; b.dataset.v = v;
    if (SUB[v]) { const d = el('span', 'dot'); d.style.background = SUB[v].color; d.setAttribute('aria-hidden', 'true'); b.append(d); }
    b.append(lab);
    b.addEventListener('click', () => { st.subj = v; st.unit = ''; save(); render(); });
    subjBox.append(b);
  });
  const lvBox = $('#lv');
  [['', '中学・高校'], ['中学', '中学'], ['高校', '高校']].forEach(([v, lab]) => {
    const b = el('button', '', lab); b.type = 'button'; b.dataset.v = v;
    b.addEventListener('click', () => { st.lv = v; save(); render(); });
    lvBox.append(b);
  });
  const unitSel = $('#unit');
  unitSel.addEventListener('change', () => { st.unit = unitSel.value; render(); });
  const q = $('#q');
  q.addEventListener('input', () => { st.q = q.value; render(); });
  const soon = $('#soon');
  soon.checked = st.soon;
  soon.addEventListener('change', () => { st.soon = soon.checked; save(); render(); });

  function save() { store.set('sm:filter', { subj: st.subj, lv: st.lv, soon: st.soon }); }
  function subjOk(s) { return !st.subj || (st.subj === 'sci' ? s.subject !== '数学' : s.subject === st.subj); }

  function render() {
    subjBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.subj)));
    lvBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.lv)));
    // 単元のえらびは、今の教科・段階にある単元だけ
    const base = SIMS.filter((s) => subjOk(s) && (!st.lv || s.levels.includes(st.lv)) && (st.soon || s.status === 'open'));
    const units = [...new Set(base.map((s) => s.subject + '｜' + s.unit))];
    if (!units.includes(st.unit)) st.unit = '';
    unitSel.innerHTML = '<option value="">すべての単元</option>' + units.map((u) => '<option value="' + u + '">' + u.replace('｜', '：') + '</option>').join('');
    unitSel.value = st.unit;
    const words = norm(st.q) ? st.q.split(/[\s　]+/).map(norm).filter(Boolean) : [];
    const hits = base.filter((s) => {
      if (st.unit && s.subject + '｜' + s.unit !== st.unit) return false;
      if (!words.length) return true;
      const hay = norm([s.title, s.subject, s.unit, s.grades, s.desc].concat(s.keywords || []).join(' '));
      return words.every((w) => hay.includes(w));
    });
    const list = $('#list');
    list.innerHTML = '';
    const best = store.get('sm:quiz', {});
    SUBJECTS.forEach((sub) => {
      const items = hits.filter((s) => s.subject === sub).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));
      if (!items.length) return;
      const g = el('section', 'sim-group');
      const h = el('h2');
      const m = el('span', 'mark', SUB[sub].mark); m.style.background = SUB[sub].color; m.setAttribute('aria-hidden', 'true');
      h.append(m, sub);
      const ul = el('ul', 'cards');
      items.forEach((s) => ul.append(card(s, best[s.id])));
      g.append(h, ul);
      list.append(g);
    });
    const open = hits.filter((s) => s.status === 'open').length;
    $('#count').textContent = hits.length ? open + ' 本' + (hits.length > open ? '（準備中 ' + (hits.length - open) + ' 本）' : '') : '';
    $('#empty').hidden = hits.length > 0;
  }

  function card(s, best) {
    const li = el('li', 'card' + (s.status === 'open' ? '' : ' soon'));
    const th = el('span', 'card-thumb'); th.setAttribute('aria-hidden', 'true');
    th.innerHTML = thumb(s);
    const body = el('div', 'card-body');
    const h = el('h3');
    if (s.status === 'open') { const a = el('a', '', s.title); a.href = 'sim.html?s=' + encodeURIComponent(s.id); h.append(a); } else h.textContent = s.title;
    const tags = el('div', 'tags');
    tags.append(el('span', '', s.grades), el('span', '', s.unit), el('span', '', '目安 ' + s.minutes + '分'));
    if (s.status !== 'open') tags.append(el('span', 'soon-t', '準備中'));
    body.append(h, tags, el('p', 'desc', s.desc));
    if (best && best.n) body.append(el('p', 'best', '確認問題 ' + best.ok + ' / ' + best.n + (best.ok === best.n ? '（全問正解）' : '')));
    if (s.status === 'open') body.append(el('span', 'go', '動かしてみる →'));
    li.append(th, body);
    return li;
  }

  // カードの上の小さな図（飾り）
  function thumb(s) {
    const sv = (inner) => '<svg viewBox="0 0 300 108" preserveAspectRatio="xMidYMid slice">' + inner + '</svg>';
    const ax = '<path d="M20 74H280M150 10V100" stroke="var(--muted)" stroke-width="1.5" opacity=".6"/>';
    switch (s.id) {
      case 'functions':
        return sv(ax + '<path d="M70 104 Q150 -30 230 104" fill="none" stroke="var(--c1)" stroke-width="4"/><path d="M40 100 L260 20" stroke="var(--c2)" stroke-width="3.5" stroke-dasharray="10 6"/><circle cx="150" cy="37" r="6" fill="var(--c1)"/>');
      case 'trig': {
        let d = 'M150 54'; for (let i = 0; i <= 120; i++) { const x = 150 + i, y = 54 - 32 * Math.sin(i / 120 * Math.PI * 2); d += ' L' + x + ' ' + y.toFixed(1); }
        return sv('<circle cx="80" cy="54" r="32" fill="none" stroke="var(--muted)" stroke-width="2"/><path d="M40 54H280M80 14V94" stroke="var(--muted)" stroke-width="1.2" opacity=".6"/><path d="M80 54 L102.6 31.4" stroke="var(--c1)" stroke-width="3"/><circle cx="102.6" cy="31.4" r="6" fill="var(--c2)"/><path d="M102.6 31.4H150" stroke="var(--c2)" stroke-dasharray="4 4" stroke-width="2"/><path d="' + d + '" fill="none" stroke="var(--c2)" stroke-width="3.5"/>');
      }
      case 'motion':
        return sv('<path d="M20 86H280" stroke="var(--muted)" stroke-width="2"/>' + [0, 1, 2, 3, 4, 5].map((i) => '<circle cx="' + (34 + 7 * i * i + 14 * i) + '" cy="72" r="' + (i === 5 ? 12 : 7) + '" fill="var(--c1)" opacity="' + (i === 5 ? 1 : 0.25 + i * 0.1) + '"/>').join('') + '<path d="M200 40 L270 40" stroke="var(--c2)" stroke-width="4"/><path d="M262 33 L274 40 L262 47Z" fill="var(--c2)"/>');
      case 'interference': {
        let r = ''; for (let i = 1; i <= 8; i++) { r += '<circle cx="120" cy="54" r="' + i * 16 + '" fill="none" stroke="var(--c1)" stroke-width="2" opacity=".55"/><circle cx="180" cy="54" r="' + i * 16 + '" fill="none" stroke="var(--c2)" stroke-width="2" opacity=".55"/>'; }
        return sv(r + '<circle cx="120" cy="54" r="5" fill="var(--ink)"/><circle cx="180" cy="54" r="5" fill="var(--ink)"/>');
      }
      case 'ohm':
        return sv('<rect x="60" y="20" width="180" height="70" rx="6" fill="none" stroke="var(--ink)" stroke-width="3"/><rect x="120" y="10" width="60" height="20" fill="var(--paper)" stroke="var(--c2)" stroke-width="3"/><path d="M52 50h16M56 62h8" stroke="var(--ink)" stroke-width="4"/><circle cx="240" cy="55" r="14" fill="var(--paper)" stroke="var(--c1)" stroke-width="3"/><text x="240" y="61" text-anchor="middle" font-size="16" font-weight="700" fill="var(--c1)">A</text>');
      default: {
        const c = (SUB[s.subject] || {}).color || 'var(--muted)';
        return sv('<circle cx="150" cy="54" r="30" fill="none" stroke="' + c + '" stroke-width="3" stroke-dasharray="6 6" opacity=".6"/><text x="150" y="62" text-anchor="middle" font-size="22" font-weight="700" fill="' + c + '" opacity=".7">' + ((SUB[s.subject] || {}).mark || '') + '</text>');
      }
    }
  }

  // 見た目（ほかのサイトと共通の ew:style）
  const stylePick = $('#style');
  stylePick.value = document.documentElement.dataset.style || 'note';
  stylePick.addEventListener('change', () => {
    store.set('ew:style', stylePick.value);
    if (window.ewStyle) window.ewStyle(stylePick.value);
  });

  // ホームの「全部のサイトから探す」から来たとき（?find=教材のid）は、その教材だけを出す
  const find = qs.get('find');
  if (find) { const hit = SIMS.find((s) => s.id === find); if (hit) { st.subj = ''; st.lv = ''; q.value = st.q = hit.title; if (hit.status !== 'open') st.soon = soon.checked = true; } history.replaceState(null, '', location.pathname); }

  render();

  // 続きから（ホーム）：一覧を開いたことだけ残す（教材を開くとその教材になる）
  try {
    const all = store.get('study:resume', {}) || {};
    if (!all.simulator || Date.now() - all.simulator.t > 0) {
      const prev = all.simulator;
      all.simulator = prev && prev.u && prev.u.indexOf('sim.html') >= 0 ? Object.assign({}, prev, { t: Date.now() }) : { t: Date.now(), n: '数学・理科シミュレーター', v: '一覧', s: '', u: location.origin + location.pathname };
      store.set('study:resume', all);
    }
  } catch (e) { /* 保存できなくても動く */ }
})();
