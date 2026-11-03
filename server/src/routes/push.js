/**
 * Push Notifications Routes
 * Gestisce notifiche push browser via Web Push API
 * Supporta iscrizione, invio notifiche, tracking
 */

import { Router } from "express";
import { query, one } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";

const pushRouter = Router();

// ============================================
// ISCRIZIONE PUSH
// ============================================

/**
 * POST /push/subscribe - Iscrivi dispositivo alle notifiche push
 * Il client deve inviare la subscription generata da serviceWorker.registration.pushManager
 */
pushRouter.post(
  "/subscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    
    // Validazione subscription
    const subscription = body.subscription;
    if (!subscription) {
      throw ApiError.bad('validation', 'Subscription obbligatoria', { field: 'subscription' });
    }

    const endpoint = v.str(subscription.endpoint, { required: true });
    const auth = v.str(subscription.keys?.auth, { required: true });
    const p256dh = v.str(subscription.keys?.p256dh, { required: true });

    // Verifica che l'endpoint sia valido
    if (!endpoint.startsWith('https://') && !endpoint.startsWith('http://localhost')) {
      throw ApiError.bad('validation', 'Endpoint non valido', { field: 'endpoint' });
    }

    // Elimina vecchie subscription per questo utente
    await query(
      `DELETE FROM push_subscriptions WHERE user_id = $1`,
      [req.user.id]
    );

    // Crea nuova subscription
    const sub = await one(
      `INSERT INTO push_subscriptions 
       (user_id, endpoint, auth, p256dh)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, endpoint, auth, p256dh]
    );

    await audit(req.user.id, 'push.subscribe', { subscriptionId: sub.id, endpoint }, clientIp(req));
    res.status(201).json({ ok: true, subscription: sub });
  })
);

/**
 * DELETE /push/subscribe - Disiscrivi dispositivo
 */
pushRouter.delete(
  "/subscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const endpoint = body.endpoint;

    let result;
    if (endpoint) {
      result = await query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [req.user.id, endpoint]
      );
    } else {
      result = await query(
        `DELETE FROM push_subscriptions WHERE user_id = $1`,
        [req.user.id]
      );
    }

    await audit(req.user.id, 'push.unsubscribe', { endpoint }, clientIp(req));
    res.json({ ok: true, message: `Disiscritto da notifiche push` });
  })
);

/**
 * GET /push/subscriptions - Elenco subscription utente (admin only per debug)
 */
pushRouter.get(
  "/subscriptions",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Solo l'utente può vedere le proprie subscription
    // Admin può vedere tutte
    let subscriptions;
    if (req.user.role === 'admin') {
      subscriptions = await query(
        `SELECT * FROM push_subscriptions ORDER BY created_at DESC`
      );
    } else {
      subscriptions = await query(
        `SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.user.id]
      );
    }

    res.json({ ok: true, subscriptions: subscriptions.rows });
  })
);

// ============================================
// INVIO NOTIFICHE
// ============================================

/**
 * POST /push/send - Invia notifica push a utenti specifici (bushi+)
 */
pushRouter.post(
  "/send",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Verifica ruolo (solo bushi+ può inviare notifiche push)
    if (req.user.role !== 'bushi' && req.user.role !== 'shogun' && req.user.role !== 'admin') {
      throw ApiError.forbidden('Non hai i permessi per inviare notifiche push');
    }

    const body = req.body || {};
    const title = v.str(body.title, { required: true, max: 100 });
    const bodyText = v.str(body.body, { required: true, max: 500 });
    const url = v.str(body.url, { max: 500 });
    const data = body.data || {};
    const target = body.target || 'all'; // 'all', 'bushi', 'shogun', 'admin', o array di user_id

    // Determina a chi inviare
    let userIds = [];
    
    if (target === 'all') {
      // Tutti gli utenti con subscription
      const users = await query(
        `SELECT DISTINCT user_id FROM push_subscriptions`
      );
      userIds = users.rows.map(r => r.user_id);
    } else if (target === 'bushi') {
      const users = await query(
        `SELECT id FROM users WHERE role IN ('bushi', 'shogun', 'admin')`
      );
      userIds = users.rows.map(r => r.id);
    } else if (target === 'shogun') {
      const users = await query(
        `SELECT id FROM users WHERE role IN ('shogun', 'admin')`
      );
      userIds = users.rows.map(r => r.id);
    } else if (target === 'admin') {
      const users = await query(
        `SELECT id FROM users WHERE role = 'admin'`
      );
      userIds = users.rows.map(r => r.id);
    } else if (Array.isArray(target)) {
      userIds = target.filter(id => v.uuid(id));
    }

    // Invia notifiche
    const results = [];
    for (const userId of userIds) {
      try {
        // Ottieni subscription utente
        const subscription = await one(
          `SELECT * FROM push_subscriptions WHERE user_id = $1`,
          [userId]
        );

        if (!subscription) {
          results.push({ userId, status: 'skipped', reason: 'No subscription' });
          continue;
        }

        // Crea notifica nel database
        const notification = await one(
          `INSERT INTO push_notifications 
           (user_id, title, body, data, url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [userId, title, bodyText, JSON.stringify(data), url]
        );

        // In ambiente reale, qui si invierebbe la notifica push effettiva
        // Per ora, simuliamo il success
        await query(
          `UPDATE push_subscriptions SET last_sent_at = now() WHERE id = $1`,
          [subscription.id]
        );

        results.push({ 
          userId, 
          status: 'sent', 
          notificationId: notification.id,
          delivered: true
        });
      } catch (err) {
        results.push({ 
          userId, 
          status: 'failed', 
          error: err.message 
        });
      }
    }

    await audit(req.user.id, 'push.send', { 
      target,
      count: userIds.length,
      successful: results.filter(r => r.status === 'sent').length
    }, clientIp(req));

    res.status(201).json({ 
      ok: true, 
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    });
  })
);

/**
 * POST /push/send-test - Invia notifica di test all'utente corrente
 * Solo per test e debug
 */
pushRouter.post(
  "/send-test",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const title = v.str(body.title, { default: 'Notifica di Test' });
    const bodyText = v.str(body.body, { default: 'Questa è una notifica push di test' });

    const subscription = await one(
      `SELECT * FROM push_subscriptions WHERE user_id = $1`,
      [req.user.id]
    );

    if (!subscription) {
      throw ApiError.notFound('Nessuna subscription push trovata per questo utente');
    }

    const notification = await one(
      `INSERT INTO push_notifications 
       (user_id, title, body, data, url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, bodyText, JSON.stringify({ type: 'test' }), '/']
    );

    await audit(req.user.id, 'push.test', { notificationId: notification.id }, clientIp(req));

    res.status(201).json({ 
      ok: true, 
      notification,
      message: 'Notifica di test inviata (simulata)'
    });
  })
);

// ============================================
// NOTIFICHE INVIATE
// ============================================

/**
 * GET /push/notifications - Cronologia notifiche inviate a me (admin per tutte)
 */
pushRouter.get(
  "/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    let notifications;
    if (req.user.role === 'admin') {
      // Admin vede tutte
      notifications = await query(
        `SELECT 
           n.*,
           u.display_name as user_name,
           u.handle as user_handle
         FROM push_notifications n
         LEFT JOIN users u ON n.user_id = u.id
         ORDER BY n.sent_at DESC
         LIMIT 100`
      );
    } else {
      // Utente normale vede solo le sue
      notifications = await query(
        `SELECT 
           n.*,
           u.display_name as user_name,
           u.handle as user_handle
         FROM push_notifications n
         LEFT JOIN users u ON n.user_id = u.id
         WHERE n.user_id = $1
         ORDER BY n.sent_at DESC
         LIMIT 100`,
        [req.user.id]
      );
    }

    res.json({ ok: true, notifications: notifications.rows });
  })
);

/**
 * GET /push/notifications/:id - Dettagli notifica
 */
pushRouter.get(
  "/notifications/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const notification = await one(
      `SELECT * FROM push_notifications WHERE id = $1`,
      [req.params.id]
    );
    
    if (!notification) {
      throw ApiError.notFound(`Notifica non trovata`);
    }

    // Verifica permessi (solo admin o destinatario)
    if (req.user.role !== 'admin' && notification.user_id !== req.user.id) {
      throw ApiError.forbidden('Non puoi visualizzare questa notifica');
    }

    res.json({ ok: true, notification });
  })
);

/**
 * DELETE /push/notifications/:id - Elimina notifica
 */
pushRouter.delete(
  "/notifications/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const notification = await one(
      `SELECT * FROM push_notifications WHERE id = $1`,
      [req.params.id]
    );
    
    if (!notification) {
      throw ApiError.notFound(`Notifica non trovata`);
    }

    // Verifica permessi (solo admin o destinatario)
    if (req.user.role !== 'admin' && notification.user_id !== req.user.id) {
      throw ApiError.forbidden('Non puoi eliminare questa notifica');
    }

    await query(
      `DELETE FROM push_notifications WHERE id = $1`,
      [req.params.id]
    );

    await audit(req.user.id, 'push.delete', { notificationId: req.params.id }, clientIp(req));
    res.json({ ok: true, message: `Notifica eliminata` });
  })
);

/**
 * POST /push/notifications/:id/read - Segna notifica come letta
 */
pushRouter.post(
  "/notifications/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const notification = await one(
      `SELECT * FROM push_notifications WHERE id = $1`,
      [req.params.id]
    );
    
    if (!notification) {
      throw ApiError.notFound(`Notifica non trovata`);
    }

    // Verifica permessi
    if (notification.user_id !== req.user.id) {
      throw ApiError.forbidden('Non puoi marcare questa notifica come letta');
    }

    await query(
      `UPDATE push_notifications SET delivered = true WHERE id = $1`,
      [req.params.id]
    );

    res.json({ ok: true, message: `Notifica segnata come letta` });
  })
);

// ============================================
// STATISTICHE PUSH
// ============================================

/**
 * GET /push/stats - Statistiche push (admin only)
 */
pushRouter.get(
  "/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
      throw ApiError.forbidden('Solo admin può vedere le statistiche');
    }

    const [totalSubscriptions, totalNotifications, deliveredRate, activeUsers] = await Promise.all([
      one(`SELECT COUNT(*) FROM push_subscriptions`),
      one(`SELECT COUNT(*) FROM push_notifications`),
      one(`SELECT 
             (COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM push_notifications), 0)) as rate
           FROM push_notifications WHERE delivered = true`),
      one(`SELECT COUNT(DISTINCT user_id) FROM push_subscriptions WHERE created_at > now() - interval '30 days'`)
    ]);

    res.json({
      ok: true,
      stats: {
        totalSubscriptions: parseInt(totalSubscriptions.count),
        totalNotifications: parseInt(totalNotifications.count),
        deliveredRate: deliveredRate.rate ? parseFloat(deliveredRate.rate) : 0,
        activeUsers: parseInt(activeUsers.count)
      }
    });
  })
);

export { pushRouter };
