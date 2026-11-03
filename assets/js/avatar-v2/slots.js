// avatar-v2/slots.js — sistema di slot/componenti per l'avatar samurai (primitive procedurali, nessun asset .glb esterno)
import * as THREE from 'three';
import { materials } from './materials.js';

const slots = (() => {
  // Helper: applica outline inverted-hull a una mesh
  function withOutline(mesh, scale = 1.045) {
    const group = new THREE.Group();
    group.add(mesh);

    const outlineMesh = mesh.clone();
    outlineMesh.material = materials.outline();
    outlineMesh.scale.set(scale, scale, scale);
    outlineMesh.renderOrder = 1;
    outlineMesh.frustumCulled = false;
    // rimuovi cast/recv shadow dall'outline
    outlineMesh.castShadow = false;
    outlineMesh.receiveShadow = false;
    group.add(outlineMesh);

    return group;
  }

  // --- HEAD ---
  function buildHead(state) {
    const group = new THREE.Group();
    group.name = 'slot-head';

    let geo;
    if (state.head === 'square') geo = new THREE.BoxGeometry(0.82, 0.92, 0.82);
    else if (state.head === 'oval') geo = new THREE.SphereGeometry(0.48, 32, 24);
    else geo = new THREE.SphereGeometry(0.5, 32, 24);

    const mesh = new THREE.Mesh(geo, materials.skin(state.skin));
    mesh.position.y = 1.12;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Jaw (mento) per forma più marcata
    const jawGeo = new THREE.SphereGeometry(0.34, 24, 16);
    const jaw = new THREE.Mesh(jawGeo, materials.skin(state.skin));
    jaw.position.set(0, 0.78, 0.22);
    jaw.scale.set(1, 0.75, 1.05);

    // Espressione: piccole deformazioni via scale
    if (state.expression === 'smile') {
      mesh.scale.y = 1.02;
    } else if (state.expression === 'serious') {
      mesh.scale.y = 0.98;
      mesh.scale.x = 1.03;
    }

    group.add(withOutline(mesh));
    group.add(jaw);
    return group;
  }

  // --- HAIR ---
  function buildHair(state) {
    const group = new THREE.Group();
    group.name = 'slot-hair';
    if (state.hair === 'none') return group;

    const mat = materials.hair(state.hairColor);

    if (state.hair === 'short') {
      const geo = new THREE.SphereGeometry(0.52, 24, 16);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = 1.3;
      m.scale.y = 0.45;
      group.add(withOutline(m));
    } else if (state.hair === 'long') {
      const geo = new THREE.CapsuleGeometry(0.54, 0.9, 4, 16);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = 1.0;
      m.rotation.z = 0.12;
      group.add(withOutline(m));
    } else if (state.hair === 'topknot') {
      // Chonmage: base sferica + nodo sopra
      const base = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat);
      base.position.y = 1.28;
      base.scale.y = 0.4;
      group.add(withOutline(base));

      const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12), mat);
      knot.position.y = 1.75;
      knot.rotation.x = Math.PI / 2;
      group.add(withOutline(knot));

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat);
      tip.position.y = 1.75;
      tip.position.z = 0.25;
      group.add(withOutline(tip));
    }
    return group;
  }

  // --- HELMET (Kabuto) ---
  function buildHelmet(state) {
    const group = new THREE.Group();
    group.name = 'slot-helmet';
    if (state.helmet === 'none') return group;

    const lacq = materials.lacquer(state.lacquerColor || state.armorColor);
    const met = materials.metal(state.metalColor);

    if (state.helmet === 'kabuto') {
      // Bowl (hachi)
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.56, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lacq);
      bowl.position.y = 1.45;
      bowl.scale.set(1, 0.85, 1);
      group.add(withOutline(bowl, 1.06));

      // Shikoro (protezione collo, strati tessuto)
      for (let i = 0; i < 3; i++) {
        const layer = new THREE.Mesh(new THREE.SphereGeometry(0.6 + i * 0.05, 24, 12, 0, Math.PI * 2, Math.PI / 3, Math.PI / 2), materials.fabric(state.fabricColor));
        layer.position.y = 1.25 - i * 0.06;
        layer.position.z = -0.15 - i * 0.04;
        layer.scale.set(1, 0.6, 1);
        group.add(layer);
      }

      // Maedate (decoro frontale) - semplice corno stilizzato
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 8), met);
      hornL.position.set(-0.18, 1.85, 0.42);
      hornL.rotation.x = -0.4;
      group.add(withOutline(hornL, 1.08));

      const hornR = hornL.clone();
      hornR.position.x = 0.18;
      hornR.rotation.x = -0.4;
      group.add(withOutline(hornR, 1.08));

      // Tehen (cima)
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 12), met);
      top.position.y = 1.95;
      group.add(withOutline(top, 1.08));
    } else if (state.helmet === 'mempo') {
      // Maschera facciale (Mempo) - copre la faccia inferiore
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.22), lacq);
      mask.position.set(0, 1.02, 0.48);
      group.add(withOutline(mask, 1.05));

      // Baffi/baffi sotto maschera
      const stache = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.04), met);
      stache.position.set(0, 0.92, 0.52);
      group.add(withOutline(stache, 1.1));
    }
    return group;
  }

  // --- ARMOR TORSO (Do + Sode) ---
  function buildArmor(state) {
    const group = new THREE.Group();
    group.name = 'slot-armor';
    if (state.armor === 'none') return group;

    const lacq = materials.lacquer(state.lacquerColor || state.armorColor);
    const fab = materials.fabric(state.fabricColor);
    const met = materials.metal(state.metalColor);

    const doType = state.armor.replace('do_', '');

    // Pettorale (Do) - forma a petto arrotondato
    const doGeo = new THREE.CylinderGeometry(0.42, 0.34, 0.75, 24);
    const doMesh = new THREE.Mesh(doGeo, lacq);
    doMesh.position.y = 0.45;
    doMesh.rotation.x = Math.PI / 2;
    group.add(withOutline(doMesh, 1.05));

    // Cordini Odoshi (strisce tessuto verticali sul davanti)
    const odoshiGeo = new THREE.BoxGeometry(0.04, 0.7, 0.26);
    for (let i = -1; i <= 1; i += 1) {
      const od = new THREE.Mesh(odoshiGeo, fab);
      od.position.set(i * 0.16, 0.45, 0.42);
      od.rotation.x = Math.PI / 2;
      group.add(od);
    }

    // Spalle (Sode) - grandi placche sulle spalle
    const sodeGeo = new THREE.SphereGeometry(0.3, 20, 12);
    const sodeL = new THREE.Mesh(sodeGeo, lacq);
    sodeL.position.set(-0.62, 0.85, 0.1);
    sodeL.scale.set(1, 0.7, 0.85);
    group.add(withOutline(sodeL, 1.06));

    const sodeR = sodeL.clone();
    sodeR.position.x = 0.62;
    group.add(withOutline(sodeR, 1.06));

    // Piastre spalle (kappa) - dettagli metallici
    const kappaL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 12), met);
    kappaL.position.set(-0.72, 0.88, 0.05);
    kappaL.rotation.z = Math.PI / 4;
    group.add(withOutline(kappaL, 1.08));

    const kappaR = kappaL.clone();
    kappaR.position.x = 0.72;
    kappaR.rotation.z = -Math.PI / 4;
    group.add(withOutline(kappaR, 1.08));

    // Fondo corazza (kusazari - strisce inferiori)
    for (let i = 0; i < 4; i++) {
      const kus = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.22), fab);
      kus.position.set(-0.28 + i * 0.14, 0.0, 0.42);
      group.add(kus);
    }

    return group;
  }

  // --- FACE ACCESSORIES ---
  function buildFace(state) {
    const group = new THREE.Group();
    group.name = 'slot-face';
    if (state.face === 'none') return group;

    const lacq = materials.lacquer(state.lacquerColor || state.armorColor);
    const met = materials.metal(state.metalColor);

    if (state.face === 'mask_oni') {
      // Maschera Oni rossa/nera che copre il volto
      const maskGeo = new THREE.BoxGeometry(0.84, 0.7, 0.3);
      const mask = new THREE.Mesh(maskGeo, lacq);
      mask.position.set(0, 1.05, 0.5);
      group.add(withOutline(mask, 1.05));

      // Corna della maschera
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), met);
      hornL.position.set(-0.22, 1.38, 0.58);
      hornL.rotation.x = -0.3;
      group.add(withOutline(hornL, 1.08));

      const hornR = hornL.clone();
      hornR.position.x = 0.22;
      group.add(withOutline(hornR, 1.08));

      // Denti visibili
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xf5f5f5 }));
      teeth.position.set(0, 0.85, 0.56);
      group.add(teeth);
    } else if (state.face === 'scar') {
      // Cicatrice sull'occhio (linea)
      const scarGeo = new THREE.BoxGeometry(0.18, 0.02, 0.02);
      const scar = new THREE.Mesh(scarGeo, new THREE.MeshBasicMaterial({ color: 0x8b0000 }));
      scar.position.set(-0.25, 1.18, 0.46);
      scar.rotation.z = 0.4;
      group.add(scar);
    } else if (state.face === 'bandage') {
      // Bende attorno alla testa
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 32), fab);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = 1.35;
      group.add(wrap);
    }
    return group;
  }

  // --- WEAPONRY ---
  function buildWeapon(state) {
    const group = new THREE.Group();
    group.name = 'slot-weapon';
    if (state.weapon === 'none') return group;

    const met = materials.metal(state.metalColor);
    const fab = materials.fabric(state.fabricColor);

    if (state.weapon === 'katana_back') {
      // Lama sulla schiena
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.03), met);
      blade.position.set(-0.35, 0.4, 0.55);
      blade.rotation.y = 0.2;
      group.add(withOutline(blade, 1.04));

      const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), lacq);
      tsuka.position.set(-0.35, -0.05, 0.6);
      tsuka.rotation.y = 0.2;
      group.add(withOutline(tsuka, 1.05));

      const saya = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.95, 12), lacq);
      saya.position.set(-0.38, 0.55, 0.45);
      saya.rotation.y = 0.2;
      group.add(saya);
    } else if (state.weapon === 'wakizashi_side') {
      // Corta al fianco
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.025), met);
      blade.position.set(0.5, 0.15, 0.05);
      group.add(withOutline(blade, 1.04));

      const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), lacq);
      tsuka.position.set(0.5, -0.1, 0.05);
      group.add(withOutline(tsuka, 1.05));
    }
    return group;
  }

  // Costruisce tutti gli slot dallo stato corrente
  function buildAll(state) {
    const parts = {
      head: buildHead(state),
      hair: buildHair(state),
      helmet: buildHelmet(state),
      armor: buildArmor(state),
      face: buildFace(state),
      weapon: buildWeapon(state),
    };
    return parts;
  }

  // Aggiorna uno slot esistente (ricostruisce per semplicità, dato che le primitive sono leggere)
  function updateSlot(name, state, container) {
    if (!container) return;
    const existing = container.getObjectByName(`slot-${name}`);
    if (existing) container.remove(existing);
    const built = {
      head: buildHead,
      hair: buildHair,
      helmet: buildHelmet,
      armor: buildArmor,
      face: buildFace,
      weapon: buildWeapon,
    }[name](state);
    container.add(built);
  }

  return { buildAll, updateSlot, withOutline };
})();

export { slots };
