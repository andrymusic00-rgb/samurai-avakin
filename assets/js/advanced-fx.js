const SHADERS = (() => {
  const canvas = document.createElement("canvas");
  canvas.id = "shaderCanvas";
  canvas.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0.15";
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) { canvas.remove(); return { init: () => {}, resize: () => {}, setUniform: () => {} }; }

  const vertexSrc = `#version 300 es
    precision highp float;
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 outColor;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform float u_intensity;
    uniform int u_mode;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform vec3 u_colorC;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5; vec2 shift = vec2(100.0);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.0 + shift; a *= 0.5; }
      return v;
    }

    vec3 palette(float t, vec3 a, vec3 b, vec3 c) {
      return a + b * cos(6.28318 * (c * t + vec3(0.0, 0.33, 0.67)));
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      vec2 m = (u_mouse - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * 0.1;

      vec3 col = vec3(0.0);

      if (u_mode == 0) {
        float n = fbm(uv * 3.0 + vec2(t * 0.3, t * 0.2));
        n = smoothstep(0.3, 0.7, n);
        col = mix(u_colorA, u_colorB, n) * u_intensity;
        float ring = sin(length(uv - m) * 20.0 - t * 5.0) * 0.5 + 0.5;
        col += u_colorC * ring * 0.3 * u_intensity * smoothstep(1.0, 0.3, length(uv - m));
      } else if (u_mode == 1) {
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        float n = fbm(vec2(radius * 8.0, angle * 4.0 + t));
        col = palette(n + t * 0.2, u_colorA, u_colorB, u_colorC) * u_intensity;
      } else if (u_mode == 2) {
        vec2 p = uv * 10.0;
        float n = fbm(p + vec2(t * 0.5, t * 0.3));
        float n2 = fbm(p * 2.0 - vec2(t * 0.3, t * 0.5));
        col = mix(u_colorA, u_colorB, smoothstep(0.4, 0.6, n)) * u_intensity;
        col += u_colorC * smoothstep(0.7, 0.9, n2) * u_intensity * 0.5;
      } else {
        float d = length(uv - m);
        float wave = sin(d * 40.0 - t * 8.0) * exp(-d * 3.0);
        col = u_colorA * wave * u_intensity;
        float n = fbm(uv * 5.0 + vec2(t * 0.4, 0.0));
        col += mix(u_colorB, u_colorC, n) * u_intensity * 0.3;
      }

      float vignette = 1.0 - smoothstep(0.5, 1.2, length(uv));
      outColor = vec4(col * vignette, col.r * 0.3);
    }
  `;

  function compile(src, type) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const vs = compile(vertexSrc, gl.VERTEX_SHADER);
  const fs = compile(fragmentSrc, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return { init: () => {}, resize: () => {}, setUniform: () => {} };

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return { init: () => {}, resize: () => {}, setUniform: () => {} };
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    time: gl.getUniformLocation(program, "u_time"),
    resolution: gl.getUniformLocation(program, "u_resolution"),
    mouse: gl.getUniformLocation(program, "u_mouse"),
    intensity: gl.getUniformLocation(program, "u_intensity"),
    mode: gl.getUniformLocation(program, "u_mode"),
    colorA: gl.getUniformLocation(program, "u_colorA"),
    colorB: gl.getUniformLocation(program, "u_colorB"),
    colorC: gl.getUniformLocation(program, "u_colorC")
  };

  let mode = 0, intensity = 1, mouse = [0, 0], startTime = performance.now();
  const seasonColors = {
    spring: { a: [0.75, 0.52, 0.96], b: [0.85, 0.71, 0.97], c: [0.91, 0.84, 1.0] },
    summer: { a: [1.0, 0.62, 0.0], b: [0.97, 0.85, 0.58], c: [1.0, 0.93, 0.78] },
    autumn: { a: [0.66, 0.52, 0.36], b: [0.83, 0.45, 0.28], c: [1.0, 0.6, 0.0] },
    winter: { a: [0.37, 0.56, 0.97], b: [0.58, 0.72, 0.97], c: [0.79, 0.89, 1.0] }
  };

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function updateColors() {
    const season = document.body.className.match(/season-(\w+)/)?.[1] || "spring";
    const c = seasonColors[season] || seasonColors.spring;
    gl.uniform3fv(uniforms.colorA, c.a);
    gl.uniform3fv(uniforms.colorB, c.b);
    gl.uniform3fv(uniforms.colorC, c.c);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  }

  function render() {
    const t = (performance.now() - startTime) * 0.001;
    gl.useProgram(program);
    gl.uniform1f(uniforms.time, t);
    gl.uniform2f(uniforms.mouse, mouse[0] * (canvas.width / window.innerWidth), mouse[1] * (canvas.height / window.innerHeight));
    gl.uniform1f(uniforms.intensity, intensity);
    gl.uniform1i(uniforms.mode, mode);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  let rafId = null;
  function loop() {
    render();
    rafId = requestAnimationFrame(loop);
  }

  function setMouse(x, y) { mouse = [x, y]; }

  function setMode(m) { mode = m; updateColors(); }

  function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); canvas.style.opacity = 0.1 + v * 0.2; }

  window.addEventListener("pointermove", (e) => setMouse(e.clientX, e.clientY), { passive: true });
  window.addEventListener("resize", resize, { passive: true });

  const observer = new MutationObserver(() => { updateColors(); });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  return {
    init: () => { resize(); updateColors(); gl.useProgram(program); loop(); },
    resize,
    setMode,
    setIntensity,
    setMouse,
    get canvas() { return canvas; },
    get gl() { return gl; }
  };
})();

const MICRO = (() => {
  let magneticElements = new WeakMap();
  let tiltElements = new WeakMap();

  function magnetic(el, strength = 0.3) {
    if (magneticElements.has(el)) return;
    let bounds = el.getBoundingClientRect();
    const updateBounds = () => bounds = el.getBoundingClientRect();
    const onMove = (e) => {
      const cx = bounds.left + bounds.width / 2;
      const cy = bounds.top + bounds.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      el.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;
      el.style.transition = "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)";
    };
    const onLeave = () => {
      el.style.transform = "translate(0, 0) scale(1)";
      el.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", updateBounds, { passive: true });
    magneticElements.set(el, { onMove, onLeave, updateBounds });
  }

  function tilt(el, maxAngle = 8) {
    if (tiltElements.has(el)) return;
    let bounds = el.getBoundingClientRect();
    const updateBounds = () => bounds = el.getBoundingClientRect();
    const onMove = (e) => {
      const cx = bounds.left + bounds.width / 2;
      const cy = bounds.top + bounds.height / 2;
      const dx = (e.clientX - cx) / (bounds.width / 2);
      const dy = (e.clientY - cy) / (bounds.height / 2);
      const rx = -dy * maxAngle;
      const ry = dx * maxAngle;
      el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.02, 1.02, 1.02)`;
      el.style.transition = "transform 0.08s linear";
      el.style.boxShadow = `${12 + Math.abs(ry) * 2}px ${12 + Math.abs(rx) * 2}px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(192,132,252,0.2)`;
    };
    const onLeave = () => {
      el.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)";
      el.style.transition = "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.boxShadow = "";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", updateBounds, { passive: true });
    tiltElements.set(el, { onMove, onLeave, updateBounds });
  }

  function ripple(el, color = "rgba(192,132,252,0.4)") {
    el.addEventListener("pointerdown", (e) => {
      const r = el.getBoundingClientRect();
      const circle = document.createElement("span");
      circle.style.cssText = `
        position:absolute;border-radius:50%;transform:scale(0);
        background:${color};pointer-events:none;z-index:10;
        width:${Math.max(r.width, r.height)}px;height:${Math.max(r.width, r.height)}px;
        left:${e.clientX - r.left - Math.max(r.width, r.height)/2}px;
        top:${e.clientY - r.top - Math.max(r.width, r.height)/2}px;
        animation:rippleAnim 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
      `;
      el.style.position = "relative";
      el.style.overflow = "hidden";
      el.appendChild(circle);
      circle.addEventListener("animationend", () => circle.remove());
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    @keyframes rippleAnim { to { transform:scale(2.5); opacity:0; } }
    .magnetic { cursor: pointer; }
    .tilt-card { transform-style: preserve-3d; }
  `;
  document.head.appendChild(style);

  function initAll() {
    document.querySelectorAll("[data-magnetic]").forEach(el => magnetic(el, +el.dataset.magnetic || 0.3));
    document.querySelectorAll("[data-tilt]").forEach(el => tilt(el, +el.dataset.tilt || 8));
    document.querySelectorAll("[data-ripple]").forEach(el => ripple(el, el.dataset.ripple));
  }

  return { magnetic, tilt, ripple, initAll };
})();

const PARALLAX = (() => {
  const layers = [];
  function add(el, speed = 0.15) {
    layers.push({ el, speed, initialY: 0 });
    el.style.willChange = "transform";
  }
  function remove(el) {
    const i = layers.findIndex(l => l.el === el);
    if (i > -1) layers.splice(i, 1);
  }
  function update() {
    const scrollY = window.scrollY;
    for (const l of layers) {
      const rect = l.el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const viewportCenter = window.innerHeight / 2;
      const dist = (centerY - viewportCenter) / viewportCenter;
      const y = dist * l.speed * window.innerHeight * 0.3;
      l.el.style.transform = `translate3d(0, ${y}px, 0)`;
    }
  }
  let raf = null;
  function start() { if (raf) return; raf = requestAnimationFrame(function loop() { update(); raf = requestAnimationFrame(loop); }); }
  function stop() { cancelAnimationFrame(raf); raf = null; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.addEventListener("scroll", () => {}, { passive: true });
  return { add, remove, start, stop };
})();

const TRANSITIONS = (() => {
  let currentView = null;
  const sharedElements = new Map();

  function registerShared(fromEl, toSelector, viewId) {
    sharedElements.set(viewId, { fromEl, toSelector });
  }

  function animateViewChange(fromView, toView) {
    return new Promise(resolve => {
      const from = document.getElementById(fromView);
      const to = document.getElementById(toView);
      if (!from || !to) { resolve(); return; }

      const shared = sharedElements.get(toView.replace("view-", ""));
      if (shared) {
        const toEl = to.querySelector(shared.toSelector);
        if (toEl && shared.fromEl) {
          const fromRect = shared.fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();
          const dx = fromRect.left - toRect.left;
          const dy = fromRect.top - toRect.top;
          const sx = fromRect.width / toRect.width;
          const sy = fromRect.height / toRect.height;

          toEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
          toEl.style.opacity = "0";
          toEl.style.transition = "none";
          toEl.offsetHeight;
          toEl.style.transition = "transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.4s cubic-bezier(0.16,1,0.3,1)";
          toEl.style.transform = "none";
          toEl.style.opacity = "1";

          setTimeout(() => { toEl.style.transition = ""; toEl.style.transform = ""; resolve(); }, 500);
          return;
        }
      }

      from.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      from.style.opacity = "0";
      from.style.transform = "translateY(-20px)";
      setTimeout(() => {
        from.style.display = "none";
        from.style.transition = "";
        to.style.display = "block";
        to.style.opacity = "0";
        to.style.transform = "translateY(20px)";
        to.offsetHeight;
        to.style.transition = "opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)";
        to.style.opacity = "1";
        to.style.transform = "none";
        setTimeout(() => { to.style.transition = ""; to.style.transform = ""; resolve(); }, 400);
      }, 300);
    });
  }

  return { registerShared, animateViewChange };
})();

const PERF = (() => {
  let frameTimes = [], lastFrame = performance.now(), fps = 60;
  let qualityLevel = 1;
  const thresholds = { high: 55, medium: 40, low: 25 };
  let callbacks = [];

  function tick(now) {
    const dt = now - lastFrame;
    lastFrame = now;
    frameTimes.push(dt);
    if (frameTimes.length > 60) frameTimes.shift();
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    fps = 1000 / avg;

    if (fps < thresholds.low && qualityLevel > 0.4) {
      qualityLevel = Math.max(0.4, qualityLevel - 0.15);
      notify();
    } else if (fps < thresholds.medium && qualityLevel > 0.6) {
      qualityLevel = Math.max(0.6, qualityLevel - 0.1);
      notify();
    } else if (fps > thresholds.high && qualityLevel < 1) {
      qualityLevel = Math.min(1, qualityLevel + 0.05);
      notify();
    }
    requestAnimationFrame(tick);
  }

  function notify() {
    callbacks.forEach(cb => cb(qualityLevel, fps));
    if (FX.setQuality) FX.setQuality(qualityLevel);
  }

  function onQualityChange(cb) { callbacks.push(cb); return () => { callbacks = callbacks.filter(c => c !== cb); }; }

  requestAnimationFrame(tick);
  return { get fps() { return Math.round(fps); }, get quality() { return qualityLevel; }, onQualityChange };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    SHADERS.init();
    MICRO.initAll();
  });
} else {
  SHADERS.init();
  MICRO.initAll();
}