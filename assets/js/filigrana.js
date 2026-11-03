const FILIGRANA = (() => {
  const canvas = document.createElement("canvas");
  canvas.id = "filigranaCanvas";
  canvas.style.cssText = "position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.04;mix-blend-mode:overlay";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) { canvas.remove(); return { init: () => {}, resize: () => {}, setSection: () => {} }; }

  const patterns = {
    home: { type: "seigaiha", color: "#c084fc", scale: 120 },
    "chi-siamo": { type: "asanoha", color: "#a855f7", scale: 100 },
    eventi: { type: "kikkou", color: "#f59e0b", scale: 90 },
    gallery: { type: "shippo", color: "#3b82f6", scale: 110 },
    video: { type: "yagasuri", color: "#ec4899", scale: 80 },
    blog: { type: "seigaiha", color: "#8b5cf6", scale: 100 },
    classifica: { type: "asanoha", color: "#f59e0b", scale: 90 },
    comando: { type: "kikkou", color: "#a855f7", scale: 80 },
    account: { type: "yagasuri", color: "#3b82f6", scale: 100 }
  };

  let currentPattern = "home";
  let time = 0;
  let rafId = null;
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function drawSeigaiha(color, scale, offset) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const rows = Math.ceil(H / (scale * 0.5)) + 2;
    const cols = Math.ceil(W / scale) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * scale + (r % 2) * (scale * 0.5) + offset;
        const y = r * scale * 0.5;
        ctx.beginPath();
        ctx.moveTo(x - scale, y);
        ctx.bezierCurveTo(x - scale * 0.5, y - scale * 0.3, x + scale * 0.5, y - scale * 0.3, x, y);
        ctx.bezierCurveTo(x + scale * 0.5, y + scale * 0.3, x + scale * 1.5, y + scale * 0.3, x + scale, y);
        ctx.stroke();
      }
    }
  }

  function drawAsanoha(color, scale, offset) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    const h = scale * Math.sqrt(3) / 2;
    const rows = Math.ceil(H / h) + 2;
    const cols = Math.ceil(W / (scale * 0.75)) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * scale * 0.75 + (r % 2) * scale * 0.375 + offset;
        const y = r * h;
        drawTriangle(x, y, scale);
      }
    }
    function drawTriangle(cx, cy, s) {
      const h = s * Math.sqrt(3) / 2;
      const pts = [
        [cx, cy - h * 2/3],
        [cx - s/2, cy + h/3],
        [cx + s/2, cy + h/3]
      ];
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.stroke();
      const cx2 = cx, cy2 = cy + h/6;
      ctx.beginPath();
      ctx.moveTo(cx2, cy2 - h/3);
      ctx.lineTo(cx2 - s/4, cy2 + h/6);
      ctx.lineTo(cx2 + s/4, cy2 + h/6);
      ctx.closePath();
      ctx.stroke();
    }
  }

  function drawKikkou(color, scale, offset) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    const h = scale * Math.sqrt(3) / 2;
    const rows = Math.ceil(H / (h * 1.5)) + 2;
    const cols = Math.ceil(W / (scale * 1.5)) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * scale * 1.5 + (r % 2) * scale * 0.75 + offset;
        const y = r * h * 1.5;
        drawHexagon(x, y, scale * 0.75);
      }
    }
    function drawHexagon(cx, cy, s) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = cx + s * Math.cos(a);
        const py = cy + s * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  function drawShippo(color, scale, offset) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const rows = Math.ceil(H / (scale * 0.7)) + 2;
    const cols = Math.ceil(W / (scale * 0.85)) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * scale * 0.85 + offset;
        const y = r * scale * 0.7;
        drawCircle(x, y, scale * 0.35);
        drawCircle(x + scale * 0.425, y + scale * 0.35, scale * 0.35);
      }
    }
    function drawCircle(cx, cy, r) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawYagasuri(color, scale, offset) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6;
    const rows = Math.ceil(H / (scale * 0.3)) + 2;
    const cols = Math.ceil(W / (scale * 0.6)) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * scale * 0.6 + offset;
        const y = r * scale * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + scale * 0.3, y + scale * 0.3);
        ctx.moveTo(x + scale * 0.3, y);
        ctx.lineTo(x, y + scale * 0.3);
        ctx.stroke();
      }
    }
  }

  const drawers = {
    seigaiha: drawSeigaiha,
    asanoha: drawAsanoha,
    kikkou: drawKikkou,
    shippo: drawShippo,
    yagasuri: drawYagasuri
  };

  function render() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ctx.clearRect(0, 0, W, H);
    const p = patterns[currentPattern] || patterns.home;
    const drawer = drawers[p.type];
    if (drawer) {
      const offset = (time * 0.00002 * W) % p.scale;
      drawer(p.color, p.scale, offset);
    }
    time += 16;
    rafId = requestAnimationFrame(render);
  }

  function setSection(section) {
    currentPattern = section;
  }

  function start() {
    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else render();
    });
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  return { init: start, resize, setSection };
})();