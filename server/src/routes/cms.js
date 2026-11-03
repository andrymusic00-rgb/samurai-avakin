/**
 * CMS Routes - Gestione contenuti dinamici
 * Permette di modificare hero, notizie, galleria, video e FAQ senza codice
 */

import { Router } from "express";
import { query, one, tx } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { requireAuth, requireRole, requireMinRole } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { config } from "../lib/config.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError.bad('validation', 'Tipo file non consentito', { field: 'file' }), false);
    }
  }
});

const cmsRouter = Router();

// ============================================
// PAGINE CMS
// ============================================

/**
 * GET /cms/pages - Elenco tutte le pagine CMS
 */
cmsRouter.get(
  "/pages",
  asyncHandler(async (req, res) => {
    const pages = await query(
      `SELECT * FROM cms_pages ORDER BY order_idx ASC, created_at ASC`
    );
    res.json({ ok: true, pages: pages.rows });
  })
);

/**
 * GET /cms/pages/:key - Ottieni pagina specifica
 */
cmsRouter.get(
  "/pages/:key",
  asyncHandler(async (req, res) => {
    const page = await one(
      `SELECT * FROM cms_pages WHERE key = $1`,
      [req.params.key]
    );
    
    if (!page) {
      throw ApiError.notFound(`Pagina '${req.params.key}' non trovata`);
    }
    
    res.json({ ok: true, page });
  })
);

/**
 * POST /cms/pages - Crea nuova pagina (admin only)
 */
cmsRouter.post(
  "/pages",
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const key = v.str(body.key, { required: true, min: 2, max: 50 });
    const title = v.str(body.title, { required: true, max: 200 });
    const subtitle = v.str(body.subtitle, { max: 500 });
    const content = body.content || {};
    const orderIdx = v.int(body.order_idx, { default: 0, min: 0 });

    // Verifica che la chiave non esista già
    const existing = await one(
      `SELECT id FROM cms_pages WHERE key = $1`,
      [key]
    );
    
    if (existing) {
      throw ApiError.conflict(`Pagina con chiave '${key}' esiste già`);
    }

    const page = await one(
      `INSERT INTO cms_pages (key, title, subtitle, content, order_idx, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [key, title, subtitle, JSON.stringify(content), orderIdx, req.user.id]
    );

    await audit(req.user.id, 'cms.page_create', { pageId: page.id, key }, clientIp(req));
    res.status(201).json({ ok: true, page });
  })
);

/**
 * PATCH /cms/pages/:key - Modifica pagina (admin/bushi)
 */
cmsRouter.patch(
  "/pages/:key",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const page = await one(
      `SELECT * FROM cms_pages WHERE key = $1`,
      [req.params.key]
    );
    
    if (!page) {
      throw ApiError.notFound(`Pagina '${req.params.key}' non trovata`);
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${idx++}`);
      params.push(v.str(body.title, { max: 200 }));
    }
    if (body.subtitle !== undefined) {
      updates.push(`subtitle = $${idx++}`);
      params.push(v.str(body.subtitle, { max: 500 }));
    }
    if (body.content !== undefined) {
      updates.push(`content = $${idx++}`);
      params.push(JSON.stringify(body.content));
    }
    if (body.order_idx !== undefined) {
      updates.push(`order_idx = $${idx++}`);
      params.push(v.int(body.order_idx, { min: 0 }));
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(body.is_active);
    }

    params.push(req.params.key);
    
    if (updates.length === 0) {
      throw ApiError.bad('validation', 'Nessun campo da aggiornare');
    }

    const updated = await one(
      `UPDATE cms_pages SET ${updates.join(', ')}, updated_at = now(), updated_by = $${idx}
       WHERE key = $${idx + 1}
       RETURNING *`,
      [...params, req.user.id, req.params.key]
    );

    await audit(req.user.id, 'cms.page_update', { pageId: updated.id, key: req.params.key }, clientIp(req));
    res.json({ ok: true, page: updated });
  })
);

/**
 * DELETE /cms/pages/:key - Elimina pagina (admin only)
 */
cmsRouter.delete(
  "/pages/:key",
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const page = await one(
      `SELECT * FROM cms_pages WHERE key = $1`,
      [req.params.key]
    );
    
    if (!page) {
      throw ApiError.notFound(`Pagina '${req.params.key}' non trovata`);
    }

    // Non permettere eliminazione di pagine di sistema
    const systemKeys = ['hero', 'news', 'gallery', 'videos', 'faq'];
    if (systemKeys.includes(req.params.key)) {
      throw ApiError.bad('validation', `Non è possibile eliminare la pagina di sistema '${req.params.key}'`);
    }

    await query(
      `DELETE FROM cms_pages WHERE key = $1`,
      [req.params.key]
    );

    await audit(req.user.id, 'cms.page_delete', { pageId: page.id, key: req.params.key }, clientIp(req));
    res.json({ ok: true, message: `Pagina '${req.params.key}' eliminata` });
  })
);

// ============================================
// ARTICOLI / NOTIZIE
// ============================================

/**
 * GET /cms/articles - Elenco articoli (pubblici o tutti per admin)
 */
cmsRouter.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const { category, published, limit = 20, offset = 0 } = req.query;
    
    let whereClause = 'WHERE true';
    const params = [];
    
    if (category) {
      whereClause += ` AND category = $${params.length + 1}`;
      params.push(category);
    }
    
    if (!req.user || req.user.role !== 'admin') {
      whereClause += ` AND is_published = true`;
    } else if (published !== undefined) {
      whereClause += ` AND is_published = $${params.length + 1}`;
      params.push(published === 'true');
    }

    const articles = await query(
      `SELECT * FROM cms_articles ${whereClause}
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    const count = await one(
      `SELECT COUNT(*) FROM cms_articles ${whereClause}`,
      params
    );

    res.json({ 
      ok: true, 
      articles: articles.rows,
      total: parseInt(count.count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  })
);

/**
 * GET /cms/articles/:slug - Ottieni articolo specifico
 */
cmsRouter.get(
  "/articles/:slug",
  asyncHandler(async (req, res) => {
    const article = await one(
      `SELECT * FROM cms_articles WHERE slug = $1`,
      [req.params.slug]
    );
    
    if (!article) {
      throw ApiError.notFound(`Articolo '${req.params.slug}' non trovato`);
    }
    
    // Verifica pubblicazione
    if (!article.is_published && (!req.user || req.user.role !== 'admin')) {
      throw ApiError.notFound(`Articolo non disponibile`);
    }
    
    res.json({ ok: true, article });
  })
);

/**
 * POST /cms/articles - Crea nuovo articolo (bushi+)
 */
cmsRouter.post(
  "/articles",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const title = v.str(body.title, { required: true, max: 200 });
    const slug = v.str(body.slug, { required: true, max: 100 });
    const summary = v.str(body.summary, { max: 500 });
    const content = v.str(body.content, { max: 100000 });
    const category = v.str(body.category, { default: 'news', max: 50 });
    const tags = body.tags || [];
    const isPublished = body.is_published || false;

    // Verifica che lo slug non esista già
    const existing = await one(
      `SELECT id FROM cms_articles WHERE slug = $1`,
      [slug]
    );
    
    if (existing) {
      throw ApiError.conflict(`Articolo con slug '${slug}' esiste già`);
    }

    const article = await one(
      `INSERT INTO cms_articles 
       (title, slug, summary, content, category, tags, is_published, published_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        slug,
        summary,
        content,
        category,
        JSON.stringify(tags),
        isPublished,
        isPublished ? new Date() : null,
        req.user.id
      ]
    );

    await audit(req.user.id, 'cms.article_create', { articleId: article.id, slug }, clientIp(req));
    res.status(201).json({ ok: true, article });
  })
);

/**
 * PATCH /cms/articles/:slug - Modifica articolo (bushi+ o autore)
 */
cmsRouter.patch(
  "/articles/:slug",
  requireAuth,
  asyncHandler(async (req, res) => {
    const article = await one(
      `SELECT * FROM cms_articles WHERE slug = $1`,
      [req.params.slug]
    );
    
    if (!article) {
      throw ApiError.notFound(`Articolo '${req.params.slug}' non trovato`);
    }

    // Verifica permessi
    if (req.user.role !== 'bushi' && req.user.role !== 'shogun' && req.user.role !== 'admin' && 
        article.created_by !== req.user.id) {
      throw ApiError.forbidden('Non hai i permessi per modificare questo articolo');
    }

    const body = req.body || {};
    const updates = [];
    const params = [];
    let idx = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${idx++}`);
      params.push(v.str(body.title, { max: 200 }));
    }
    if (body.summary !== undefined) {
      updates.push(`summary = $${idx++}`);
      params.push(v.str(body.summary, { max: 500 }));
    }
    if (body.content !== undefined) {
      updates.push(`content = $${idx++}`);
      params.push(v.str(body.content, { max: 100000 }));
    }
    if (body.category !== undefined) {
      updates.push(`category = $${idx++}`);
      params.push(v.str(body.category, { max: 50 }));
    }
    if (body.tags !== undefined) {
      updates.push(`tags = $${idx++}`);
      params.push(JSON.stringify(body.tags));
    }
    if (body.is_published !== undefined) {
      updates.push(`is_published = $${idx++}`);
      params.push(body.is_published);
      updates.push(`published_at = $${idx++}`);
      params.push(body.is_published ? new Date() : null);
    }

    params.push(req.params.slug);
    
    if (updates.length === 0) {
      throw ApiError.bad('validation', 'Nessun campo da aggiornare');
    }

    const updated = await one(
      `UPDATE cms_articles SET ${updates.join(', ')}, updated_at = now(), updated_by = $${idx}
       WHERE slug = $${idx + 1}
       RETURNING *`,
      [...params, req.user.id, req.params.slug]
    );

    await audit(req.user.id, 'cms.article_update', { articleId: updated.id, slug: req.params.slug }, clientIp(req));
    res.json({ ok: true, article: updated });
  })
);

/**
 * DELETE /cms/articles/:slug - Elimina articolo (bushi+ o autore)
 */
cmsRouter.delete(
  "/articles/:slug",
  requireAuth,
  asyncHandler(async (req, res) => {
    const article = await one(
      `SELECT * FROM cms_articles WHERE slug = $1`,
      [req.params.slug]
    );
    
    if (!article) {
      throw ApiError.notFound(`Articolo '${req.params.slug}' non trovato`);
    }

    // Verifica permessi
    if (req.user.role !== 'bushi' && req.user.role !== 'shogun' && req.user.role !== 'admin' && 
        article.created_by !== req.user.id) {
      throw ApiError.forbidden('Non hai i permessi per eliminare questo articolo');
    }

    await query(
      `DELETE FROM cms_articles WHERE slug = $1`,
      [req.params.slug]
    );

    await audit(req.user.id, 'cms.article_delete', { articleId: article.id, slug: req.params.slug }, clientIp(req));
    res.json({ ok: true, message: `Articolo '${req.params.slug}' eliminato` });
  })
);

// ============================================
// GALLERIA
// ============================================

/**
 * GET /cms/gallery - Elenco immagini galleria
 */
cmsRouter.get(
  "/gallery",
  asyncHandler(async (req, res) => {
    const { category, limit = 20, offset = 0 } = req.query;
    
    let whereClause = 'WHERE is_active = true';
    const params = [];
    
    if (category) {
      whereClause += ` AND category = $${params.length + 1}`;
      params.push(category);
    }

    const images = await query(
      `SELECT * FROM cms_gallery ${whereClause}
       ORDER BY order_idx ASC, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    const count = await one(
      `SELECT COUNT(*) FROM cms_gallery ${whereClause}`,
      params
    );

    res.json({ 
      ok: true, 
      images: images.rows,
      total: parseInt(count.count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  })
);

/**
 * POST /cms/gallery - Upload immagine (bushi+)
 */
cmsRouter.post(
  "/gallery",
  requireAuth,
  requireMinRole('bushi'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.bad('validation', 'Nessun file caricato', { field: 'image' });
    }

    const body = req.body || {};
    const title = v.str(body.title, { max: 200 });
    const description = v.str(body.description, { max: 1000 });
    const category = v.str(body.category, { default: 'general', max: 50 });
    const orderIdx = v.int(body.order_idx, { default: 0, min: 0 });

    // Salva file
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}-${randomUUID()}.${fileExt}`;
    const filePath = `${config.uploadDir}/cms/${fileName}`;
    
    // TODO: Salvare file su disco
    // await fs.promises.writeFile(filePath, req.file.buffer);

    const imageUrl = `/uploads/cms/${fileName}`;
    const thumbnailUrl = `/uploads/cms/thumb-${fileName}`;

    const image = await one(
      `INSERT INTO cms_gallery 
       (title, description, image_url, thumbnail_url, category, order_idx, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, imageUrl, thumbnailUrl, category, orderIdx, req.user.id]
    );

    await audit(req.user.id, 'cms.gallery_create', { imageId: image.id, file: fileName }, clientIp(req));
    res.status(201).json({ ok: true, image });
  })
);

/**
 * PATCH /cms/gallery/:id - Modifica immagine (bushi+)
 */
cmsRouter.patch(
  "/gallery/:id",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const image = await one(
      `SELECT * FROM cms_gallery WHERE id = $1`,
      [req.params.id]
    );
    
    if (!image) {
      throw ApiError.notFound(`Immagine non trovata`);
    }

    const body = req.body || {};
    const updates = [];
    const params = [];
    let idx = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${idx++}`);
      params.push(v.str(body.title, { max: 200 }));
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(v.str(body.description, { max: 1000 }));
    }
    if (body.category !== undefined) {
      updates.push(`category = $${idx++}`);
      params.push(v.str(body.category, { max: 50 }));
    }
    if (body.order_idx !== undefined) {
      updates.push(`order_idx = $${idx++}`);
      params.push(v.int(body.order_idx, { min: 0 }));
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(body.is_active);
    }

    params.push(req.params.id);
    
    if (updates.length === 0) {
      throw ApiError.bad('validation', 'Nessun campo da aggiornare');
    }

    const updated = await one(
      `UPDATE cms_gallery SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      [...params, req.params.id]
    );

    await audit(req.user.id, 'cms.gallery_update', { imageId: updated.id }, clientIp(req));
    res.json({ ok: true, image: updated });
  })
);

/**
 * DELETE /cms/gallery/:id - Elimina immagine (bushi+)
 */
cmsRouter.delete(
  "/gallery/:id",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const image = await one(
      `SELECT * FROM cms_gallery WHERE id = $1`,
      [req.params.id]
    );
    
    if (!image) {
      throw ApiError.notFound(`Immagine non trovata`);
    }

    await query(
      `DELETE FROM cms_gallery WHERE id = $1`,
      [req.params.id]
    );

    // TODO: Eliminare file fisici

    await audit(req.user.id, 'cms.gallery_delete', { imageId: image.id }, clientIp(req));
    res.json({ ok: true, message: `Immagine eliminata` });
  })
);

// ============================================
// VIDEO
// ============================================

/**
 * GET /cms/videos - Elenco video
 */
cmsRouter.get(
  "/videos",
  asyncHandler(async (req, res) => {
    const { category, limit = 20, offset = 0 } = req.query;
    
    let whereClause = 'WHERE is_active = true';
    const params = [];
    
    if (category) {
      whereClause += ` AND category = $${params.length + 1}`;
      params.push(category);
    }

    const videos = await query(
      `SELECT * FROM cms_videos ${whereClause}
       ORDER BY order_idx ASC, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    const count = await one(
      `SELECT COUNT(*) FROM cms_videos ${whereClause}`,
      params
    );

    res.json({ 
      ok: true, 
      videos: videos.rows,
      total: parseInt(count.count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  })
);

/**
 * POST /cms/videos - Crea video (bushi+)
 */
cmsRouter.post(
  "/videos",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const title = v.str(body.title, { required: true, max: 200 });
    const description = v.str(body.description, { max: 1000 });
    const videoUrl = v.str(body.video_url, { required: true, max: 500 });
    const thumbnailUrl = v.str(body.thumbnail_url, { max: 500 });
    const duration = v.int(body.duration, { default: 0, min: 0 });
    const category = v.str(body.category, { default: 'general', max: 50 });
    const orderIdx = v.int(body.order_idx, { default: 0, min: 0 });

    const video = await one(
      `INSERT INTO cms_videos 
       (title, description, video_url, thumbnail_url, duration, category, order_idx, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, videoUrl, thumbnailUrl, duration, category, orderIdx, req.user.id]
    );

    await audit(req.user.id, 'cms.video_create', { videoId: video.id, title }, clientIp(req));
    res.status(201).json({ ok: true, video });
  })
);

/**
 * PATCH /cms/videos/:id - Modifica video (bushi+)
 */
cmsRouter.patch(
  "/videos/:id",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const video = await one(
      `SELECT * FROM cms_videos WHERE id = $1`,
      [req.params.id]
    );
    
    if (!video) {
      throw ApiError.notFound(`Video non trovato`);
    }

    const body = req.body || {};
    const updates = [];
    const params = [];
    let idx = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${idx++}`);
      params.push(v.str(body.title, { max: 200 }));
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(v.str(body.description, { max: 1000 }));
    }
    if (body.video_url !== undefined) {
      updates.push(`video_url = $${idx++}`);
      params.push(v.str(body.video_url, { max: 500 }));
    }
    if (body.thumbnail_url !== undefined) {
      updates.push(`thumbnail_url = $${idx++}`);
      params.push(v.str(body.thumbnail_url, { max: 500 }));
    }
    if (body.duration !== undefined) {
      updates.push(`duration = $${idx++}`);
      params.push(v.int(body.duration, { min: 0 }));
    }
    if (body.category !== undefined) {
      updates.push(`category = $${idx++}`);
      params.push(v.str(body.category, { max: 50 }));
    }
    if (body.order_idx !== undefined) {
      updates.push(`order_idx = $${idx++}`);
      params.push(v.int(body.order_idx, { min: 0 }));
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(body.is_active);
    }

    params.push(req.params.id);
    
    if (updates.length === 0) {
      throw ApiError.bad('validation', 'Nessun campo da aggiornare');
    }

    const updated = await one(
      `UPDATE cms_videos SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      [...params, req.params.id]
    );

    await audit(req.user.id, 'cms.video_update', { videoId: updated.id }, clientIp(req));
    res.json({ ok: true, video: updated });
  })
);

/**
 * DELETE /cms/videos/:id - Elimina video (bushi+)
 */
cmsRouter.delete(
  "/videos/:id",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const video = await one(
      `SELECT * FROM cms_videos WHERE id = $1`,
      [req.params.id]
    );
    
    if (!video) {
      throw ApiError.notFound(`Video non trovato`);
    }

    await query(
      `DELETE FROM cms_videos WHERE id = $1`,
      [req.params.id]
    );

    await audit(req.user.id, 'cms.video_delete', { videoId: video.id }, clientIp(req));
    res.json({ ok: true, message: `Video eliminato` });
  })
);

// ============================================
// FAQ
// ============================================

/**
 * GET /cms/faq - Elenco FAQ
 */
cmsRouter.get(
  "/faq",
  asyncHandler(async (req, res) => {
    const { category, limit = 20, offset = 0 } = req.query;
    
    let whereClause = 'WHERE is_active = true';
    const params = [];
    
    if (category) {
      whereClause += ` AND category = $${params.length + 1}`;
      params.push(category);
    }

    const faqs = await query(
      `SELECT * FROM cms_faq ${whereClause}
       ORDER BY order_idx ASC, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    const count = await one(
      `SELECT COUNT(*) FROM cms_faq ${whereClause}`,
      params
    );

    res.json({ 
      ok: true, 
      faqs: faqs.rows,
      total: parseInt(count.count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  })
);

/**
 * POST /cms/faq - Crea FAQ (bushi+)
 */
cmsRouter.post(
  "/faq",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const question = v.str(body.question, { required: true, max: 500 });
    const answer = v.str(body.answer, { required: true, max: 5000 });
    const category = v.str(body.category, { default: 'general', max: 50 });
    const orderIdx = v.int(body.order_idx, { default: 0, min: 0 });

    const faq = await one(
      `INSERT INTO cms_faq 
       (question, answer, category, order_idx, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [question, answer, category, orderIdx, req.user.id]
    );

    await audit(req.user.id, 'cms.faq_create', { faqId: faq.id }, clientIp(req));
    res.status(201).json({ ok: true, faq });
  })
);

/**
 * PATCH /cms/faq/:id - Modifica FAQ (bushi+)
 */
cmsRouter.patch(
  "/faq/:id",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const faq = await one(
      `SELECT * FROM cms_faq WHERE id = $1`,
      [req.params.id]
    );
    
    if (!faq) {
      throw ApiError.notFound(`FAQ non trovata`);
    }

    const body = req.body || {};
    const updates = [];
    const params = [];
    let idx = 1;

    if (body.question !== undefined) {
      updates.push(`question = $${idx++}`);
      params.push(v.str(body.question, { max: 500 }));
    }
    if (body.answer !== undefined) {
      updates.push(`answer = $${idx++}`);
      params.push(v.str(body.answer, { max: 5000 }));
    }
    if (body.category !== undefined) {
      updates.push(`category = $${idx++}`);
      params.push(v.str(body.category, { max: 50 }));
    }
    if (body.order_idx !== undefined) {
      updates.push(`order_idx = $${idx++}`);
      params.push(v.int(body.order_idx, { min: 0 }));
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(body.is_active);
    }

    params.push(req.params.id);
    
    if (updates.length === 0) {
      throw ApiError.bad('validation', 'Nessun campo da aggiornare');
    }

    const updated = await one(
      `UPDATE cms_faq SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      [...params, req.params.id]
    );

    await audit(req.user.id, 'cms.faq_update', { faqId: updated.id }, clientIp(req));
    res.json({ ok: true, faq: updated });
  })
);

/**
 * DELETE /cms/faq/:id - Elimina FAQ (bushi+)
 */
cmsRouter.delete(
  "/faq/:id",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const faq = await one(
      `SELECT * FROM cms_faq WHERE id = $1`,
      [req.params.id]
    );
    
    if (!faq) {
      throw ApiError.notFound(`FAQ non trovata`);
    }

    await query(
      `DELETE FROM cms_faq WHERE id = $1`,
      [req.params.id]
    );

    await audit(req.user.id, 'cms.faq_delete', { faqId: faq.id }, clientIp(req));
    res.json({ ok: true, message: `FAQ eliminata` });
  })
);

// ============================================
// CATEGORIE
// ============================================

/**
 * GET /cms/categories - Elenco tutte le categorie disponibili
 */
cmsRouter.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await query(
      `SELECT DISTINCT category FROM cms_articles
       UNION
       SELECT DISTINCT category FROM cms_gallery
       UNION
       SELECT DISTINCT category FROM cms_videos
       UNION
       SELECT DISTINCT category FROM cms_faq
       ORDER BY category`
    );

    res.json({ 
      ok: true, 
      categories: categories.rows.map(r => r.category)
    });
  })
);

export { cmsRouter };
