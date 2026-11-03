import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Generatore di icone PWA per Samurai di Avakin.
 * Nessuna dipendenza: disegna lo stemma con SDF matematiche e scrive PNG
 * tramite zlib. Chiamato da `npm run icons`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "assets", "icons");

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function sdRing(px, py, cx, cy, r, w) {
  return Math.abs(sdCircle(px, py, cx, cy, r)) - w / 2;
}

function sdSegment(px, py, ax, ay, bx, by, w) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h) - w / 2;
}

/**
 * Pettali del crest: unione di ellissi ruotate attorno al centro.
 * L'intersezione e' approssimata con il minimo delle distanze: per una
 * stella a 8 petali il risultato e' visivamente indistinguibile.
 */
function sdStarPetals(px, py, cx, cy, rot, petals, rx, ry) {
  const dx = px - cx;
  const dy = py - cy;
  let best = Infinity;
  for (let i = 0; i < petals; i++) {
    const a = rot + (TAU * i) / petals;
    const cos = Math.cos(-a);
    const sin = Math.sin(-a);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const e = Math.hypot(lx / rx, ly / ry) - 1;
    best = Math.min(best, e * Math.min(rx, ry));
  }
  return best;
}

function sdRoundedBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Restituisce [r,g,b,a] in 0..255 per un pixel normalizzato 0..1. */
function shade(x, y, size, maskable) {
  const px = x * size;
  const py = y * size;
  const cx = size / 2;
  const cy = size / 2;
  const unit = size / 512;

  // Sfondo: quasi nero con alone blu in alto a destra e viola in basso.
  let r = 1 + 2 * (1 - y);
  let g = 3 + 5 * (1 - y);
  let b = 10 + 12 * (1 - y);

  const glowA = Math.exp(-(Math.pow((x - 0.74) / 0.55, 2) + Math.pow((y - 0.14) / 0.5, 2)) * 2.4);
  const glowB = Math.exp(-(Math.pow((x - 0.2) / 0.55, 2) + Math.pow((y - 0.9) / 0.55, 2)) * 2.6);
  r += 14 * glowA + 30 * glowB;
  g += 40 * glowA + 12 * glowB;
  b += 92 * glowA + 96 * glowB;

  // Mascherabile: riempie tutto, il safe zone lascia il 20% di margine.
  const box = maskable
    ? -1
    : sdRoundedBox(px, py, cx, cy, size * 0.5, size * 0.5, size * 0.22);
  const inside = smooth(1.2, -1.2, box);
  if (inside <= 0.001) return [0, 0, 0, 0];

  const inner = maskable ? size * 0.5 : size * 0.42;

  // Anello esterno tratteggiato simulato da 24 trattini.
  const ang = Math.atan2(py - cy, px - cx);
  const ringR = Math.hypot(px - cx, py - cy);
  const dash = smooth(0.35, 0.55, Math.abs(Math.sin(ang * 12)));
  const dRing = sdRing(px, py, cx, cy, inner, 7 * unit);
  const ringA = smooth(1.2, -1.2, dRing) * (0.35 + 0.45 * dash);

  // Corona di 8 petali metallici.
  const dPetals = sdStarPetals(px, py, cx, cy, -Math.PI / 2, 8, inner * 0.62, inner * 0.27);
  const petalGrad = clamp01((py - cy) / (inner * 1.6) + 0.5);
  const petalA = smooth(1.2, -1.2, dPetals) * 0.96;

  // Nucleo.
  const dCore = sdCircle(px, py, cx, cy, inner * 0.29);
  const coreA = smooth(1.2, -1.2, dCore);
  const dHole = sdCircle(px, py, cx, cy, inner * 0.13);
  const holeA = smooth(1.2, -1.2, dHole);

  // Lamina diagonale, richiama la spada del brand.
  const dBlade = Math.min(
    sdSegment(px, py, cx - inner * 0.86, cy + inner * 0.86, cx + inner * 0.72, cy - inner * 0.72, 16 * unit),
    sdSegment(px, py, cx - inner * 0.7, cy + inner * 0.7, cx + inner * 0.86, cy - inner * 0.86, 5 * unit)
  );
  const bladeA = smooth(1.2, -1.2, dBlade) * 0.8;

  // Composizione additiva sul fondo.
  const silver = [244 - 10 * petalGrad, 248 - 6 * petalGrad, 255];
  const accent = [143, 198, 255];
  const mixCol = (base, col, a) => base.map((c, i) => mix(c, col[i], a));

  r = mixCol([r, g, b], accent, ringA * 0.7);
  r = mixCol(r, silver, petalA);
  r = mixCol(r, silver.map((c) => c * 0.92), coreA);
  r = mixCol(r, accent, bladeA);
  r = mixCol(r, [3, 6, 18], holeA * 0.85);

  const alpha = clamp01(inside) * 255;
  return [
    Math.round(clamp01(r[0] / 255) * 255),
    Math.round(clamp01(r[1] / 255) * 255),
    Math.round(clamp01(r[2] / 255) * 255),
    Math.round(alpha)
  ];
}

function render(size, { maskable = false, supersample = 3 } = {}) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const px = (x + (sx + 0.5) / supersample) / size;
          const py = (y + (sy + 0.5) / supersample) / size;
          const c = shade(px, py, size, maskable);
          rr += c[0] * c[3];
          gg += c[1] * c[3];
          bb += c[2] * c[3];
          aa += c[3];
        }
      }
      const n = supersample * supersample;
      raw[p++] = aa ? Math.round(rr / aa) : 0;
      raw[p++] = aa ? Math.round(gg / aa) : 0;
      raw[p++] = aa ? Math.round(bb / aa) : 0;
      raw[p++] = Math.round(aa / n);
    }
  }
  return raw;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

mkdirSync(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, maskable: false, ss: 4 },
  { file: "icon-512.png", size: 512, maskable: false, ss: 3 },
  { file: "icon-maskable.png", size: 512, maskable: true, ss: 3 },
  { file: "apple-touch-icon.png", size: 180, maskable: true, ss: 4 },
  { file: "favicon-32.png", size: 32, maskable: false, ss: 6 }
];

for (const t of targets) {
  const buf = png(t.size, render(t.size, { maskable: t.maskable, supersample: t.ss }));
  writeFileSync(join(outDir, t.file), buf);
  console.log(`[icons] ${t.file} — ${t.size}x${t.size} (${(buf.length / 1024).toFixed(1)} kB)`);
}

console.log(`[icons] scritti in ${outDir}`);
