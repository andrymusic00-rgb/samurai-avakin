/**
 * Chat Routes - Chat in tempo reale del clan
 * Supporta canali pubblici e privati, moderazione, messaggi persistenti
 */

import { Router } from "express";
import { query, one, tx } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { requireAuth, requireRole, requireMinRole } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { randomUUID } from "node:crypto";

const chatRouter = Router();

// ============================================
// CANALI CHAT
// ============================================

/**
 * GET /chat/channels - Elenco canali chat disponibili
 */
chatRouter.get(
  "/channels",
  asyncHandler(async (req, res) => {
    // Canali pubblici visibili a tutti
    const publicChannels = await query(
      `SELECT * FROM chat_channels 
       WHERE is_public = true AND is_archived = false
       ORDER BY name ASC`
    );

    // Se l'utente è autenticato, mostra anche i canali privati a cui ha accesso
    let privateChannels = [];
    if (req.user) {
      privateChannels = await query(
        `SELECT c.* FROM chat_channels c
         WHERE c.is_public = false AND c.is_archived = false
         AND (
           c.created_by = $1 OR
           EXISTS (
             SELECT 1 FROM chat_messages m 
             WHERE m.channel_id = c.id AND m.user_id = $1
           )
         )
         ORDER BY c.name ASC`,
        [req.user.id]
      );
    }

    const channels = [...publicChannels.rows, ...privateChannels.rows];
    
    // Aggiungi informazione su messaggi non letti per utente autenticato
    if (req.user) {
      for (const channel of channels) {
        const lastRead = await one(
          `SELECT MAX(created_at) as last_read FROM chat_messages_read
           WHERE channel_id = $1 AND user_id = $2`,
          [channel.id, req.user.id]
        );
        
        const lastMessage = await one(
          `SELECT created_at FROM chat_messages 
           WHERE channel_id = $1 AND created_at > $2
           ORDER BY created_at DESC LIMIT 1`,
          [channel.id, lastRead?.last_read || '1970-01-01']
        );
        
        channel.unread = lastMessage ? true : false;
      }
    }

    res.json({ ok: true, channels });
  })
);

/**
 * POST /chat/channels - Crea nuovo canale (bushi+)
 */
chatRouter.post(
  "/channels",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = v.str(body.name, { required: true, min: 3, max: 50 });
    const description = v.str(body.description, { max: 500 });
    const isPublic = body.is_public !== false; // default true

    // Verifica che il nome non esista già
    const existing = await one(
      `SELECT id FROM chat_channels WHERE lower(name) = $1`,
      [name.toLowerCase()]
    );
    
    if (existing) {
      throw ApiError.conflict(`Canale '${name}' esiste già`);
    }

    const channel = await one(
      `INSERT INTO chat_channels 
       (name, description, is_public, is_archived, created_by)
       VALUES ($1, $2, $3, false, $4)
       RETURNING *`,
      [name, description, isPublic, req.user.id]
    );

    await audit(req.user.id, 'chat.channel_create', { channelId: channel.id, name }, clientIp(req));
    res.status(201).json({ ok: true, channel });
  })
);

/**
 * GET /chat/channels/:id - Dettagli canale
 */
chatRouter.get(
  "/channels/:id",
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    // Verifica accesso
    if (!channel.is_public && (!req.user || (channel.created_by !== req.user.id && 
        !(await hasMessagesInChannel(req.params.id, req.user?.id))))) {
      throw ApiError.forbidden('Accesso negato a questo canale');
    }

    // Conta messaggi
    const messageCount = await one(
      `SELECT COUNT(*) FROM chat_messages WHERE channel_id = $1`,
      [req.params.id]
    );

    channel.message_count = parseInt(messageCount.count);

    // Ottieni utenti attivi (ultimi 30 giorni)
    const activeUsers = await query(
      `SELECT DISTINCT u.id, u.display_name, u.handle, u.avatar_url
       FROM chat_messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.channel_id = $1 AND m.created_at > now() - interval '30 days'
       ORDER BY m.created_at DESC LIMIT 20`,
      [req.params.id]
    );

    channel.active_users = activeUsers.rows;
    
    res.json({ ok: true, channel });
  })
);

/**
 * PATCH /chat/channels/:id - Modifica canale (bushi+ o creatore)
 */
chatRouter.patch(
  "/channels/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    // Verifica permessi
    if (req.user.role !== 'bushi' && req.user.role !== 'shogun' && req.user.role !== 'admin' && 
        channel.created_by !== req.user.id) {
      throw ApiError.forbidden('Non hai i permessi per modificare questo canale');
    }

    const body = req.body || {};
    const updates = [];
    const params = [];
    let idx = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(v.str(body.name, { min: 3, max: 50 }));
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(v.str(body.description, { max: 500 }));
    }
    if (body.is_public !== undefined) {
      updates.push(`is_public = $${idx++}`);
      params.push(body.is_public);
    }
    if (body.is_archived !== undefined) {
      updates.push(`is_archived = $${idx++}`);
      params.push(body.is_archived);
    }

    params.push(req.params.id);
    
    if (updates.length === 0) {
      throw ApiError.bad('validation', 'Nessun campo da aggiornare');
    }

    const updated = await one(
      `UPDATE chat_channels SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      [...params, req.params.id]
    );

    await audit(req.user.id, 'chat.channel_update', { channelId: updated.id }, clientIp(req));
    res.json({ ok: true, channel: updated });
  })
);

/**
 * DELETE /chat/channels/:id - Elimina canale (bushi+ o creatore)
 */
chatRouter.delete(
  "/channels/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    // Verifica permessi
    if (req.user.role !== 'bushi' && req.user.role !== 'shogun' && req.user.role !== 'admin' && 
        channel.created_by !== req.user.id) {
      throw ApiError.forbidden('Non hai i permessi per eliminare questo canale');
    }

    await query(
      `DELETE FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );

    await audit(req.user.id, 'chat.channel_delete', { channelId: channel.id }, clientIp(req));
    res.json({ ok: true, message: `Canale eliminato` });
  })
);

/**
 * Verifica se un utente ha messaggi in un canale
 */
async function hasMessagesInChannel(channelId, userId) {
  if (!userId) return false;
  const result = await one(
    `SELECT 1 FROM chat_messages WHERE channel_id = $1 AND user_id = $2 LIMIT 1`,
    [channelId, userId]
  );
  return Boolean(result);
}

// ============================================
// MESSAGGI
// ============================================

/**
 * GET /chat/channels/:id/messages - Storia messaggi di un canale
 */
chatRouter.get(
  "/channels/:id/messages",
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    // Verifica accesso
    if (!channel.is_public && (!req.user || (channel.created_by !== req.user.id && 
        !(await hasMessagesInChannel(req.params.id, req.user?.id))))) {
      throw ApiError.forbidden('Accesso negato a questo canale');
    }

    const { limit = 50, before, after } = req.query;
    
    let whereClause = 'WHERE m.channel_id = $1';
    const params = [req.params.id];
    
    if (before) {
      whereClause += ` AND m.created_at < $${params.length + 1}`;
      params.push(new Date(before));
    }
    
    if (after) {
      whereClause += ` AND m.created_at > $${params.length + 1}`;
      params.push(new Date(after));
    }

    const messages = await query(
      `SELECT 
         m.*,
         u.id as user_id,
         u.display_name,
         u.handle,
         u.avatar_url,
         u.role,
         COALESCE(
           (SELECT 1 FROM chat_moderation 
            WHERE channel_id = m.channel_id AND user_id = m.user_id 
            AND action = 'ban' AND (expires_at IS NULL OR expires_at > now())),
           0
         ) as is_banned,
         COALESCE(
           (SELECT 1 FROM chat_moderation 
            WHERE channel_id = m.channel_id AND user_id = m.user_id 
            AND action = 'mute' AND (expires_at IS NULL OR expires_at > now())),
           0
         ) as is_muted
       FROM chat_messages m
       JOIN users u ON m.user_id = u.id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, parseInt(limit)]
    );

    // Ordina in ordine cronologico per il client
    const orderedMessages = messages.rows.reverse();

    res.json({ ok: true, messages: orderedMessages });
  })
);

/**
 * POST /chat/channels/:id/messages - Invia messaggio
 */
chatRouter.post(
  "/channels/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    // Verifica che l'utente non sia bannato
    const isBanned = await one(
      `SELECT 1 FROM chat_moderation 
       WHERE channel_id = $1 AND user_id = $2 AND action = 'ban' 
       AND (expires_at IS NULL OR expires_at > now())`,
      [req.params.id, req.user.id]
    );

    if (isBanned) {
      throw ApiError.forbidden('Sei bannato da questo canale');
    }

    // Verifica che l'utente non sia mutato
    const isMuted = await one(
      `SELECT 1 FROM chat_moderation 
       WHERE channel_id = $1 AND user_id = $2 AND action = 'mute' 
       AND (expires_at IS NULL OR expires_at > now())`,
      [req.params.id, req.user.id]
    );

    if (isMuted) {
      throw ApiError.forbidden('Sei mutato in questo canale');
    }

    const body = req.body || {};
    const content = v.str(body.body, { required: true, min: 1, max: 5000 });
    const attachments = body.attachments || [];

    // Limita allegati a 5
    if (attachments.length > 5) {
      throw ApiError.bad('validation', 'Massimo 5 allegati', { field: 'attachments' });
    }

    const message = await one(
      `INSERT INTO chat_messages 
       (channel_id, user_id, body, attachments)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, req.user.id, content, JSON.stringify(attachments)]
    );

    // Aggiungi info utente
    message.user = {
      id: req.user.id,
      display_name: req.user.display_name,
      handle: req.user.handle,
      avatar_url: req.user.avatar_url,
      role: req.user.role
    };

    await audit(req.user.id, 'chat.message_send', { 
      channelId: req.params.id, 
      messageId: message.id 
    }, clientIp(req));

    res.status(201).json({ ok: true, message });
  })
);

/**
 * PATCH /chat/messages/:id - Modifica messaggio (autore o bushi+)
 */
chatRouter.patch(
  "/messages/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const message = await one(
      `SELECT * FROM chat_messages WHERE id = $1`,
      [req.params.id]
    );
    
    if (!message) {
      throw ApiError.notFound(`Messaggio non trovato`);
    }

    // Verifica permessi
    if (message.user_id !== req.user.id && 
        req.user.role !== 'bushi' && 
        req.user.role !== 'shogun' && 
        req.user.role !== 'admin') {
      throw ApiError.forbidden('Non puoi modificare questo messaggio');
    }

    const body = req.body || {};
    const content = v.str(body.body, { required: true, min: 1, max: 5000 });

    const updated = await one(
      `UPDATE chat_messages 
       SET body = $1, is_edited = true, edited_at = now()
       WHERE id = $2
       RETURNING *`,
      [content, req.params.id]
    );

    await audit(req.user.id, 'chat.message_edit', { messageId: req.params.id }, clientIp(req));
    res.json({ ok: true, message: updated });
  })
);

/**
 * DELETE /chat/messages/:id - Elimina messaggio (autore o bushi+)
 */
chatRouter.delete(
  "/messages/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const message = await one(
      `SELECT * FROM chat_messages WHERE id = $1`,
      [req.params.id]
    );
    
    if (!message) {
      throw ApiError.notFound(`Messaggio non trovato`);
    }

    // Verifica permessi
    if (message.user_id !== req.user.id && 
        req.user.role !== 'bushi' && 
        req.user.role !== 'shogun' && 
        req.user.role !== 'admin') {
      throw ApiError.forbidden('Non puoi eliminare questo messaggio');
    }

    await query(
      `DELETE FROM chat_messages WHERE id = $1`,
      [req.params.id]
    );

    await audit(req.user.id, 'chat.message_delete', { messageId: req.params.id }, clientIp(req));
    res.json({ ok: true, message: `Messaggio eliminato` });
  })
);

/**
 * POST /chat/messages/:id/pin - Attacca messaggio (bushi+)
 */
chatRouter.post(
  "/messages/:id/pin",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const message = await one(
      `SELECT * FROM chat_messages WHERE id = $1`,
      [req.params.id]
    );
    
    if (!message) {
      throw ApiError.notFound(`Messaggio non trovato`);
    }

    // Se già attached, toglilo
    if (message.is_pinned) {
      await query(
        `UPDATE chat_messages SET is_pinned = false, pinned_by = NULL, pinned_at = NULL 
         WHERE id = $1`,
        [req.params.id]
      );
      res.json({ ok: true, message: `Messaggio rimosso dai preferiti` });
    } else {
      // Attacca
      await query(
        `UPDATE chat_messages SET is_pinned = true, pinned_by = $1, pinned_at = now() 
         WHERE id = $2`,
        [req.user.id, req.params.id]
      );
      res.json({ ok: true, message: `Messaggio aggiunto ai preferiti` });
    }

    await audit(req.user.id, 'chat.message_pin', { messageId: req.params.id }, clientIp(req));
  })
);

// ============================================
// MODERAZIONE
// ============================================

/**
 * POST /chat/channels/:id/moderate - Azione di moderazione (bushi+)
 */
chatRouter.post(
  "/channels/:id/moderate",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    const body = req.body || {};
    const userId = v.uuid(body.user_id, { required: true });
    const action = v.oneOf(body.action, ['warn', 'mute', 'ban'], { required: true });
    const reason = v.str(body.reason, { max: 500 });
    const duration = body.duration ? parseInt(body.duration) : null; // minuti

    // Verifica che l'utente target esista
    const targetUser = await one(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!targetUser) {
      throw ApiError.notFound(`Utente non trovato`);
    }

    // Calcola expiration
    let expiresAt = null;
    if (duration && action !== 'warn') {
      expiresAt = new Date(Date.now() + duration * 60000);
    }

    const moderation = await one(
      `INSERT INTO chat_moderation 
       (channel_id, user_id, action, reason, moderator_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.params.id, userId, action, reason, req.user.id, expiresAt]
    );

    await audit(req.user.id, 'chat.moderate', { 
      channelId: req.params.id, 
      userId, 
      action 
    }, clientIp(req));

    res.status(201).json({ ok: true, moderation });
  })
);

/**
 * GET /chat/channels/:id/moderation - Cronologia moderazione (bushi+)
 */
chatRouter.get(
  "/channels/:id/moderation",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    const moderation = await query(
      `SELECT 
         m.*,
         u.display_name as target_name,
         u.handle as target_handle,
         um.display_name as moderator_name,
         um.handle as moderator_handle
       FROM chat_moderation m
       JOIN users u ON m.user_id = u.id
       JOIN users um ON m.moderator_id = um.id
       WHERE m.channel_id = $1
       ORDER BY m.created_at DESC`,
      [req.params.id]
    );

    res.json({ ok: true, moderation: moderation.rows });
  })
);

/**
 * DELETE /chat/moderation/:id - Revoca azione moderazione (bushi+)
 */
chatRouter.delete(
  "/moderation/:id",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const mod = await one(
      `SELECT * FROM chat_moderation WHERE id = $1`,
      [req.params.id]
    );
    
    if (!mod) {
      throw ApiError.notFound(`Azione di moderazione non trovata`);
    }

    await query(
      `DELETE FROM chat_moderation WHERE id = $1`,
      [req.params.id]
    );

    await audit(req.user.id, 'chat.moderation_revoke', { modId: req.params.id }, clientIp(req));
    res.json({ ok: true, message: `Azione di moderazione revocata` });
  })
);

// ============================================
// MESSAGGI LETTI (per unread count)
// ============================================

/**
 * POST /chat/channels/:id/read - Segna messaggi come letti
 */
chatRouter.post(
  "/channels/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const channel = await one(
      `SELECT * FROM chat_channels WHERE id = $1`,
      [req.params.id]
    );
    
    if (!channel) {
      throw ApiError.notFound(`Canale non trovato`);
    }

    // Ottieni l'ultimo messaggio
    const lastMessage = await one(
      `SELECT created_at FROM chat_messages 
       WHERE channel_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    if (lastMessage) {
      // Aggiorna o inserisci marcatura lettura
      await query(
        `INSERT INTO chat_messages_read (channel_id, user_id, last_read)
         VALUES ($1, $2, $3)
         ON CONFLICT (channel_id, user_id)
         DO UPDATE SET last_read = $3`,
        [req.params.id, req.user.id, lastMessage.created_at]
      );
    }

    res.json({ ok: true, message: `Messaggi segnati come letti` });
  })
);

// ============================================
// STATISTICHE CHAT
// ============================================

/**
 * GET /chat/stats - Statistiche generali (bushi+)
 */
chatRouter.get(
  "/stats",
  requireAuth,
  requireMinRole('bushi'),
  asyncHandler(async (req, res) => {
    const [totalMessages, totalChannels, activeUsers, todayMessages] = await Promise.all([
      one(`SELECT COUNT(*) FROM chat_messages`),
      one(`SELECT COUNT(*) FROM chat_channels WHERE is_archived = false`),
      one(`SELECT COUNT(DISTINCT user_id) FROM chat_messages WHERE created_at > now() - interval '30 days'`),
      one(`SELECT COUNT(*) FROM chat_messages WHERE created_at > now()::date`)
    ]);

    res.json({
      ok: true,
      stats: {
        totalMessages: parseInt(totalMessages.count),
        totalChannels: parseInt(totalChannels.count),
        activeUsers: parseInt(activeUsers.count),
        todayMessages: parseInt(todayMessages.count)
      }
    });
  })
);

export { chatRouter };
