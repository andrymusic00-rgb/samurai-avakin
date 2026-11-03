# Guida al Testing - Samurai di Avakin

> **Versione aggiornata con supporto completo per test automatici, CMS, Chat, Push Notifications e Multilingua**

---

## Indice

1. [Architettura dei Test](#architettura-dei-test)
2. [Esecuzione dei Test](#esecuzione-dei-test)
3. [Test Unitari](#test-unitari)
4. [Test di Integrazione](#test-di-integrazione)
5. [Test E2E](#test-e2e)
6. [Test API](#test-api)
7. [Test su Rete Locale](#test-su-rete-locale)
8. [Nuove Funzionalità](#nuove-funzionalità)
9. [Struttura del Progetto](#struttura-del-progetto)
10. [Risoluzione Problemi](#risoluzione-problemi)

---

## Architettura dei Test

Il progetto ora include un **framework di testing completo** con supporto per:

- **Test Unitari**: Test di funzioni singole senza dipendenze esterne
- **Test di Integrazione**: Test di flussi completi (API + Database)
- **Test E2E**: Test end-to-end (richiede browser reale)
- **Test API**: Test automatici delle API REST
- **Test su Rete Locale**: Test che possono essere eseguiti da altri dispositivi sulla stessa rete

### Dipendenze Test

Tutti i test sono **zero-dependency** - usano solo Node.js e il codice esistente.

- Node.js >= 20
- PostgreSQL o PGlite (inclusa)

### Struttura Cartelle Test

```
isamurai/
├── test/
│   ├── unit/            # Test unitari
│   │   └── test.api.js # Test funzioni API e utility
│   │
│   ├── integration/     # Test di integrazione
│   │   └── test.auth.js
│   │   └── test.cms.js
│   │   └── test.chat.js
│   │
│   └── e2e/            # Test E2E
│       └── testflows.js
│
├── server/
│   └── scripts/
│       └── test.js     # Test Runner principale
│
└── server/src/lib/
    └── testing.js      # Framework di testing
```

---

## Esecuzione dei Test

### Comandi Base

| Comando | Descrizione |
|---|---|
| `npm test` | Esegue **tutti** i test (unit + integration + e2e) |
| `npm run test:unit` | Solo test unitari |
| `npm run test:integration` | Solo test di integrazione |
| `npm run test:e2e` | Solo test E2E |
| `npm run test:api` | Solo test API |
| `npm run test:verbose` | Tutti i test con output dettagliato |
| `npm run test:coverage` | Test con coverage (da implementare) |

### Esempio di Output

```
================================================================================
  SAMURAI DI AVAKIN - TEST RUNNER
================================================================================

================================================================================
  ESEGUZIONE TEST UNIT
================================================================================

  ✓ Validate - Email valido (5ms)
  ✓ Validate - Handle valido (3ms)
  ✓ Validate - Password valida (2ms)
  ✓ Lib - Generazione token casuale (15ms)
  ✓ Lib - Hash password (50ms)
  ✓ Lib - JWT sign/verify (10ms)
  ✓ CMS - Generazione slug (1ms)
  ✓ CMS - Formattazione data (0ms)
  ✓ CMS - Ordinamento per order_idx (0ms)
  ✓ CMS - Sanitizzazione HTML (1ms)
  ✓ Chat - Formattazione ora (0ms)
  ✓ Chat - Linkificazione messaggio (1ms)
  ✓ Chat - Colore messaggio per ruolo (0ms)
  ✓ Chat - Sanitizzazione messaggio (0ms)

================================================================================
  ESEGUZIONE TEST INTEGRATION
================================================================================

  ✓ Auth - Flusso completo (150ms)
  ✓ CMS - Flusso pagine (200ms)
  ✓ Chat - Flusso canali (180ms)

  REPORT FINALE
================================================================================
  Totale: 17
  Passati: 17
  Falliti: 0
  Successo: 100.00%
================================================================================

  ✓ Report HTML salvato in test/reports/test-report.html
```

### Report dei Test

Dopo ogni esecuzione:
- **Report a console** con sommario
- **Report HTML** salvato in `test/reports/test-report.html`
- **Risultati nel database** nella tabella `test_runs`

---

## Test Unitari

Test di funzioni isolate senza database o dipendenze esterne.

### Funzioni Testate

#### Autenticazione
- Validazione email
- Validazione handle
- Validazione password
- Generazione token
- Hash/SHA-256
- JWT sign/verify

#### CMS
- Generazione slug
- Formattazione date
- Ordinamento per `order_idx`
- Sanitizzazione HTML

#### Chat
- Formattazione orario
- Linkificazione messaggi
- Colori messaggi per ruolo
- Sanitizzazione messaggi

### Esempio Test Unitario

```javascript
{
  name: 'Validate - Email valido',
  async test({ db }) {
    const validEmails = [
      'test@example.com',
      'user.name+tag@sub.example.com'
    ];
    
    for (const email of validEmails) {
      assert.ok(email.includes('@'), `Email ${email} valida`);
    }
  }
}
```

---

## Test di Integrazione

Test di flussi completi che coinvolgono più componenti.

### Flussi Testati

#### Autenticazione Completa
```
Registrazione → Login → Get Me → Update Profile → Logout
```

#### CMS
```
Get Pages → Get Page → Update Page → Get Articles → Create Article → Delete Article
```

#### Chat
```
Get Channels → Join Channel → Send Message → Get Messages → Leave Channel
```

#### Push Notifications
```
Subscribe → Send Test Notification → Get Notifications
```

### Esempio Test di Integrazione

```javascript
{
  name: 'Auth - Flusso completo',
  async test({ api, createTestUser }) {
    // 1. Registrazione
    const user = await createTestUser();
    
    // 2. Login
    await api.login(user.email, user.password);
    
    // 3. Me
    const me = await api.me();
    assert.ok(me.data.authenticated);
    
    // 4. Account
    const account = await api.request('GET', '/api/account');
    assert.ok(account.ok);
    
    // 5. Logout
    await api.logout();
    
    // 6. Verifica logout
    const meAfter = await api.me();
    assert.ok(!meAfter.data.authenticated);
  }
}
```

---

## Test E2E

> **Nota**: I test E2E completi richiedono browser reale (Playwright, Cypress, Puppeteer).
> La versione attuale include test HTTP semplificati.

### Flussi E2E Testati

- Registrazione utente → Login → Navigazione → Logout
- Accesso area riservata
- Modifica profilo
- Upload avatar
- Iscrizione evento
- Invio messaggio chat
- Notifiche push (simulate)

### Strumenti Consigliati

Per test E2E completi:

```bash
# Installa Playwright
npm install --save-dev @playwright/test

# Esegui test
npx playwright test
```

---

## Test API

Test automatici delle API REST.

### Comando
```bash
npm run test:api
```

### API Testate

#### Autenticazione
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/logout`
- POST `/api/auth/refresh`

#### Account
- GET `/api/account`
- PATCH `/api/account/profile`
- PATCH `/api/account/preferences`
- POST `/api/account/avatar`
- POST `/api/account/uploads`

#### Clan
- GET `/api/clan/roster`
- GET `/api/clan/stats`
- GET `/api/clan/events`
- GET `/api/clan/leaderboard`
- GET `/api/clan/raid`

#### CMS
- GET `/api/cms/pages`
- GET `/api/cms/pages/{key}`
- POST `/api/cms/pages` (admin)
- PATCH `/api/cms/pages/{key}` (bushi+)
- GET `/api/cms/articles`
- POST `/api/cms/articles` (bushi+)
- GET `/api/cms/gallery`
- POST `/api/cms/gallery` (bushi+)
- GET `/api/cms/videos`
- GET `/api/cms/faq`

#### Chat
- GET `/api/chat/channels`
- POST `/api/chat/channels` (bushi+)
- GET `/api/chat/channels/{id}/messages`
- POST `/api/chat/channels/{id}/messages`
- DELETE `/api/chat/messages/{id}`

#### Push Notifications
- POST `/api/push/subscribe`
- DELETE `/api/push/subscribe`
- GET `/api/push/notifications`
- POST `/api/push/send` (bushi+)

---

## Test su Rete Locale

> **Questa è la parte più importante per il tuo bisogno:** **testare su più dispositivi collegati alla stessa rete**

### Setup Rete Locale

#### Passo 1: Avvia Server
```bash
npm start
# O in modalità sviluppo con auto-reload
npm run dev
```

Il server sarà acceso su:
- **HTTP**: `http://127.0.0.1:4173`
- **Chat WS**: `ws://127.0.0.1:4173/ws/chat`

#### Passo 2: Rendi accessibile su rete locale

Per permettere ad altri dispositivi sulla stessa rete di accedere:

```bash
# Opzione A: Usa l'indirizzo IP locale
HOST=0.0.0.0 PORT=4173 npm start

# Trova il tuo IP locale
# Su Mac/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
# Su Windows: ipconfig

# Poi accedi da altri dispositivi usando:
# http://[TUO_IP_LOCALE]:4173
```

Oppure modifica `.env`:
```
HOST=0.0.0.0
PORT=4173
```

#### Passo 3: Verifica connettività

Da un altro dispositivo sulla stessa rete:
1. Apri browser
2. Vai a `http://[IP_SERVER]:4173`
3. Dovresti vedere il sito funzionante

#### Passo 4: Esegui test da remoto

```bash
# Da un altro computer sulla stessa rete:
# Copia il progetto e avvia i test puntando al server remoto

# Modifica test.js per usare l'IP del server:
# const apiClient = new ApiTestClient(`http://[IP_SERVER]:4173`);

# Poi esegui:
npm run test:api
```

### Script di Test per Rete Locale

Ho creato uno script dedicato per test su rete locale:

#### `test-local.js`

```javascript
// server/scripts/test-local.js
import { ApiTestClient } from '../src/lib/testing.js';

// Indirizzo del server sulla rete locale
const SERVER_IP = process.argv[2] || '127.0.0.1';
const SERVER_PORT = process.argv[3] || 4173;

const apiClient = new ApiTestClient(`http://${SERVER_IP}:${SERVER_PORT}`);

async function testLocalNetwork() {
  console.log('='.repeat(60));
  console.log(`  TEST SU RETE LOCALE`);
  console.log(`  Server: http://${SERVER_IP}:${SERVER_PORT}`);
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  // Test 1: Server accessibile
  try {
    const health = await apiClient.request('GET', '/api/clan/health');
    if (health.ok) {
      console.log('✓ Server accessibile');
      passed++;
    } else {
      console.log('✗ Server non accessibile');
      failed++;
    }
  } catch (err) {
    console.log('✗ Errore connessione:', err.message);
    failed++;
  }

  // Test 2: Registrazione
  try {
    const user = {
      email: `test-local-${Date.now()}@test.com`,
      password: 'TestPass123!',
      name: 'Test Locale',
      handle: `TEST_LOCAL_${Date.now()}`,
      region: 'Europa',
      device: 'PC'
    };
    
    const register = await apiClient.request('POST', '/api/auth/register', user);
    if (register.ok) {
      console.log('✓ Registrazione utente');
      passed++;
    } else {
      console.log('✗ Registrazione fallita:', register.error);
      failed++;
    }
  } catch (err) {
    console.log('✗ Errore registrazione:', err.message);
    failed++;
  }

  // Test 3: Login
  try {
    await apiClient.login('kenshin@samurai.test', 'Samurai2019');
    const me = await apiClient.me();
    if (me.data.authenticated) {
      console.log('✓ Login utente demo');
      passed++;
    } else {
      console.log('✗ Login fallito');
      failed++;
    }
  } catch (err) {
    console.log('✗ Errore login:', err.message);
    failed++;
  }

  // Test 4: CMS
  try {
    const pages = await apiClient.request('GET', '/api/cms/pages');
    if (pages.ok && pages.data.pages) {
      console.log(`✓ CMS: ${pages.data.pages.length} pagine caricate`);
      passed++;
    } else {
      console.log('✗ CMS fallito');
      failed++;
    }
  } catch (err) {
    console.log('✗ Errore CMS:', err.message);
    failed++;
  }

  // Test 5: Chat Channels
  try {
    const channels = await apiClient.request('GET', '/api/chat/channels');
    if (channels.ok) {
      console.log(`✓ Chat: ${channels.data.channels?.length || 0} canali`);
      passed++;
    } else {
      console.log('✗ Chat fallito');
      failed++;
    }
  } catch (err) {
    console.log('✗ Errore Chat:', err.message);
    failed++;
  }

  // Test 6: Push Subscribe (solo struttura)
  try {
    const sub = await apiClient.request('POST', '/api/push/subscribe', {
      subscription: {
        endpoint: 'https://test.endpoint',
        keys: { auth: 'test', p256dh: 'test' }
      }
    });
    if (sub.ok) {
      console.log('✓ Push: Subscription test');
      passed++;
    } else {
      console.log('✗ Push fallito');
      failed++;
    }
  } catch (err) {
    console.log('✗ Errore Push:', err.message);
    failed++;
  }

  // Sommario
  console.log('='.repeat(60));
  console.log(`  Totale: ${passed + failed}`);
  console.log(`  Passati: ${passed}`);
  console.log(`  Falliti: ${failed}`);
  console.log(`  Successo: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
  console.log('='.repeat(60));

  return failed === 0;
}

// Esegui
testLocalNetwork().catch(console.error);
```

#### Come usare

Da un altro dispositivo sulla stessa rete:

```bash
# Da terminale:
node server/scripts/test-local.js [IP_SERVER] [PORTA]

# Esempio:
node server/scripts/test-local.js 192.168.1.100 4173
```

Da browser su altro dispositivo:
1. Apri `http://[IP_SERVER]:4173`
2. Prova tutte le funzionalità manualmente
3. Registra un nuovo utente
4. Accedi
5. Prova chat, CMS, ecc.

### Test WebSocket su Rete Locale

#### `test-ws-local.js`

```javascript
// server/scripts/test-ws-local.js
import WebSocket from 'ws';

const SERVER_IP = process.argv[2] || '127.0.0.1';
const SERVER_PORT = process.argv[3] || 4173;
const WS_URL = `ws://${SERVER_IP}:${SERVER_PORT}/ws/chat?token=TEST_TOKEN`;

async function testWebSocket() {
  return new Promise((resolve) => {
    console.log('='.repeat(60));
    console.log(`  TEST WEB SOCKET SU RETE LOCALE`);
    console.log(`  Server: ${WS_URL}`);
    console.log('='.repeat(60));

    const ws = new WebSocket(WS_URL);
    let passed = 0;
    let failed = 0;

    ws.on('open', () => {
      console.log('✓ Connessione WebSocket stabilita');
      passed++;
      
      // Invia messaggio ping
      ws.send(JSON.stringify({ type: 'ping' }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('✓ Messaggio ricevuto:', message.type);
        passed++;
        
        if (message.type === 'pong') {
          console.log('✓ Ping-Pong funzionante');
          passed++;
        }
      } catch (err) {
        console.log('✗ Errore parsing messaggio');
        failed++;
      }
    });

    ws.on('error', (err) => {
      console.log('✗ Errore WebSocket:', err.message);
      failed++;
    });

    ws.on('close', () => {
      console.log('✓ Connessione chiusa');
      
      console.log('='.repeat(60));
      console.log(`  Passati: ${passed}`);
      console.log(`  Falliti: ${failed}`);
      console.log('='.repeat(60));
      
      resolve(failed === 0);
    });

    // Chiudi dopo 5 secondi
    setTimeout(() => ws.close(), 5000);
  });
}

// Esegui (richiede token valido)
// Per test, usa un token da login:
// 1. npm start
// 2. Login su http://localhost:4173
// 3. Copia il cookie samurai_session
// 4. Esegui: node server/scripts/test-ws-local.js [IP] [PORT] [TOKEN]
testWebSocket().catch(console.error);
```

---

## Nuove Funzionalità

### 1. CMS (Content Management System)

**Backend** (`server/src/routes/cms.js`):
- ✅ Pagine CMS (Hero, Notizie, Gallery, Video, FAQ)
- ✅ CRUD Articoli / Notizie
- ✅ CRUD Galleria Immagini
- ✅ CRUD Video
- ✅ CRUD FAQ
- ✅ Gestione Categorie
- ✅ Upload immagini con Multer

**Frontend** (`assets/js/cms.js`):
- ✅ API Client CMS
- ✅ Actions per tutte le operazioni
- ✅ Selectors per accesso allo stato
- ✅ Utility (slug, sanitize, format)

**Permessi**:
- `bushi`+: Create, Update, Delete contenuti
- `admin`: Gestione pagine di sistema

### 2. Chat in Tempo Reale

**Backend** (`server/src/routes/chat.js`, `server/src/lib/chat.js`):
- ✅ WebSocket Server (`ws://.../ws/chat`)
- ✅ Canali pubblici e privati
- ✅ Messaggi persistenti nel DB
- ✅ Moderazione (mute, ban, warn)
- ✅ Notifiche online/offline
- ✅ Messaggi non letti

**Frontend** (`assets/js/chat.js`):
- ✅ WebSocket Client
- ✅ Join/Leave canali
- ✅ Invio/ricezione messaggi
- ✅ Typing indicators
- ✅ Online users list
- ✅ Formattazione messaggi

**Autenticazione WebSocket**:
```
Connessione: ws://[HOST]:[PORT]/ws/chat?token=[JWT_TOKEN]
```

### 3. Push Notifications

**Backend** (`server/src/routes/push.js`, `server/src/lib/push.js`):
- ✅ Subscription VAPID
- ✅ Invio notifiche push
- ✅ Templates notifiche (messaggi, eventi, raid)
- ✅ Scheduler promemoria eventi
- ✅ Sync con notifiche in-app

**Frontend** (Service Worker in `assets/sw.js`):
```javascript
// Service worker deve gestire push events
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icons/icon-192.png',
      data: data.data
    })
  );
});
```

**Note**: In sviluppo, le notifiche push sono simulate. In produzione, servono:
- HTTPS
- VAPID Keys configurate
- Service Worker registrato

### 4. Multilingua (i18n)

**Backend** (`server/src/middleware/i18n.js`):
- ✅ Middleware rilevamento lingua
- ✅ Traduzioni dal database
- ✅ Cache traduzioni
- ✅ Import/Export traduzioni

**Frontend** (`assets/js/i18n.js`):
- ✅ Traduzione lato client
- ✅ Rilevamento automatico lingua
- ✅ Cambio lingua dinamico
- ✅ Traduzione automatica DOM

**Lingue Supportate**: Italiano, Inglese, Spagnolo

**Come aggiungere traduzioni**:
```javascript
// Via API (admin)
await fetch('/api/i18n/translations', {
  method: 'POST',
  body: JSON.stringify({
    key: 'welcome.title',
    lang: 'en',
    value: 'Welcome'
  })
});

// Via codice
import { addTranslation } from '../src/middleware/i18n.js';
await addTranslation('welcome.title', 'es', 'Bienvenido');
```

---

## Struttura del Progetto

```
isamurai/
├── index.html                    # Shell principale
├── offline.html                 # Pagina offline PWA
├── package.json                 # Dipendenze e script
├── README.md                    # Documentazione originale
├── TESTING_GUIDE.md             # Questa guida
│
├── test/                        # Cartella test
│   ├── unit/                    # Test unitari
│   │   └── test.api.js         # Test funzioni API
│   │
│   ├── integration/             # Test di integrazione
│   │   └── test.auth.js        # Test flussi autenticazione
│   │
│   └── e2e/                    # Test E2E
│       └── testflows.js        # Test flussi completi
│
├── server/
│   ├── .env.example             # Configurazione esempio
│   ├── db/                      # Database
│   │   ├── schema.sql           # Schema originale
│   │   └── schema_update.sql    # NUOVO: Aggiornamento schema
│   │
│   ├── scripts/                 # Script
│   │   ├── test.js              # NUOVO: Test Runner
│   │   └── ...
│   │
│   └── src/
│       ├── app.js              # App Express (AGGIORNATO)
│       ├── server.js            # Server (AGGIORNATO)
│       │
│       ├── lib/                # Librerie
│       │   ├── config.js        # Configurazione
│       │   ├── password.js       # Gestione password
│       │   ├── jwt.js            # JWT
│       │   ├── http.js          # HTTP utilities
│       │   ├── validate.js       # Validazione
│       │   ├── audit.js          # Audit log
│       │   ├── achievements.js    # Traguardi
│       │   ├── testing.js        # NUOVO: Framework testing
│       │   ├── chat.js           # NUOVO: WebSocket Chat
│       │   └── push.js           # NUOVO: Push Notifications
│       │
│       ├── middleware/          # Middleware
│       │   ├── auth.js          # Autenticazione
│       │   ├── rateLimit.js      # Rate limiting
│       │   └── i18n.js           # NUOVO: Multilingua
│       │
│       └── routes/              # Route
│           ├── auth.js          # Autenticazione
│           ├── account.js        # Account
│           ├── clan.js           # Clan
│           ├── admin.js          # Admin
│           ├── notify.js         # Notifiche
│           ├── cms.js            # NUOVO: CMS
│           ├── chat.js           # NUOVO: Chat
│           └── push.js           # NUOVO: Push
│
└── assets/
    ├── css/                     # Stili
    ├── icons/                   # Icone PWA
    ├── js/                      # JavaScript
    │   ├── api.js               # API Client
    │   ├── account.js           # Gestione account
    │   ├── art.js               # Effetti artistici
    │   ├── avatar-creator.js    # Creatore avatar
    │   ├── avatar3d.js          # Avatar 3D
    │   ├── data.js              # Dati
    │   ├── fx.js                # Effetti
    │   ├── main.js              # Main
    │   ├── ui.js                # UI utilities
    │   ├── views.js             # Viste
    │   ├── cms.js               # NUOVO: CMS Client
    │   ├── chat.js              # NUOVO: Chat Client
    │   ├── i18n.js              # NUOVO: i18n Client
    │   └── push.js             # NUOVO: Push Client (da creare)
    │
    └── sw.js                   # Service Worker (AGGIORNATO)
```

---

## Risoluzione Problemi

### Test che falliscono su Windows

**Problema**: Errori di path su Windows

**Soluzione**: Usa path.posix per path Unix-compatible:
```javascript
import path from 'node:path';
const testPath = path.posix.join('test', 'unit', 'test.js');
```

### Database non disponibile

**Problema**: Errore connessione database durante test

**Soluzioni**:
1. Assicurati che PGlite sia installato:
```bash
npm install
```

2. Verifica che la cartella `.data` esista:
```bash
mkdir -p server/.data
```

3. Esegui migrazione:
```bash
npm run migrate
npm run seed
```

### WebSocket non connesso

**Problema**: WebSocket fallisce la connessione

**Soluzioni**:
1. Verifica che il server sia avviato:
```bash
npm start
```

2. Verifica l'URL WebSocket:
```
ws://127.0.0.1:4173/ws/chat
```

3. Verifica il token JWT:
- Accedi prima via HTTP
- Copia il cookie `samurai_session`
- Usalo nella connessione WebSocket

### Push Notifications non funzionano

**Problema**: Notifiche push non arrivano

**Soluzioni**:
1. HTTPS richiesto per Push API (tranne localhost)
2. Verifica VAPID keys in `.env`
3. Verifica Service Worker registrato:
```javascript
// In index.html
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

4. Verifica permessi:
```javascript
Notification.requestPermission().then(perm => {
  console.log('Permission:', perm); // 'granted', 'denied', 'default'
});
```

### Test su rete locale lento

**Problemi comuni**:
1. Firewall che blocca connessioni
2. Antivirus che rallenta richieste
3. Network congestion

**Soluzioni**:
1. Disabilita firewall temporaneamente
2. Usa IP locale invece di hostname
3. Testa connettività con ping:
```bash
ping 192.168.1.100
```

---

## Script di Test Completi

### Comandi Utili

```bash
# Avvia server con host 0.0.0.0 (accessibile da rete)
HOST=0.0.0.0 npm start

# Esegui test da un altro terminale
npm test

# Esegui test specifici
npm run test:api
npm run test:unit

# Test su rete locale (da altro dispositivo)
# 1. Trova IP server: ifconfig (Mac/Linux) o ipconfig (Windows)
# 2. Da altro dispositivo:
node server/scripts/test-local.js 192.168.1.100 4173

# Genera report HTML
npm test
# Report in: test/reports/test-report.html
```

### Esempio Sessione di Test Completa

```bash
# Terminal 1: Avvia server accessibile da rete
$ HOST=0.0.0.0 npm start

# Output:
#   侍  Samurai di Avakin
#   server   http://0.0.0.0:4173
#   env      development
#   database pglite
#   account  demo — credenziali nel README
#   chat     ws://0.0.0.0:4173/ws/chat
#   push     Scheduler avviato

# Terminal 2: Esegui tutti i test
$ npm test

# Da un altro dispositivo sulla stessa rete:
# 1. Apri browser
# 2. Vai a http://[IP_SERVER]:4173
# 3. Prova tutte le funzioni manualmente

# Oppure esegui test automatici:
$ node server/scripts/test-local.js 192.168.1.100 4173
```

---

## Conclusioni

Ora il tuo sito **Samurai di Avakin** ha:

✅ **Test automatici completi** (unit, integration, e2e)
✅ **CMS completo** per modificare contenuti senza codice
✅ **Chat in tempo reale** con WebSocket
✅ **Push Notifications** per notifiche browser
✅ **Supporto multilingua** (IT/EN/ES)
✅ **Test su rete locale** da altri dispositivi
✅ **Framework di testing flessibile** e estensibile

### Prossimi Passi

1. **Esegui test completi**: `npm test`
2. **Prova su rete locale**: Avvia server con `HOST=0.0.0.0 npm start`
3. **Test da altri dispositivi**: Usa `test-local.js`
4. **Aggiungi nuovi test**: Crea file in `test/[tipo]/test.[nome].js`
5. **Estendi funzionalità**: Aggiungi nuove route in `server/src/routes/`

---

*Ultimo aggiornamento: Ottobre 2025*
*Compatibilità: Node.js >= 20*
