const FX = (() => {
  const cv = document.getElementById("fxCanvas");
  const ctx = cv.getContext("2d", { alpha: true, desynchronized: true });
  let W = 0, H = 0, DPR = 1;
  let blobs = [], motes = [], petals = [], streaks = [], ripples = [];
  let raf = null, running = false, t = 0, last = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, down: false };
  const opts = { motion: true, petals: true, grain: true, quality: 1 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;

  const BLUE = ["#0F172A", "#172554", "#1D4ED8", "#3B82F6", "#93C5FD", "#CBE4F9"];
  const SILVER = ["#EAE5D9", "#F4F2EC", "#C8C4B7", "#A6A194", "#525662"];
  const PURPLE = ["#E9D5FF", "#D8B4FE", "#C084FC", "#A855F7", "#9333EA", "#7E22CE"];
  const WOOD = ["#D4B28C", "#A8835C", "#4A3B32", "#29211C"];
  const ACCENT = ["#F59E0B", "#EF4444"];

  const seasonColors = {
    spring: { blobs: ["#C084FC", "#D8B4FE", "#E9D5FF", "#A855F7"], petals: ["#C084FC", "#D8B4FE", "#E9D5FF", "#A8835C"], motes: [...SILVER, ...WOOD], streaks: [...BLUE, ...PURPLE] },
    summer: { blobs: ["#F59E0B", "#D97706", "#EAE5D9", "#FDE68A"], petals: ["#F59E0B", "#D97706", "#EAE5D9"], motes: [...WOOD, "#FDE68A", "#FEF3C7"], streaks: ["#F59E0B", "#D97706", "#FDE68A"] },
    autumn: { blobs: ["#A8835C", "#D4B28C", "#DC2626", "#B91C1C"], petals: ["#A8835C", "#D4B28C", "#DC2626", "#B91C1C"], motes: [...WOOD, "#FDE68A", "#FEF3C7", "#FED7AA"], streaks: ["#A8835C", "#D4B28C", "#DC2626"] },
    winter: { blobs: ["#CBE4F9", "#93C5FD", "#3B82F6", "#60A5FA"], petals: ["#CBE4F9", "#93C5FD", "#3B82F6", "#E9D5FF"], motes: [...SILVER, ...BLUE], streaks: [...BLUE, "#CBE4F9", "#93C5FD"] }
  };

  const hexCache = new Map();
  function hexA(hex, a) {
    const key = hex + a.toFixed(3);
    if (hexCache.has(key)) return hexCache.get(key);
    const n = parseInt(hex.slice(1), 16);
    const out = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
    if (hexCache.size > 500) hexCache.clear();
    hexCache.set(key, out);
    return out;
  }

  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.floor(W * DPR);
    cv.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function build() {
    const area = (W * H) / 1000000;
    const season = document.body.className.match(/season-(\w+)/)?.[1] || "spring";
    const sc = seasonColors[season] || seasonColors.spring;

    const blobCount = Math.min(9, Math.max(5, Math.floor(7 * opts.quality)));
    blobs = Array.from({ length: blobCount }, (_, i) => ({
      x: rand(0, W), y: rand(0, H),
      r: rand(180, 480) * (W < 700 ? 0.8 : 1),
      vx: rand(-0.08, 0.08), vy: rand(-0.06, 0.06),
      c: pick(sc.blobs), a: rand(0.08, 0.3),
      ph: rand(0, TAU), sp: rand(0.00012, 0.0004)
    }));

    const moteCount = Math.round(80 * Math.max(0.5, area * 1.5) * opts.quality);
    motes = Array.from({ length: moteCount }, () => ({
      x: rand(0, W), y: rand(0, H),
      r: rand(0.4, 1.8), vy: rand(-0.2, -0.04), vx: rand(-0.1, 0.1),
      a: rand(0.12, 0.65), c: pick(sc.motes), ph: rand(0, TAU)
    }));

    const petalCount = Math.min(W < 700 ? 14 : 28, Math.floor(24 * opts.quality));
    petals = Array.from({ length: petalCount }, () => newPetal(true, sc));
  }

  function newPetal(init, sc) {
    return {
      x: rand(0, W),
      y: init ? rand(0, H) : rand(-60, -10),
      r: rand(3, 9),
      vy: rand(0.18, 0.6),
      sway: rand(0.3, 1.2), ph: rand(0, TAU),
      rot: rand(0, TAU), vr: rand(-0.01, 0.01),
      a: rand(0.08, 0.35), depth: rand(0.35, 1),
      c: pick(sc.petals)
    };
  }

  function addStreak() {
    const fromTop = Math.random() > 0.35;
    const season = document.body.className.match(/season-(\w+)/)?.[1] || "spring";
    const sc = seasonColors[season] || seasonColors.spring;
    streaks.push({
      x: fromTop ? rand(-W * 0.3, W * 1.3) : rand(-W * 0.3, W * 1.3),
      y: fromTop ? rand(-80, H * 0.4) : rand(H * 0.6, H + 80),
      len: rand(150, 550),
      ang: fromTop ? Math.PI / 3.1 : (-Math.PI / 3.1) + rand(-0.15, 0.15),
      life: 0, max: rand(0.6, 1.3),
      a: rand(0.3, 0.8), c: pick(sc.streaks)
    });
  }

  function burst(x, y) {
    const season = document.body.className.match(/season-(\w+)/)?.[1] || "spring";
    const sc = seasonColors[season] || seasonColors.spring;
    ripples.push({ x, y, r0: 6, r1: rand(150, 300), life: 0, max: 1 });
    for (let i = 0; i < 2; i++) addStreak();
    for (let i = 0; i < 5; i++) {
      motes.push({
        x, y, r: rand(1, 2.5), vy: rand(-0.8, 0.8), vx: rand(-0.8, 0.8),
        a: rand(0.35, 0.85), c: pick(sc.petals), ph: rand(0, TAU), life: 0, max: rand(0.5, 1)
      });
    }
  }

  function drawBlobs() {
    ctx.globalCompositeOperation = "lighter";
    for (const b of blobs) {
      const pulse = 1 + Math.sin(t * b.sp * 1000 + b.ph) * 0.15;
      const px = b.x + (pointer.x - W / 2) * 0.04;
      const py = b.y + (pointer.y - H / 2) * 0.04;
      const g = ctx.createRadialGradient(px, py, 0, px, py, b.r * pulse);
      g.addColorStop(0, hexA(b.c, b.a));
      g.addColorStop(0.4, hexA(b.c, b.a * 0.28));
      g.addColorStop(1, hexA(b.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, b.r * pulse, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawMotes(dt) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.y += m.vy * dt * 0.06;
      m.x += (m.vx + Math.sin(t * 0.0005 + m.ph) * 0.12) * dt * 0.06;
      if (m.y < -8) { m.y = H + 8; m.x = rand(0, W); }
      if (m.x < -10) m.x = W + 10;
      if (m.x > W + 10) m.x = -10;
      if (m.life !== undefined) {
        m.life += dt * 0.001;
        if (m.life >= m.max) { motes.splice(i, 1); continue; }
      }
      const tw = 0.5 + Math.sin(t * 0.0025 + m.ph) * 0.5;
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
      g.addColorStop(0, hexA(m.c, m.a * tw));
      g.addColorStop(1, hexA(m.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 4, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawPetals(dt) {
    if (!opts.petals) return;
    for (const p of petals) {
      p.y += p.vy * p.depth * dt * 0.06;
      p.ph += 0.015 * p.depth;
      p.x += Math.sin(p.ph) * p.sway;
      p.rot += p.vr;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) Object.assign(p, newPetal(false, seasonColors[document.body.className.match(/season-(\w+)/)?.[1] || "spring"] || seasonColors.spring));
      const sq = Math.abs(Math.cos(p.rot * 0.8));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.a * opts.quality;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.5 * (0.3 + sq * 0.7), 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = p.a * 0.4 * opts.quality;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 0.4, p.r * 0.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawStreaks(dt) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i];
      s.life += dt * 0.001;
      const k = s.life / s.max;
      if (k >= 1) { streaks.splice(i, 1); continue; }
      const ease = Math.sin(k * Math.PI);
      const dx = Math.cos(s.ang) * s.len * (0.35 + k * 0.65);
      const dy = Math.sin(s.ang) * s.len * (0.35 + k * 0.65);
      const g = ctx.createLinearGradient(s.x, s.y, s.x + dx, s.y + dy);
      g.addColorStop(0, hexA(s.c, 0));
      g.addColorStop(0.5, hexA(s.c, s.a * ease));
      g.addColorStop(1, hexA(s.c, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = rand(0.5, 1.5);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + dx, s.y + dy);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    if (streaks.length < 2 && Math.random() < 0.004 * opts.quality) addStreak();
  }

  function drawRipples(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.life += dt * 0.001;
      const k = rp.life / rp.max;
      if (k >= 1) { ripples.splice(i, 1); continue; }
      const rad = rp.r0 + (rp.r1 - rp.r0) * (1 - Math.pow(1 - k, 2));
      const season = document.body.className.match(/season-(\w+)/)?.[1] || "spring";
      const sc = seasonColors[season] || seasonColors.spring;
      ctx.strokeStyle = hexA(pick(sc.streaks), 0.45 * (1 - k));
      ctx.lineWidth = 2 * (1 - k) + 0.3;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rad, rad * 0.4, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = hexA(pick(sc.motes), 0.18 * (1 - k));
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rad * 0.55, rad * 0.24, 0, 0, TAU);
      ctx.stroke();
    }
  }

  let frameId = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(48, ts - last) || 16;
    last = ts;
    t += dt;
    ctx.clearRect(0, 0, W, H);

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;

    for (const b of blobs) {
      b.x += b.vx * dt * 0.045;
      b.y += b.vy * dt * 0.045;
      if (b.x < -b.r) b.x = W + b.r;
      if (b.x > W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = H + b.r;
      if (b.y > H + b.r) b.y = -b.r;
    }

    drawBlobs();
    drawMotes(dt);
    drawPetals(dt);
    drawStreaks(dt);
    drawRipples(dt);

    frameId = requestAnimationFrame(frame);
  }

  function play() {
    if (running || !opts.motion || reduce) return;
    running = true;
    last = performance.now();
    frameId = requestAnimationFrame(frame);
  }

  function pause() { running = false; cancelAnimationFrame(frameId); }

  function start() {
    size();
    window.addEventListener("resize", size, { passive: true });
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
    window.addEventListener("pointermove", (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * W;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * H;
    }, { passive: true });
    window.addEventListener("pointerdown", () => { pointer.down = true; }, { passive: true });
    window.addEventListener("pointerup", () => { pointer.down = false; }, { passive: true });
    play();
  }

  function setOption(key, val) {
    opts[key] = val;
    if (key === "motion") val ? play() : pause();
    if (key === "grain") document.querySelector(".fx-grain").style.opacity = val ? "" : "0";
    if (key === "quality") build();
  }

  function setQuality(q) {
    opts.quality = Math.max(0.3, Math.min(1, q));
    build();
  }

  return { start, pause, burst, setOption, setQuality, get running() { return running; }, get quality() { return opts.quality; } };
})();

document.addEventListener("pointerdown", (e) => FX.burst(e.clientX, e.clientY), { passive: true });