// avatar-v2/store.js — stato centrale dell'avatar (nessuna dipendenza esterna)
const DEFAULT = {
  version: 2,
  // Slots
  head:   'round',        // round | square | oval
  hair:   'short',        // short | long | topknot | none
  helmet: 'none',         // none | kabuto | mempo
  armor:  'do_red',       // none | do_red | do_blue | do_black
  face:   'none',         // none | mask_oni | scar | bandage
  weapon: 'none',         // none | katana_back | wakizashi_side
  // Colori (HSL-friendly hex)
  skin:   '#ffe0bd',
  hairColor: '#1a1a1a',
  armorColor: '#8b0000',
  lacquerColor: '#4a0e0e',
  fabricColor: '#2a1a1a',
  metalColor: '#b8a35e',
  // Proporzioni
  headScale: 1.0,
  bodyScale: 1.0,
  // Espressione / morph
  expression: 'neutral',  // neutral | smile | serious
};

const store = {
  state: { ...DEFAULT },
  listeners: [],

  get() { return { ...this.state }; },

  set(patch) {
    Object.assign(this.state, patch || {});
    this.listeners.forEach((fn) => { try { fn(this.get()); } catch {} });
  },

  reset() {
    this.state = { ...DEFAULT };
    this.listeners.forEach((fn) => { try { fn(this.get()); } catch {} });
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  },
};

export { store, DEFAULT };
