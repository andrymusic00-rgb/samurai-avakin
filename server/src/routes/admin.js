import { Router } from "express";
import { one, many, query } from "../../db/index.js";
import { asyncHandler, ApiError, clientIp } from "../lib/http.js";
import { requireMinRole } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { audit } from "../lib/audit.js";
import { syncAchievements } from "../lib/achievements.js";
import * as v from "../lib/validate.js";
import { uuidOrNull } from "../lib/validate.js";

/**
 * Area di comando: rotte riservate a bushi, shogun e admin.
 * Montata su /api/admin, mai raggiungibile da un membro semplice.
 */
export const adminRouter = Router();

adminRouter.use(requireMinRole("bushi"));

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [membri, candidature, eventi, raid, subs] = await Promise.all([
      one(
        `SELECT count(*) FILTER (WHERE status = 'attivo')::int AS attivi,
                count(*) FILTER (WHERE status = 'sospeso')::int AS sospesi,
                count(*) FILTER (WHERE role = 'bushi')::int AS bushi,
                count(*) FILTER (WHERE role = 'shogun')::int AS shogun,
                COALESCE(round(avg(level) FILTER (WHERE status = 'attivo')), 0)::int AS livello_medio
           FROM users`
      ),
      one("SELECT count(*)::int AS n FROM applications WHERE status = 'in_bozza'"),
      one("SELECT count(*)::int AS n FROM events WHERE starts_at > now()"),
      one("SELECT count(*)::int AS n FROM clan_raid_log WHERE created_at > now() - interval '30 days'"),
      one("SELECT count(*)::int AS n FROM subscribers")
    ]);
    res.json({ ok: true, membri, candidature, eventi, raid, subscribers: subs });
  })
);

adminRouter.get(
  "/members",
  asyncHandler(async (_req, res) => {
    const rows = await many(
      `SELECT u.id, u.handle, u.display_name, u.email, u.role, u.status, u.level, u.xp,
              u.region, u.main_char, u.device, u.avatar_url, u.avakin_id,
              u.last_login_at, u.created_at,
              s.vittorie, s.sconfitte, s.raid, s.ore, s.kill_streak,
              (SELECT count(*) FROM achievements a WHERE a.user_id = u.id)::int AS traguardi,
              (SELECT count(*) FROM event_rsvp e WHERE e.user_id = u.id)::int  AS eventi
         FROM users u
         LEFT JOIN user_stats s ON s.user_id = u.id
        ORDER BY u.level DESC, u.created_at ASC
        LIMIT 200`
    );
    res.json({
      ok: true,
      membri: rows.map((u) => ({
        id: u.id,
        handle: u.handle,
        nome: u.display_name,
        email: u.email,
        role: u.role,
        status: u.status,
        level: u.level,
        xp: u.xp,
        region: u.region,
        mainChar: u.main_char,
        avakinId: u.avakin_id,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
        stats: {
          vittorie: u.vittorie ?? 0,
          sconfitte: u.sconfitte ?? 0,
          raid: u.raid ?? 0,
          ore: u.ore ?? 0,
          killStreak: u.kill_streak ?? 0
        },
        traguardi: u.traguardi,
        eventi: u.eventi
      }))
    });
  })
);

adminRouter.patch(
  "/members/:id/stats",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const num = (k, max) => v.intInRange(b[k], { min: 0, max, fallback: null });

    const row = await one(
      `INSERT INTO user_stats (user_id, vittorie, sconfitte, raid, ore, kill_streak)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
         SET vittorie    = COALESCE($2, user_stats.vittorie),
             sconfitte   = COALESCE($3, user_stats.sconfitte),
             raid        = COALESCE($4, user_stats.raid),
             ore         = COALESCE($5, user_stats.ore),
             kill_streak = COALESCE($6, user_stats.kill_streak),
             aggiornato  = now()
       RETURNING *`,
      [req.params.id, num("vittorie", 1_000_000), num("sconfitte", 1_000_000), num("raid", 100_000), num("ore", 100_000), num("killStreak", 10_000)]
    );
    const traguardi = await syncAchievements(req.params.id);
    await audit(req.user.id, "admin.stats_updated", { userId: req.params.id }, clientIp(req));
    res.json({ ok: true, stats: row, nuoviTraguardi: traguardi.gained });
  })
);

adminRouter.patch(
  "/members/:id",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const current = await one("SELECT role, status, handle FROM users WHERE ($1::uuid IS NOT NULL AND id = $1::uuid)", [
      uuidOrNull(req.params.id)
    ]);
    if (!current) throw ApiError.notFound("Membro non trovato");

    const role = b.role ? v.oneOf(b.role, ["membro", "bushi", "shogun", "admin"], { field: "Ruolo" }) : current.role;
    const status = b.status ? v.oneOf(b.status, ["attivo", "sospeso", "espulso"], { field: "Stato" }) : current.status;
    const level = b.level != null ? v.intInRange(b.level, { min: 1, max: 50, fallback: current.level }) : null;

    if (current.handle.toLowerCase() === req.user.handle.toLowerCase() && (role !== req.user.role || status !== "attivo")) {
      throw ApiError.bad("validation", "Non puoi revocare i tuoi stessi permessi");
    }
    if (role === "shogun" && req.user.role !== "admin" && req.user.role !== "shogun") {
      throw ApiError.forbidden("Serve il ruolo admin per nominare uno Shogun");
    }

    const row = await one(
      `UPDATE users
          SET role = COALESCE($1, role),
              status = COALESCE($2, status),
              level = COALESCE($3, level),
              xp = CASE WHEN COALESCE($3, level) <> level THEN 0 ELSE xp END
        WHERE ($4::uuid IS NOT NULL AND id = $4::uuid)
        RETURNING id, display_name, handle, role, status, level, xp`,
      [b.role ? role : null, b.status ? status : null, level, uuidOrNull(req.params.id)]
    );
    if (!row) throw ApiError.notFound("Membro non trovato");
    await syncAchievements(row.id);
    await audit(req.user.id, "admin.member_updated", { handle: row.handle, role: row.role, status: row.status }, clientIp(req));
    res.json({ ok: true, membro: { id: row.id, nome: row.display_name, handle: row.handle, role: row.role, status: row.status, level: row.level, xp: row.xp } });
  })
);

adminRouter.post(
  "/raid",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const row = await one(
      `INSERT INTO clan_raid_log (title, category, result, score, opponent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, category, result, score, opponent, created_at`,
      [
        v.str(b.title, { min: 3, max: 90, required: true, field: "Titolo" }),
        v.oneOf(b.category, ["raid", "evento", "guida", "riunione"], { field: "Categoria", fallback: "raid" }),
        v.oneOf(b.result, ["vittoria", "sconfitta", "pareggio"], { field: "Esito", fallback: "vittoria" }),
        v.intInRange(b.score, { min: 0, max: 100000, fallback: 0 }),
        v.str(b.opponent, { max: 60, field: "Avversario" }) || "Sconosciuto"
      ]
    );
    await query(
      `UPDATE user_stats SET vittorie = vittorie + CASE WHEN $1 = 'vittoria' THEN 1 ELSE 0 END,
                            sconfitte = sconfitte + CASE WHEN $1 = 'sconfitta' THEN 1 ELSE 0 END,
                            raid = raid + 1
        WHERE user_id = ANY(SELECT id FROM users WHERE status = 'attivo')`,
      [row.result]
    );
    await audit(req.user.id, "admin.raid_logged", { result: row.result, title: row.title }, clientIp(req));
    res.status(201).json({ ok: true, raid: row });
  })
);

adminRouter.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const limit = v.intInRange(req.query.limit, { min: 1, max: 200, fallback: 60 });
    const rows = await many(
      `SELECT a.action, a.meta, a.ip, a.created_at, u.handle
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ ok: true, entries: rows });
  })
);
