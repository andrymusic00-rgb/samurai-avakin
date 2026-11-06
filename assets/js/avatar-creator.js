const AvatarCreator = (() => {
  const $ = (sel, r = document) => r.querySelector(sel);
  const $$ = (sel, r = document) => Array.from(r.querySelectorAll(sel));
  const toast = (...a) => { if (typeof UI !== 'undefined' && UI?.toast) UI.toast(...a); else console.log(...a); };

  let _wrap = null;
  let _mode = 'photo'; // 'photo' | 'avatar3d'
  let _originalImage = null;
  let _currentStyle = 'classic';
  let _canvas = null;
  let _ctx = null;
  let _v2 = null;
  let _photoAnalysis = null; // analisi automatica della foto 2D

  /* ---------------------------------------------------------------- analisi foto */
  function toHex(c) {
    return '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  function analyzePhoto(img) {
    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d');
    const size = 60;
    tmp.width = size; tmp.height = size;
    tctx.drawImage(img, 0, 0, size, size);
    const data = tctx.getImageData(0, 0, size, size).data;

    let face = { r: 0, g: 0, b: 0, n: 0 };
    let hair = { r: 0, g: 0, b: 0, n: 0 };
    let overall = { r: 0, g: 0, b: 0, n: 0 };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const a = data[i + 3];
        if (a < 100) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        overall.r += r; overall.g += g; overall.b += b; overall.n++;

        // Capelli: fascia superiore centrale
        if (y < size * 0.30 && x > size * 0.25 && x < size * 0.75) {
          hair.r += r; hair.g += g; hair.b += b; hair.n++;
        }
        // Pelle: zona centrale del volto
        if (y > size * 0.35 && y < size * 0.72 && x > size * 0.30 && x < size * 0.70) {
          face.r += r; face.g += g; face.b += b; face.n++;
        }
      }
    }

    const avg = (o) => o.n > 0 ? { r: o.r / o.n, g: o.g / o.n, b: o.b / o.n } : { r: 200, g: 160, b: 120 };
    const f = avg(face);
    const h = avg(hair);
    const o = avg(overall);
    const lum = (o.r * 0.3 + o.g * 0.59 + o.b * 0.11) / 255;

    return {
      skin: toHex(f),
      hairColor: toHex(h),
      overallLuminance: lum
    };
  }

  function mapAnalysisToAvatar3D(analysis) {
    const lum = analysis.overallLuminance;
    let armorColor, lacquerColor, metalColor, fabricColor;
    if (lum > 0.6) {
      armorColor = '#8b0000'; lacquerColor = '#4a0e0e'; metalColor = '#d4af37'; fabricColor = '#2a1a1a';
    } else if (lum > 0.4) {
      armorColor = '#1a3a5a'; lacquerColor = '#0d1b2a'; metalColor = '#b8a35e'; fabricColor = '#1a1a2e';
    } else {
      armorColor = '#2a1a1a'; lacquerColor = '#1a0a0a'; metalColor = '#8a7a4e'; fabricColor = '#121212';
    }

    return {
      skin: analysis.skin,
      hairColor: analysis.hairColor,
      armorColor,
      lacquerColor,
      fabricColor,
      metalColor,
      head: 'round',
      hair: 'short',
      helmet: 'none',
      face: 'none',
      weapon: 'none',
      headScale: 1.0,
      bodyScale: 1.0,
      expression: 'neutral'
    };
  }

  /* ---------------------------------------------------------------- init */
  function init() {
    _wrap = $('#avatarCreatorModal');
    if (!_wrap) {
      console.warn('[AvatarCreator] #avatarCreatorModal non trovato in index.html');
      return;
    }
    _canvas = $('#acCanvas');
    _ctx = _canvas ? _canvas.getContext('2d') : null;

    bindDropZone();
    bindStyles();
    bindControls();
    bindModeSwitch();

    if (typeof window !== 'undefined') {
      window.AvatarCreator = { open, openWithImage, openWithAvatar, close, init };
    }
  }

  function bindDropZone() {
    const dz = $('#acDropZone');
    const input = $('#acInput');
    if (!dz || !input) return;
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      if (e.target.files[0]) loadFile(e.target.files[0]);
    });
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('is-over'); }));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('is-over'); }));
    dz.addEventListener('drop', e => { if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) { toast('Formato non valido', 'Carica un\'immagine.', 'warn'); return; }
    const r = new FileReader();
    r.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        _originalImage = img;
        render2D(img);
        // Analisi automatica della foto per l'avatar 3D
        _photoAnalysis = analyzePhoto(img);
        open();
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(file);
  }

  function bindStyles() {
    $$('#acStyles .ac-style', _wrap).forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#acStyles .ac-style', _wrap).forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        _currentStyle = btn.dataset.style;
        if (_originalImage) render2D(_originalImage);
      });
    });
  }

  function bindControls() {
    const apply = $('#acApply', _wrap) || $('#acSave', _wrap);
    const reset = $('#acReset');
    const download = $('#acDownload');
    const clear = $('#acClear');

    if (apply) apply.addEventListener('click', saveAvatar);
    if (reset) reset.addEventListener('click', resetPhoto);
    if (download) download.addEventListener('click', download2D);
    if (clear) clear.addEventListener('click', () => { _originalImage = null; _photoAnalysis = null; show2D(); });
  }

  function bindModeSwitch() {
    const toggle = $('#acToggleView');
    if (toggle) toggle.addEventListener('click', () => {
      _mode = _mode === 'photo' ? 'avatar3d' : 'photo';
      showMode();
    });
  }

  /* ---------------------------------------------------------------- 2D */
  function show2D() {
    const stage = $('#acStage');
    const controls = $('#acControls');
    if (stage) stage.style.display = _originalImage ? '' : 'none';
    if (controls) controls.style.display = _originalImage ? 'flex' : 'none';
    const el3d = $('#ac3d', _wrap);
    if (el3d) el3d.style.display = 'none';
  }

  function render2D(img) {
    if (!_canvas || !_ctx) return;
    const c = _canvas;
    const maxW = 560, maxH = 420;
    let w = img.naturalWidth, h = img.naturalHeight;
    const scale = Math.min(maxW / w, maxH / h, 1);
    c.width = Math.floor(w * scale);
    c.height = Math.floor(h * scale);
    _ctx.drawImage(img, 0, 0, c.width, c.height);

    if (_currentStyle === 'ink') {
      const d = _ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const lum = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
        const step = Math.round(lum / 51) * 51;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = step;
      }
      _ctx.putImageData(d, 0, 0);
    } else if (_currentStyle === 'bushi') {
      _ctx.filter = 'contrast(1.15) saturate(1.1) hue-rotate(-10deg)';
      _ctx.drawImage(img, 0, 0, c.width, c.height);
      _ctx.filter = 'none';
    } else if (_currentStyle === 'oni') {
      _ctx.filter = 'contrast(1.3) saturate(0.5) hue-rotate(15deg)';
      _ctx.drawImage(img, 0, 0, c.width, c.height);
      _ctx.filter = 'none';
    }
    show2D();
  }

  function resetPhoto() {
    _originalImage = null;
    _photoAnalysis = null;
    if (_canvas && _ctx) { _ctx.clearRect(0, 0, _canvas.width, _canvas.height); }
    show2D();
  }

  function download2D() {
    if (!_canvas) return;
    const url = _canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'samurai-avatar-2d.png';
    a.click();
  }

  async function saveAvatar() {
    let payload = {};
    if (_mode === 'photo') {
      if (!_canvas) { toast('Nessuna immagine', '', 'warn'); return; }
      payload = { avatar2d: _canvas.toDataURL('image/png'), style: _currentStyle, type: 'mii' };
    } else {
      if (!_v2) { toast('Avatar 3D non caricato', '', 'warn'); return; }
      payload = { avatar3d: _v2.getState ? _v2.getState() : null, type: 'avatar3d' };
    }

    try {
      let res;
      if (typeof API !== 'undefined') {
        res = await API.post('/api/account/avatar', payload, { noRetry: true });
      } else {
        res = await fetch('/api/account/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (res?.ok) {
        toast('Avatar salvato', 'Il tuo avatar è ora sul profilo.', 'ok');
        close();
      } else {
        toast('Salvataggio fallito', res?.message || 'Riprova.', 'err');
      }
    } catch (e) {
      toast('Errore salvataggio', e.message, 'err');
    }
  }

  /* ---------------------------------------------------------------- 3D */
  async function initAvatar3D() {
    if (_v2) {
      // Se c'è già un'analisi della foto 2D, applicala
      if (_photoAnalysis) {
        _v2.setState(mapAnalysisToAvatar3D(_photoAnalysis));
      }
      return;
    }
    const container = $('#ac3d', _wrap);
    if (!container) return;
    try {
      const mod = await import('./avatar-v2/index.js');
      _v2 = mod.avatarV2;
      _v2.init({ uiContainer: null, stageContainer: container });
      // Applica subito l'analisi della foto 2D se disponibile
      if (_photoAnalysis) {
        _v2.setState(mapAnalysisToAvatar3D(_photoAnalysis));
      }
      toast('Avatar 3D pronto', 'Generato automaticamente dalla tua foto.', 'ok', 3000);
    } catch (e) {
      toast('Errore caricamento 3D', 'Usa la modalità foto.', 'warn');
      console.error(e);
    }
  }

  function showMode() {
    const stage = $('#acStage');
    const panel3d = $('#ac3d', _wrap);
    if (_mode === 'avatar3d') {
      if (stage) stage.style.display = 'none';
      if (panel3d) panel3d.style.display = '';
      initAvatar3D();
    } else {
      if (panel3d) panel3d.style.display = 'none';
      show2D();
    }
  }

  /* ---------------------------------------------------------------- public */
  function open() {
    if (!_wrap) init();
    if (!_wrap) return;
    _mode = 'photo';
    const toggle = $('#acToggleView');
    if (toggle) { toggle.textContent = 'Passa a 3D'; toggle.classList.remove('is-active'); }
    const dz = $('#acDropZone', _wrap);
    const stage = $('#acStage');
    const controls = $('#acControls');
    if (dz) dz.style.display = '';
    if (stage) stage.style.display = _originalImage ? '' : 'none';
    if (controls) controls.style.display = _originalImage ? 'flex' : 'none';
    const el3d = $('#ac3d', _wrap);
    if (el3d) el3d.style.display = 'none';
    _wrap.classList.add('is-open');
    _wrap.setAttribute('aria-modal', 'true');
  }

  function openWithImage(dataUrl) {
    const img = new Image();
    img.onload = () => { _originalImage = img; _photoAnalysis = analyzePhoto(img); render2D(img); open(); };
    img.src = dataUrl;
  }

  function openWithAvatar(avatarObj) {
    if (!avatarObj) { open(); return; }
    if (avatarObj.type === 'mii' && avatarObj.dataUrl) {
      openWithImage(avatarObj.dataUrl);
    } else if (avatarObj.type === 'avatar3d' || avatarObj.avatar3d) {
      _mode = 'avatar3d';
      open();
      if (avatarObj.avatar3d && _v2) {
        _v2.setState(avatarObj.avatar3d);
      } else if (_v2) {
        _v2.setState(avatarObj);
      }
    } else {
      open();
    }
  }

  function close() {
    if (_wrap) {
      _wrap.classList.remove('is-open');
      _wrap.removeAttribute('aria-modal');
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return { open, openWithImage, openWithAvatar, close, init };
})();
