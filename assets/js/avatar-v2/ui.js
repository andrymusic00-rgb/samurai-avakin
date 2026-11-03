// avatar-v2/ui.js — pannello di controllo granulare per l'avatar v2 (standalone, non tocca il DOM esistente)
import { store } from './store.js';
import { scene as scene3d } from './scene.js';
import { slots } from './slots.js';
import { exportGLB } from './export.js';

const ui = (() => {
  let _root, _stage, _unsubscribe, _activeTab = 'face';
  let _parts = {};

  const tabs = [
    { id: 'face', label: 'Volto' },
    { id: 'hair', label: 'Capelli / Elmo' },
    { id: 'armor', label: 'Armatura' },
    { id: 'color', label: 'Colori' },
    { id: 'body', label: 'Proporzioni' },
  ];

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function btn(label, cls) {
    const b = el('button', cls || 'av-btn', label);
    b.type = 'button';
    return b;
  }

  function buildUI(root) {
    root.innerHTML = '';
    root.style.position = 'relative';

    // Barra schede
    const bar = el('div', 'av-tabs');
    bar.style.display = 'flex';
    bar.style.gap = '6px';
    bar.style.marginBottom = '10px';
    bar.style.borderBottom = '1px solid #2a2a40';
    bar.style.paddingBottom = '6px';

    tabs.forEach((t) => {
      const b = btn(t.label, 'av-tab');
      b.dataset.tab = t.id;
      b.style.padding = '6px 12px';
      b.style.fontSize = '12px';
      b.style.background = t.id === _activeTab ? '#3b2a5a' : '#1a1a2e';
      b.style.color = t.id === _activeTab ? '#fff' : '#aaa';
      b.style.border = '1px solid #333';
      b.style.borderRadius = '6px 6px 0 0';
      b.style.cursor = 'pointer';
      b.addEventListener('click', () => { _activeTab = t.id; render(); });
      bar.appendChild(b);
    });
    root.appendChild(bar);

    // Contenuto schede
    const content = el('div', 'av-content');
    content.style.padding = '10px 0';
    root.appendChild(content);

    render();
  }

  function render() {
    const content = _root.querySelector('.av-content');
    if (!content) return;
    content.innerHTML = '';

    const s = store.get();

    if (_activeTab === 'face') {
      renderFace(content, s);
    } else if (_activeTab === 'hair') {
      renderHair(content, s);
    } else if (_activeTab === 'armor') {
      renderArmor(content, s);
    } else if (_activeTab === 'color') {
      renderColor(content, s);
    } else if (_activeTab === 'body') {
      renderBody(content, s);
    }

    // Azioni globali
    const actions = el('div', 'av-actions');
    actions.style.marginTop = '14px';
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const exp = btn('Esporta GLB', 'av-btn-export');
    exp.style.background = '#2a5a3b';
    exp.style.color = '#fff';
    exp.addEventListener('click', async () => {
      exp.textContent = 'Esportando...';
      await exportGLB(scene3d.scene, 'samurai-avatar-v2.glb', (st) => {
        exp.textContent = st === 'done' ? 'Esportato GLB ✓' : 'Esporta GLB';
      });
    });
    actions.appendChild(exp);

    const rst = btn('Reset', 'av-btn-reset');
    rst.style.background = '#5a2a2a';
    rst.style.color = '#fff';
    rst.addEventListener('click', () => {
      store.reset();
      render();
    });
    actions.appendChild(rst);

    content.appendChild(actions);
  }

  // ---- Tab Volto ----
  function renderFace(container, s) {
    const box = section('Forma del viso');
    const rows = [
      { label: 'Tonda', val: 'round', group: 'head' },
      { label: 'Squadrata', val: 'square', group: 'head' },
      { label: 'Ovale', val: 'oval', group: 'head' },
    ];
    rows.forEach((r) => {
      const b = btn(r.label, 'av-opt');
      b.style.background = s.head === r.val ? '#3b2a5a' : '#1a1a2e';
      b.style.color = s.head === r.val ? '#fff' : '#aaa';
      b.addEventListener('click', () => store.set({ head: r.val }));
      box.appendChild(b);
    });

    // Espressione
    const expBox = section('Espressione');
    ['neutral', 'smile', 'serious'].forEach((e) => {
      const b = btn(e, 'av-opt');
      b.style.background = s.expression === e ? '#3b2a5a' : '#1a1a2e';
      b.style.color = s.expression === e ? '#fff' : '#aaa';
      b.addEventListener('click', () => store.set({ expression: e }));
      expBox.appendChild(b);
    });

    // Accessori viso
    const accBox = section('Accessori viso');
    ['none', 'mask_oni', 'scar', 'bandage'].forEach((f) => {
      const b = btn(f === 'none' ? 'Nessuno' : f === 'mask_oni' ? 'Maschera Oni' : f === 'scar' ? 'Cicatrice' : 'Bende', 'av-opt');
      b.style.background = s.face === f ? '#3b2a5a' : '#1a1a2e';
      b.style.color = s.face === f ? '#fff' : '#aaa';
      b.addEventListener('click', () => store.set({ face: f }));
      accBox.appendChild(b);
    });

    container.appendChild(box);
    container.appendChild(expBox);
    container.appendChild(accBox);
  }

  // ---- Tab Capelli / Elmo ----
  function renderHair(container, s) {
    const box = section('Capigliatura');
    ['none', 'short', 'long', 'topknot'].forEach((h) => {
      const b = btn(h === 'none' ? 'Nessuno' : h === 'short' ? 'Corti' : h === 'long' ? 'Lunghi' : 'Chonmage', 'av-opt');
      b.style.background = s.hair === h ? '#3b2a5a' : '#1a1a2e';
      b.style.color = s.hair === h ? '#fff' : '#aaa';
      b.addEventListener('click', () => store.set({ hair: h }));
      box.appendChild(b);
    });

    const helmBox = section('Elmo (Kabuto / Mempo)');
    ['none', 'kabuto', 'mempo'].forEach((h) => {
      const b = btn(h === 'none' ? 'Nessuno' : h === 'kabuto' ? 'Kabuto' : 'Mempo', 'av-opt');
      b.style.background = s.helmet === h ? '#3b2a5a' : '#1a1a2e';
      b.style.color = s.helmet === h ? '#fff' : '#aaa';
      b.addEventListener('click', () => store.set({ helmet: h }));
      helmBox.appendChild(b);
    });

    container.appendChild(box);
    container.appendChild(helmBox);
  }

  // ---- Tab Armatura ----
  function renderArmor(container, s) {
    const box = section('Corazza (Do)');
    ['none', 'do_red', 'do_blue', 'do_black'].forEach((a) => {
      const b = btn(a === 'none' ? 'Nessuna' : a.replace('do_', 'Do ').toUpperCase(), 'av-opt');
      b.style.background = s.armor === a ? '#3b2a5a' : '#1a1a2e';
      b.style.color = s.armor === a ? '#fff' : '#aaa';
      b.addEventListener('click', () => store.set({ armor: a }));
      box.appendChild(b);
    });

    const wepBox = section('Arma');
    ['none', 'katana_back', 'wakizashi_side'].forEach((w) => {
      const b = btn(w === 'none' ? 'Nessuna' : w === 'katana_back' ? 'Katana (schiena)' : 'Wakizashi (fianco)', 'av-opt');
      b.style.background = s.weapon === w ? '#3b2a5a' : '#1a1a2e';
      b.style.color = s.weapon === w ? '#fff' : '#aaa';
      b.addEventListener('click', () => store.set({ weapon: w }));
      wepBox.appendChild(b);
    });

    container.appendChild(box);
    container.appendChild(wepBox);
  }

  // ---- Tab Colori ----
  function renderColor(container, s) {
    const pick = (label, key, def) => {
      const box = section(label);
      const input = el('input');
      input.type = 'color';
      input.value = s[key] || def;
      input.style.width = '100%';
      input.style.height = '28px';
      input.style.border = 'none';
      input.style.background = 'transparent';
      input.style.cursor = 'pointer';
      input.addEventListener('input', (e) => store.set({ [key]: e.target.value }));
      box.appendChild(input);
      return box;
    };

    container.appendChild(pick('Pelle', 'skin', '#ffe0bd'));
    container.appendChild(pick('Capelli', 'hairColor', '#1a1a1a'));
    container.appendChild(pick('Armatura (lacca)', 'armorColor', '#8b0000'));
    container.appendChild(pick('Lacca scura', 'lacquerColor', '#4a0e0e'));
    container.appendChild(pick('Tessuto Odoshi', 'fabricColor', '#2a1a1a'));
    container.appendChild(pick('Metallo / Oro', 'metalColor', '#b8a35e'));
  }

  // ---- Tab Proporzioni ----
  function renderBody(container, s) {
    const slider = (label, key, min, max, step, def) => {
      const box = section(label);
      const row = el('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.marginBottom = '8px';

      const valSpan = el('span', 'av-val');
      valSpan.style.fontSize = '11px';
      valSpan.style.minWidth = '32px';
      valSpan.style.color = '#aaa';
      valSpan.textContent = s[key].toFixed(2);

      const input = el('input');
      input.type = 'range';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = s[key];
      input.style.flex = '1';

      input.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        valSpan.textContent = v.toFixed(2);
        store.set({ [key]: v });
      });

      row.appendChild(valSpan);
      row.appendChild(input);
      box.appendChild(row);
      return box;
    };

    container.appendChild(slider('Scala testa', 'headScale', 0.7, 1.4, 0.05, 1.0));
    container.appendChild(slider('Scala corpo', 'bodyScale', 0.7, 1.4, 0.05, 1.0));
  }

  function section(title) {
    const box = el('div', 'av-section');
    box.style.marginBottom = '10px';
    const t = el('div', 'av-section-title');
    t.style.fontSize = '11px';
    t.style.color = '#8a8ab0';
    t.style.textTransform = 'uppercase';
    t.style.letterSpacing = '0.08em';
    t.style.marginBottom = '6px';
    t.textContent = title;
    box.appendChild(t);
    return box;
  }

  function init(root, stageEl) {
    _root = root;
    _stage = stageEl;
    if (!_root) return false;
    buildUI(_root);

    _unsubscribe = store.subscribe(() => {
      render();
      redraw3d();
    });

    redraw3d();
    return true;
  }

  function redraw3d() {
    if (!_stage) return;
    scene3d.clearMeshes();
    const s = store.get();
    _parts = slots.buildAll(s);
    Object.values(_parts).forEach((p) => scene3d.add(p));
  }

  function dispose() {
    if (_unsubscribe) _unsubscribe();
    _root = null;
    _stage = null;
    _parts = {};
  }

  return { init, dispose, render, redraw3d };
})();

export { ui };
