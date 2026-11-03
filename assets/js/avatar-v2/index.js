// avatar-v2/index.js — punto di ingresso del modulo avatar v2 (isolato, non modifica l'esistente)
import { scene as scene3d } from './scene.js';
import { ui } from './ui.js';
import { store } from './store.js';
import { slots } from './slots.js';

const avatarV2 = (() => {
  let _rootUI, _root3D, _created = false, _resizeBound = null;

  function ensureContainer(id, cls, parent = document.body) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = cls || '';
    parent.appendChild(el);
    _created = true;
    return el;
  }

  function init(opts = {}) {
    // Evita doppia inizializzazione
    if (avatarV2.initialized) return avatarV2;

    const uiParent = opts.uiParent || document.body;
    const stageParent = opts.stageParent || document.body;

    _rootUI = opts.uiContainer || ensureContainer('avatar-v2-ui', 'avatar-v2-ui', uiParent);
    _root3D = opts.stageContainer || ensureContainer('avatar-v2-stage', 'avatar-v2-stage', stageParent);

    // Stile di base per i container creati da noi
    if (_created) {
      Object.assign(_rootUI.style, {
        position: 'fixed',
        top: '120px',
        right: '16px',
        width: '260px',
        background: '#0f0f1a',
        color: '#c8c8e0',
        border: '1px solid #2a2a40',
        borderRadius: '10px',
        padding: '12px',
        zIndex: '1000',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      });
      Object.assign(_root3D.style, {
        width: '400px',
        height: '400px',
        background: '#060812',
        border: '1px solid #2a2a40',
        borderRadius: '10px',
        display: 'inline-block',
      });
    }

    // Inizializza scena 3D
    const ok = scene3d.init(_root3D, 400, 400);
    if (!ok) {
      console.warn('[avatar-v2] Impossibile inizializzare la scena 3D');
      return avatarV2;
    }

    // Disegna avatar iniziale
    const s = store.get();
    const parts = slots.buildAll(s);
    Object.values(parts).forEach((p) => scene3d.add(p));

    // Inizializza UI
    ui.init(_rootUI, _root3D);

    // Resize listener
    _resizeBound = () => {
      const r = _root3D.getBoundingClientRect();
      scene3d.resize(r.width || 400, r.height || 400);
    };
    window.addEventListener('resize', _resizeBound);

    avatarV2.initialized = true;
    return avatarV2;
  }

  function dispose() {
    if (_resizeBound) {
      window.removeEventListener('resize', _resizeBound);
      _resizeBound = null;
    }
    ui.dispose();
    scene3d.dispose();
    avatarV2.initialized = false;
  }

  function getState() {
    return store.get();
  }

  function setState(patch) {
    store.set(patch || {});
  }

  return { init, dispose, getState, setState, initialized: false,
    get scene() { return scene3d.scene; },
    get camera() { return scene3d.camera; } };
})();

export { avatarV2 };

// Esposizione opzionale su window per debug da console (non invadente)
if (typeof window !== 'undefined') {
  window.AvatarV2 = avatarV2;
}
