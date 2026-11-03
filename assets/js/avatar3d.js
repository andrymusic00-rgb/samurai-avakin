import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const Avatar3D = (() => {
  let scene, camera, renderer, head, body, hair;
  let container;
  let animId = 0;
  let headMesh, bodyMesh, hairMesh;
  let current = {
    headScale: 1.0,
    bodyScale: 1.0,
    headShape: 'round',
    skinColor: '#ffe0bd',
    hairColor: '#1a1a1a',
    hairStyle: 'short'
  };

  function init(el) {
    container = el;
    if (!container) return;
    const w = 400, h = 400;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1f);

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 0.8, 3.5);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x0f1428, 2.0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0x8ab4ff, 1.0);
    dir.position.set(3, 4, 2);
    scene.add(dir);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    build();
    animate();
  }

  function build() {
    scene.clear();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x0f1428, 2.0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0x8ab4ff, 1.0);
    dir.position.set(3, 4, 2);
    scene.add(dir);

    const skin = new THREE.MeshLambertMaterial({ color: current.skinColor });
    const hairMat = new THREE.MeshLambertMaterial({ color: current.hairColor });

    // Head
    let headGeo;
    if (current.headShape === 'square') {
      headGeo = new THREE.BoxGeometry(0.8 * current.headScale, 0.9 * current.headScale, 0.8 * current.headScale);
    } else {
      headGeo = new THREE.SphereGeometry(0.5 * current.headScale, 24, 18);
    }
    headMesh = new THREE.Mesh(headGeo, skin);
    headMesh.position.y = 1.1;
    scene.add(headMesh);

    // Hair
    if (current.hairStyle === 'long') {
      const hairGeo = new THREE.CapsuleGeometry(0.52 * current.headScale, 0.5, 4, 16);
      hairMesh = new THREE.Mesh(hairGeo, hairMat);
      hairMesh.position.y = 1.1;
      hairMesh.rotation.z = 0.1;
      scene.add(hairMesh);
    } else if (current.hairStyle === 'spiky') {
      const hairGeo = new THREE.ConeGeometry(0.5 * current.headScale, 0.6, 8);
      hairMesh = new THREE.Mesh(hairGeo, hairMat);
      hairMesh.position.y = 1.5;
      scene.add(hairMesh);
    } else {
      const hairGeo = new THREE.SphereGeometry(0.48 * current.headScale, 16, 12);
      hairMesh = new THREE.Mesh(hairGeo, hairMat);
      hairMesh.position.y = 1.28;
      hairMesh.scale.y = 0.4;
      scene.add(hairMesh);
    }

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.35 * current.bodyScale, 1.2, 4, 16);
    bodyMesh = new THREE.Mesh(bodyGeo, skin);
    bodyMesh.position.y = 0.0;
    scene.add(bodyMesh);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.2, 12);
    const neck = new THREE.Mesh(neckGeo, skin);
    neck.position.y = 0.6;
    scene.add(neck);
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    if (scene && camera && renderer) {
      if (headMesh) headMesh.rotation.y += 0.002;
      renderer.render(scene, camera);
    }
  }

  function set(patch) {
    Object.assign(current, patch);
    build();
  }

  function getParams() {
    return { ...current };
  }

  function exportGLB(cb) {
    if (!renderer || !scene) return;
    const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
      try {
        const blob = new Blob([gltf], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        if (cb) cb(url);
      } catch (e) {
        if (cb) cb(null);
      }
    }, (err) => {
      console.warn('export err', err);
      if (cb) cb(null);
    }, { binary: true });
  }

  return { init, set, getParams, exportGLB };
})();

if (typeof window !== 'undefined') window.Avatar3D = Avatar3D;
export { Avatar3D };
