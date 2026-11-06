// server/src/routes/video.js — Video upload (chunked), management, streaming
import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { join, extname } from "node:path";
import { one, many, query, tx } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { audit } from "../lib/audit.js";
import { config } from "../lib/config.js";
import { unlink, mkdir, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

export const videoRouter = Router();
videoRouter.use(requireAuth);

const ALLOWED_VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"]);
const ALLOWED_THUMB_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const CHUNK_DIR = join(config.uploadDir, "chunks");
const VIDEO_DIR = join(config.uploadDir, "videos");
const THUMB_DIR = join(config.uploadDir, "thumbnails");

async function ensureDirs() {
  await Promise.all([
    mkdir(CHUNK_DIR, { recursive: true }),
    mkdir(VIDEO_DIR, { recursive: true }),
    mkdir(THUMB_DIR, { recursive: true })
  ]);
}

function mediaTipo(ext) {
  const e = ext.toLowerCase();
  if ([".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"].includes(e)) return "video";
  return "unknown";
}

const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CHUNK_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const safe = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, safe);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_VIDEO_EXT.has(ext) && !ext.includes('chunk')) {
      return cb(ApiError.bad("unsupported", `Formato non supportato per chunk (${ext || "sconosciuto"})`));
    }
    cb(null, true);
  }
});

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEO_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const safe = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}${ALLOWED_VIDEO_EXT.has(ext) ? ext : ".mp4"}`;
    cb(null, safe);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_VIDEO_EXT.has(ext)) {
      return cb(ApiError.bad("unsupported", `Formato video non supportato (${ext || "sconosciuto"})`));
    }
    cb(null, true);
  }
});

const thumbUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, THUMB_DIR),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const safe = `thumb_${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}${ALLOWED_THUMB_EXT.has(ext) ? ext : ".jpg"}`;
      cb(null, safe);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_THUMB_EXT.has(ext)) {
      return cb(ApiError.bad("unsupported", `Formato thumbnail non supportato (${ext || "sconosciuto"})`));
    }
    cb(null, true);
  }
});

/* ---------------------------------------------------------------- Upload chunk */
videoRouter.post(
  "/upload-chunk",
  writeLimiter,
  chunkUpload.single("chunk"),
  asyncHandler(async (req, res) => {
    await ensureDirs();
    
    const videoId = req.body.videoId;
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const totalChunks = parseInt(req.body.totalChunks, 10);
    
    if (!videoId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      throw ApiError.bad("validation", "Parametri chunk mancanti");
    }
    
    const chunkDir = join(CHUNK_DIR, videoId);
    await mkdir(chunkDir, { recursive: true });
    
    const finalName = `chunk_${chunkIndex.toString().padStart(5, '0')}`;
    const finalPath = join(chunkDir, finalName);
    
    await pipeline(
      createReadStream(req.file.path),
      createWriteStream(finalPath)
    );
    
    await unlink(req.file.path).catch(() => {});
    
    await tx(async (c) => {
      await c.query(
        `INSERT INTO video_chunks (video_id, chunk_index, file_path, size, uploaded_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (video_id, chunk_index) DO UPDATE SET file_path = $3, size = $4, uploaded_at = now()`,
        [videoId, chunkIndex, finalPath, req.file.size]
      );
      
      await c.query(
        `UPDATE videos SET updated_at = now() WHERE id = $1`,
        [videoId]
      );
    });
    
    res.json({ ok: true, chunkIndex, received: req.file.size });
  })
);

/* ---------------------------------------------------------------- Finalize chunked upload */
videoRouter.post(
  "/finalize",
  writeLimiter,
  asyncHandler(async (req, res) => {
    await ensureDirs();
    
    const videoId = req.body.videoId;
    const totalChunks = parseInt(req.body.totalChunks, 10);
    
    if (!videoId || isNaN(totalChunks)) {
      throw ApiError.bad("validation", "Parametri finalize mancanti");
    }
    
    const chunkDir = join(CHUNK_DIR, videoId);
    
    const chunks = await many(
      `SELECT chunk_index, file_path FROM video_chunks WHERE video_id = $1 ORDER BY chunk_index`,
      [videoId]
    );
    
    if (chunks.length !== totalChunks) {
      throw ApiError.bad("validation", `Chunk mancanti: ${chunks.length}/${totalChunks}`);
    }
    
    const video = await one("SELECT * FROM videos WHERE id = $1", [videoId]);
    if (!video) throw ApiError.notFound("Video non trovato");
    
    const finalPath = join(VIDEO_DIR, `${videoId}${extname(video.file_name || 'video.mp4')}`);
    
    const writeStream = createWriteStream(finalPath);
    
    for (const chunk of chunks) {
      await pipeline(
        createReadStream(chunk.file_path),
        writeStream,
        { end: false }
      );
    }
    
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    await tx(async (c) => {
      await c.query(
        `UPDATE videos SET 
           media_url = $1,
           file_size = $2,
           synced = true,
           server_id = $3,
           updated_at = now()
         WHERE id = $4`,
        [`/uploads/videos/${videoId}${extname(video.file_name || 'video.mp4')}`, 
         (await stat(finalPath)).size,
         videoId,
         videoId]
      );
      
      await c.query(`DELETE FROM video_chunks WHERE video_id = $1`, [videoId]);
    });
    
    await Promise.all(
      chunks.map(chunk => unlink(chunk.file_path).catch(() => {}))
    );
    await unlink(chunkDir).catch(() => {});
    
    res.json({ 
      ok: true, 
      id: videoId, 
      url: `/uploads/videos/${videoId}${extname(video.file_name || 'video.mp4')}` 
    });
  })
);

/* ---------------------------------------------------------------- Single video upload */
videoRouter.post(
  "/upload",
  writeLimiter,
  videoUpload.single("video"),
  thumbUpload.single("thumbnail"),
  asyncHandler(async (req, res) => {
    await ensureDirs();
    
    const b = req.body;
    const titolo = b.titolo || req.file.originalname.replace(/\.[^/.]+$/, '');
    const descrizione = b.descrizione || '';
    const categoria = b.categoria || 'video';
    const tags = b.tags ? JSON.parse(b.tags) : [];
    const visibilita = b.visibilita || 'public';
    const durata = parseInt(b.durata, 10) || 0;
    
    const videoId = `vid_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
    const ext = extname(req.file.originalname).toLowerCase();
    const finalName = `${videoId}${ext}`;
    const finalPath = join(VIDEO_DIR, finalName);
    
    await pipeline(
      createReadStream(req.file.path),
      createWriteStream(finalPath)
    );
    await unlink(req.file.path).catch(() => {});
    
    let thumbnailUrl = null;
    if (req.files?.thumbnail?.[0]) {
      const thumbFile = req.files.thumbnail[0];
      const thumbExt = extname(thumbFile.originalname).toLowerCase();
      const thumbName = `thumb_${videoId}${thumbExt}`;
      const thumbPath = join(THUMB_DIR, thumbName);
      
      await pipeline(
        createReadStream(thumbFile.path),
        createWriteStream(thumbPath)
      );
      await unlink(thumbFile.path).catch(() => {});
      thumbnailUrl = `/uploads/thumbnails/${thumbName}`;
    }
    
    await tx(async (c) => {
      await c.query(
        `INSERT INTO videos (id, user_id, titolo, descrizione, categoria, tags, visibilita, 
           media_url, file_name, file_size, mime_type, durata, thumbnail_url, creato_il, aggiornato_il, synced)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now(),true)
         RETURNING *`,
        [videoId, req.user.id, titolo, descrizione, categoria, tags, visibilita,
         `/uploads/videos/${finalName}`, req.file.originalname, req.file.size, 
         req.file.mimetype, durata, thumbnailUrl]
      );
      
      await c.query("INSERT INTO user_xp_log (user_id, azione, xp_guadagnato) VALUES ($1,'video_upload',50)", [req.user.id]);
      await c.query("UPDATE users SET xp = xp + 50 WHERE id = $1", [req.user.id]);
    });
    
    await audit(req.user.id, "video.uploaded", { videoId, categoria }, clientIp(req));
    
    res.status(201).json({ 
      ok: true, 
      videoId,
      message: "Video caricato con successo",
      video: {
        id: videoId,
        titolo,
        mediaUrl: `/uploads/videos/${finalName}`,
        thumbnailUrl
      }
    });
  })
);

/* ---------------------------------------------------------------- Lista video */
videoRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const categoria = req.query.categoria;
    const autore = req.query.autore;
    const search = req.query.search;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const synced = req.query.synced !== undefined ? req.query.synced === 'true' : undefined;
    
    let sql = `
      SELECT v.id, v.user_id, v.titolo, v.descrizione, v.categoria, v.tags, v.visibilita,
             v.media_url, v.file_name, v.file_size, v.mime_type, v.durata, v.thumbnail_url,
             v.creato_il, v.aggiornato_il, v.synced,
             u.display_name, u.handle, u.avatar_url, u.level
      FROM videos v
      JOIN users u ON u.id = v.user_id
      WHERE v.visibilita = 'public'
    `;
    const params = [];
    let pIdx = 1;
    
    if (categoria) { sql += ` AND v.categoria = $${pIdx++}`; params.push(categoria); }
    if (autore) { sql += ` AND v.user_id = $${pIdx++}`; params.push(autore); }
    if (search) { sql += ` AND (v.titolo ILIKE $${pIdx++} OR v.descrizione ILIKE $${pIdx++})`; params.push(`%${search}%`, `%${search}%`); }
    if (synced !== undefined) { sql += ` AND v.synced = $${pIdx++}`; params.push(synced); }
    
    sql += ` ORDER BY v.creato_il DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    params.push(limit, offset);
    
    const rows = await many(sql, params);
    
    let myReactions = new Map();
    if (req.user && rows.length) {
      const ids = rows.map(r => r.id);
      const reactions = await many(
        `SELECT video_id, emoji FROM video_reactions WHERE video_id = ANY($1) AND user_id = $2`,
        [ids, req.user.id]
      );
      reactions.forEach(r => myReactions.set(r.video_id, r.emoji));
    }
    
    res.json({
      ok: true,
      videos: rows.map(r => ({
        id: r.id,
        autore: { id: r.user_id, nome: r.display_name, handle: r.handle, avatarUrl: r.avatar_url, level: r.level },
        titolo: r.titolo,
        descrizione: r.descrizione,
        categoria: r.categoria,
        tags: r.tags ?? [],
        visibilita: r.visibilita,
        mediaUrl: r.media_url,
        fileName: r.file_name,
        fileSize: r.file_size,
        mimeType: r.mime_type,
        durata: r.durata,
        thumbnailUrl: r.thumbnail_url,
        creatoIl: r.creato_il,
        aggiornatoIl: r.aggiornato_il,
        synced: r.synced,
        miaReazione: myReactions.get(r.id) || null
      })),
      limite: limit,
      offset
    });
  })
);

/* ---------------------------------------------------------------- Singolo video */
videoRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const video = await one(
      `SELECT v.*, u.display_name, u.handle, u.avatar_url, u.level
       FROM videos v
       JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [req.params.id]
    );
    
    if (!video) throw ApiError.notFound("Video non trovato");
    if (!video.visibilita && video.user_id !== req.user?.id) throw ApiError.forbidden("Video privato");
    
    let miaReazione = null;
    if (req.user) {
      const r = await one("SELECT emoji FROM video_reactions WHERE video_id = $1 AND user_id = $2", [video.id, req.user.id]);
      miaReazione = r?.emoji || null;
    }
    
    const commenti = await many(
      `SELECT c.id, c.corpo, c.creato_il, u.display_name, u.handle, u.avatar_url, u.level
       FROM video_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.video_id = $1
       ORDER BY c.creato_il ASC`,
      [video.id]
    );
    
    res.json({
      ok: true,
      video: {
        id: video.id,
        autore: { id: video.user_id, nome: video.display_name, handle: video.handle, avatarUrl: video.avatar_url, level: video.level },
        titolo: video.titolo,
        descrizione: video.descrizione,
        categoria: video.categoria,
        tags: video.tags ?? [],
        visibilita: video.visibilita,
        mediaUrl: video.media_url,
        fileName: video.file_name,
        fileSize: video.file_size,
        mimeType: video.mime_type,
        durata: video.durata,
        thumbnailUrl: video.thumbnail_url,
        creatoIl: video.creato_il,
        aggiornatoIl: video.aggiornato_il,
        synced: video.synced,
        miaReazione,
        commenti: commenti.map(c => ({
          id: c.id,
          corpo: c.corpo,
          creatoIl: c.creato_il,
          autore: { nome: c.display_name, handle: c.handle, avatarUrl: c.avatar_url, level: c.level }
        }))
      }
    });
  })
);

/* ---------------------------------------------------------------- Reazioni video */
videoRouter.post(
  "/:id/reaction",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { emoji } = req.body;
    if (!emoji) throw ApiError.bad("validation", "Emoji richiesta");
    
    const video = await one("SELECT id FROM videos WHERE id = $1", [req.params.id]);
    if (!video) throw ApiError.notFound("Video non trovato");
    
    const existing = await one("SELECT emoji FROM video_reactions WHERE video_id = $1 AND user_id = $2", [video.id, req.user.id]);
    
    if (existing) {
      if (existing.emoji === emoji) {
        await query("DELETE FROM video_reactions WHERE video_id = $1 AND user_id = $2", [video.id, req.user.id]);
        res.json({ ok: true, reaction: null });
      } else {
        await query("UPDATE video_reactions SET emoji = $1 WHERE video_id = $1 AND user_id = $2", [emoji, video.id, req.user.id]);
        res.json({ ok: true, reaction: emoji });
      }
    } else {
      await query("INSERT INTO video_reactions (video_id, user_id, emoji) VALUES ($1, $2, $3)", [video.id, req.user.id, emoji]);
      res.json({ ok: true, reaction: emoji });
    }
  })
);

/* ---------------------------------------------------------------- Commenti video */
videoRouter.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT c.id, c.corpo, c.creato_il, u.display_name, u.handle, u.avatar_url, u.level
       FROM video_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.video_id = $1
       ORDER BY c.creato_il ASC`,
      [req.params.id]
    );
    res.json({ ok: true, commenti: rows.map(c => ({
      id: c.id, corpo: c.corpo, creatoIl: c.creato_il,
      autore: { nome: c.display_name, handle: c.handle, avatarUrl: c.avatar_url, level: c.level }
    })) });
  })
);

videoRouter.post(
  "/:id/comments",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const corpo = req.body.corpo;
    if (!corpo || corpo.trim().length === 0) throw ApiError.bad("validation", "Commento vuoto");
    
    const video = await one("SELECT id FROM videos WHERE id = $1", [req.params.id]);
    if (!video) throw ApiError.notFound("Video non trovato");
    
    const r = await one(
      `INSERT INTO video_comments (video_id, user_id, corpo) VALUES ($1, $2, $3) RETURNING id, creato_il`,
      [req.params.id, req.user.id, corpo]
    );
    
    await query("UPDATE videos SET commenti_count = commenti_count + 1 WHERE id = $1", [req.params.id]);
    
    res.status(201).json({ ok: true, commento: { id: r.id, corpo, creatoIl: r.creato_il } });
  })
);

videoRouter.delete(
  "/:id/comments/:cid",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const row = await one(
      `DELETE FROM video_comments WHERE id = $1 AND (user_id = $2 OR (SELECT user_id FROM videos WHERE id = $3) = $2) RETURNING id`,
      [req.params.cid, req.user.id, req.params.id]
    );
    if (!row) throw ApiError.notFound("Commento non trovato o non tuo");
    await query("UPDATE videos SET commenti_count = GREATEST(0, commenti_count - 1) WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);

/* ---------------------------------------------------------------- Streaming / Range Requests */
videoRouter.get(
  "/stream/:id",
  asyncHandler(async (req, res) => {
    const video = await one("SELECT media_url, mime_type, file_size FROM videos WHERE id = $1", [req.params.id]);
    if (!video) throw ApiError.notFound("Video non trovato");
    
    const path = join(process.cwd(), video.media_url.replace(/^\/uploads\//, 'uploads/'));
    
    try {
      await stat(path);
    } catch {
      throw ApiError.notFound("File video non trovato su disco");
    }
    
    const range = req.headers.range;
    const fileSize = video.file_size;
    
    if (!range) {
      res.setHeader('Content-Type', video.mime_type || 'video/mp4');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      createReadStream(path).pipe(res);
      return;
    }
    
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    
    res.status(206);
    res.setHeader('Content-Type', video.mime_type || 'video/mp4');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    
    createReadStream(path, { start, end }).pipe(res);
  })
);

/* ---------------------------------------------------------------- Elimina video */
videoRouter.delete(
  "/:id",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const video = await one("SELECT * FROM videos WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (!video) throw ApiError.notFound("Video non trovato o non tuo");
    
    await tx(async (c) => {
      await c.query("DELETE FROM video_comments WHERE video_id = $1", [video.id]);
      await c.query("DELETE FROM video_reactions WHERE video_id = $1", [video.id]);
      await c.query("DELETE FROM video_chunks WHERE video_id = $1", [video.id]);
      await c.query("DELETE FROM videos WHERE id = $1", [video.id]);
    });
    
    const filesToDelete = [
      join(process.cwd(), video.media_url.replace(/^\/uploads\//, 'uploads/')),
      video.thumbnail_url ? join(process.cwd(), video.thumbnail_url.replace(/^\/uploads\//, 'uploads/')) : null
    ].filter(Boolean);
    
    await Promise.all(filesToDelete.map(f => unlink(f).catch(() => {})));
    
    await audit(req.user.id, "video.deleted", { videoId: video.id }, clientIp(req));
    
    res.json({ ok: true, message: "Video eliminato" });
  })
);

export default videoRouter;