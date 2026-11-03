// avatar-v2/materials.js — materiali cel-shading, outline, armatura (core Three.js solo)
import * as THREE from 'three';

const materials = (() => {
  const cache = new Map();

  // Toon ramp generata proceduralmente (gradoni per ombre nette stile illustrazione giapponese)
  function makeToonRamp(size = 16) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const steps = 5;
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      let level = Math.floor(t * steps) / steps;
      // scala giapponese: zone di luce piatte, transizioni nette
      level = Math.round(level * 4) / 4;
      const v = Math.round(level * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(i, 0, 1, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    return tex;
  }

  const toonRamp = makeToonRamp();

  function get(key, factory) {
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
  }

  function skin(color) {
    return get(`skin:${color}`, () => new THREE.MeshToonMaterial({
      color,
      gradientMap: toonRamp,
      roughness: 0.45,
      metalness: 0.0,
    }));
  }

  function hair(color) {
    return get(`hair:${color}`, () => new THREE.MeshToonMaterial({
      color,
      gradientMap: toonRamp,
      roughness: 0.6,
      metalness: 0.05,
    }));
  }

  // Laccatura lucida (Urushi) per placche armatura
  function lacquer(color) {
    return get(`lacquer:${color}`, () => new THREE.MeshToonMaterial({
      color,
      gradientMap: toonRamp,
      roughness: 0.18,
      metalness: 0.35,
    }));
  }

  // Tessuto opaco per cordini Odoshi
  function fabric(color) {
    return get(`fabric:${color}`, () => new THREE.MeshToonMaterial({
      color,
      gradientMap: toonRamp,
      roughness: 0.85,
      metalness: 0.0,
    }));
  }

  // Metallo satinato per lame e dettagli dorati
  function metal(color) {
    return get(`metal:${color}`, () => new THREE.MeshToonMaterial({
      color,
      gradientMap: toonRamp,
      roughness: 0.35,
      metalness: 0.85,
    }));
  }

  // Outline nero invertito (inverted hull)
  function outline() {
    return get('outline', () => new THREE.MeshBasicMaterial({
      color: 0x050505,
      side: THREE.BackSide,
      depthWrite: false,
    }));
  }

  // Emissivo per dettagli che brillano (es. occhi lama)
  function emissive(color, intensity = 1.0) {
    return get(`emissive:${color}:${intensity}`, () => new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
    }));
  }

  function dispose() {
    cache.forEach((m) => { try { m.dispose(); } catch {} });
    cache.clear();
    try { toonRamp.dispose(); } catch {}
  }

  return { skin, hair, lacquer, fabric, metal, outline, emissive, dispose, toonRamp };
})();

export { materials };
