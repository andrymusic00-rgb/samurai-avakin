const FX = (() => {
  const cv = document.getElementById("fxCanvas");
  const ctx = cv.getContext("2d", { alpha: true });
  let W = 0, H = 0, DPR = 1;
  let blobs = [], motes = [], petals = [], streaks = [], ripples = [];
  let raf = null, running = false, t = 0, last = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const opts = { motion: true, petals: true, grain: true };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const BLUE = ["#0F172A", "#172554", "#1D4ED8", "#3B82F6", "#93C5FD", "#CBE4F9"];
  const SILVER = ["#EAE5D9", "#F4F2EC", "#C8C4B7", "#A6A194", "#525662"];
  const PURPLE = ["#E9D5FF", "#D8B4FE", "#C084FC", "#A855F7", "#9333EA", "#7E22CE"];
  const WOOD = ["#D4B28C", "#A8835C", "#4A3B32", "#29211C"];
  const ACCENT = ["#F59E0B", "#EF4444"];

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
  blobs = Array.from({ length: 9 }, (_, i) => ({
    x: rand(0, W), y: rand(0, H),
    r: rand(200, 520) * (W < 700 ? 0.8 : 1),
    vx: rand(-0.09, 0.09), vy: rand(-0.07, 0.07),
    c: pick([...BLUE, ...PURPLE]), a: rand(0.1, 0.35),
    ph: rand(0, TAU), sp: rand(0.00016, 0.00046)
  }));
  motes = Array.from({ length: Math.round(90 * Math.max(0.6, area * 2)) }, () => ({
    x: rand(0, W), y: rand(0, H),
    r: rand(0.5, 2.1), vy: rand(-0.24, -0.05), vx: rand(-0.12, 0.12),
    a: rand(0.14, 0.75), c: pick([...SILVER, ...WOOD]), ph: rand(0, TAU)
  }));
  petals = Array.from({ length: W < 700 ? 18 : 34 }, () => newPetal(true));
  }

  function newPetal(init) {
    const season = document.querySelector(".season-theme.active")?.dataset.season || "spring";
    const seasonColors = {
      spring: ["#FFFFFF", "#F4F2EC", "#E5E4E2", "#C0C0C0", "#5AA8FF", "#2563EB", "#D946EF", "#A855F7"],
      summer: ["#F59E0B", "#D97706", "#EAE5D9"],
      autumn: ["#A8835C", "#D4B28C", "#DC2626", "#B91C1C"],
      winter: ["#CBE4F9", "#93C5FD", "#3B82F6", "#E9D5FF"]
    };

    const colors = seasonColors[season] || seasonColors.spring;
    return {
      x: rand(0, W),
      y: init ? rand(0, H) : rand(-60, -10),
      r: rand(4, 10),
      vy: rand(0.22, 0.72),
      sway: rand(0.4, 1.4), ph: rand(0, TAU),
      rot: rand(0, TAU), vr: rand(-0.012, 0.012),
      a: rand(0.1, 0.42), depth: rand(0.4, 1),
      c: pick(colors)
    };
  }

  function addStreak() {
    const fromTop = Math.random() > 0.35;
    streaks.push({
      x: fromTop ? rand(-W * 0.3, W * 1.3) : rand(-W * 0.3, W * 1.3),
      y: fromTop ? rand(-80, H * 0.4) : rand(H * 0.6, H + 80),
      len: rand(180, 620),
      ang: fromTop ? Math.PI / 3.1 : (-Math.PI / 3.1) + rand(-0.2, 0.2),
      life: 0, max: rand(0.7, 1.5),
      a: rand(0.35, 0.9), c: pick([...BLUE, ...PURPLE])
    });
  }

  function burst(x, y) {
    const season = document.querySelector(".season-theme.active")?.dataset.season || "spring";
    const seasonColors = {
      spring: ["#C084FC", "#D8B4FE", "#E9D5FF"],
      summer: ["#F59E0B", "#D97706", "#EAE5D9"],
      autumn: ["#A8835C", "#D4B28C", "#DC2626"],
      winter: ["#CBE4F9", "#93C5FD", "#3B82F6"]
    };
    const colors = seasonColors[season] || seasonColors.spring;
    ripples.push({ x, y, r0: 8, r1: rand(180, 340), life: 0, max: 1.15 });
    for (let i = 0; i < 3; i++) addStreak();
    for (let i = 0; i < 6; i++) {
      motes.push({
        x, y, r: rand(1, 3), vy: rand(-1, 1), vx: rand(-1, 1),
        a: rand(0.4, 0.9), c: pick(colors), ph: rand(0, TAU), life: 0, max: rand(0.6, 1.2)
      });
    }
  }

  function drawBlobs() {
    ctx.globalCompositeOperation = "lighter";
    for (const b of blobs) {
      const pulse = 1 + Math.sin(t * b.sp * 1000 + b.ph) * 0.18;
      const px = b.x + (pointer.x - W / 2) * 0.045;
      const py = b.y + (pointer.y - H / 2) * 0.045;
      const g = ctx.createRadialGradient(px, py, 0, px, py, b.r * pulse);
      g.addColorStop(0, hexA(b.c, b.a));
      g.addColorStop(0.45, hexA(b.c, b.a * 0.32));
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
    for (const m of motes) {
      m.y += m.vy * dt;
      m.x += (m.vx + Math.sin(t * 0.0006 + m.ph) * 0.16) * dt;
      if (m.y < -8) { m.y = H + 8; m.x = rand(0, W); }
      if (m.x < -10) m.x = W + 10;
      if (m.x > W + 10) m.x = -10;
      const tw = 0.55 + Math.sin(t * 0.003 + m.ph) * 0.45;
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 5);
      g.addColorStop(0, hexA(m.c, m.a * tw));
      g.addColorStop(1, hexA(m.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 5, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawPetals(dt) {
    for (const p of petals) {
      p.y += p.vy * p.depth * dt;
      p.ph += 0.02 * p.depth;
      p.x += Math.sin(p.ph) * p.sway;
      p.rot += p.vr;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) Object.assign(p, newPetal(false));
      const sq = Math.abs(Math.cos(p.rot * 0.8));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.a;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.52 * (0.35 + sq * 0.65), 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = p.a * 0.5;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 0.45, p.r * 0.22, 0, 0, TAU);
    ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawStreaks(dt) {
    ctx.globalCompositeOperation = "lighter";
    for (const s of streaks) {
      s.life += dt;
      const k = s.life / s.max;
      if (k >= 1) continue;
      const ease = Math.sin(k * Math.PI);
      const dx = Math.cos(s.ang) * s.len * (0.4 + k);
      const dy = Math.sin(s.ang) * s.len * (0.4 + k);
      const g = ctx.createLinearGradient(s.x, s.y, s.x + dx, s.y + dy);
      g.addColorStop(0, hexA(s.c, 0));
      g.addColorStop(0.55, hexA(s.c, s.a * ease));
      g.addColorStop(1, hexA(s.c, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = rand(0.6, 1.8);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + dx, s.y + dy);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    streaks = streaks.filter((s) => s.life < s.max);
  }

  function drawRipples(dt) {
    for (const rp of ripples) {
      rp.life += dt;
      const k = rp.life / rp.max;
      if (k >= 1) continue;
      const rad = rp.r0 + (rp.r1 - rp.r0) * (1 - Math.pow(1 - k, 2.2));
      ctx.strokeStyle = hexA(pick([...BLUE, ...PURPLE]), 0.5 * (1 - k));
      ctx.lineWidth = 2.2 * (1 - k) + 0.4;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rad, rad * 0.42, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = hexA(pick([...SILVER]), 0.22 * (1 - k));
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rad * 0.62, rad * 0.26, 0, 0, TAU);
      ctx.stroke();
    }
    ripples = ripples.filter((r) => r.life < r.max);
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(48, ts - last) || 16;
    last = ts;
    t += dt;
    ctx.clearRect(0, 0, W, H);

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    for (const b of blobs) {
      b.x += b.vx * dt * 0.05;
      b.y += b.vy * dt * 0.05;
      if (b.x < -b.r) b.x = W + b.r;
      if (b.x > W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = H + b.r;
      if (b.y > H + b.r) b.y = -b.r;
    }

    drawBlobs();
    drawMotes(dt);
    if (opts.petals) drawPetals(dt);
    drawStreaks(dt);
    drawRipples(dt);

    if (streaks.length < 3 && Math.random() < 0.006) addStreak();

    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (running || !opts.motion || reduce) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() { running = false; cancelAnimationFrame(raf); }

  function start() {
    size();
    window.addEventListener("resize", size, { passive: true });
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
    window.addEventListener("pointermove", (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * W;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * H;
    }, { passive: true });
    play();
  }

  function burst(x, y) {
    const season = document.querySelector(".season-theme.active")?.dataset.season || "spring";
    const seasonColors = {
      spring: ["#C084FC", "#D8B4FE", "#E9D5FF"],
      summer: ["#F59E0B", "#D97706", "#EAE5D9"],
      autumn: ["#A8835C", "#D4B28C", "#DC2626"],
      winter: ["#CBE4F9", "#93C5FD", "#3B82F6"]
    };
    const colors = seasonColors[season] || seasonColors.spring;
    ripples.push({ x, y, r0: 8, r1: rand(180, 340), life: 0, max: 1.15 });
    for (let i = 0; i < 3; i++) addStreak();
    for (let i = 0; i < 6; i++) {
      motes.push({
        x, y, r: rand(1, 3), vy: rand(-1, 1), vx: rand(-1, 1),
        a: rand(0.4, 0.9), c: pick(colors), ph: rand(0, TAU), life: 0, max: rand(0.6, 1.2)
      });
    }
  }

  function setOption(key, val) {
    opts[key] = val;
    if (key === "motion") val ? play() : pause();
    if (key === "grain") document.querySelector(".fx-grain").style.opacity = val ? "" : "0";
  }

  return { start, pause, burst, setOption, get running() { return running; } };
})();

document.addEventListener("pointerdown", (e) => FX.burst(e.clientX, e.clientY), { passive: true });
