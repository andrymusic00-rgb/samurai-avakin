/**
 * Chat Manager - Chat in tempo reale del clan
 * Gestisce connessioni WebSocket, messaggi, canali
 */

import { ApiClient } from './api.js';
import { showNotification } from './ui.js';

// ============================================
// STATO CHAT
// ============================================

let chatState = {
  channels: [],
  messages: {}, // { channelId: [messages] }
  currentChannel: null,
  onlineUsers: {}, // { channelId: [users] }
  typingUsers: new Set(), // { userId }
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectTimeout: 3000,
  ws: null,
  subscriptions: new Map() // { eventType: Set<callback> }
};

// ============================================
// API CLIENT CHAT
// ============================================

const chatApi = {
  // Canali
  getChannels: async () => {
    const response = await ApiClient.get('/api/chat/channels');
    return response.data.channels;
  },
  
  createChannel: async (channelData) => {
    const response = await ApiClient.post('/api/chat/channels', channelData);
    return response.data.channel;
  },
  
  getChannel: async (id) => {
    const response = await ApiClient.get(`/api/chat/channels/${id}`);
    return response.data.channel;
  },
  
  // Messaggi
  getMessages: async (channelId, params = {}) => {
    const query = new URLSearchParams(params);
    const response = await ApiClient.get(`/api/chat/channels/${channelId}/messages?${query.toString()}`);
    return response.data.messages;
  },
  
  sendMessage: async (channelId, messageData) => {
    const response = await ApiClient.post(`/api/chat/channels/${channelId}/messages`, messageData);
    return response.data.message;
  },
  
  updateMessage: async (messageId, updates) => {
    const response = await ApiClient.patch(`/api/chat/messages/${messageId}`, updates);
    return response.data.message;
  },
  
  deleteMessage: async (messageId) => {
    await ApiClient.delete(`/api/chat/messages/${messageId}`);
    return true;
  },
  
  pinMessage: async (messageId) => {
    await ApiClient.post(`/api/chat/messages/${messageId}/pin`);
    return true;
  },
  
  // Moderazione
  moderateUser: async (channelId, userId, action, reason, duration) => {
    const response = await ApiClient.post(`/api/chat/channels/${channelId}/moderate`, {
      user_id: userId,
      action,
      reason,
      duration
    });
    return response.data.moderation;
  },
  
  // Statistiche
  getStats: async () => {
    const response = await ApiClient.get('/api/chat/stats');
    return response.data.stats;
  },
  
  // Marcatura lettura
  markAsRead: async (channelId) => {
    await ApiClient.post(`/api/chat/channels/${channelId}/read`);
    return true;
  }
};

// ============================================
// WEB SOCKET MANAGER
// ============================================

class ChatWebSocket {
  constructor() {
    this.ws = null;
    this.url = null;
    this.reconnectInterval = null;
    this.isConnecting = false;
  }

  /**
   * Connettersi al WebSocket
   */
  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // Chiudi connessione esistente
    this.disconnect();

    // Genera URL con token
    this.url = `ws://${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.isConnecting = true;

        this.ws.onopen = () => {
          this.isConnecting = false;
          chatState.isConnected = true;
          chatState.reconnectAttempts = 0;
          console.log('[Chat WS] Connesso');
          emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          chatState.isConnected = false;
          console.log('[Chat WS] Disconnesso:', event.code, event.reason);
          emit('disconnected', event);
          
          // Tentativo di reconnect
          this.scheduleReconnect();
          
          reject(new Error(`Disconnesso: ${event.code} - ${event.reason}`));
        };

        this.ws.onerror = (error) => {
          this.isConnecting = false;
          console.error('[Chat WS] Errore:', error);
          emit('error', error);
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  /**
   * Disconnetti
   */
  disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignora errori
      }
      this.ws = null;
    }

    chatState.isConnected = false;
  }

  /**
   * Reconnetti
   */
  reconnect() {
    if (this.isConnecting) return;
    
    chatState.reconnectAttempts++;
    
    if (chatState.reconnectAttempts > chatState.maxReconnectAttempts) {
      console.log('[Chat WS] Max tentativi reconnect raggiunti');
      return;
    }

    console.log(`[Chat WS] Tentativo reconnect ${chatState.reconnectAttempts}/${chatState.maxReconnectAttempts}`);
    
    // Ritardo esponenziale
    const delay = Math.min(
      chatState.reconnectTimeout * Math.pow(2, chatState.reconnectAttempts - 1),
      30000 // max 30 secondi
    );

    setTimeout(() => {
      if (!chatState.isConnected) {
        const token = localStorage.getItem('samurai_token');
        if (token) {
          this.connect(token).catch(() => {});
        }
      }
    }, delay);
  }

  /**
   * Pianifica reconnect
   */
  scheduleReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    this.reconnectInterval = setInterval(() => {
      if (!chatState.isConnected && !this.isConnecting) {
        this.reconnect();
      }
    }, chatState.reconnectTimeout);
  }

  /**
   * Invia messaggio
   */
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket non connesso');
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('[Chat WS] Errore invio:', err);
      return false;
    }
  }

  /**
   * Gestisce messaggi ricevuti
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          // Aggiorna stato
          chatState.isConnected = true;
          chatState.reconnectAttempts = 0;
          break;

        case 'joined':
          // Canale joantino
          chatState.currentChannel = message.channelId;
          break;

        case 'new_message':
          // Nuovo messaggio
          this.handleNewMessage(message.message);
          break;

        case 'user_joined':
          // Utente entrato nel canale
          this.handleUserJoined(message.user, message.channelId);
          break;

        case 'user_left':
          // Utente uscito dal canale
          this.handleUserLeft(message.user, message.channelId);
          break;

        case 'user_typing':
          // Utente sta scrivendo
          this.handleUserTyping(message.user, message.channelId);
          break;

        case 'online_users':
          // Lista utenti online
          this.handleOnlineUsers(message.users, message.channelId);
          break;

        case 'user_online':
          // Utente online (notifica globale)
          this.handleUserOnline(message.userId);
          break;

        case 'pong':
          // Risposta ping
          break;

        case 'error':
          // Errore dal server
          showNotification({ type: 'error', message: message.message });
          break;

        default:
          console.log('[Chat WS] Messaggio sconosciuto:', message.type);
      }

      // Emetti evento personalizzato
      emit(message.type, message);
    } catch (err) {
      console.error('[Chat WS] Errore processazione messaggio:', err);
    }
  }

  /**
   * Gestisce nuovo messaggio
   */
  handleNewMessage(message) {
    const channelId = message.channelId || chatState.currentChannel;
    
    if (!channelId) return;

    // Inizializza array messaggi per canale
    if (!chatState.messages[channelId]) {
      chatState.messages[channelId] = [];
    }

    // Aggiungi messaggio
    chatState.messages[channelId].push(message);
    
    // Limita a ultimi 200 messaggi
    if (chatState.messages[channelId].length > 200) {
      chatState.messages[channelId].shift();
    }

    // Emetti evento
    emit('new_message', { channelId, message });
    
    // Se è il canale corrente, emetti anche evento specifico
    if (chatState.currentChannel === channelId) {
      emit('current_channel_new_message', { message });
    }
  }

  /**
   * Gestisce utente entrato
   */
  handleUserJoined(user, channelId) {
    if (!channelId) return;

    if (!chatState.onlineUsers[channelId]) {
      chatState.onlineUsers[channelId] = [];
    }

    // Aggiungi utente se non già presente
    if (!chatState.onlineUsers[channelId].some(u => u.id === user.id)) {
      chatState.onlineUsers[channelId].push(user);
      emit('user_online', { channelId, user });
    }
  }

  /**
   * Gestisce utente uscito
   */
  handleUserLeft(user, channelId) {
    if (!channelId) return;

    if (chatState.onlineUsers[channelId]) {
      chatState.onlineUsers[channelId] = chatState.onlineUsers[channelId]
        .filter(u => u.id !== user.id);
      emit('user_offline', { channelId, userId: user.id });
    }
  }

  /**
   * Gestisce utente sta scrivendo
   */
  handleUserTyping(user, channelId) {
    if (!channelId) return;

    chatState.typingUsers.add(`${channelId}:${user.id}`);
    emit('user_typing', { channelId, user });

    // Rimuovi dopo 3 secondi
    setTimeout(() => {
      chatState.typingUsers.delete(`${channelId}:${user.id}`);
      emit('user_stopped_typing', { channelId, userId: user.id });
    }, 3000);
  }

  /**
   * Gestisce lista utenti online
   */
  handleOnlineUsers(users, channelId) {
    if (!channelId) return;

    chatState.onlineUsers[channelId] = users;
    emit('online_users', { channelId, users });
  }

  /**
   * Gestisce utente online (notifica globale)
   */
  handleUserOnline(userId) {
    emit('user_online_global', { userId });
  }
}

// Istanza WebSocket
const wsManager = new ChatWebSocket();

// ============================================
// EVENT EMITTER
// ============================================

/**
 * Sottoscrivi a evento
 */
export function on(event, callback) {
  if (!chatState.subscriptions.has(event)) {
    chatState.subscriptions.set(event, new Set());
  }
  chatState.subscriptions.get(event).add(callback);
  
  // Ritorna funzione per rimuovere subscription
  return () => {
    chatState.subscriptions.get(event)?.delete(callback);
  };
}

/**
 * Emetti evento
 */
function emit(event, data = {}) {
  const callbacks = chatState.subscriptions.get(event);
  if (callbacks) {
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[Chat] Errore callback evento ${event}:`, err);
      }
    });
  }
}

// ============================================
// ACTIONS CHAT
// ============================================

export const ChatActions = {
  // Connessione
  connect: async () => {
    const token = localStorage.getItem('samurai_token');
    if (!token) {
      showNotification({ type: 'error', message: 'Devi accedere per usare la chat' });
      return false;
    }

    try {
      await wsManager.connect(token);
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore connessione chat: ${err.message}` });
      return false;
    }
  },

  disconnect: () => {
    wsManager.disconnect();
  },

  isConnected: () => chatState.isConnected,

  // Canali
  loadChannels: async () => {
    try {
      chatState.channels = await chatApi.getChannels();
      return chatState.channels;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento canali: ${err.message}` });
      return [];
    }
  },

  joinChannel: async (channelId) => {
    if (!chatState.isConnected) {
      await ChatActions.connect();
    }

    // Se già nel canale, non fare nulla
    if (chatState.currentChannel === channelId) {
      return true;
    }

    try {
      // Invia messaggio join
      wsManager.send({ type: 'join', channelId });
      chatState.currentChannel = channelId;
      
      // Carica messaggi storici
      await ChatActions.loadMessages(channelId);
      
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore join canale: ${err.message}` });
      return false;
    }
  },

  leaveChannel: () => {
    if (!chatState.currentChannel) return;

    try {
      wsManager.send({ type: 'leave' });
      chatState.currentChannel = null;
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore leave canale: ${err.message}` });
      return false;
    }
  },

  // Messaggi
  loadMessages: async (channelId, limit = 50) => {
    try {
      const messages = await chatApi.getMessages(channelId, { limit });
      
      if (!chatState.messages[channelId]) {
        chatState.messages[channelId] = [];
      }
      
      // Sostituisci messaggi se è il primo caricamento
      // Altrimenti aggiungi in testa
      if (chatState.messages[channelId].length === 0) {
        chatState.messages[channelId] = messages;
      } else {
        // Caricamento messaggi precedenti
        chatState.messages[channelId] = [...messages, ...chatState.messages[channelId]];
      }
      
      return messages;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento messaggi: ${err.message}` });
      return [];
    }
  },

  sendMessage: async (content, attachments = []) => {
    if (!chatState.currentChannel) {
      showNotification({ type: 'error', message: 'Seleziona un canale prima' });
      return false;
    }

    if (!content.trim()) {
      showNotification({ type: 'error', message: 'Il messaggio non può essere vuoto' });
      return false;
    }

    try {
      // Invia tramite WebSocket per immediate delivery
      const messageData = {
        type: 'message',
        body: content,
        attachments
      };
      
      const sent = wsManager.send(messageData);
      
      // Invia anche tramite HTTP per persistenza (fallback)
      if (sent) {
        await chatApi.sendMessage(chatState.currentChannel, { body: content, attachments });
      }
      
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore invio messaggio: ${err.message}` });
      return false;
    }
  },

  updateMessage: async (messageId, newContent) => {
    try {
      await chatApi.updateMessage(messageId, { body: newContent });
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore modifica messaggio: ${err.message}` });
      return false;
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await chatApi.deleteMessage(messageId);
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore eliminazione messaggio: ${err.message}` });
      return false;
    }
  },

  pinMessage: async (messageId) => {
    try {
      await chatApi.pinMessage(messageId);
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore pin messaggio: ${err.message}` });
      return false;
    }
  },

  // Typing
  sendTyping: () => {
    if (!chatState.currentChannel || !chatState.isConnected) return false;
    
    try {
      wsManager.send({ type: 'typing' });
      return true;
    } catch (err) {
      return false;
    }
  },

  // Moderazione
  moderateUser: async (userId, action, reason = '', duration = null) => {
    if (!chatState.currentChannel) {
      showNotification({ type: 'error', message: 'Seleziona un canale prima' });
      return false;
    }

    try {
      await chatApi.moderateUser(
        chatState.currentChannel,
        userId,
        action,
        reason,
        duration
      );
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore moderazione: ${err.message}` });
      return false;
    }
  },

  // Lettura
  markAsRead: async () => {
    if (!chatState.currentChannel) return false;

    try {
      await chatApi.markAsRead(chatState.currentChannel);
      return true;
    } catch (err) {
      return false;
    }
  },

  // Statistiche
  loadStats: async () => {
    try {
      return await chatApi.getStats();
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento statistiche: ${err.message}` });
      return null;
    }
  }
};

// ============================================
// SELECTORS CHAT
// ============================================

export const ChatSelectors = {
  getChannels: () => chatState.channels,
  getCurrentChannel: () => chatState.currentChannel,
  getMessages: (channelId) => {
    if (!channelId) return [];
    return chatState.messages[channelId] || [];
  },
  getCurrentMessages: () => {
    if (!chatState.currentChannel) return [];
    return chatState.messages[chatState.currentChannel] || [];
  },
  getOnlineUsers: (channelId) => {
    if (!channelId) return [];
    return chatState.onlineUsers[channelId] || [];
  },
  getTypingUsers: (channelId) => {
    if (!channelId) return [];
    return Array.from(chatState.typingUsers)
      .filter(key => key.startsWith(`${channelId}:`))
      .map(key => key.split(':')[1]);
  },
  isConnected: () => chatState.isConnected,
  getChannel: (channelId) => chatState.channels.find(c => c.id === channelId),
  findChannelByName: (name) => chatState.channels.find(c => c.name === name)
};

// ============================================
// CHAT STORE
// ============================================

const ChatStore = {
  state: chatState,
  actions: ChatActions,
  selectors: ChatSelectors,
  on,
  ws: wsManager
};

// ============================================
// UTILITY CHAT
// ============================================

/**
 * Formatta messaggio per display
 */
export function formatMessage(message, currentUserId) {
  const isCurrentUser = message.userId === currentUserId;
  
  return {
    ...message,
    isCurrentUser,
    isOwn: isCurrentUser,
    canEdit: message.canEdit !== false && isCurrentUser,
    canDelete: message.canDelete !== false && (isCurrentUser || message.user?.role === 'bushi'),
    timestamp: formatTime(message.createdAt)
  };
}

/**
 * Formatta ora
 */
export function formatTime(date) {
  const now = new Date();
  const msgDate = new Date(date);
  
  // Stessa giornata
  if (msgDate.toDateString() === now.toDateString()) {
    return msgDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  
  // Ieri
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDate.toDateString() === yesterday.toDateString()) {
    return `Ieri ${msgDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Più di ieri
  return msgDate.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Sanitizza contenuto messaggio
 */
export function sanitizeMessage(content) {
  // Escape HTML
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Trasforma URL in link cliccabili
 */
export function linkifyMessage(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return content.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

/**
 * Colora messaggi in base al ruolo
 */
export function getMessageColor(role) {
  const colors = {
    admin: '#ff4444',
    shogun: '#ff8800',
    bushi: '#00aa00',
    membro: '#888888'
  };
  return colors[role] || colors.membro;
}

// ============================================
// INTEGRAZIONE CON NOTIFICHE
// ============================================

/**
 * Notifica nuovo messaggio (per browser)
 */
export function notifyNewMessage(message, channelName) {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(`Nuovo messaggio in ${channelName}`, {
      body: `${message.user.displayName}: ${message.body.substring(0, 50)}...`,
      icon: message.user.avatarUrl || '/assets/icons/icon-192.png',
      tag: `chat-${message.id}`,
      data: {
        type: 'chat_message',
        channelId: message.channelId,
        messageId: message.id
      }
    });
  }
}

// ============================================
// EXPORT
// ============================================

export default ChatStore;

export { ChatActions, ChatSelectors, ChatState: chatState, chatApi, wsManager, on };
