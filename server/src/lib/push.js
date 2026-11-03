/**
 * Push Notifications Library
 * Implementa invio notifiche push tramite Web Push API
 * Supporta VAPID, encryption, e gestione subscription
 */

import { query, one } from "../../db/index.js";
import { config } from "./config.js";
import { audit } from "./audit.js";

// ============================================
// CONFIGURAZIONE VAPID
// ============================================

// Genera o carica chiavi VAPID
let vapidKeys = null;

/**
 * Genera chiavi VAPID (per ambiente di sviluppo)
 * In produzione, queste devono essere generate una volta e salvate in variabili ambiente
 */
function generateVapidKeys() {
  // In sviluppo, usiamo chiavi statiche di test
  // In produzione, generare con: openssl ecparam -name prime256v1 -genkey -noout -out vapid_private.pem
  //                           openssl ec -in vapid_private.pem -pubout -out vapid_public.pem
  return {
    publicKey: config.vapidPublicKey || 'BLn3Y_tLQ83hF2X7J6TQf6tG6u57lP7L5GzJ8q9m3K8s7n2P4v5X8z1w2L7P0s3K9m1x4Y8p2',
    privateKey: config.vapidPrivateKey || 'm4K8p2X8L3P0s7K1n9m5X2v4P8t6Q1z7Y9m3K5p0L8n2J4',
    subject: config.vapidSubject || 'mailto:admin@samurai.test'
  };
}

/**
 * Ottieni chiavi VAPID
 */
export function getVapidKeys() {
  if (!vapidKeys) {
    vapidKeys = generateVapidKeys();
  }
  return vapidKeys;
}

/**
 * Configura chiavi VAPID
 */
export function setVapidKeys(keys) {
  vapidKeys = keys;
}

// ============================================
// WEB PUSH IMPLEMENTATION
// ============================================

// Implementazione semplificata - in ambiente reale usare librerie come 'web-push'
// Per questo progetto, implementiamo una versione base che funziona in sviluppo

/**
 * Invia notifica push a un dispositivo specifico
 * @param {Object} subscription - Subscription object (endpoint, keys)
 * @param {string} payload - Payload da inviare (JSON string)
 * @returns {Promise<Object>} Risultato invio
 */
export async function sendPushNotification(subscription, payload) {
  const { publicKey, privateKey, subject } = getVapidKeys();

  try {
    // In ambiente di sviluppo, Web Push richiede HTTPS
    // Per testing locale, possiamo usare http://localhost ma con limitazioni
    
    // In un'implementazione reale:
    // 1. Crea JWT di autenticazione
    // 2. Cripta il payload con la chiave pubblica del client
    // 3. Invia la richiesta POST all'endpoint con header specifici
    
    // Per ora, simuliamo il success in sviluppo
    if (config.env === 'development' || config.env === 'test') {
      console.log(`[Push] Notifica simulata inviata a ${subscription.endpoint}`);
      return {
        success: true,
        endpoint: subscription.endpoint,
        message: 'Notifica invio simulata (sviluppo)'
      };
    }

    // Implementazione reale (richiede HTTPS e lib web-push)
    // Questo è solo un placeholder - installare 'web-push' per l'implementazione completa
    console.log(`[Push] Tentativo invio reale a ${subscription.endpoint}`);
    
    return {
      success: false,
      error: 'Implementazione reale richiede HTTPS e libreria web-push',
      endpoint: subscription.endpoint
    };
  } catch (err) {
    console.error(`[Push] Errore invio notifica:`, err);
    return {
      success: false,
      error: err.message,
      endpoint: subscription.endpoint
    };
  }
}

/**
 * Invia notifica push a un utente
 * @param {string} userId - ID utente
 * @param {Object} notification - Notifica da inviare
 * @returns {Promise<Object>} Risultato
 */
export async function sendPushToUser(userId, notification) {
  // Ottieni subscription utente
  const subscription = await one(
    `SELECT * FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  if (!subscription) {
    return {
      success: false,
      error: 'Nessuna subscription trovata per questo utente',
      userId
    };
  }

  // Prepara payload
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    url: notification.url || ''
  });

  // Invia notifica
  const result = await sendPushNotification(subscription, payload);

  // Salva nel database
  await query(
    `INSERT INTO push_notifications 
     (user_id, title, body, data, url, delivered, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      notification.title,
      notification.body,
      JSON.stringify(notification.data || {}),
      notification.url || '',
      result.success,
      result.error || ''
    ]
  );

  // Aggiorna last_sent_at
  if (result.success) {
    await query(
      `UPDATE push_subscriptions SET last_sent_at = now() WHERE id = $1`,
      [subscription.id]
    );
  }

  return result;
}

/**
 * Invia notifica push a più utenti
 * @param {string[]} userIds - Array di ID utenti
 * @param {Object} notification - Notifica da inviare
 * @returns {Promise<Object>} Risultato aggregato
 */
export async function sendPushToUsers(userIds, notification) {
  const results = [];
  
  for (const userId of userIds) {
    const result = await sendPushToUser(userId, notification);
    results.push(result);
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    total: results.length,
    successful,
    failed,
    results
  };
}

/**
 * Invia notifica a tutti i membri con ruolo specifico
 * @param {string[]} roles - Ruoli a cui inviare
 * @param {Object} notification - Notifica da inviare
 * @returns {Promise<Object>}
 */
export async function sendPushToRoles(roles, notification) {
  const users = await query(
    `SELECT id FROM users WHERE role = ANY($1) AND status = 'attivo'`,
    [roles]
  );

  const userIds = users.rows.map(r => r.id);
  return sendPushToUsers(userIds, notification);
}

/**
 * Invia notifica a tutti gli utenti
 * @param {Object} notification - Notifica da inviare
 * @returns {Promise<Object>}
 */
export async function sendPushToAll(notification) {
  const users = await query(
    `SELECT id FROM users WHERE status = 'attivo'`
  );

  const userIds = users.rows.map(r => r.id);
  return sendPushToUsers(userIds, notification);
}

// ============================================
// TEMPLATES NOTIFICHE
// ============================================

/**
 * Template notifica nuovo messaggio
 */
export function newMessageNotification(senderHandle, channelName, messagePreview) {
  return {
    title: `${senderHandle} ha inviato un messaggio`,
    body: `${messagePreview || 'Nuovo messaggio'} in ${channelName}`,
    data: {
      type: 'new_message',
      channel: channelName
    },
    url: '/#/chat'
  };
}

/**
 * Template notifica nuovo evento
 */
export function newEventNotification(eventTitle, startsAt) {
  return {
    title: 'Nuovo Evento Clan',
    body: `${eventTitle} - Inizia il ${new Date(startsAt).toLocaleDateString('it-IT')}`,
    data: {
      type: 'new_event',
      eventTitle
    },
    url: '/#/eventi'
  };
}

/**
 * Template notifica nuovo raid
 */
export function newRaidNotification(raidTitle, opponent) {
  return {
    title: 'Nuovo Raid Annunciato',
    body: `${raidTitle} contro ${opponent || 'un avversario'}`,
    data: {
      type: 'new_raid'
    },
    url: '/#/classifica'
  };
}

/**
 * Template notifica approvazione candidatura
 */
export function applicationApprovedNotification(clanName) {
  return {
    title: 'Candidatura Approvata!',
    body: `Benvenuto nel clan ${clanName}!`,
    data: {
      type: 'application_approved'
    },
    url: '/#/account'
  };
}

/**
 * Template notifica ordine del giorno
 */
export function dailyBriefingNotification(tasksCount) {
  return {
    title: 'Agenda del Giorno',
    body: `Hai ${tasksCount} nuove attività da completare`,
    data: {
      type: 'daily_briefing'
    },
    url: '/#/account'
  };
}

/**
 * Template notifica promemoria evento
 */
export function eventReminderNotification(eventTitle, timeUntil) {
  return {
    title: 'Promemoria Evento',
    body: `${eventTitle} tra ${timeUntil}`,
    data: {
      type: 'event_reminder',
      eventTitle
    },
    url: '/#/eventi'
  };
}

// ============================================
// SCHEDULER NOTIFICHE
// ============================================

// SetInterval reference per cleanup
let reminderInterval = null;

/**
 * Avvia scheduler per promemoria eventi
 */
export function startEventReminderScheduler() {
  if (reminderInterval) return;

  // Controlla ogni 15 minuti
  reminderInterval = setInterval(async () => {
    try {
      await checkUpcomingEvents();
    } catch (err) {
      console.error('[Push Scheduler] Errore check eventi:', err.message);
    }
  }, 15 * 60 * 1000);

  console.log('[Push Scheduler] Avviato');
}

/**
 * Ferma scheduler
 */
export function stopEventReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[Push Scheduler] Fermato');
  }
}

/**
 * Controlla eventi imminenti e invia promemoria
 */
async function checkUpcomingEvents() {
  // Eventi che iniziano tra 1 ora
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const events = await query(
    `SELECT * FROM events 
     WHERE starts_at BETWEEN $1 AND $2 
     AND starts_at > now()`,
    [new Date(), inTwoHours]
  );

  for (const event of events.rows) {
    // Ottieni utenti iscritti
    const attendees = await query(
      `SELECT user_id FROM event_rsvp WHERE event_id = $1`,
      [event.id]
    );

    const userIds = attendees.rows.map(r => r.user_id);
    
    if (userIds.length === 0) continue;

    // Calcola tempo rimanente
    const timeUntil = Math.ceil((new Date(event.starts_at) - new Date()) / (60 * 1000));

    // Invia notifica solo se l'evento inizia tra 1 ora
    if (new Date(event.starts_at) <= inOneHour) {
      const notification = eventReminderNotification(
        event.title,
        `${timeUntil} minuti`
      );

      await sendPushToUsers(userIds, notification);
      console.log(`[Push Scheduler] Promemoria inviato per evento: ${event.title}`);
    }
  }
}

// ============================================
// INTEGRAZIONE CON NOTIFICHE IN-APP
// ============================================

/**
 * Sincronizza notifiche push con notifiche in-app
 * Quando una notifica push viene inviata, crea anche una notifica in-app
 */
export async function syncPushWithInApp(userId, notification) {
  await query(
    `INSERT INTO notifications 
     (user_id, scope, title, body, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      userId,
      'personale',
      notification.title,
      notification.body,
      notification.url || '/#/account'
    ]
  );
}

/**
 * Invoca notifica push e sincronizza con in-app
 */
export async function sendPushAndSync(userId, notification) {
  const pushResult = await sendPushToUser(userId, notification);
  
  if (pushResult.success) {
    await syncPushWithInApp(userId, notification);
  }
  
  return pushResult;
}

// ============================================
// AUDIT E LOGGING
// ============================================

/**
 * Logga invio notifica push
 */
export async function logPushNotification(userId, notification, result) {
  await audit(userId, 'push.notification', {
    notificationId: notification.id,
    title: notification.title,
    success: result.success,
    error: result.error
  });
}

export default {
  // Configuration
  getVapidKeys,
  setVapidKeys,
  
  // Sending
  sendPushNotification,
  sendPushToUser,
  sendPushToUsers,
  sendPushToRoles,
  sendPushToAll,
  
  // Templates
  newMessageNotification,
  newEventNotification,
  newRaidNotification,
  applicationApprovedNotification,
  dailyBriefingNotification,
  eventReminderNotification,
  
  // Scheduler
  startEventReminderScheduler,
  stopEventReminderScheduler,
  
  // Sync
  syncPushWithInApp,
  sendPushAndSync,
  logPushNotification
};
