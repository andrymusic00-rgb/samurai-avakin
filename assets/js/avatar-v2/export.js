// avatar-v2/export.js — esportazione GLB dell'avatar corrente
import * as THREE from 'three';

let GLTFExporter = null;
try {
  // eslint-disable-next-line no-undef
  const mod = threeAddonsGLTFExporter();
  if (mod) GLTFExporter = mod.GLTFExporter;
} catch {}

function threeAddonsGLTFExporter() {
  return null;
}

async function exportGLB(scene, filename = 'samurai-avatar.glb', onProgress) {
  if (!scene) return null;

  // Carica GLTFExporter dinamicamente se non disponibile
  if (!GLTFExporter) {
    try {
      const m = await import('three/addons/exporters/GLTFExporter.js');
      GLTFExporter = m.GLTFExporter;
    } catch (e) {
      console.warn('GLTFExporter non disponibile:', e);
      return null;
    }
  }

  return new Promise((resolve) => {
    const exporter = new GLTFExporter();
    // Clona la scena per esportare solo le mesh (no luci)
    const exportScene = new THREE.Scene();
    scene.traverse((obj) => {
      if (obj.isMesh) {
        exportScene.add(obj.clone());
      }
    });

    exporter.parse(exportScene,
      (gltf) => {
        try {
          const blob = new Blob([gltf], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          if (onProgress) onProgress('done');
          resolve(url);
        } catch (err) {
          console.warn('export err', err);
          if (onProgress) onProgress('error');
          resolve(null);
        }
      },
      (err) => {
        console.warn('export parse err', err);
        if (onProgress) onProgress('error');
        resolve(null);
      },
      { binary: true },
    );
  });
}

export { exportGLB };
