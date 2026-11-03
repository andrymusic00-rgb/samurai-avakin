// server/src/routes/creative.js — Blog creativo samurai: post, media, like, commenti
import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { join, extname, basename } from "node:path";
import { one, many, query, tx } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { audit } from "../lib/audit.js";
import * as v from "../lib/validate.js";
import { config } from "../lib/config.js";

export const creativeRouter = Router();
creativeRouter.use(requireAuth);

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg", ".m4a"]);

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
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(ApiError.bad("unsupported", `Formato non supportato (${ext || "senza estensione"})`));
    cb(null, true);
  }
});

function mediaTipo(ext) {
  const e = ext.toLowerCase();
  if ([".mp4", ".webm", ".mov"].includes(e)) return "video";
  if ([".mp3", ".wav", ".ogg", ".m4a"].includes(e)) return "audio";
  return "foto";
}

/* ---------------------------------------------------------------- lista post */
creativeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tipo = v.oneOf(req.query.tipo, ["foto", "video", "audio", "testo", "misto"], { required: false, fallback: null });
    const autore = v.uuidOrNull(req.query.autore);
    const search = v.str(req.query.search, { max: 100, field: "Search" });
    const limit = v.intInRange(req.query.limit, { min: 1, max: 100, fallback: 50 });
    const offset = v.intInRange(req.query.offset, { min: 0, max: 10000, fallback: 0 });

    let sql = `
      SELECT cp.id, cp.user_id, cp.titolo, cp.corpo, cp.tipo, cp.media_url, cp.tags,
             cp.pubblico, cp.likes_count, cp.commenti_count, cp.creato_il, cp.aggiornato_il,
             u.display_name, u.handle, u.avatar_url, u.level
      FROM creative_posts cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.pubblico = true
    `;
    const params = [];
    let pIdx = 1;
    if (tipo) { sql += ` AND cp.tipo = $${pIdx++}`; params.push(tipo); }
    if (autore) { sql += ` AND cp.user_id = $${pIdx++}`; params.push(autore); }
    if (search) { sql += ` AND (cp.titolo ILIKE $${pIdx++} OR cp.corpo ILIKE $${pIdx++})`; params.push(`%${search}%`, `%${search}%`); }
    sql += ` ORDER BY cp.creato_il DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    params.push(limit, offset);

    const rows = await many(sql, params);

    // Like dell'utente corrente su questi post
    const postIds = rows.map((r) => r.id);
    let myLikes = new Set();
    if (postIds.length && req.user) {
      const lr = await many(
        `SELECT post_id FROM creative_post_likes WHERE post_id = ANY($1) AND user_id = $2`,
        [postIds, req.user.id]
      );
      lr.forEach((r) => myLikes.add(r.post_id));
    }

    res.json({
      ok: true,
      post: rows.map((r) => ({
        id: r.id,
        autore: { id: r.user_id, nome: r.display_name, handle: r.handle, avatarUrl: r.avatar_url, level: r.level },
        titolo: r.titolo,
        corpo: r.corpo,
        tipo: r.tipo,
        mediaUrl: r.media_url,
        tags: r.tags ?? [],
        pubblico: r.pubblico,
        likes: r.likes_count,
        commenti: r.commenti_count,
        mioLike: myLikes.has(r.id),
        creatoIl: r.creato_il,
        aggiornatoIl: r.aggiornato_il
      })),
      limite: limit,
      offset
    });
  })
);

/* ---------------------------------------------------------------- post mio */
creativeRouter.get(
  "/miei",
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT cp.id, cp.titolo, cp.corpo, cp.tipo, cp.media_url, cp.tags,
              cp.pubblico, cp.likes_count, cp.commenti_count, cp.creato_il, cp.aggiornato_il
       FROM creative_posts cp
       WHERE cp.user_id = $1
       ORDER BY cp.creato_il DESC`,
      [req.user.id]
    );
    res.json({ ok: true, post: rows.map((r) => ({
      id: r.id, titolo: r.titolo, corpo: r.corpo, tipo: r.tipo, mediaUrl: r.media_url,
      tags: r.tags ?? [], pubblico: r.pubblico, likes: r.likes_count, commenti: r.commenti_count,
      creatoIl: r.creato_il, aggiornatoIl: r.aggiornato_il
    })) });
  })
);

/* ---------------------------------------------------------------- singolo post */
creativeRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID post non valido");

    const post = await one(
      `SELECT cp.*, u.display_name, u.handle, u.avatar_url, u.level
       FROM creative_posts cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.id = $1`,
      [req.params.id]
    );
    if (!post) throw ApiError.notFound("Post non trovato");

    // Visibilità: pubblico o autore
    if (!post.pubblico && post.user_id !== req.user.id) throw ApiError.forbidden("Post privato");

    const media = await many(
      "SELECT id, url, tipo, titolo, creato_il FROM creative_post_media WHERE post_id = $1 ORDER BY creato_il ASC",
      [post.id]
    );
    const commenti = await many(
      `SELECT c.id, c.corpo, c.creato_il, u.display_name, u.handle, u.avatar_url, u.level
       FROM creative_post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.creato_il ASC`,
      [post.id]
    );

    let mioLike = false;
    if (req.user) {
      const l = await one("SELECT 1 FROM creative_post_likes WHERE post_id = $1 AND user_id = $2", [post.id, req.user.id]);
      mioLike = !!l;
    }

    res.json({
      ok: true,
      post: {
        id: post.id,
        autore: { id: post.user_id, nome: post.display_name, handle: post.handle, avatarUrl: post.avatar_url, level: post.level },
        titolo: post.titolo, corpo: post.corpo, tipo: post.tipo, mediaUrl: post.media_url,
        tags: post.tags ?? [], pubblico: post.pubblico,
        likes: post.likes_count, commenti: post.commenti_count, mioLike,
        creatoIl: post.creato_il, aggiornatoIl: post.aggiornato_il,
        media: media.map((m) => ({ id: m.id, url: m.url, tipo: m.tipo, titolo: m.titolo, creatoIl: m.creato_il })),
        commenti: commenti.map((c) => ({
          id: c.id, corpo: c.corpo, creatoIl: c.creato_il,
          autore: { nome: c.display_name, handle: c.handle, avatarUrl: c.avatar_url, level: c.level }
        }))
      }
    });
  })
);

/* ---------------------------------------------------------------- crea post */
creativeRouter.post(
  "/",
  writeLimiter,
  upload.array("files", 10),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const titolo = v.str(b.titolo, { min: 1, max: 120, required: true, field: "Titolo" });
    const corpo = v.str(b.corpo, { max: 5000, field: "Corpo" });
    const tipo = v.oneOf(b.tipo, ["foto", "video", "audio", "testo", "misto"], { required: true, field: "Tipo" });
    const pubblico = v.bool(b.pubblico, true);
    let tags = [];
    if (b.tags) {
      try { tags = JSON.parse(b.tags); } catch { tags = []; }
      tags = tags.filter((t) => typeof t === "string").slice(0, 10);
    }

    const files = req.files ?? [];
    if (files.length === 0 && tipo !== "testo") throw ApiError.bad("validation", "Aggiungi almeno un file multimediale");

    let post;
    await tx(async (c) => {
      const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
      const r = await run(
        `INSERT INTO creative_posts (user_id, titolo, corpo, tipo, media_url, tags, pubblico)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [req.user.id, titolo, corpo, tipo, files[0] ? `/uploads/${files[0].filename}` : "", tags, pubblico]
      );
      post = r.rows[0];

      for (const f of files) {
        await run(
          `INSERT INTO creative_post_media (post_id, user_id, url, tipo, titolo)
           VALUES ($1, $2, $3, $4, $5)`,
          [post.id, req.user.id, `/uploads/${f.filename}`, mediaTipo(extname(f.originalname)), f.originalname]
        );
      }

      // XP per creazione
      await run("INSERT INTO user_xp_log (user_id, azione, xp_guadagnato) VALUES ($1,'post_creativo',30)", [req.user.id]);
      await run("UPDATE users SET xp = xp + 30 WHERE id = $1", [req.user.id]);
    });

    await audit(req.user.id, "creative.post_created", { postId: post.id, tipo }, clientIp(req));
    res.status(201).json({ ok: true, postId: post.id, message: "Post creativo pubblicato" });
  })
);

/* ---------------------------------------------------------------- modifica post */
creativeRouter.patch(
  "/:id",
  writeLimiter,
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID post non valido");
    const b = req.body ?? {};
    const titolo = v.str(b.titolo, { min: 1, max: 120, field: "Titolo" });
    const corpo = v.str(b.corpo, { max: 5000, field: "Corpo" });
    const tipo = v.oneOf(b.tipo, ["foto", "video", "audio", "testo", "misto"], { field: "Tipo" });
    const pubblico = v.bool(b.pubblico, null);
    let tags = b.tags;
    if (tags) {
      try { tags = JSON.parse(tags); } catch { tags = []; }
      tags = tags.filter((t) => typeof t === "string").slice(0, 10);
    }

    const set = [];
    const params = [];
    let p = 1;
    if (titolo !== undefined) { set.push(`titolo = $${p++}`); params.push(titolo); }
    if (corpo !== undefined) { set.push(`corpo = $${p++}`); params.push(corpo); }
    if (tipo !== undefined) { set.push(`tipo = $${p++}`); params.push(tipo); }
    if (pubblico !== undefined) { set.push(`pubblico = $${p++}`); params.push(pubblico); }
    if (tags !== undefined) { set.push(`tags = $${p++}`); params.push(tags); }
    if (set.length === 0) throw ApiError.bad("validation", "Nessun campo da aggiornare");
    set.push(`aggiornato_il = now()`);
    params.push(req.params.id, req.user.id);

    const row = await one(
      `UPDATE creative_posts SET ${set.join(", ")} WHERE id = $${p} AND user_id = $${p + 1} RETURNING id`,
      params
    );
    if (!row) throw ApiError.notFound("Post non trovato o non tuo");

    await audit(req.user.id, "creative.post_updated", { postId: req.params.id }, clientIp(req));
    res.json({ ok: true, message: "Post aggiornato" });
  })
);

/* ---------------------------------------------------------------- elimina post */
creativeRouter.delete(
  "/:id",
  writeLimiter,
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID post non valido");
    const row = await one("DELETE FROM creative_posts WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
    if (!row) throw ApiError.notFound("Post non trovato o non tuo");
    await audit(req.user.id, "creative.post_deleted", { postId: req.params.id }, clientIp(req));
    res.json({ ok: true, message: "Post eliminato" });
  })
);

/* ---------------------------------------------------------------- like */
creativeRouter.post(
  "/:id/like",
  writeLimiter,
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID post non valido");
    const esistente = await one("SELECT 1 FROM creative_post_likes WHERE post_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (esistente) {
      await query("DELETE FROM creative_post_likes WHERE post_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
      await query("UPDATE creative_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1", [req.params.id]);
      res.json({ ok: true, like: false });
    } else {
      await query("INSERT INTO creative_post_likes (post_id, user_id) VALUES ($1, $2)", [req.params.id, req.user.id]);
      await query("UPDATE creative_posts SET likes_count = likes_count + 1 WHERE id = $1", [req.params.id]);
      res.json({ ok: true, like: true });
    }
  })
);

/* ---------------------------------------------------------------- commenti */
creativeRouter.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID post non valido");
    const rows = await many(
      `SELECT c.id, c.corpo, c.creato_il, u.display_name, u.handle, u.avatar_url, u.level
       FROM creative_post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.creato_il DESC`,
      [req.params.id]
    );
    res.json({ ok: true, commenti: rows.map((c) => ({
      id: c.id, corpo: c.corpo, creatoIl: c.creato_il,
      autore: { nome: c.display_name, handle: c.handle, avatarUrl: c.avatar_url, level: c.level }
    })) });
  })
);

creativeRouter.post(
  "/:id/comments",
  writeLimiter,
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID post non valido");
    const corpo = v.str(req.body?.corpo, { min: 1, max: 1000, required: true, field: "Commento" });
    const post = await one("SELECT id FROM creative_posts WHERE id = $1", [req.params.id]);
    if (!post) throw ApiError.notFound("Post non trovato");
    const r = await one(
      `INSERT INTO creative_post_comments (post_id, user_id, corpo) VALUES ($1, $2, $3)
       RETURNING id, creato_il`,
      [req.params.id, req.user.id, corpo]
    );
    await query("UPDATE creative_posts SET commenti_count = commenti_count + 1 WHERE id = $1", [req.params.id]);
    await audit(req.user.id, "creative.comment_created", { postId: req.params.id }, clientIp(req));
    res.status(201).json({ ok: true, commento: { id: r.id, corpo, creatoIl: r.creato_il } });
  })
);

creativeRouter.delete(
  "/:id/comments/:cid",
  writeLimiter,
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id) || !v.isUuid(req.params.cid)) throw ApiError.bad("validation", "ID non valido");
    const row = await one("DELETE FROM creative_post_comments WHERE id = $1 AND (user_id = $2 OR (SELECT user_id FROM creative_posts WHERE id = $3) = $2) RETURNING id", [req.params.cid, req.user.id, req.params.id]);
    if (!row) throw ApiError.notFound("Commento non trovato o non tuo");
    await query("UPDATE creative_posts SET commenti_count = GREATEST(0, commenti_count - 1) WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);
