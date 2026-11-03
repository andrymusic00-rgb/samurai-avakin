import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

const envFile = join(root, "server", ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

const bool = (v, d) => (v == null || v === "" ? d : /^(1|true|yes|on)$/i.test(v));
const int = (v, d) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : d);

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";

function devSecret(name) {
  const file = join(root, "server", ".secret");
  try {
    if (!existsSync(file)) {
      crypto.writeFileSync(file, crypto.randomBytes(48).toString("hex"), { mode: 0o600 });
    }
    return readFileSync(file, "utf8").trim();
  } catch {
    return crypto.createHash("sha256").update(`${name}:samurai-dev-fallback`).digest("hex");
  }
}

const jwtSecret = process.env.JWT_SECRET || devSecret("jwt");
if (isProd && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET obbligatorio in produzione. Impostalo in server/.env");
}

export const config = {
  root,
  env: nodeEnv,
  isProd,
  port: int(process.env.PORT, 4173),
  host: process.env.HOST ?? "",
  publicDir: join(root, "index.html"),
  assetsDir: join(root, "assets"),
  uploadDir: join(root, "server", "uploads"),

  databaseUrl: process.env.DATABASE_URL || "",
  dbSsl: bool(process.env.DATABASE_SSL, false),
  dbPoolMax: int(process.env.DATABASE_POOL_MAX, 10),
  pgliteDir: process.env.PGLITE_DIR || join(root, "server", ".data"),

  jwtSecret,
  issuer: "samurai-di-avakin",
  accessTtl: process.env.ACCESS_TTL || "20m",
  refreshDays: int(process.env.REFRESH_DAYS, 30),
  cookieName: "sam_session",
  cookieSecure: bool(process.env.COOKIE_SECURE, isProd),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,

  uploadMaxBytes: int(process.env.UPLOAD_MAX_BYTES, 4 * 1024 * 1024),
  allowImageOnly: bool(process.env.ALLOW_IMAGE_ONLY, true),
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /* OAuth social */
  social: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect: process.env.GOOGLE_REDIRECT_URI || "",
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
      redirect: process.env.MICROSOFT_REDIRECT_URI || "",
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || "",
      teamId: process.env.APPLE_TEAM_ID || "",
      keyId: process.env.APPLE_KEY_ID || "",
      redirect: process.env.APPLE_REDIRECT_URI || "",
    },
  },
  /* Se true, il login social funziona in modalità dev (senza credenziali reali) */
  socialDevMode: bool(process.env.SOCIAL_DEV_MODE, true),

  /* Anti-bot (Cloudflare Turnstile). Attivo solo se configurato. */
  turnstile: {
    secret: process.env.TURNSTILE_SECRET || "",
    siteKey: process.env.TURNSTILE_SITE_KEY || "",
    enabled: bool(process.env.TURNSTILE_ENABLED, false)
  },
  /* Età minima per la registrazione (anni). */
  minAge: int(process.env.MIN_AGE, 13),
};
