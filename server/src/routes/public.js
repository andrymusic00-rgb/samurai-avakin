// server/src/routes/public.js — Public Content Upload/List (Anonymous + Authenticated)
import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { extname } from "node:path";
import { one, many, query, tx } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { audit } from "../lib/audit.js";
import * as v from "../lib/validate.js";
import { config } from "../lib/config.js";

export const publicRouter = Router();

// Config multer per upload pubblici (limiti più restrittivi per anonimi)
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov", ".mkv"]);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadDir),
    filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const safe = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}${ALLOWED_EXT.has(ext) ? ext : ".bin"}`;
        cb(null, safe);
    }
});

function mediaTypeFromExt(ext) {
    const e = ext.toLowerCase();
    if ([".mp4", ".webm", ".mov", ".mkv"].includes(e)) return "video";
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(e)) return "photo";
    return "unknown";
}

const publicUpload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024, files: 10 }, // 100MB, 10 file max
    fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) return cb(ApiError.bad("unsupported", `Formato non supportato (${ext || "senza estensione"})`));
        cb(null, true);
    }
});

// Helper: hash IP per moderazione anonima
function hashIp(ip) {
    const salt = process.env.IP_SALT || "samurai-salt-change-in-prod";
    return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

// Helper: controlla se IP è "trusted" (ha contenuti approvati)
async function isTrustedIp(ipHash) {
    const row = await one(
        `SELECT COUNT(*) as c FROM public_content WHERE author_ip_hash = $1 AND status = 'approved'`,
        [ipHash]
    );
    return +row.c >= 3; // 3+ contenuti approvati = trusted
}

// ============================================================
// POST /api/public/upload — Carica foto/video/evento
// ============================================================
publicRouter.post(
    "/upload",
    writeLimiter,
    optionalAuth, // Allega req.user se autenticato, altrimenti null
    publicUpload.array("files", 10),
    asyncHandler(async (req, res) => {
        const b = req.body;
        const files = req.files ?? [];
        
        const type = v.oneOf(b.type, ["photo", "video", "event"], { required: true, field: "Tipo" });
        const title = v.str(b.title, { min: 1, max: 200, required: true, field: "Titolo" });
        const description = v.str(b.description, { max: 5000, field: "Descrizione" });
        const category = v.str(b.category, { max: 50, field: "Categoria" }) || "creativo";
        let tags = [];
        if (b.tags) {
            try { tags = JSON.parse(b.tags); } catch { tags = []; }
            tags = tags.filter(t => typeof t === "string").slice(0, 10);
        }
        
        const authorName = v.str(b.authorName, { min: 1, max: 100, field: "Nome" }) || "Anonimo";
        const eventDate = b.eventDate ? v.isoDate(b.eventDate, { field: "Data evento" }) : null;
        const eventLocation = v.str(b.eventLocation, { max: 200, field: "Luogo" }) || null;
        
        // Validazione file
        if (type !== "event" && files.length === 0) {
            throw ApiError.bad("validation", "Almeno un file richiesto per foto/video");
        }
        if (type === "event" && !eventDate) {
            throw ApiError.bad("validation", "Data evento richiesta");
        }
        
        const ipHash = hashIp(clientIp(req));
        const userId = req.user?.id || null;
        const isAnonymous = !req.user;
        const trusted = userId ? true : await isTrustedIp(ipHash);
        const initialStatus = trusted ? "approved" : "pending";
        
        // Genera thumbnail per video (primo frame) - semplificato, in produzione usa ffmpeg
        let thumbnailUrl = null;
        let duration = null;
        
        if (type === "video" && files[0]) {
            // In produzione: usa ffmpeg per estrarre frame e durata
            // Per ora: placeholder, il frontend manda thumb generata client-side
            thumbnailUrl = b.thumbnailUrl || null; // Base64 o URL dal frontend
            duration = b.duration || null; // "12:34" dal frontend
        }
        
        const mediaUrl = files[0] ? `/uploads/${files[0].filename}` : null;
        
        const [content] = await tx(async (c) => {
            const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
            
            // Inserisci contenuto principale
            const r = await run(
                `INSERT INTO public_content 
                    (type, title, description, media_url, thumbnail_url, duration, category, tags, author_name, author_ip_hash, user_id, status, event_date, event_location)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                 RETURNING *`,
                [type, title, description, mediaUrl, thumbnailUrl, duration, category, tags, authorName, ipHash, userId, initialStatus, eventDate, eventLocation]
            );
            const content = r.rows[0];
            
            // Media aggiuntivi (gallery multiple)
            for (let i = 1; i < files.length; i++) {
                await run(
                    `INSERT INTO public_content_media (content_id, url, type, sort_order) VALUES ($1,$2,$3,$4)`,
                    [content.id, `/uploads/${files[i].filename}`, mediaTypeFromExt(extname(files[i].originalname)), i]
                );
            }
            
            // XP se autenticato
            if (userId) {
                await run("INSERT INTO user_xp_log (user_id, azione, xp_guadagnato) VALUES ($1,'public_upload',20)", [userId]);
                await run("UPDATE users SET xp = xp + 20 WHERE id = $1", [userId]);
            }
            
            return [content];
        });
        
        await audit(userId || ipHash, "public.upload", { contentId: content.id, type, anonymous: isAnonymous }, clientIp(req));
        
        res.status(201).json({ 
            ok: true, 
            content: {
                id: content.id,
                type: content.type,
                title: content.title,
                status: content.status,
                message: initialStatus === "approved" ? "Pubblicato subito!" : "In coda per moderazione, apparirà a breve."
            }
        });
    })
);

// ============================================================
// GET /api/public/content — Lista contenuti
// ============================================================
publicRouter.get(
    "/content",
    asyncHandler(async (req, res) => {
        const type = v.oneOf(req.query.type, ["photo", "video", "event"], { required: false, fallback: null });
        const category = v.str(req.query.category, { max: 50, field: "Categoria" }) || null;
        const status = v.oneOf(req.query.status, ["approved", "pending", "rejected"], { required: false, fallback: "approved" });
        const limit = v.intInRange(req.query.limit, { min: 1, max: 50, fallback: 20 });
        const cursor = req.query.cursor ? v.isoDate(req.query.cursor, { field: "Cursor" }) : null;
        const authorIp = req.query.myIp === "true" ? hashIp(clientIp(req)) : null;
        const userId = req.user?.id || null;
        
        let sql = `
            SELECT pc.*, 
                   u.display_name as user_display_name, u.handle as user_handle, u.avatar_url as user_avatar,
                   (SELECT COUNT(*) FROM public_content_likes WHERE content_id = pc.id) as likes_count,
                   (SELECT COUNT(*) FROM public_content_comments WHERE content_id = pc.id) as comments_count
            FROM public_content pc
            LEFT JOIN users u ON u.id = pc.user_id
            WHERE 1=1
        `;
        const params = [];
        let p = 1;
        
        // Se myIp=true, mostra approved + pending per quell'IP
        // Altrimenti solo lo status richiesto (default approved)
        if (authorIp) {
            sql += ` AND (pc.status = 'approved' OR (pc.status = 'pending' AND pc.author_ip_hash = $${p++}))`;
            params.push(authorIp);
        } else {
            sql += ` AND pc.status = $${p++}`;
            params.push(status);
        }
        
        if (type) { sql += ` AND pc.type = $${p++}`; params.push(type); }
        if (category) { sql += ` AND pc.category = $${p++}`; params.push(category); }
        if (authorIp) { sql += ` AND pc.author_ip_hash = $${p++}`; params.push(authorIp); }
        if (userId) { sql += ` AND pc.user_id = $${p++}`; params.push(userId); }
        if (cursor) { sql += ` AND pc.created_at < $${p++}`; params.push(cursor); }
        
        sql += ` ORDER BY pc.created_at DESC LIMIT $${p++}`;
        params.push(limit + 1); // +1 per hasMore
        
        const rows = await many(sql, params);
        const hasMore = rows.length > limit;
        const items = rows.slice(0, limit);
        
        // Aggiungi like dell'utente corrente se autenticato
        let myLikes = new Set();
        if (userId && items.length) {
            const ids = items.map(r => r.id);
            const lr = await many(
                `SELECT content_id FROM public_content_likes WHERE content_id = ANY($1) AND user_id = $2`,
                [ids, userId]
            );
            lr.forEach(r => myLikes.add(r.content_id));
        }
        
        res.json({
            ok: true,
            items: items.map(r => ({
                id: r.id,
                type: r.type,
                title: r.title,
                description: r.description,
                mediaUrl: r.media_url,
                thumbnailUrl: r.thumbnail_url,
                duration: r.duration,
                category: r.category,
                tags: r.tags ?? [],
                authorName: r.author_name,
                author: r.user_id ? {
                    id: r.user_id,
                    nome: r.user_display_name,
                    handle: r.user_handle,
                    avatarUrl: r.user_avatar
                } : null,
                likes: +r.likes_count,
                comments: +r.comments_count,
                myLike: myLikes.has(r.id),
                eventDate: r.event_date,
                eventLocation: r.event_location,
                createdAt: r.created_at,
                isMine: r.user_id === userId || (r.author_ip_hash === hashIp(clientIp(req)) && !userId)
            })),
            hasMore,
            nextCursor: hasMore ? items[items.length - 1].created_at : null
        });
    })
);

// ============================================================
// GET /api/public/content/:id — Singolo contenuto
// ============================================================
publicRouter.get(
    "/content/:id",
    asyncHandler(async (req, res) => {
        if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID non valido");
        
        const row = await one(`
            SELECT pc.*, 
                   u.display_name, u.handle, u.avatar_url, u.level,
                   (SELECT COUNT(*) FROM public_content_likes WHERE content_id = pc.id) as likes_count,
                   (SELECT COUNT(*) FROM public_content_comments WHERE content_id = pc.id) as comments_count
            FROM public_content pc
            LEFT JOIN users u ON u.id = pc.user_id
            WHERE pc.id = $1
        `, [req.params.id]);
        
        if (!row) throw ApiError.notFound("Contenuto non trovato");
        if (row.status !== "approved" && row.user_id !== req.user?.id && row.author_ip_hash !== hashIp(clientIp(req))) {
            throw ApiError.forbidden("Contenuto non visibile");
        }
        
        // Media aggiuntivi
        const media = await many(
            `SELECT id, url, type, sort_order FROM public_content_media WHERE content_id = $1 ORDER BY sort_order`,
            [row.id]
        );
        
        // Commenti
        const comments = await many(`
            SELECT c.*, u.display_name, u.handle, u.avatar_url, u.level
            FROM public_content_comments c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.content_id = $1
            ORDER BY c.created_at ASC
        `, [row.id]);
        
        let myLike = false;
        if (req.user) {
            const l = await one("SELECT 1 FROM public_content_likes WHERE content_id = $1 AND user_id = $2", [row.id, req.user.id]);
            myLike = !!l;
        }
        
        // Incrementa views (async, non bloccante)
        query("UPDATE public_content SET views_count = views_count + 1 WHERE id = $1", [row.id]).catch(() => {});
        
        res.json({ ok: true, content: {
            id: row.id,
            type: row.type,
            title: row.title,
            description: row.description,
            mediaUrl: row.media_url,
            thumbnailUrl: row.thumbnail_url,
            duration: row.duration,
            category: row.category,
            tags: row.tags ?? [],
            authorName: row.author_name,
            author: row.user_id ? { id: row.user_id, nome: row.display_name, handle: row.handle, avatarUrl: row.avatar_url, level: row.level } : null,
            likes: +row.likes_count,
            comments: +row.comments_count,
            myLike,
            eventDate: row.event_date,
            eventLocation: row.event_location,
            createdAt: row.created_at,
            media: media.map(m => ({ id: m.id, url: m.url, type: m.type })),
            comments: comments.map(c => ({
                id: c.id, body: c.body, createdAt: c.created_at,
                author: c.user_id ? { nome: c.display_name, handle: c.handle, avatarUrl: c.avatar_url, level: c.level } : { nome: c.author_name }
            })),
            isMine: row.user_id === req.user?.id || (row.author_ip_hash === hashIp(clientIp(req)) && !req.user)
        }});
    })
);

// ============================================================
// POST /api/public/content/:id/like — Like (solo autenticati)
// ============================================================
publicRouter.post(
    "/content/:id/like",
    writeLimiter,
    requireAuth,
    asyncHandler(async (req, res) => {
        if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID non valido");
        
        const exists = await one("SELECT 1 FROM public_content_likes WHERE content_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
        if (exists) {
            await query("DELETE FROM public_content_likes WHERE content_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
            await query("UPDATE public_content SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1", [req.params.id]);
            res.json({ ok: true, liked: false });
        } else {
            await query("INSERT INTO public_content_likes (content_id, user_id) VALUES ($1, $2)", [req.params.id, req.user.id]);
            await query("UPDATE public_content SET likes_count = likes_count + 1 WHERE id = $1", [req.params.id]);
            res.json({ ok: true, liked: true });
        }
    })
);

// ============================================================
// POST /api/public/content/:id/comments — Commento (auth + anonimo)
// ============================================================
publicRouter.post(
    "/content/:id/comments",
    writeLimiter,
    optionalAuth,
    asyncHandler(async (req, res) => {
        if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID non valido");
        const body = v.str(req.body?.body, { min: 1, max: 2000, required: true, field: "Commento" });
        const authorName = req.user ? null : v.str(req.body?.authorName, { min: 1, max: 100, field: "Nome" }) || "Anonimo";
        
        const post = await one("SELECT id FROM public_content WHERE id = $1 AND status = 'approved'", [req.params.id]);
        if (!post) throw ApiError.notFound("Contenuto non trovato");
        
        const r = await one(`
            INSERT INTO public_content_comments (content_id, user_id, author_name, body)
            VALUES ($1, $2, $3, $4) RETURNING id, created_at
        `, [req.params.id, req.user?.id || null, authorName, body]);
        
        await query("UPDATE public_content SET comments_count = comments_count + 1 WHERE id = $1", [req.params.id]);
        
        res.status(201).json({ ok: true, comment: { id: r.id, body, createdAt: r.created_at, author: req.user ? { nome: req.user.displayName } : { nome: authorName } } });
    })
);

// ============================================================
// DELETE /api/public/content/:id — Elimina (solo proprio)
// ============================================================
publicRouter.delete(
    "/content/:id",
    writeLimiter,
    optionalAuth,
    asyncHandler(async (req, res) => {
        if (!v.isUuid(req.params.id)) throw ApiError.bad("validation", "ID non valido");
        
        const ipHash = hashIp(clientIp(req));
        const userId = req.user?.id;
        
        const row = await one(`
            DELETE FROM public_content 
            WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND author_ip_hash = $3))
            RETURNING id
        `, [req.params.id, userId, ipHash]);
        
        if (!row) throw ApiError.notFound("Contenuto non trovato o non tuo");
        
        res.json({ ok: true, message: "Contenuto eliminato" });
    })
);

// ============================================================
// GET /api/public/mine — I miei contenuti (anonimo via IP o autenticato)
// ============================================================
publicRouter.get(
    "/mine",
    optionalAuth,
    asyncHandler(async (req, res) => {
        const ipHash = hashIp(clientIp(req));
        const userId = req.user?.id;
        
        const rows = await many(`
            SELECT pc.*, 
                   (SELECT COUNT(*) FROM public_content_likes WHERE content_id = pc.id) as likes_count
            FROM public_content pc
            WHERE (pc.user_id = $1) OR (pc.user_id IS NULL AND pc.author_ip_hash = $2)
            ORDER BY pc.created_at DESC
            LIMIT 50
        `, [userId, ipHash]);
        
        res.json({ ok: true, items: rows.map(r => ({
            id: r.id, type: r.type, title: r.title, status: r.status,
            mediaUrl: r.media_url, thumbnailUrl: r.thumbnail_url,
            category: r.category, likes: +r.likes_count,
            createdAt: r.created_at, eventDate: r.event_date
        })) });
    })
);