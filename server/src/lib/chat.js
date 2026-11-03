/**
 * Chat Library - Gestione WebSocket per chat in tempo reale
 * Implementa server WebSocket con supporto per:
 * - Multiple canali
 * - Autenticazione tramite JWT
 * - Messaggi persistenti
 * - Moderazione
 * - Notifiche online/offline
 */

import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { query, one } from "../../db/index.js";
import { verifyAccess } from "./jwt.js";
import { config } from "./config.js";
import { audit } from "./audit.js";

// Mappa client connessi: { channelId: { userId: Set<WebSocket> } }
const connectedClients = new Map();

// Mappa WebSocket -> utente
const wsToUser = new Map();

// Mappa WebSocket -> canale
const wsToChannel = new Map();

// Server WebSocket
let wss = null;

/**
 * Inizializza WebSocket server per chat
 * @param {Object} httpServer - Server HTTP Express
 */
export function initChatWebSocket(httpServer) {
  if (wss) return wss;

  wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/chat',
    verifyClient: async (info, callback) => {
      try {
        // Estrai token dal query string
        const token = info.req.url.split('token=')[1]?.split('&')[0];
        
        if (!token) {
          callback(false, 401, 'Token mancante');
          return;
        }

        // Verifica token JWT
        const payload = verifyAccess(token);
        if (!payload || !payload.sub) {
          callback(false, 401, 'Token non valido');
          return;
        }

        // Verifica utente nel database
        const user = await one(
          `SELECT * FROM users WHERE id = $1 AND status = 'attivo'`,
          [payload.sub]
        );

        if (!user) {
          callback(false, 403, 'Utente non valido');
          return;
        }

        // Salva utente nell'oggetto request per il client
        info.req.user = user;
        callback(true);
      } catch (err) {
        console.error('[Chat WS] Errore verifica client:', err.message);
        callback(false, 500, 'Errore server');
      }
    }
  });

  wss.on('connection', (ws, req) => {
    const user = req.user;
    console.log(`[Chat WS] Nuova connessione: ${user.handle} (${user.id})`);

    // Salva referenze
    wsToUser.set(ws, user);

    // Gestisci messaggi
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (err) {
        console.error('[Chat WS] Errore processazione messaggio:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: 'Messaggio non valido' }));
      }
    });

    // Gestisci chiusura
    ws.on('close', () => {
      cleanupClient(ws);
      console.log(`[Chat WS] Connessione chiusa: ${user.handle}`);
    });

    // Gestisci errore
    ws.on('error', (err) => {
      console.error(`[Chat WS] Errore connessione ${user.handle}:`, err.message);
      cleanupClient(ws);
    });

    // Invia conferma connessione
    ws.send(JSON.stringify({
      type: 'connected',
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.display_name,
        role: user.role
      }
    }));
  });

  return wss;
}

/**
 * Gestisce messaggi WebSocket
 */
async function handleMessage(ws, message) {
  const user = wsToUser.get(ws);
  
  if (!user) {
    ws.close(1008, 'Utente non autenticato');
    return;
  }

  switch (message.type) {
    case 'join':
      await handleJoinChannel(ws, message);
      break;
    case 'leave':
      await handleLeaveChannel(ws, message);
      break;
    case 'message':
      await handleChatMessage(ws, message);
      break;
    case 'typing':
      await handleTyping(ws, message);
      break;
    case 'read':
      await handleReadReceipt(ws, message);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Tipo messaggio sconosciuto' }));
  }
}

/**
 * Gestisce join a un canale
 */
async function handleJoinChannel(ws, message) {
  const user = wsToUser.get(ws);
  const channelId = message.channelId;

  if (!channelId) {
    ws.send(JSON.stringify({ type: 'error', message: 'channelId obbligatorio' }));
    return;
  }

  // Verifica canale
  const channel = await one(
    `SELECT * FROM chat_channels WHERE id = $1 AND is_archived = false`,
    [channelId]
  );

  if (!channel) {
    ws.send(JSON.stringify({ type: 'error', message: 'Canale non trovato o archiviato' }));
    return;
  }

  // Verifica accesso
  if (!channel.is_public && channel.created_by !== user.id) {
    // Verifica se l'utente ha già messaggi nel canale
    const hasMessages = await one(
      `SELECT 1 FROM chat_messages WHERE channel_id = $1 AND user_id = $2 LIMIT 1`,
      [channelId, user.id]
    );
    
    if (!hasMessages) {
      ws.send(JSON.stringify({ type: 'error', message: 'Accesso negato' }));
      return;
    }
  }

  // Verifica che l'utente non sia bannato
  const isBanned = await one(
    `SELECT 1 FROM chat_moderation 
     WHERE channel_id = $1 AND user_id = $2 AND action = 'ban'
     AND (expires_at IS NULL OR expires_at > now())`,
    [channelId, user.id]
  );

  if (isBanned) {
    ws.send(JSON.stringify({ type: 'error', message: 'Sei bannato da questo canale' }));
    return;
  }

  // Registra client nel canale
  if (!connectedClients.has(channelId)) {
    connectedClients.set(channelId, new Map());
  }
  
  const channelClients = connectedClients.get(channelId);
  if (!channelClients.has(user.id)) {
    channelClients.set(user.id, new Set());
  }
  channelClients.get(user.id).add(ws);
  wsToChannel.set(ws, channelId);

  // Invia conferma join
  ws.send(JSON.stringify({
    type: 'joined',
    channelId,
    channel: {
      id: channel.id,
      name: channel.name,
      description: channel.description
    }
  }));

  // Invia messaggi non letti
  await sendUnreadMessages(ws, channelId, user.id);

  // Notifica agli altri utenti che qualcuno ha joinato
  broadcastToChannel(channelId, ws, {
    type: 'user_joined',
    user: {
      id: user.id,
      handle: user.handle,
      displayName: user.display_name,
      role: user.role
    }
  });

  // Invia lista utenti online nel canale
  await sendOnlineUsers(ws, channelId);
}

/**
 * Gestisce leave da un canale
 */
async function handleLeaveChannel(ws, message) {
  const channelId = wsToChannel.get(ws);
  const user = wsToUser.get(ws);

  if (!channelId || !user) return;

  // Rimuovi da connectedClients
  const channelClients = connectedClients.get(channelId);
  if (channelClients) {
    const userSockets = channelClients.get(user.id);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        channelClients.delete(user.id);
      }
    }
    
    if (channelClients.size === 0) {
      connectedClients.delete(channelId);
    }
  }

  wsToChannel.delete(ws);

  // Notifica agli altri utenti
  broadcastToChannel(channelId, ws, {
    type: 'user_left',
    user: {
      id: user.id,
      handle: user.handle
    }
  });
}

/**
 * Gestisce messaggio chat
 */
async function handleChatMessage(ws, message) {
  const user = wsToUser.get(ws);
  const channelId = wsToChannel.get(ws);

  if (!channelId || !user) {
    ws.send(JSON.stringify({ type: 'error', message: 'Non sei in alcun canale' }));
    return;
  }

  const content = message.content?.trim();
  const attachments = message.attachments || [];

  if (!content || content.length === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Messaggio vuoto' }));
    return;
  }

  if (content.length > 5000) {
    ws.send(JSON.stringify({ type: 'error', message: 'Messaggio troppo lungo (max 5000 caratteri)' }));
    return;
  }

  // Verifica muto
  const isMuted = await one(
    `SELECT 1 FROM chat_moderation 
     WHERE channel_id = $1 AND user_id = $2 AND action = 'mute'
     AND (expires_at IS NULL OR expires_at > now())`,
    [channelId, user.id]
  );

  if (isMuted) {
    ws.send(JSON.stringify({ type: 'error', message: 'Sei mutato in questo canale' }));
    return;
  }

  // Salva messaggio nel database
  const savedMessage = await one(
    `INSERT INTO chat_messages 
     (channel_id, user_id, body, attachments)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [channelId, user.id, content, JSON.stringify(attachments)]
  );

  // Aggiungi info utente al messaggio
  const messageData = {
    type: 'new_message',
    message: {
      id: savedMessage.id,
      channelId,
      userId: user.id,
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        role: user.role
      },
      body: content,
      attachments,
      createdAt: savedMessage.created_at,
      isPinned: false,
      canEdit: true,
      canDelete: true
    }
  };

  // Broadcast a tutti nel canale
  broadcastToChannel(channelId, null, messageData);

  // Log audit
  await audit(user.id, 'chat.message_send', { 
    channelId, 
    messageId: savedMessage.id 
  });
}

/**
 * Gestisce evento typing
 */
async function handleTyping(ws, message) {
  const user = wsToUser.get(ws);
  const channelId = wsToChannel.get(ws);

  if (!channelId || !user) return;

  broadcastToChannel(channelId, ws, {
    type: 'user_typing',
    user: {
      id: user.id,
      handle: user.handle,
      displayName: user.display_name
    }
  });
}

/**
 * Gestisce ricevuta lettura
 */
async function handleReadReceipt(ws, message) {
  const user = wsToUser.get(ws);
  const channelId = wsToChannel.get(ws);

  if (!channelId || !user) return;

  // Aggiorna letztenza lettura nel database
  const lastMessage = await one(
    `SELECT created_at FROM chat_messages 
     WHERE channel_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [channelId]
  );

  if (lastMessage) {
    await query(
      `INSERT INTO chat_messages_read (channel_id, user_id, last_read)
       VALUES ($1, $2, $3)
       ON CONFLICT (channel_id, user_id)
       DO UPDATE SET last_read = $3`,
      [channelId, user.id, lastMessage.created_at]
    );
  }
}

/**
 * Invia messaggi non letti al client
 */
async function sendUnreadMessages(ws, channelId, userId) {
  // Ottieni l'ultimo messaggio letto
  const lastRead = await one(
    `SELECT last_read FROM chat_messages_read 
     WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  );

  // Ottieni messaggi non letti
  const unread = await query(
    `SELECT 
       m.*,
       u.display_name,
       u.handle,
       u.avatar_url,
       u.role
     FROM chat_messages m
     JOIN users u ON m.user_id = u.id
     WHERE m.channel_id = $1 
       AND m.created_at > $2
     ORDER BY m.created_at ASC`,
    [channelId, lastRead?.last_read || '1970-01-01']
  );

  // Invia messaggi non letti
  for (const msg of unread.rows) {
    ws.send(JSON.stringify({
      type: 'new_message',
      message: {
        id: msg.id,
        channelId,
        userId: msg.user_id,
        user: {
          id: msg.user_id,
          handle: msg.handle,
          displayName: msg.display_name,
          avatarUrl: msg.avatar_url,
          role: msg.role
        },
        body: msg.body,
        attachments: msg.attachments || [],
        createdAt: msg.created_at,
        isPinned: msg.is_pinned,
        canEdit: msg.user_id === userId,
        canDelete: msg.user_id === userId
      }
    }));
  }
}

/**
 * Invia lista utenti online nel canale
 */
async function sendOnlineUsers(ws, channelId) {
  const channelClients = connectedClients.get(channelId);
  if (!channelClients) return;

  const onlineUsers = [];
  for (const [userId, sockets] of channelClients) {
    if (sockets.size > 0) {
      const user = await one(
        `SELECT id, display_name, handle, role FROM users WHERE id = $1`,
        [userId]
      );
      if (user) {
        onlineUsers.push({
          id: user.id,
          handle: user.handle,
          displayName: user.display_name,
          role: user.role
        });
      }
    }
  }

  ws.send(JSON.stringify({
    type: 'online_users',
    users: onlineUsers
  }));
}

/**
 * Broadcast messaggio a tutti nel canale
 * @param {string} channelId - ID canale
 * @param {WebSocket|null} exclude - WebSocket da escludere (opzionale)
 * @param {Object} message - Messaggio da inviare
 */
function broadcastToChannel(channelId, exclude, message) {
  const channelClients = connectedClients.get(channelId);
  if (!channelClients) return;

  const messageStr = JSON.stringify(message);

  for (const [userId, sockets] of channelClients) {
    for (const ws of sockets) {
      if (ws !== exclude && ws.readyState === 1) {
        try {
          ws.send(messageStr);
        } catch (err) {
          console.error(`[Chat WS] Errore broadcast a ${userId}:`, err.message);
        }
      }
    }
  }
}

/**
 * Pulisce client disconnesso
 */
function cleanupClient(ws) {
  const user = wsToUser.get(ws);
  const channelId = wsToChannel.get(ws);

  if (user && channelId) {
    const channelClients = connectedClients.get(channelId);
    if (channelClients) {
      const userSockets = channelClients.get(user.id);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          channelClients.delete(user.id);
        }
      }
      
      if (channelClients.size === 0) {
        connectedClients.delete(channelId);
      }
    }
  }

  wsToUser.delete(ws);
  wsToChannel.delete(ws);
}

/**
 * Ottieni numero di utenti online in un canale
 */
export function getOnlineCount(channelId) {
  const channelClients = connectedClients.get(channelId);
  return channelClients ? channelClients.size : 0;
}

/**
 * Ottieni tutti i client connessi
 */
export function getConnectedClients() {
  return {
    total: wsToUser.size,
    byChannel: Object.fromEntries(
      Array.from(connectedClients.entries()).map(([channelId, clients]) => [
        channelId,
        clients.size
      ])
    )
  };
}

/**
 * Invia messaggio a specifici utenti
 */
export async function sendMessageToUsers(userIds, message) {
  for (const userId of userIds) {
    // Trova tutti i WebSocket dell'utente
    for (const [channelId, clients] of connectedClients) {
      const userSockets = clients.get(userId);
      if (userSockets) {
        const messageStr = JSON.stringify(message);
        for (const ws of userSockets) {
          if (ws.readyState === 1) {
            try {
              ws.send(messageStr);
            } catch (err) {
              console.error(`[Chat WS] Errore invio a ${userId}:`, err.message);
            }
          }
        }
      }
    }
  }
}

/**
 * Notifica a tutti che un utente è online
 */
export async function notifyUserOnline(userId) {
  // Trova canali in cui l'utente è presente
  const channels = await query(
    `SELECT DISTINCT channel_id FROM chat_messages WHERE user_id = $1`,
    [userId]
  );

  for (const row of channels.rows) {
    broadcastToChannel(row.channel_id, null, {
      type: 'user_online',
      userId
    });
  }
}

/**
 * Ottieni WebSocket server
 */
export function getWSS() {
  return wss;
}

/**
 * Chiudi connessioni WebSocket
 */
export function closeWebSocket() {
  if (wss) {
    wss.clients.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.close(1001, 'Server in chiusura');
      }
    });
    wss.close();
    wss = null;
  }
  
  connectedClients.clear();
  wsToUser.clear();
  wsToChannel.clear();
}

export default {
  initChatWebSocket,
  getWSS,
  closeWebSocket,
  getOnlineCount,
  getConnectedClients,
  sendMessageToUsers,
  notifyUserOnline
};
