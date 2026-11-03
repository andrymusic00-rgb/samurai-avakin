import { Router } from "express";
import { unlink } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import multer from "multer";
import crypto from "node:crypto";
import { one, many, query, tx } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import { hashPassword, verifyPassword, sha256, randomToken } from "../lib/password.js";
import { config } from "../lib/config.js";
import { clearAuthCookies } from "../lib/jwt.js";
import * as v from "../lib/validate.js";
import { requireAuth, findUserById, publicUser, loadPrefs, prefsPayload } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { audit, auditTrail } from "../lib/audit.js";
import { achievementsFor, syncAchievements } from "../lib/achievements.js";
import { addXp, addSkillXp, getProgression, xpSummary } from "../lib/progression.js";

export const accountRouter = Router();
accountRouter.use(requireAuth);

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const safe = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}${ALLOWED_EXT.has(ext) ? ext : ".bin"}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploadMaxBytes, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(ApiError.bad("unsupported", "Solo file immagine"));
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(ApiError.bad("unsupported", `Formato non supportato (${ext || "senza estensione"})`));
    cb(null, true);
  }
});

const SKILLS = [
  { nome: "Difesa con scudo", chiave: "difesa" },
  { nome: "Attacco in terapia", chiave: "attacco" },
  { nome: "Gestione risorse", chiave: "risorse" },
  { nome: "Lettura dell'arena", chiave: "arena" },
  { nome: "Spirito di squadra", chiave: "squadra" }
];

async function skillValues(userId) {
  const rows = await many("SELECT chiave, livello, xp FROM user_skills WHERE user_id = $1 ORDER BY chiave", [userId]);
  const map = {};
  rows.forEach((r) => { map[r.chiave] = { v: Number(r.livello ?? 1), xp: Number(r.xp ?? 0) }; });
  return SKILLS.map((s) => ({ nome: s.nome, chiave: s.chiave, v: map[s.chiave]?.v ?? 1, xp: map[s.chiave]?.xp ?? 0 }));
}

accountRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [prefs, stats, uploads, progression] = await Promise.all([
      loadPrefs(req.user.id),
      one("SELECT * FROM user_stats WHERE user_id = $1", [req.user.id]),
      many("SELECT id, url, filename, bytes, created_at FROM uploads WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30", [req.user.id]),
      getProgression(req.user.id)
    ]);

    if (!stats) {
      await query("INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [req.user.id]);
    }
    const s = stats ?? { vittorie: 0, sconfitte: 0, raid: 0, ore: 0, kill_streak: 0 };
    const total = s.vittorie + s.sconfitte;
    const traguardi = await achievementsFor(req.user.id);
    const skills = await skillValues(req.user.id);

    res.json({
      ok: true,
      user: publicUser(req.user),
      prefs: prefsPayload(prefs),
      stats: {
        vittorie: s.vittorie,
        sconfitte: s.sconfitte,
        raid: s.raid,
        ore: s.ore,
        killStreak: s.kill_streak,
        winRate: total ? Math.round((s.vittorie / total) * 100) : 0,
        skills
      },
      progression,
      achievements: traguardi,
      uploads: uploads.map((u) => ({ id: u.id, url: u.url, filename: u.filename, bytes: u.bytes, createdAt: u.created_at }))
    });
  })
);

accountRouter.patch(
  "/profile",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const name = v.str(b.name, { min: 3, max: 24, required: true, field: "Nome" });
    const tag = v.handle(b.handle);

    if (tag.toLowerCase() !== req.user.handle.toLowerCase()) {
      const clash = await one("SELECT id FROM users WHERE lower(handle) = $1", [tag.toLowerCase()]);
      if (clash) throw ApiError.conflict("Questo handle è già preso");
    }

    const row = await one(
      `UPDATE users
          SET display_name = $1, handle = $2, bio = $3, region = $4, main_char = $5, device = $6
        WHERE id = $7
        RETURNING id, email, display_name, handle, role, status, level, xp, bio, region,
                  main_char, device, avatar_url, avakin_id, avakin_name, avakin_server,
                  avakin_alliance, email_verified_at, last_login_at, created_at`,
      [
        name,
        tag,
        v.str(b.bio, { max: 140, field: "Bio" }),
        v.oneOf(b.region, ["Europa", "America", "Asia", "Oceania", "MENA"], { required: true, field: "Regione" }),
        v.oneOf(
          b.mainChar,
          ["Troppa ⋆ ⋆ ⋆ ⋆ ⋆", "Troppa ⋆ ⋆ ⋆ ⋆", "Troppa ⋆ ⋆ ⋆", "Troppa ⋆ ⋆", "Troppa ⋆", "Senza scudiero"],
          { required: true, field: "Personaggio" }
        ),
        v.oneOf(b.device, ["iOS", "Android", "PC", "Console", "Altro"], { required: true, field: "Dispositivo" }),
        req.user.id
      ]
    );

    await audit(req.user.id, "account.profile_updated", { handle: row.handle }, clientIp(req));
    try {
      await addXp(req.user.id, "profilo_aggiornato", 20);
      await addSkillXp(req.user.id, "risorse", 5);
      await addSkillXp(req.user.id, "squadra", 5);
    } catch {}
    res.json({ ok: true, user: publicUser(row) });
  })
);

accountRouter.patch(
  "/email",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const mail = v.email(req.body?.email);
    const row = await one("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!(await verifyPassword(String(req.body?.password ?? ""), row.password_hash))) {
      throw ApiError.unauthorized("Password non corretta");
    }
    const clash = await one("SELECT id FROM users WHERE lower(email) = $1 AND id <> $2", [mail, req.user.id]);
    if (clash) throw ApiError.conflict("Email già in uso");
    await query("UPDATE users SET email = $1, email_verified_at = NULL WHERE id = $2", [mail, req.user.id]);
    await audit(req.user.id, "account.email_changed", {}, clientIp(req));
    try { await addXp(req.user.id, "email_cambiata", 15); } catch {}
    res.json({ ok: true, email: mail, needsEmailVerification: true });
  })
);

accountRouter.patch(
  "/preferences",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const cur = await loadPrefs(req.user.id);
    const row = await one(
      `UPDATE user_prefs
          SET motion = $1, petals = $2, grain = $3, sound = $4, notifications = $5, compact = $6, accent = $7
        WHERE user_id = $8
        RETURNING *`,
      [
        v.bool(b.motion, cur.motion),
        v.bool(b.petals, cur.petals),
        v.bool(b.grain, cur.grain),
        v.bool(b.sound, cur.sound),
        v.bool(b.notif, cur.notifications),
        v.bool(b.compact, cur.compact),
        v.hexColor(b.accent, cur.accent),
        req.user.id
      ]
    );
    res.json({ ok: true, prefs: prefsPayload(row) });
  })
);

accountRouter.get(
  "/progression",
  asyncHandler(async (req, res) => {
    const progression = await getProgression(req.user.id);
    const log = await many(
      "SELECT azione, xp_guadagnato, creato_il FROM user_xp_log WHERE user_id = $1 ORDER BY creato_il DESC LIMIT 20",
      [req.user.id]
    );
    const summary = await xpSummary(req.user.id, 30);
    res.json({ ok: true, progression, log, summary });
  })
);

accountRouter.post(
  "/link-avakin",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const avakinId = v.digits(b.avakinId, { field: "ID Avakin" });
    const avakinName = v.str(b.avakinName, { min: 3, max: 24, required: true, field: "Nickname" });

    const taken = await one("SELECT id FROM users WHERE avakin_id = $1 AND id <> $2", [avakinId, req.user.id]);
    if (taken) throw ApiError.conflict("Questo ID Avakin è già collegato a un altro membro");

    const row = await one(
      `UPDATE users
          SET avakin_id = $1, avakin_name = $2, avakin_server = $3, avakin_alliance = $4,
              avakin_linked_at = now(), level = LEAST(50, level + 3)
        WHERE id = $5
        RETURNING id, email, display_name, handle, role, status, level, xp, bio, region,
                  main_char, device, avatar_url, avakin_id, avakin_name, avakin_server,
                  avakin_alliance, email_verified_at, last_login_at, created_at`,
      [
        avakinId,
        avakinName,
        v.oneOf(b.server, ["Europa", "America", "Asia", "Oceania", "MENA"], { field: "Server", fallback: "Europa" }),
        v.str(b.alliance, { max: 40, field: "Alleanza" }) || "Nessuna",
        req.user.id
      ]
    );
    await query("UPDATE user_stats SET raid = raid + 2 WHERE user_id = $1", [req.user.id]);
    await syncAchievements(req.user.id);
    await audit(req.user.id, "account.avakin_linked", { avakinId }, clientIp(req));
    try {
      await addXp(req.user.id, "avakin_collegato", 50);
      await addSkillXp(req.user.id, "squadra", 10);
    } catch {}
    res.json({ ok: true, user: publicUser(row), bonus: { level: 3, raid: 2 } });
  })
);

accountRouter.post(
  "/password",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const row = await one("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!(await verifyPassword(String(req.body?.currentPassword ?? ""), row.password_hash))) {
      throw ApiError.unauthorized("Password attuale non corretta");
    }
    const next = v.password(req.body?.newPassword);
    if (next === req.body?.currentPassword) throw ApiError.bad("validation", "La nuova password deve essere diversa");

    const keepSession = req.cookies?.[config.cookieName] ? sha256(String(req.cookies[config.cookieName]).slice(-8)) : null;
    void keepSession;

    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(next), req.user.id]);
    const { rows: killed } = await query(
      "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id",
      [req.user.id]
    );

    clearAuthCookies(res);
    await audit(req.user.id, "account.password_changed", { sessionsRevoked: killed.length }, clientIp(req));
    try { await addXp(req.user.id, "password_cambiata", 10); } catch {}
    res.json({
      ok: true,
      sessionsRevoked: killed.length,
      message: "Password aggiornata. Accedi di nuovo."
    });
  })
);

accountRouter.post(
  "/avatar",
  upload.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.bad("validation", "Nessun file ricevuto", { field: "avatar" });

    const old = req.user.avatar_url;
    const url = `/uploads/${req.file.filename}`;
    await query("UPDATE users SET avatar_url = $1 WHERE id = $2", [url, req.user.id]);

    if (old && old.startsWith("/uploads/")) {
      const p = join(config.uploadDir, basename(old));
      await unlink(p).catch(() => {});
    }
    await audit(req.user.id, "account.avatar_updated", { url }, clientIp(req));
    try { await addXp(req.user.id, "avatar_aggiornato", 30); } catch {}
    res.json({ ok: true, avatarUrl: url });
  })
);

accountRouter.post(
  "/uploads",
  upload.array("files", 6),
  asyncHandler(async (req, res) => {
    const files = req.files ?? [];
    if (!files.length) throw ApiError.bad("validation", "Nessun file ricevuto");
    const saved = [];
    for (const f of files) {
      const url = `/uploads/${f.filename}`;
      const r = await one(
        "INSERT INTO uploads (user_id, url, filename, bytes) VALUES ($1, $2, $3, $4) RETURNING id, url, filename, bytes, created_at",
        [req.user.id, url, f.originalname, f.size]
      );
      saved.push({ id: r.id, url: r.url, filename: r.filename, bytes: r.bytes, createdAt: r.created_at });
    }
    await audit(req.user.id, "account.uploads_added", { count: saved.length }, clientIp(req));
    try {
      await addXp(req.user.id, "foto_caricate", 10 * saved.length);
      await addSkillXp(req.user.id, "risorse", 3 * saved.length);
    } catch {}
    res.status(201).json({ ok: true, uploads: saved });
  })
);

accountRouter.delete(
  "/uploads/:id",
  asyncHandler(async (req, res) => {
    const row = await one("DELETE FROM uploads WHERE id = $1 AND user_id = $2 RETURNING url", [req.params.id, req.user.id]);
    if (!row) throw ApiError.notFound("Upload non trovato");
    await unlink(join(config.uploadDir, basename(row.url))).catch(() => {});
    res.json({ ok: true });
  })
);

accountRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const prefs = await loadPrefs(req.user.id);
    const stats = await one("SELECT * FROM user_stats WHERE user_id = $1", [req.user.id]);
    const trail = await auditTrail(req.user.id, 200);
    const sessions = await many(
      "SELECT id, user_agent, ip, created_at, last_used_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    const uploads = await many("SELECT url, filename, bytes, created_at FROM uploads WHERE user_id = $1", [req.user.id]);

    res.setHeader("Content-Disposition", `attachment; filename="samurai-${req.user.handle.toLowerCase()}.json"`);
    res.json({
      esportatoIl: new Date().toISOString(),
      formato: "samurai-di-avakin/account-export@1",
      utente: publicUser(req.user),
      preferenze: prefsPayload(prefs),
      statistiche: stats,
      sessioni: sessions,
      auditLog: trail,
      upload: uploads
    });
  })
);

accountRouter.get(
  "/achievements",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, ...(await achievementsFor(req.user.id)) });
  })
);

accountRouter.get(
  "/audit",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, entries: await auditTrail(req.user.id, v.intInRange(req.query.limit, { min: 1, max: 200, fallback: 50 })) });
  })
);

accountRouter.delete(
  "/",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const row = await one("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!(await verifyPassword(String(req.body?.password ?? ""), row?.password_hash))) {
      throw ApiError.unauthorized("Password non corretta");
    }
    if (String(req.body?.confirm ?? "").toUpperCase() !== "ELIMINA") {
      throw ApiError.bad("validation", "Digita ELIMINA per confermare", { field: "confirm" });
    }

    const files = await many("SELECT url FROM uploads WHERE user_id = $1", [req.user.id]);
    await tx(async (c) => {
      const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
      await run("DELETE FROM users WHERE id = $1", [req.user.id]);
    });
    for (const f of files) await unlink(join(config.uploadDir, basename(f.url))).catch(() => {});
    clearAuthCookies(res);
    await audit(null, "account.deleted", { handle: req.user.handle }, clientIp(req));
    res.json({ ok: true, message: "Account eliminato definitivamente." });
  })
);

accountRouter.get(
  "/badge.svg",
  asyncHandler(async (req, res) => {
    const handle = req.user.handle;
    const accent = (await loadPrefs(req.user.id)).accent;
    const svg = buildBadge(handle, req.user.level, accent);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="stemma-${handle.toLowerCase()}.svg"`);
    res.send(svg);
  })
);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function buildBadge(handle, level, accent) {
  const nm = esc(String(handle).toUpperCase().slice(0, 14));
  const c = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#5aa8ff";
  const pct = Math.min(100, Math.max(6, (level / 50) * 100));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="560" viewBox="0 0 480 560">
<defs>
<linearGradient id="bb" x1="0" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="#0a1a3d"/><stop offset="0.5" stop-color="#050c20"/><stop offset="1" stop-color="#01030a"/></linearGradient>
<linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset="0.5" stop-color="${c}"/><stop offset="1" stop-color="#0a1a3d"/></linearGradient>
<radialGradient id="bg" cx="0.5" cy="0.3" r="0.75"><stop offset="0" stop-color="${c}" stop-opacity="0.5"/><stop offset="1" stop-color="#01030a" stop-opacity="0"/></radialGradient>
</defs>
<rect width="480" height="560" rx="34" fill="url(#bb)"/>
<rect width="480" height="560" rx="34" fill="url(#bg)"/>
<rect x="20" y="20" width="440" height="520" rx="24" fill="none" stroke="#bcc9dd" stroke-opacity="0.25"/>
<rect x="32" y="32" width="416" height="496" rx="18" fill="none" stroke="${c}" stroke-opacity="0.4" stroke-dasharray="5 9"/>
<g transform="translate(240 168)">
<circle r="82" fill="none" stroke="#8fc6ff" stroke-opacity="0.3" stroke-dasharray="6 10"/>
${Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-62" rx="16" ry="28" fill="url(#bm)" opacity="0.8" transform="rotate(${i * 45})"/>`).join("")}
<circle r="30" fill="url(#bm)"/><circle r="14" fill="#01030a" opacity="0.65"/>
</g>
<text x="240" y="300" text-anchor="middle" font-family="serif" font-size="40" fill="#f4f8ff" letter-spacing="6">${nm}</text>
<text x="240" y="334" text-anchor="middle" font-family="monospace" font-size="14" letter-spacing="7" fill="${c}">SAMURAI·DI·AVAKIN</text>
<line x1="140" y1="362" x2="340" y2="362" stroke="#8fc6ff" stroke-opacity="0.35"/>
<text x="240" y="404" text-anchor="middle" font-family="serif" font-size="22" fill="#c3e0ff" letter-spacing="3">侍</text>
<text x="240" y="452" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="4" fill="#97a6bd">LIVELLO ${esc(level)}</text>
<rect x="120" y="470" width="240" height="8" rx="4" fill="#0a1a3d" stroke="#5aa8ff" stroke-opacity="0.4"/>
<rect x="120" y="470" width="${Math.round(2.4 * pct)}" height="8" rx="4" fill="${c}"/>
</svg>`;
}

export { randomToken };
