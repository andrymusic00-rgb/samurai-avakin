import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const Avatar3DAdvanced = (() => {
  let scene, camera, renderer, container;
  let headMesh, bodyMesh, hairMesh, leftEye, rightEye, nose, mouth, ears;
  let baseImage = null;
  let animId = 0;
  let analysis = null;

  const defaultAnalysis = {
    skinColor: '#ffe0bd',
    hairColor: '#2b1d0e',
    hairStyle: 'short',
    headWidth: 1.0,
    headHeight: 1.0,
    headDepth: 1.0,
    jawWidth: 0.9,
    cheek: 0.1,
    eyeDistance: 0.28,
    eyeSize: 0.12,
    noseHeight: 0.08,
    noseWidth: 0.12,
    mouthWidth: 0.16,
    mouthHeight: 0.04,
    earSize: 0.14,
    hasBeard: false,
    hasGlasses: false,
    gender: 'neutral'
  };

  async function analyzeImage(img) {
    if (!img) return { ...defaultAnalysis };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 128;
    canvas.width = size; canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r=0,g=0,b=0,count=0;
    for (let i=0; i<data.length; i+=4) {
      const a=data[i+3];
      if(a>128) {
        r+=data[i]; g+=data[i+1]; b+=data[i+2]; count++;
      }
    }
    let skinColor = defaultAnalysis.skinColor;
    if(count>0) {
      r=Math.floor(r/count); g=Math.floor(g/count); b=Math.floor(b/count);
      skinColor = rgbToHex(r,g,b);
    }
    const analysis = { ...defaultAnalysis, skinColor };
    baseImage = img;
    return analysis;
  }

  function rgbToHex(r,g,b) {
    return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  function init(el) {
    container = el;
    if (!container) return;
    const w = 400, h = 400;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1f);
    camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 1000);
    camera.position.set(0, 0.9, 3.8);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x0f1428, 2.2);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0x9fc3ff, 1.2);
    dir.position.set(4,5,3);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffe7b3, 0.4);
    dir2.position.set(-3,4,2);
    scene.add(dir2);
    renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setSize(w,h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    container.innerHTML='';
    container.appendChild(renderer.domElement);
    if(!analysis) analysis={...defaultAnalysis};
    build();
    animate();
  }

  function build() {
    if(!scene) return;
    // clear except lights
    scene.children.filter(c=>!(c instanceof THREE.Light)).forEach(c=>scene.remove(c));
    const skinMat = new THREE.MeshPhysicalMaterial({color: analysis.skinColor, roughness:0.5, metalness:0, transmission:0});
    const hairMat = new THREE.MeshLambertMaterial({color: analysis.hairColor});
    const eyeMat = new THREE.MeshPhongMaterial({color:0x111111, emissive:0x000000});
    const whiteMat = new THREE.MeshPhongMaterial({color:0xf7f7fa});
    const lipMat = new THREE.MeshLambertMaterial({color:'#d9a399'});

    const hw=analysis.headWidth, hh=analysis.headHeight, hd=analysis.headDepth;
    const headGeo = new THREE.SphereGeometry(0.5*hw, 32, 24);
    headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.scale.y = hh/hw;
    headMesh.scale.z = hd/hw;
    headMesh.position.y = 1.1;
    scene.add(headMesh);

    const earGeo = new THREE.SphereGeometry(0.08*analysis.earSize*6, 16, 12);
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-0.5*hw-0.02, 1.1, 0);
    earL.scale.set(0.6,1,0.3);
    const earR = earL.clone();
    earR.position.x = 0.5*hw+0.02;
    scene.add(earL); scene.add(earR);

    const jawGeo = new THREE.SphereGeometry(0.32*analysis.jawWidth, 24, 16);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.y = 0.85;
    jaw.scale.y = 0.8;
    scene.add(jaw);

    const noseGeo = new THREE.ConeGeometry(analysis.noseWidth*0.3, analysis.noseHeight*1.2, 8);
    nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = Math.PI/2;
    nose.position.set(0,1.05,0.52*hd);
    scene.add(nose);

    const eyeGeo = new THREE.SphereGeometry(analysis.eyeSize*0.5, 12, 10);
    leftEye = new THREE.Mesh(eyeGeo, whiteMat);
    leftEye.position.set(-analysis.eyeDistance*0.6, 1.15, 0.48*hd);
    rightEye = leftEye.clone();
    rightEye.position.x = analysis.eyeDistance*0.6;
    scene.add(leftEye); scene.add(rightEye);
    const pupilGeo = new THREE.SphereGeometry(analysis.eyeSize*0.22, 8, 6);
    const pupil = new THREE.Mesh(pupilGeo, eyeMat);
    pupil.position.z = 0.008;
    const lp = pupil.clone(); lp.position.copy(leftEye.position); lp.position.z += 0.04;
    const rp = lp.clone(); rp.position.x = rightEye.position.x;
    scene.add(lp); scene.add(rp);

    const mouthGeo = new THREE.BoxGeometry(analysis.mouthWidth*0.8, analysis.mouthHeight*0.6, 0.02);
    mouth = new THREE.Mesh(mouthGeo, lipMat);
    mouth.position.set(0,0.95,0.48*hd);
    scene.add(mouth);

    const hairGeo = analysis.hairStyle==='long' ? new THREE.CapsuleGeometry(0.54*hw, 0.8, 4, 16) : new THREE.SphereGeometry(0.5*hw, 20, 14);
    hairMesh = new THREE.Mesh(hairGeo, hairMat);
    if(analysis.hairStyle==='spiky') {
      hairMesh.geometry = new THREE.ConeGeometry(0.48*hw, 0.9, 10);
      hairMesh.position.y = 1.6;
    } else if(analysis.hairStyle==='long') {
      hairMesh.position.y = 1.0;
      hairMesh.rotation.z = 0.12;
    } else {
      hairMesh.position.y = 1.3;
      hairMesh.scale.y = 0.45;
    }
    scene.add(hairMesh);

    const bodyGeo = new THREE.CapsuleGeometry(0.36, 1.25, 4, 16);
    bodyMesh = new THREE.Mesh(bodyGeo, skinMat);
    bodyMesh.position.y = 0.0;
    scene.add(bodyMesh);

    const neckGeo = new THREE.CylinderGeometry(0.18,0.18,0.22,12);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y=0.62;
    scene.add(neck);
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    if(renderer && scene && camera) {
      if(headMesh) headMesh.rotation.y += 0.0018;
      renderer.render(scene,camera);
    }
  }

  function setAnalysis(a) {
    analysis = { ...defaultAnalysis, ...(a||{}) };
    build();
  }

  function fromImage(img) {
    return analyzeImage(img).then(a=>{ setAnalysis(a); return a; });
  }

  function getAnalysis() { return {...analysis}; }

  function exportGLB(cb) {
    if(!renderer||!scene) return;
    const exp = new GLTFExporter();
    exp.parse(scene, (gltf)=>{
      try{
        const blob = new Blob([gltf], {type:'model/gltf-binary'});
        const url = URL.createObjectURL(blob);
        if(cb) cb(url);
      }catch(e){ if(cb) cb(null); }
    }, (err)=>{ console.warn(err); if(cb) cb(null); }, {binary:true});
  }

  return { init, fromImage, setAnalysis, getAnalysis, exportGLB, analyzeImage };
})();

if(typeof window !== 'undefined') window.Avatar3DAdvanced = Avatar3DAdvanced;
export { Avatar3DAdvanced };
