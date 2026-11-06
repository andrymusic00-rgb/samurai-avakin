import { one, many, query } from "../../db/index.js";
import { ApiError } from "../lib/http.js";
import { config } from "../lib/config.js";
import { verifyAccess } from "../lib/jwt.js";

export const PUBLIC_FIELDS = `
  id, email, display_name, handle, role, status, level, xp, bio, region,
  main_char, device, avatar_url, avakin_id, avakin_name, avakin_server,
  avakin_alliance, email_verified_at, last_login_at, created_at
`;

const ROLE_LEVEL = { membro: 10, bushi: 30, shogun: 45, admin: 100 };

export async function findUserById(id) {
  return one(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]);
}

export async function loadPrefs(userId) {
  const row = await one("SELECT * FROM user_prefs WHERE user_id = $1", [userId]);
  if (row) return row;
  await query("INSERT INTO user_prefs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [userId]);
  return one("SELECT * FROM user_prefs WHERE user_id = $1", [userId]);
}

export function publicUser(user) {
  if (!user) return null;
  // Estrae cognome dall'handle (formato: nome-cognome)
  const handleParts = (user.handle || "").split("-");
  const cognome = handleParts.length > 1 ? handleParts.slice(1).join("-") : "";
  return {
    id: user.id,
    email: user.email,
    name: user.display_name,
    cognome: cognome,
    handle: user.handle,
    role: user.role,
    status: user.status,
    level: user.level,
    xp: user.xp,
    bio: user.bio,
    region: user.region,
    mainChar: user.main_char,
    device: user.device,
    avatarUrl: user.avatar_url,
    avakin: user.avakin_id
      ? {
          id: user.avakin_id,
          name: user.avakin_name,
          server: user.avakin_server,
          alliance: user.avakin_alliance,
          linkedAt: user.avakin_linked_at
        }
      : null,
    emailVerified: !!user.email_verified_at,
    emailVerifiedAt: user.email_verified_at,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at
  };
}

export function prefsPayload(row) {
  return {
    motion: row.motion,
    petals: row.petals,
    grain: row.grain,
    sound: row.sound,
    notif: row.notifications,
    compact: row.compact,
    accent: row.accent
  };
}

async function resolveUser(req) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return null;
  const payload = verifyAccess(token);
  if (!payload) return null;
  const user = await findUserById(payload.sub);
  if (!user || user.status !== "attivo") return null;
  if (!user.email_verified_at) return null;
  return user;
}

export async function attachUser(req, _res, next) {
  try {
    req.user = await resolveUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

export function optionalAuth(req, _res, next) {
  // Attach user if token exists, but don't require it
  if (req.user) return next();
  // Try to resolve user from token if not already attached
  const token = req.cookies?.[config.cookieName];
  if (!token) return next();
  try {
    const payload = verifyAccess(token);
    if (payload) {
      findUserById(payload.sub).then(user => {
        if (user && user.status === "attivo" && user.email_verified_at) {
          req.user = user;
        }
      }).catch(() => {});
    }
  } catch {}
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`Serve il ruolo: ${roles.join(" o ")}`));
    next();
  };
}

export function requireMinRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if ((ROLE_LEVEL[req.user.role] ?? 0) < (ROLE_LEVEL[role] ?? 999)) {
      return next(ApiError.forbidden(`Serve almeno il ruolo ${role}`));
    }
    next();
  };
}

export async function activeSessions(userId) {
  const rows = await many(
    `SELECT id, user_agent, ip, created_at, last_used_at, expires_at
       FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY last_used_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    device: r.user_agent || "Dispositivo sconosciuto",
    ip: r.ip,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at
  }));
}
