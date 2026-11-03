import { Router } from "express";
import { one, many, query, tx } from "../../db/index.js";
import { asyncHandler, ApiError, clientIp } from "../lib/http.js";
import { requireAuth, requireMinRole } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { audit } from "../lib/audit.js";
import { achievementsFor, syncAchievements } from "../lib/achievements.js";
import { uuidOrNull } from "../lib/validate.js";
import * as v from "../lib/validate.js";

export const clanRouter = Router();

const REGIONS = ["Europa", "America", "Asia", "Oceania", "MENA"];
const MAIN_CHARS = ["Troppa ⋆ ⋆ ⋆ ⋆ ⋆", "Troppa ⋆ ⋆ ⋆ ⋆", "Troppa ⋆ ⋆ ⋆", "Troppa ⋆ ⋆", "Troppa ⋆", "Senza scudiero"];
const DEVICES = ["iOS", "Android", "PC", "Console", "Altro"];

const publicMember = (u) => ({
  handle: u.handle,
  name: u.display_name,
  role: u.role,
  level: u.level,
  xp: u.xp,
  mainChar: u.main_char,
  avakinId: u.avakin_id,
  bio: u.bio,
  region: u.region,
  device: u.device,
  avatarUrl: u.avatar_url,
  lastLoginAt: u.last_login_at,
  createdAt: u.created_at
});

function eventPayload(row) {
  return {
    id: row.id,
    slug: row.slug,
    titolo: row.title,
    sommario: row.summary,
    categoria: row.category,
    inizio: row.starts_at,
    fine: row.ends_at,
    posti: row.capacity,
    iscritti: row.rsvp_count,
    postiRimasti: row.capacity > 0 ? Math.max(0, row.capacity - row.rsvp_count) : null,
    completo: row.capacity > 0 && row.rsvp_count >= row.capacity
  };
}

clanRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const r = await one("SELECT count(*)::int AS utenti FROM users");
    res.json({
      ok: true,
      servizio: "samurai-di-avakin",
      utenti: r?.utenti ?? 0,
      orario: new Date().toISOString()
    });
  })
);

/** Numeri pubblici del clan: alimentano la home anche senza sessione. */
clanRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const row = await one(
      `SELECT count(*) FILTER (WHERE status = 'attivo')::int                    AS membri,
              count(*) FILTER (WHERE status = 'attivo' AND role <> 'membro')::int AS ufficiali,
              COALESCE(round(avg(level) FILTER (WHERE status = 'attivo')), 0)::int AS livello_medio,
              COALESCE(max(level) FILTER (WHERE status = 'attivo'), 0)::int        AS livello_max,
              count(*) FILTER (WHERE avakin_id IS NOT NULL)::int                  AS collegati
         FROM users`
    );
    const raid = await one(
      `SELECT count(*)::int AS totale,
              COALESCE(sum(score), 0)::int AS punti,
              count(*) FILTER (WHERE result = 'vittoria')::int AS vittorie,
              count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS recenti
         FROM clan_raid_log`
    );
    res.json({
      ok: true,
      membri: row.membri,
      ufficiali: row.ufficiali,
      livelloMedio: row.livello_medio,
      livelloMax: row.livello_max,
      accountCollegati: row.collegati,
      raid: raid.totale,
      puntiRaid: raid.punti,
      vittorieRaid: raid.vittorie,
      raidRecenti: raid.recenti
    });
  })
);

clanRouter.get(
  "/roster",
  asyncHandler(async (_req, res) => {
    const rows = await many(
      `SELECT handle, display_name, role, level, xp, main_char, avakin_id, bio,
              region, device, avatar_url, last_login_at, created_at
         FROM users
        WHERE status = 'attivo'
        ORDER BY level DESC, created_at ASC
        LIMIT 100`
    );
    res.json({ ok: true, membri: rows.map(publicMember) });
  })
);

clanRouter.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT u.id, u.handle, u.display_name, u.level, u.role, u.avatar_url,
              COALESCE(s.vittorie, 0)   AS vittorie,
              COALESCE(s.sconfitte, 0)  AS sconfitte,
              COALESCE(s.raid, 0)       AS raid,
              COALESCE(s.ore, 0)        AS ore,
              COALESCE(s.kill_streak, 0) AS kill_streak,
              (SELECT count(*) FROM achievements a WHERE a.user_id = u.id)::int AS traguardi
         FROM users u
         LEFT JOIN user_stats s ON s.user_id = u.id
        WHERE u.status = 'attivo'
        ORDER BY vittorie DESC, u.level DESC
        LIMIT 25`
    );
    const io = req.user?.id ?? null;
    const classifica = rows.map((u, i) => {
      const total = u.vittorie + u.sconfitte;
      return {
        posizione: i + 1,
        handle: u.handle,
        nome: u.display_name,
        role: u.role,
        level: u.level,
        vittorie: u.vittorie,
        sconfitte: u.sconfitte,
        raid: u.raid,
        ore: u.ore,
        killStreak: u.kill_streak,
        traguardi: u.traguardi,
        winRate: total ? Math.round((u.vittorie / total) * 100) : 0,
        avatarUrl: u.avatar_url,
        seiTu: io ? u.id === io : false
      };
    });
    res.json({ ok: true, classifica });
  })
);

clanRouter.get(
  "/raid",
  asyncHandler(async (_req, res) => {
    const rows = await many(
      `SELECT id, title, category, result, score, opponent, created_at
         FROM clan_raid_log ORDER BY created_at DESC LIMIT 20`
    );
    const total = await one(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE result = 'vittoria')::int AS vittorie
         FROM clan_raid_log`
    );
    res.json({
      ok: true,
      totale: total.n,
      vittorie: total.vittorie,
      winRate: total.n ? Math.round((total.vittorie / total.n) * 100) : 0,
      raid: rows.map((r) => ({
        id: r.id,
        titolo: r.title,
        categoria: r.category,
        esito: r.result,
        score: r.score,
        avversario: r.opponent,
        data: r.created_at
      }))
    });
  })
);

/* ---------------------------------------------------------------- events */

clanRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT id, slug, title, summary, category, starts_at, ends_at, capacity, rsvp_count
         FROM events
        WHERE starts_at > now() - interval '1 day'
        ORDER BY starts_at ASC
        LIMIT 20`
    );
    const mio = new Set();
    if (req.user?.id && rows.length) {
      const mine = await many(
        "SELECT event_id::text AS id FROM event_rsvp WHERE user_id = $1",
        [req.user.id]
      );
      for (const m of mine) mio.add(m.id);
    }
    res.json({ ok: true, eventi: rows.map((r) => ({ ...eventPayload(r), iscritto: mio.has(String(r.id)) })) });
  })
);

clanRouter.post(
  "/events",
  requireMinRole("bushi"),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const title = v.str(b.title, { min: 4, max: 90, required: true, field: "Titolo" });
    const slug = v.str(b.slug, { max: 60, field: "Slug" })
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `evento-${Date.now().toString(36)}`;
    const starts = new Date(b.startsAt ?? Date.now());
    if (Number.isNaN(starts.getTime())) throw ApiError.bad("validation", "Data di inizio non valida", { field: "startsAt" });
    const ends = b.endsAt ? new Date(b.endsAt) : null;
    if (ends && Number.isNaN(ends.getTime())) throw ApiError.bad("validation", "Data di fine non valida", { field: "endsAt" });

    const row = await one(
      `INSERT INTO events (slug, title, summary, category, starts_at, ends_at, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title, summary = EXCLUDED.summary, category = EXCLUDED.category,
             starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, capacity = EXCLUDED.capacity
       RETURNING id, slug, title, summary, category, starts_at, ends_at, capacity, rsvp_count`,
      [
        slug,
        title,
        v.str(b.summary, { max: 240, field: "Sommario" }),
        v.oneOf(b.category, ["raid", "evento", "guida", "riunione"], { field: "Categoria", fallback: "raid" }),
        starts.toISOString(),
        ends ? ends.toISOString() : null,
        v.intInRange(b.capacity, { min: 0, max: 10000, fallback: 0 })
      ]
    );
    await audit(req.user.id, "clan.event_created", { slug }, clientIp(req));
    res.status(201).json({ ok: true, evento: eventPayload(row) });
  })
);

clanRouter.post(
  "/events/:id/rsvp",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const ev = await one(
      "SELECT id, capacity, rsvp_count, starts_at FROM events WHERE ($2::uuid IS NOT NULL AND id = $2::uuid) OR slug = $1",
      [req.params.id, uuidOrNull(req.params.id)]
    );
    if (!ev) throw ApiError.notFound("Evento non trovato");
    if (new Date(ev.starts_at).getTime() < Date.now()) throw ApiError.conflict("L'evento è già passato");
    if (ev.capacity > 0 && ev.rsvp_count >= ev.capacity) throw ApiError.conflict("Posti esauriti");

    const done = await one(
      `INSERT INTO event_rsvp (event_id, user_id) VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO UPDATE SET created_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [ev.id, req.user.id]
    );
    if (done.inserted) await query("UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = $1", [ev.id]);

    const fresh = await one("SELECT rsvp_count FROM events WHERE id = $1", [ev.id]);
    await syncAchievements(req.user.id);
    res.json({ ok: true, iscritto: true, iscritti: fresh.rsvp_count, postiRimasti: ev.capacity > 0 ? Math.max(0, ev.capacity - fresh.rsvp_count) : null });
  })
);

clanRouter.delete(
  "/events/:id/rsvp",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const ev = await one("SELECT id FROM events WHERE ($2::uuid IS NOT NULL AND id = $2::uuid) OR slug = $1", [
      req.params.id,
      uuidOrNull(req.params.id)
    ]);
    if (!ev) throw ApiError.notFound("Evento non trovato");
    const gone = await one("DELETE FROM event_rsvp WHERE event_id = $1 AND user_id = $2 RETURNING user_id", [ev.id, req.user.id]);
    if (gone) await query("UPDATE events SET rsvp_count = GREATEST(0, rsvp_count - 1) WHERE id = $1", [ev.id]);
    const fresh = await one("SELECT rsvp_count, capacity FROM events WHERE id = $1", [ev.id]);
    res.json({
      ok: true,
      iscritto: false,
      iscritti: fresh.rsvp_count,
      postiRimasti: fresh.capacity > 0 ? Math.max(0, fresh.capacity - fresh.rsvp_count) : null
    });
  })
);

/** Esporta gli eventi futuri come calendario .ics, utilizzabile da Google/Apple. */
clanRouter.get(
  "/events.ics",
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT slug, title, summary, category, starts_at, ends_at
         FROM events WHERE starts_at > now() ORDER BY starts_at ASC LIMIT 50`
    );
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = (v) =>
      String(v ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Samurai di Avakin//Eventi//IT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${ics("Samurai di Avakin")}`,
      "X-WR-TIMEZONE:Europe/Rome"
    ];
    for (const e of rows) {
      const end = e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 2 * 3600_000);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${e.slug}@samurai-di-avakin`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${new Date(e.starts_at).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTEND:${new Date(end).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `SUMMARY:${ics(e.title)}`,
        `DESCRIPTION:${ics(e.summary || "Evento del clan Samurai di Avakin")}`,
        `CATEGORIES:${ics((e.category || "raid").toUpperCase())}`,
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="samurai-eventi.ics"');
    res.send(lines.join("\r\n"));
  })
);

/* ---------------------------------------------------------- candidature */

clanRouter.post(
  "/applications",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const nickname = v.str(b.nickname, { min: 3, max: 24, required: true, field: "Nickname" });
    const avakinId = v.digits(b.avakinId, { field: "ID Avakin" });
    const message = v.str(b.message, { min: 20, max: 400, required: true, field: " Motivazione" });

    const taken = await one(
      "SELECT id FROM applications WHERE avakin_id = $1 AND status = 'in_bozza'",
      [avakinId]
    );
    if (taken) throw ApiError.conflict("Questa candidatura è già in attesa di revisione");

    const linked = await one("SELECT id FROM users WHERE avakin_id = $1", [avakinId]);
    if (linked) throw ApiError.conflict("Questo ID Avakin è già collegato a un membro del clan");

    const row = await one(
      `INSERT INTO applications (nickname, avakin_id, region, main_char, device, message, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nickname, avakin_id, region, main_char, device, message, status, created_at`,
      [
        nickname,
        avakinId,
        v.oneOf(b.region, REGIONS, { field: "Regione", fallback: "Europa" }),
        v.oneOf(b.mainChar, MAIN_CHARS, { field: "Personaggio", fallback: "" }),
        v.oneOf(b.device, DEVICES, { field: "Dispositivo", fallback: "" }),
        message,
        req.user?.id ?? null
      ]
    );
    // `row.id` e' l'UUID della candidatura, non dell'utente: passarlo come
    // user_id farebbe fallire la foreign key di audit_log.
    await audit(req.user?.id ?? null, "clan.application_submitted", { avakinId, applicationId: row.id }, clientIp(req));
    res.status(201).json({
      ok: true,
      candidatura: { id: row.id, nickname: row.nickname, status: row.status, createdAt: row.created_at },
      message: "Candidatura ricevuta. Il comando ti risponde entro 48 ore."
    });
  })
);

clanRouter.get(
  "/applications/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT id, nickname, avakin_id, region, main_char, device, message, status, note, created_at, decided_at
         FROM applications
        WHERE user_id = $1 OR avakin_id = $2
        ORDER BY created_at DESC LIMIT 20`,
      [req.user.id, req.user.avakin_id ?? ""]
    );
    res.json({ ok: true, candidature: rows.map(applicationPayload) });
  })
);

clanRouter.get(
  "/applications",
  requireMinRole("bushi"),
  asyncHandler(async (req, res) => {
    const status = v.oneOf(req.query.status, ["in_bozza", "approvata", "rifiutata", "tutte"], { field: "status", fallback: "in_bozza" });
    const rows = await many(
      `SELECT a.*, u.handle AS decided_by_handle
         FROM applications a
         LEFT JOIN users u ON u.id = a.decided_by
        WHERE ($1 = 'tutte' OR a.status = $1)
        ORDER BY (a.status = 'in_bozza') DESC, a.created_at DESC
        LIMIT 100`,
      [status]
    );
    const counts = await one(
      `SELECT count(*) FILTER (WHERE status = 'in_bozza')::int   AS in_bozza,
              count(*) FILTER (WHERE status = 'approvata')::int  AS approvata,
              count(*) FILTER (WHERE status = 'rifiutata')::int  AS rifiutata
         FROM applications`
    );
    res.json({ ok: true, candidature: rows.map(applicationPayload), conteggi: counts });
  })
);

function applicationPayload(r) {
  return {
    id: r.id,
    nickname: r.nickname,
    avakinId: r.avakin_id,
    region: r.region,
    mainChar: r.main_char,
    device: r.device,
    message: r.message,
    status: r.status,
    note: r.note,
    decidedBy: r.decided_by_handle ?? null,
    createdAt: r.created_at,
    decidedAt: r.decided_at
  };
}

clanRouter.post(
  "/applications/:id/decision",
  requireMinRole("bushi"),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const decision = v.oneOf(b.decision, ["approvata", "rifiutata"], { required: true, field: "Decisione" });
    const note = v.str(b.note, { max: 240, field: "Nota" });

    const app = await one("SELECT * FROM applications WHERE ($1::uuid IS NOT NULL AND id = $1::uuid)", [uuidOrNull(req.params.id)]);
    if (!app) throw ApiError.notFound("Candidatura non trovata");
    if (app.status !== "in_bozza") throw ApiError.conflict("Questa candidatura è già stata decisa");

    const updated = await tx(async (c) => {
      const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
      const row = await run(
        `UPDATE applications
            SET status = $1, note = $2, decided_by = $3, decided_at = now()
          WHERE id = $4
          RETURNING id, nickname, avakin_id, region, main_char, device, message, status, note, created_at, decided_at`,
        [decision, note, req.user.id, app.id]
      );
      await run("INSERT INTO application_history (avakin_id, nickname, status) VALUES ($1, $2, $3)", [
        app.avakin_id,
        app.nickname,
        decision
      ]);
      return row.rows[0];
    });

    await audit(req.user.id, `clan.application_${decision}`, { applicationId: app.id, avakinId: app.avakin_id }, clientIp(req));
    res.json({ ok: true, candidatura: applicationPayload(updated) });
  })
);

/* ------------------------------------------------------------- reactions */

const CONTENT_KEY = /^[\w:.-]{1,80}$/;

clanRouter.get(
  "/content/:key/reactions",
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!CONTENT_KEY.test(key)) throw ApiError.bad("validation", "Chiave contenuto non valida");
    const rows = await many(
      `SELECT emoji, count(*)::int AS totale
         FROM content_reactions WHERE content_key = $1
        GROUP BY emoji ORDER BY totale DESC`,
      [key]
    );
    const io = req.user?.id ?? null;
    const mine = io
      ? (await many("SELECT emoji FROM content_reactions WHERE content_key = $1 AND user_id = $2", [key, io])).map((r) => r.emoji)
      : [];
    const comments = await many(
      `SELECT c.id, c.body, c.created_at, u.handle, u.display_name, u.avatar_url, u.role
         FROM content_comments c JOIN users u ON u.id = c.user_id
        WHERE c.content_key = $1 ORDER BY c.created_at ASC LIMIT 100`,
      [key]
    );
    res.json({
      ok: true,
      reactions: rows.map((r) => ({ emoji: r.emoji, totale: r.totale })),
      mie: mine,
      commenti: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.created_at,
        handle: c.handle,
        nome: c.display_name,
        avatarUrl: c.avatar_url,
        role: c.role
      }))
    });
  })
);

clanRouter.post(
  "/content/:key/reactions",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!CONTENT_KEY.test(key)) throw ApiError.bad("validation", "Chiave contenuto non valida");
    const emoji = v.str(req.body?.emoji, { min: 1, max: 4, required: true, field: "Reazione" });
    await query(
      `INSERT INTO content_reactions (content_key, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (content_key, user_id, emoji) DO NOTHING`,
      [key, req.user.id, emoji]
    );
    const rows = await many(
      "SELECT emoji, count(*)::int AS totale FROM content_reactions WHERE content_key = $1 GROUP BY emoji ORDER BY totale DESC",
      [key]
    );
    res.json({ ok: true, reactions: rows.map((r) => ({ emoji: r.emoji, totale: r.totale })) });
  })
);

clanRouter.delete(
  "/content/:key/reactions",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!CONTENT_KEY.test(key)) throw ApiError.bad("validation", "Chiave contenuto non valida");
    const emoji = v.str(req.body?.emoji, { min: 1, max: 4, required: true, field: "Reazione" });
    await query("DELETE FROM content_reactions WHERE content_key = $1 AND user_id = $2 AND emoji = $3", [key, req.user.id, emoji]);
    const rows = await many(
      "SELECT emoji, count(*)::int AS totale FROM content_reactions WHERE content_key = $1 GROUP BY emoji ORDER BY totale DESC",
      [key]
    );
    res.json({ ok: true, reactions: rows.map((r) => ({ emoji: r.emoji, totale: r.totale })) });
  })
);

clanRouter.post(
  "/content/:key/comments",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!CONTENT_KEY.test(key)) throw ApiError.bad("validation", "Chiave contenuto non valida");
    const body = v.str(req.body?.body, { min: 2, max: 500, required: true, field: "Commento" });
    const row = await one(
      `INSERT INTO content_comments (content_key, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [key, req.user.id, body]
    );
    res.status(201).json({
      ok: true,
      commento: {
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        handle: req.user.handle,
        nome: req.user.display_name,
        avatarUrl: req.user.avatar_url,
        role: req.user.role
      }
    });
  })
);

clanRouter.delete(
  "/content/:key/comments/:id",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const row = await one(
      `DELETE FROM content_comments
        WHERE ($1::uuid IS NOT NULL AND id = $1::uuid) AND content_key = $2 AND (user_id = $3 OR $4 = 'admin')
        RETURNING id`,
      [req.params.id, req.params.key, req.user.id, req.user.role]
    );
    if (!row) throw ApiError.notFound("Commento non trovato");
    res.json({ ok: true });
  })
);

/* ---------------------------------------------------------- newsletter */

clanRouter.post(
  "/subscribe",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const email = v.email(req.body?.email);
    await query(
      `INSERT INTO subscribers (email, source) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [email, v.str(req.body?.source, { max: 30, field: "Fonte" }) || "newsletter"]
    );
    await audit(null, "clan.subscribed", { source: "newsletter" }, clientIp(req));
    res.json({ ok: true, message: "Iscrizione registrata. Riceverai il prossimo bollettino." });
  })
);

clanRouter.get(
  "/subscribers/count",
  asyncHandler(async (_req, res) => {
    const r = await one("SELECT count(*)::int AS n FROM subscribers");
    res.json({ ok: true, iscritti: r.n });
  })
);

/* --------------------------------------------------------- achievements */

clanRouter.get(
  "/achievements",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ ok: true, ...(await achievementsFor(req.user.id)) });
  })
);

/* ---------------------------------------------------------- eventi custom */

/** Lista eventi custom (pubblica, visibile anche senza login). */
clanRouter.get(
  "/events-custom",
  asyncHandler(async (req, res) => {
    const mio = new Set();
    if (req.user?.id) {
      const mine = await many(
        "SELECT event_id::text AS id FROM clan_event_custom_rsvps WHERE user_id = $1",
        [req.user.id]
      );
      for (const m of mine) mio.add(m.id);
    }
    const rows = await many(
      `SELECT e.id, e.titolo, e.descrizione, e.categoria, e.immagine_url,
              e.inizio, e.fine, e.posti, e.luogo, e.pubblico, e.creato_il,
              count(r.id)::int AS iscritti,
              u.handle, u.display_name, u.avatar_url, u.level
       FROM clan_events_custom e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN clan_event_custom_rsvps r ON r.event_id = e.id
       WHERE e.pubblico = true
       GROUP BY e.id, u.handle, u.display_name, u.avatar_url, u.level
       ORDER BY e.inizio ASC
       LIMIT 50`
    );
    res.json({
      ok: true,
      eventi: rows.map((r) => ({
        id: r.id,
        titolo: r.titolo,
        sommario: r.descrizione,
        categoria: r.categoria,
        immagine: r.immagine_url,
        inizio: r.inizio,
        fine: r.fine,
        posti: r.posti,
        luogo: r.luogo,
        iscritti: r.iscritti,
        postoRimasti: r.posti > 0 ? Math.max(0, r.posti - r.iscritti) : null,
        completo: r.posti > 0 && r.iscritti >= r.posti,
        iscritto: mio.has(String(r.id)),
        autore: {
          id: r.user_id,
          handle: r.handle,
          nome: r.display_name,
          avatarUrl: r.avatar_url,
          level: r.level
        },
        creatoIl: r.creato_il
      }))
    });
  })
);

/** Dettaglio singolo evento custom. */
clanRouter.get(
  "/events-custom/:id",
  asyncHandler(async (req, res) => {
    const row = await one(
      `SELECT e.*, u.handle, u.display_name, u.avatar_url, u.level,
              count(r.id)::int AS iscritti
       FROM clan_events_custom e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN clan_event_custom_rsvps r ON r.event_id = e.id
       WHERE e.id = $1
       GROUP BY e.id, u.handle, u.display_name, u.avatar_url, u.level`,
      [req.params.id]
    );
    if (!row) throw ApiError.notFound("Evento non trovato");
    let mioLike = false;
    if (req.user?.id) {
      const l = await one(
        "SELECT 1 FROM clan_event_custom_rsvps WHERE event_id = $1 AND user_id = $2",
        [row.id, req.user.id]
      );
      mioLike = !!l;
    }
    res.json({
      ok: true,
      evento: {
        id: row.id,
        titolo: row.titolo,
        sommario: row.descrizione,
        categoria: row.categoria,
        immagine: row.immagine_url,
        inizio: row.inizio,
        fine: row.fine,
        posti: row.posti,
        luogo: row.luogo,
        pubblico: row.pubblico,
        iscritti: row.iscritti,
        postoRimasti: row.posti > 0 ? Math.max(0, row.posti - row.iscritti) : null,
        completo: row.posti > 0 && row.iscritti >= row.posti,
        iscritto: mioLike,
        autore: {
          id: row.user_id,
          handle: row.handle,
          nome: row.display_name,
          avatarUrl: row.avatar_url,
          level: row.level
        },
        creatoIl: row.creato_il
      }
    });
  })
);

/** Crea evento custom (richiede login). */
clanRouter.post(
  "/events-custom",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const titolo = v.str(b.titolo, { min: 4, max: 90, required: true, field: "Titolo" });
    const descrizione = v.str(b.descrizione, { max: 1000, field: "Descrizione" });
    const categoria = v.oneOf(b.categoria, ["evento", "raid", "guida", "riunione"], { field: "Categoria", fallback: "evento" });
    const inizio = new Date(b.inizio ?? Date.now());
    if (Number.isNaN(inizio.getTime())) throw ApiError.bad("validation", "Data di inizio non valida", { field: "inizio" });
    const fine = b.fine ? new Date(b.fine) : null;
    if (fine && Number.isNaN(fine.getTime())) throw ApiError.bad("validation", "Data di fine non valida", { field: "fine" });
    const posti = v.intInRange(b.posti, { min: 0, max: 10000, fallback: 0 });
    const luogo = v.str(b.luogo, { max: 100, field: "Luogo" });
    const immagine = v.str(b.immagine, { max: 300, field: "Immagine" });
    const pubblico = v.bool(b.pubblico, true);

    const row = await one(
      `INSERT INTO clan_events_custom (user_id, titolo, descrizione, categoria, immagine_url, inizio, fine, posti, luogo, pubblico)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [req.user.id, titolo, descrizione, categoria, immagine, inizio.toISOString(), fine ? fine.toISOString() : null, posti, luogo, pubblico]
    );
    await audit(req.user.id, "clan.event_custom_created", { titolo, categoria }, clientIp(req));
    res.status(201).json({ ok: true, evento: { id: row.id } });
  })
);

/** Iscrizione a evento custom (richiede login). */
clanRouter.post(
  "/events-custom/:id/rsvp",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const ev = await one("SELECT id, posti FROM clan_events_custom WHERE id = $1", [req.params.id]);
    if (!ev) throw ApiError.notFound("Evento non trovato");
    if (ev.posti > 0) {
      const count = await one("SELECT count(*)::int AS n FROM clan_event_custom_rsvps WHERE event_id = $1", [ev.id]);
      if (count.n >= ev.posti) throw ApiError.conflict("Posti esauriti");
    }
    const esistente = await one("SELECT 1 FROM clan_event_custom_rsvps WHERE event_id = $1 AND user_id = $2", [ev.id, req.user.id]);
    if (esistente) throw ApiError.conflict("Già iscritto a questo evento");
    await query("INSERT INTO clan_event_custom_rsvps (event_id, user_id) VALUES ($1, $2)", [ev.id, req.user.id]);
    await audit(req.user.id, "clan.event_custom_rsvp", { eventId: ev.id }, clientIp(req));
    const fresh = await one("SELECT count(*)::int AS n FROM clan_event_custom_rsvps WHERE event_id = $1", [ev.id]);
    res.json({ ok: true, iscritto: true, iscritti: fresh.n, postoRimasti: ev.posti > 0 ? Math.max(0, ev.posti - fresh.n) : null });
  })
);

/** Disiscrizione da evento custom (richiede login). */
clanRouter.delete(
  "/events-custom/:id/rsvp",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const gone = await one("DELETE FROM clan_event_custom_rsvps WHERE event_id = $1 AND user_id = $2 RETURNING event_id", [req.params.id, req.user.id]);
    if (!gone) throw ApiError.notFound("Iscrizione non trovata");
    const fresh = await one("SELECT count(*)::int AS n FROM clan_event_custom_rsvps WHERE event_id = $1", [req.params.id]);
    const ev = await one("SELECT posti FROM clan_events_custom WHERE id = $1", [req.params.id]);
    res.json({
      ok: true,
      iscritto: false,
      iscritti: fresh.n,
      postoRimasti: ev?.posti > 0 ? Math.max(0, ev.posti - fresh.n) : null
    });
  })
);

/** Elimina evento custom (solo autore o ruolo >= bushi). */
clanRouter.delete(
  "/events-custom/:id",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const ev = await one("SELECT id, user_id FROM clan_events_custom WHERE id = $1", [req.params.id]);
    if (!ev) throw ApiError.notFound("Evento non trovato");
    const isAutore = ev.user_id === req.user.id;
    const puoGestire = ["bushi", "shogun", "admin"].includes(req.user.role);
    if (!isAutore && !puoGestire) throw ApiError.forbidden("Non puoi eliminare questo evento");
    await query("DELETE FROM clan_events_custom WHERE id = $1", [req.params.id]);
    await audit(req.user.id, "clan.event_custom_deleted", { eventId: req.params.id }, clientIp(req));
    res.json({ ok: true });
  })
);

