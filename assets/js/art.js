const ART = (() => {
  const rnd = (seed) => {
    let a = (seed + 1013) >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const toUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/\s{2,}/g, " "));

  const defs = (r, W, H) => {
    const blues = ["#1d5cc0", "#2f83ef", "#5aa8ff", "#8fc6ff"];
    const violets = ["#6d32b8", "#8b52d1", "#a873e6", "#c79bff"];
    const silvers = ["#bcc9dd", "#dde6f4", "#f4f8ff", "#97a6bd"];
    const b1 = blues[Math.floor(r() * blues.length)];
    const b2 = blues[Math.floor(r() * blues.length)];
    const v1 = violets[Math.floor(r() * violets.length)];
    const s1 = silvers[Math.floor(r() * silvers.length)];
    const uid = "a" + Math.floor(r() * 1e9).toString(36);
    return `
    <defs>
      <linearGradient id="bg${uid}" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="#081431"/>
        <stop offset="0.45" stop-color="#050c20"/>
        <stop offset="1" stop-color="#01030a"/>
      </linearGradient>
      <radialGradient id="gl${uid}" cx="0.5" cy="0.34" r="0.75">
        <stop offset="0" stop-color="${b1}" stop-opacity="0.55"/>
        <stop offset="0.55" stop-color="#0a1a3d" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#01030a" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="mt${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${s1}" stop-opacity="0.95"/>
        <stop offset="0.5" stop-color="${b2}" stop-opacity="0.85"/>
        <stop offset="1" stop-color="#0a1a3d" stop-opacity="0.5"/>
      </linearGradient>
      <linearGradient id="ac${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${b2}"/>
        <stop offset="0.6" stop-color="${s1}"/>
        <stop offset="1" stop-color="#f4f8ff"/>
      </linearGradient>
      <linearGradient id="vl${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${v1}"/>
        <stop offset="0.6" stop-color="${s1}"/>
        <stop offset="1" stop-color="#f3e8ff"/>
      </linearGradient>
      <radialGradient id="vg${uid}" cx="0.5" cy="0.45" r="0.72">
        <stop offset="0.5" stop-color="#01030a" stop-opacity="0"/>
        <stop offset="1" stop-color="#01030a" stop-opacity="0.92"/>
      </radialGradient>
      <pattern id="gri${uid}" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M34 0H0V34" fill="none" stroke="${b2}" stroke-opacity="0.12" stroke-width="1"/>
      </pattern>
    </defs>`;
  };

  const frame = (uid, W, H) => `
    <rect width="${W}" height="${H}" fill="url(#bg${uid})"/>
    <rect width="${W}" height="${H}" fill="url(#gl${uid})"/>
    <rect width="${W}" height="${H}" fill="url(#gri${uid})"/>`;

  const grainLines = (r, W, H, n) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const y = r() * H;
      s += `<rect x="0" y="${y.toFixed(1)}" width="${W}" height="1" fill="#c3e0ff" opacity="${(0.02 + r() * 0.05).toFixed(3)}"/>`;
    }
    return s;
  };

  const sparks = (r, W, H, n, uid) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, rad = 0.6 + r() * 2.2;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="#dde6f4" opacity="${(0.15 + r() * 0.6).toFixed(2)}"/>`;
    }
    return s;
  };

  const helmet = (r, W, H, uid) => {
    const cx = W / 2, cy = H * 0.52, s = Math.min(W, H) / 300;
    return `
    <g transform="translate(${cx} ${cy}) scale(${s.toFixed(3)})">
      <path d="M-120 60 C-120 -60 -66 -118 0 -118 C66 -118 120 -60 120 60 Z" fill="url(#mt${uid})" opacity="0.95"/>
      <path d="M-120 60 C-120 -60 -66 -118 0 -118 C66 -118 120 -60 120 60 Z" fill="none" stroke="#f4f8ff" stroke-opacity="0.5" stroke-width="2"/>
      <path d="M-140 66 L140 66 L128 92 L-128 92 Z" fill="#0a1a3d" stroke="${'#8fc6ff'}" stroke-opacity="0.6" stroke-width="2"/>
      <path d="M-96 66 L-96 -22 M-32 66 L-32 -96 M32 66 L32 -96 M96 66 L96 -22" stroke="#01030a" stroke-opacity="0.5" stroke-width="5"/>
      <path d="M-34 -112 L-34 -196 M34 -112 L34 -196" stroke="url(#ac${uid})" stroke-width="7" stroke-linecap="round"/>
      <circle cx="0" cy="-40" r="26" fill="#01030a" opacity="0.85"/>
      <circle cx="0" cy="-40" r="10" fill="#8fc6ff" opacity="0.85"/>
      <path d="M-120 60 L120 60" stroke="#dde6f4" stroke-width="2" opacity="0.6"/>
    </g>`;
  };

  const troppa = (r, W, H, uid) => {
    const cx = W / 2, cy = H * 0.5, s = Math.min(W, H) / 260;
    const star = (rad, inner, points, rot) => {
      let p = "";
      for (let i = 0; i < points * 2; i++) {
        const rr = i % 2 === 0 ? rad : inner;
        const a = rot + (Math.PI * i) / points;
        p += `${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)} `;
      }
      return p;
    };
    return `
    <g transform="translate(${cx} ${cy}) scale(${s.toFixed(3)})">
      <polygon points="${star(120, 50, 5, -Math.PI / 2)}" fill="url(#mt${uid})" opacity="0.25"/>
      <polygon points="${star(92, 38, 5, -Math.PI / 2)}" fill="url(#mt${uid})"/>
      <polygon points="${star(92, 38, 5, -Math.PI / 2)}" fill="none" stroke="#f4f8ff" stroke-opacity="0.65" stroke-width="2.4"/>
      <polygon points="${star(46, 19, 5, -Math.PI / 2)}" fill="#01030a" opacity="0.5"/>
      ${[-1, 1].map((d) => `<path d="M${d * 34} 0 L${d * 118} 0" stroke="url(#ac${uid})" stroke-width="3" opacity="0.55"/>`).join("")}
      <circle cx="0" cy="0" r="150" fill="none" stroke="#8fc6ff" stroke-opacity="0.28" stroke-width="1.5"/>
      <circle cx="0" cy="0" r="176" fill="none" stroke="#8fc6ff" stroke-opacity="0.14" stroke-width="1" stroke-dasharray="8 12"/>
    </g>`;
  };

  const blade = (r, W, H, uid) => {
    const s = Math.min(W, H) / 300;
    return `
    <g transform="translate(${W * 0.5} ${H * 0.55}) rotate(-38) scale(${s.toFixed(3)})">
      <path d="M-230 -16 L150 -7 L172 0 L150 7 L-230 16 Z" fill="url(#mt${uid})"/>
      <path d="M-230 -16 L150 -7 L172 0" fill="none" stroke="#f4f8ff" stroke-opacity="0.8" stroke-width="2"/>
      <path d="M-230 0 L172 0" stroke="#8fc6ff" stroke-opacity="0.85" stroke-width="2.4"/>
      <rect x="172" y="-26" width="16" height="52" rx="4" fill="none" stroke="url(#ac${uid})" stroke-width="3"/>
      <rect x="188" y="-15" width="118" height="30" rx="6" fill="#0a1a3d" stroke="#8fc6ff" stroke-opacity="0.4" stroke-width="2"/>
      ${[0, 1, 2, 3, 4].map((i) => `<path d="M${196 + i * 22} -13 l14 26" stroke="#5aa8ff" stroke-opacity="0.5" stroke-width="4"/>`).join("")}
      <rect x="306" y="-22" width="16" height="44" rx="5" fill="url(#mt${uid})"/>
      <ellipse cx="0" cy="0" rx="250" ry="70" fill="#5aa8ff" opacity="0.09"/>
    </g>`;
  };

  const torii = (r, W, H, uid) => {
    const s = Math.min(W, H) / 300;
    return `
    <g transform="translate(${W * 0.5} ${H * 0.6}) scale(${s.toFixed(3)})">
      <circle cx="0" cy="-40" r="72" fill="#c3e0ff" opacity="0.14"/>
      <circle cx="0" cy="-40" r="72" fill="none" stroke="#8fc6ff" stroke-opacity="0.45" stroke-width="1.5"/>
      <g fill="url(#mt${uid})">
        <rect x="-118" y="-150" width="236" height="26" rx="8"/>
        <rect x="-98" y="-126" width="196" height="14" rx="5"/>
        <path d="M-96 -126 h26 l-6 176 h-16 z"/>
        <path d="M96 -126 h-26 l6 176 h16 z"/>
        <rect x="-26" y="-112" width="52" height="20" rx="4"/>
      </g>
      <g fill="#f4f8ff" opacity="0.9">
        <rect x="-118" y="-150" width="236" height="6" rx="3"/>
      </g>
      <rect x="-14" y="-92" width="28" height="142" rx="6" fill="#01030a" opacity="0.55"/>
      <path d="M-140 60 H140" stroke="url(#vl${uid})" stroke-opacity="0.5" stroke-width="2"/>
    </g>`;
  };

  const moon = (r, W, H, uid) => {
    const s = Math.min(W, H) / 300;
    const lines = [];
    for (let i = 0; i < 9; i++) {
      const y = 96 + i * 16;
      const w = 120 - i * 8 + r() * 40;
      lines.push(`<rect x="${(-w / 2).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="3" rx="1.5" fill="#8fc6ff" opacity="${(0.36 - i * 0.03).toFixed(2)}"/>`);
    }
    const petals = [];
    for (let i = 0; i < 16; i++) {
      const x = r() * W, y = r() * H * 0.7, rad = 5 + r() * 7;
      petals.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rad.toFixed(1)}" ry="${(rad * 0.55).toFixed(1)}" fill="#c3e0ff" opacity="${(0.14 + r() * 0.3).toFixed(2)}" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
    return `
    <g transform="translate(${W * 0.5} ${H * 0.36}) scale(${s.toFixed(3)})">${petals.join("")}</g>
    <g transform="translate(${W * 0.5} ${H * 0.36}) scale(${s.toFixed(3)})">
      <circle cx="0" cy="0" r="86" fill="url(#mt${uid})" opacity="0.92"/>
      <circle cx="0" cy="0" r="86" fill="none" stroke="#f4f8ff" stroke-opacity="0.6" stroke-width="2"/>
      <circle cx="0" cy="0" r="104" fill="none" stroke="#8fc6ff" stroke-opacity="0.25" stroke-width="1.5"/>
      <circle cx="-26" cy="-14" r="9" fill="#0a1a3d" opacity="0.28"/>
      <circle cx="22" cy="18" r="14" fill="#0a1a3d" opacity="0.22"/>
      <circle cx="16" cy="-34" r="6" fill="#0a1a3d" opacity="0.2"/>
    </g>
    <g transform="translate(${W * 0.5} ${H * 0.62}) scale(${s.toFixed(3)})">${lines.join("")}</g>
    <path d="M${W * 0.1} ${H * 0.2} q60 -30 120 10 q-60 24 -120 -10Z" fill="#5aa8ff" opacity="0.28"/>
    <path d="M${W * 0.1} ${H * 0.2} q60 -30 120 10" fill="none" stroke="#c3e0ff" stroke-opacity="0.4" stroke-width="2"/>`;
  };

  const waves = (r, W, H, uid) => {
    const s = Math.min(W, H) / 300;
    const arcs = [];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const x = -220 + col * 66 + (row % 2 ? 33 : 0);
        const y = 40 + row * 46;
        const op = (0.1 + r() * 0.32).toFixed(2);
        arcs.push(`<path d="M${x - 30} ${y} a30 30 0 0 1 60 0" fill="none" stroke="#8fc6ff" stroke-opacity="${op}" stroke-width="2.4"/>`);
        arcs.push(`<path d="M${x - 18} ${y} a18 18 0 0 1 36 0" fill="none" stroke="#c3e0ff" stroke-opacity="${(Number(op) * 0.6).toFixed(2)}" stroke-width="1.4"/>`);
      }
    }
    return `
    <g transform="translate(${W * 0.5} ${H * 0.42}) scale(${s.toFixed(3)})">${arcs.join("")}</g>
    <g transform="translate(${W * 0.5} ${H * 0.3}) scale(${s.toFixed(3)})">
      <path d="M-60 60 C-60 -20 -33 -60 0 -60 C33 -60 60 -20 60 60 Z" fill="url(#mt${uid})" opacity="0.9"/>
      <path d="M-60 60 C-60 -20 -33 -60 0 -60 C33 -60 60 -20 60 60 Z" fill="none" stroke="#f4f8ff" stroke-opacity="0.5" stroke-width="2"/>
      <path d="M-84 62 h168" stroke="url(#ac${uid})" stroke-width="4" stroke-linecap="round"/>
    </g>`;
  };

  const crest = (r, W, H, uid) => {
    const s = Math.min(W, H) / 300;
    const petals = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      petals.push(`<ellipse cx="0" cy="-96" rx="26" ry="46" fill="url(#mt${uid})" opacity="0.85" transform="rotate(${(i * 45).toFixed(1)})"/>`);
    }
    return `
    <g transform="translate(${W * 0.5} ${H * 0.5}) scale(${s.toFixed(3)})">
      <circle r="150" fill="none" stroke="#8fc6ff" stroke-opacity="0.22" stroke-width="1.5" stroke-dasharray="6 10"/>
      <circle r="128" fill="#01030a" opacity="0.5"/>
      <g>${petals.join("")}</g>
      <circle r="52" fill="url(#mt${uid})"/>
      <circle r="52" fill="none" stroke="#f4f8ff" stroke-opacity="0.7" stroke-width="2.4"/>
      <circle r="26" fill="#01030a" opacity="0.6"/>
      <circle r="10" fill="#8fc6ff"/>
    </g>`;
  };

  const COMPS = { helmet, troppa, blade, torii, moon, waves, crest };

  function make(opts) {
    const W = opts.w || 900;
    const H = opts.h || 900;
    const r = rnd(opts.seed || 7);
    const comp = COMPS[opts.comp] || helmet;
    const uid = "a" + Math.floor(r() * 1e9).toString(36);
    const mark = opts.comp === "crest" ? "侍" : opts.comp === "torii" ? "門" : "侍";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs(r, W, H)}
${frame(uid, W, H)}
${grainLines(r, W, H, 46)}
${comp(r, W, H, uid)}
${sparks(r, W, H, 40)}
<rect width="${W}" height="${H}" fill="url(#vg${uid})"/>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#bcc9dd" stroke-opacity="0.18" stroke-width="1"/>
<text x="${W - 46}" y="${H - 44}" font-family="serif" font-size="52" fill="#c3e0ff" fill-opacity="0.16" text-anchor="end">${mark}</text>
<text x="46" y="${H - 44}" font-family="monospace" font-size="15" letter-spacing="5" fill="#8fc6ff" fill-opacity="0.42">SAMURAI·DI·AVAKIN</text>
</svg>`;
    return toUri(svg);
  }

  function badge(d) {
    const nm = String(d.name || "SAMURAI").toUpperCase().slice(0, 14);
    const lv = String(d.level || 1);
    const c = d.accent || "#5aa8ff";
    const seed = String(nm).split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const r = rnd(seed);
    const uid = "bg" + seed;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="560" viewBox="0 0 480 560">
<defs>
<linearGradient id="${uid}b" x1="0" y1="0" x2="0.7" y2="1">
<stop offset="0" stop-color="#0a1a3d"/><stop offset="0.5" stop-color="#050c20"/><stop offset="1" stop-color="#01030a"/>
</linearGradient>
<linearGradient id="${uid}m" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#f4f8ff"/><stop offset="0.5" stop-color="${c}"/><stop offset="1" stop-color="#0a1a3d"/>
</linearGradient>
<radialGradient id="${uid}g" cx="0.5" cy="0.3" r="0.75">
<stop offset="0" stop-color="${c}" stop-opacity="0.5"/><stop offset="1" stop-color="#01030a" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="480" height="560" rx="34" fill="url(#${uid}b)"/>
<rect width="480" height="560" rx="34" fill="url(#${uid}g)"/>
<rect x="20" y="20" width="440" height="520" rx="24" fill="none" stroke="#bcc9dd" stroke-opacity="0.25"/>
<rect x="32" y="32" width="416" height="496" rx="18" fill="none" stroke="${c}" stroke-opacity="0.4" stroke-dasharray="5 9"/>
<g transform="translate(240 168)">
<circle r="82" fill="none" stroke="#8fc6ff" stroke-opacity="0.3" stroke-dasharray="6 10"/>
${Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-62" rx="16" ry="28" fill="url(#${uid}m)" opacity="0.8" transform="rotate(${i * 45})"/>`).join("")}
<circle r="30" fill="url(#${uid}m)"/><circle r="14" fill="#01030a" opacity="0.65"/>
</g>
<text x="240" y="300" text-anchor="middle" font-family="serif" font-size="40" fill="#f4f8ff" letter-spacing="6">${nm}</text>
<text x="240" y="334" text-anchor="middle" font-family="monospace" font-size="14" letter-spacing="7" fill="${c}">SAMURAI·DI·AVAKIN</text>
<line x1="140" y1="362" x2="340" y2="362" stroke="#8fc6ff" stroke-opacity="0.35"/>
<text x="240" y="404" text-anchor="middle" font-family="serif" font-size="22" fill="#c3e0ff" letter-spacing="3">侍</text>
<text x="240" y="452" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="4" fill="#97a6bd">LIVELLO ${lv}</text>
<rect x="120" y="470" width="240" height="8" rx="4" fill="#0a1a3d" stroke="#5aa8ff" stroke-opacity="0.4"/>
<rect x="120" y="470" width="${(240 * (0.25 + r() * 0.7)).toFixed(0)}" height="8" rx="4" fill="${c}"/>
</svg>`;
  }

  return { make, badge };
})();
