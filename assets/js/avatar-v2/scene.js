// avatar-v2/scene.js — scena, camera, renderer, three-point lighting
import * as THREE from 'three';

const scene = (() => {
  let _scene, _camera, _renderer, _container, _animId = 0, _running = false;

  const lights = {};

  function init(containerEl, w = 400, h = 400) {
    if (!containerEl) return false;
    _container = containerEl;

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x060812);
    _scene.fog = new THREE.Fog(0x060812, 2, 12);

    _camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    _camera.position.set(0, 1.0, 4.2);
    _camera.lookAt(0, 1.0, 0);

    // --- Three-Point Lighting ---
    // Key light: calda (alba/ambra), angolata 45 deg
    lights.key = new THREE.DirectionalLight(0xffb74d, 1.15);
    lights.key.position.set(2.5, 3.0, 2.0);
    lights.key.lookAt(0, 1.0, 0);
    lights.key.castShadow = true;
    _scene.add(lights.key);

    // Fill light: morbida, riempie ombre profonde
    lights.fill = new THREE.DirectionalLight(0x7fa3ff, 0.45);
    lights.fill.position.set(-2.0, 1.0, 1.5);
    lights.fill.lookAt(0, 1.0, 0);
    _scene.add(lights.fill);

    // Rim light: fredda (viola/azzurro), stacca dallo sfondo
    lights.rim = new THREE.DirectionalLight(0x8a6fff, 0.85);
    lights.rim.position.set(-1.5, 2.5, -2.5);
    lights.rim.lookAt(0, 1.0, 0);
    _scene.add(lights.rim);

    // Ambient base
    lights.ambient = new THREE.AmbientLight(0x222840, 0.5);
    _scene.add(lights.ambient);

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    _container.innerHTML = '';
    _container.appendChild(_renderer.domElement);

    _running = true;
    animate();
    return true;
  }

  function add(obj) {
    if (_scene && obj) _scene.add(obj);
  }

  function remove(obj) {
    if (_scene && obj) _scene.remove(obj);
  }

  function clearMeshes() {
    if (!_scene) return;
    _scene.children.forEach((c) => {
      if (c.isLight) return;
      _scene.remove(c);
    });
  }

  function animate() {
    if (!_running) return;
    _animId = requestAnimationFrame(animate);
    if (_renderer && _scene && _camera) {
      _renderer.render(_scene, _camera);
    }
  }

  function resize(w, h) {
    if (!_camera || !_renderer) return;
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
    _renderer.setSize(w, h);
  }

  function dispose() {
    _running = false;
    cancelAnimationFrame(_animId);
    if (_renderer) {
      try { _renderer.dispose(); } catch {}
      if (_container && _renderer.domElement) {
        _container.removeChild(_renderer.domElement);
      }
    }
    _scene = _camera = _renderer = _container = null;
  }

  return { init, add, remove, clearMeshes, resize, dispose,
    get scene() { return _scene; },
    get camera() { return _camera; },
    get renderer() { return _renderer; },
    get lights() { return lights; },
  };
})();

export { scene };
