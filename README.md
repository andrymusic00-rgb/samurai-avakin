# Samurai di Avakin — sito del clan

Sito del clan **Samurai di Avakin**: design *liquid glass* in blu, argento e nero, motion graphic
continuo su canvas, **auth reale** e **area Account collegata a un database Postgres**.
Include sezioni Eventi, Classifica e Comando, area bushi, PWA offline e SEO completa.

Stack: frontend statico senza dipendenze + API Node/Express + Postgres.
Nessun build step: `npm install` e `npm start`.

---

## Avvio

```bash
npm install          # una volta sola
npm run seed         # crea database + 5 account demo + 3 eventi + storico raid
npm start            # http://127.0.0.1:4173
```

Ogni comando utile:

| Comando | Cosa fa |
|---|---|
| `npm start` | Avvia API + sito statico |
| `npm run dev` | Idem, con ricaricamento automatico |
| `npm run migrate` | Applica `schema.sql` (idempotente) |
| `npm run seed` | Popola il database, non tocca gli account esistenti |
| `npm run seed -- --reset` | Ricrea le password e le statistiche degli account demo |
| `npm run reset` | Cancella il database locale (solo PGlite) |
| `npm run icons` | Rigenera le icone PWA in `assets/icons/` |

### Account di sviluppo

Password per tutti: **`Samurai2019`**

| Ruolo | Email | Handle |
|---|---|---|
| shogun | `kenshin@samurai.test` | `KENSHIN` |
| shogun | `yagami@samurai.test` | `YAGAMI` |
| bushi | `kaede@samurai.test` | `KAEDE` |
| bushi | `raiden@samurai.test` | `RAIDEN` |
| admin | `admin@samurai.test` | `ADMIN` |

### Database

Di default gira su **PGlite**: Postgres compilato in WASM, avviato dentro il processo Node.
SQL identico a Postgres, zero installazione, dati in `server/.data/`.

Quando avrai un Postgres vero basta una riga in `server/.env`:

```bash
DATABASE_URL=postgres://utente:password@localhost:5432/samurai
```

Il resto del codice non cambia: `server/db/index.js` è l'unico punto che conosce il driver.

---

## Struttura

```
isamurai/
├── index.html                    Shell, topbar, 8 sezioni, modali, palette comandi
├── offline.html                  Pagina mostrata dal service worker senza rete
├── assets/
│   ├── css/  core · layout · components · features
│   ├── icons/                     192, 512 e maskable per la PWA
│   ├── sw.js                     Cache shell, offline e strategia per asset
│   └── js/   data · art · fx · api · ui · views · account · main
└── server/
    ├── .env.example              Configurazione commentata
    ├── db/
    │   ├── schema.sql            15 tabelle, idempotente
    │   └── index.js              Pool Postgres / PGlite + transazioni
    ├── scripts/  migrate · seed · reset · icons
    ├── uploads/                  File caricati dagli utenti
    └── src/
        ├── server.js             Bootstrap + shutdown pulito
        ├── app.js                Middleware, rotte, statici
        ├── lib/                  config · password · jwt · validate · http · audit · achievements
        ├── middleware/           auth (ruoli) · rateLimit
        └── routes/               auth · account · clan · admin · notify
```

---

## Sicurezza

| Protezione | Implementazione |
|---|---|
| Password | `scrypt` (N=16384, sale 16 byte) con `timingSafeEqual` — niente bcrypt nativo |
| Sessioni | JWT access 20 min in cookie `httpOnly` + `SameSite=Lax`, refresh 30 giorni **ruotato** e memorizzato come hash SHA-256 |
| Revoca | Ogni sessione è una riga: si revoca singolarmente o tutte insieme |
| Validazione | Schema implicito per ogni campo, mai `eval` o query concatenate |
| SQL injection | Solo query parametrizzate `$1, $2…` |
| Brute force | `express-rate-limit`: 30 tentativi / 15 min su auth, 300 req/min su API |
| Reset password | Token casuale, hashato, uso singolo, scadenza 1 ora, risposta identica per email esistenti e inesistenti (anti-enumerazione) |
| Upload | Solo immagini, estensione e MIME verificati, 4 MB, nome file rigenerato dal server |
| Header | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS in produzione |
| Audit | Ogni login, registrazione, revoca e cambio password finisce in `audit_log` |
| Produzione | `JWT_SECRET` obbligatorio, `SameSite`/HSTS automatici, CORS opt-in via env |

In sviluppo `POST /api/auth/forgot-password` restituisce il token nella risposta (`devToken`).
In produzione non lo fa mai: lì va collegato un servizio email.

---

## API

Tutte le risposte sono `{ ok: true, ... }` oppure `{ ok: false, error: { code, message, details } }`.

### Auth — `/api/auth`

| Metodo | Endpoint | Note |
|---|---|---|
| `POST` | `/register` | email, password, name, handle, region, device |
| `POST` | `/login` | emette i cookie di sessione |
| `POST` | `/refresh` | ruota il refresh token |
| `POST` | `/logout` | revoca la sessione corrente |
| `GET` | `/me` | utente corrente o `authenticated: false` |
| `GET` | `/sessions` | sessioni attive con dispositivo e IP |
| `DELETE` | `/sessions/:id` | revoca una sessione |
| `POST` | `/logout-all` | revoca tutte le sessioni |
| `POST` | `/forgot-password` | avvia il reset |
| `POST` | `/reset-password` | completa il reset, token monouso |

### Account — `/api/account` (richiede sessione)

| Metodo | Endpoint | Note |
|---|---|---|
| `GET` | `/` | utente + preferenze + statistiche + upload |
| `PATCH` | `/profile` | nome, handle, bio, regione, personaggio, dispositivo |
| `PATCH` | `/email` | richiede la password, azzera la verifica |
| `PATCH` | `/preferences` | patch parziale: i campi omessi restano invariati |
| `POST` | `/link-avakin` | ID numerico unico, +3 livelli e +2 raid |
| `POST` | `/password` | revoca tutte le sessioni dopo il cambio |
| `POST` | `/avatar` | `multipart/form-data`, campo `avatar` |
| `POST` | `/uploads` | fino a 6 immagini, campo `files` |
| `DELETE` | `/uploads/:id` | elimina file e riga |
| `GET` | `/export` | JSON con profilo, preferenze, sessioni, audit, upload |
| `GET` | `/audit` | storico azioni |
| `GET` | `/badge.svg` | stemma generato dal server |
| `DELETE` | `/` | elimina l'account (password + conferma `ELIMINA`) |

### Clan — `/api/clan` (pubbliche salvo dove indicato)

| Metodo | Endpoint | Note |
|---|---|---|
| `GET` | `/health` | stato servizio e driver del database |
| `GET` | `/stats` | numeri di sintesi: membri, ufficiali, raid, account collegati |
| `GET` | `/roster` | membri pubblici con handle, ruolo e livello |
| `GET` | `/leaderboard` | classifica per vittorie, raid, ore e win rate |
| `GET` | `/raid` | storico raid con esito, punteggio e win rate |
| `GET` | `/events` | eventi con posti e stato di iscrizione |
| `GET` | `/events.ics` | calendario scaricabile |
| `POST` | `/events` | crea un evento (`bushi`+) |
| `PATCH` / `DELETE` | `/events/:id` | modifica o elimina un evento (`bushi`+) |
| `POST` / `DELETE` | `/events/:id/rsvp` | iscrizione e disiscrizione (serve la sessione) |
| `POST` | `/applications` | candidatura pubblica, risposta entro 48 ore |
| `GET` | `/applications/mine` | stato delle candidature dell'utente |
| `GET` | `/applications` | elenco e conteggi per il comando |
| `POST` | `/applications/:id/decision` | approva o rifiuta (`bushi`+) |
| `POST` | `/subscribe` | iscrizione newsletter |
| `GET` | `/content/:key` | reaction e commenti di una sezione |
| `POST` | `/content/:key/react` | like su una sezione |
| `POST` / `DELETE` | `/content/:key/comments[/:id]` | commenti (propri o admin) |

### Notifiche — `/api/notifications` (richiede sessione)

| Metodo | Endpoint | Note |
|---|---|---|
| `GET` | `/` | elenco e contatore non lette |
| `GET` | `/stream` | canale SSE, uno per utente |
| `POST` | `/read` | segna tutte o un elenco di id |
| `DELETE` | `/:id` | elimina una notifica |

### Comando — `/api/admin` (`bushi`, `shogun`, `admin`)

| Metodo | Endpoint | Note |
|---|---|---|
| `GET` | `/overview` | membri, candidature, eventi, iscritti newsletter |
| `GET` | `/members` | elenco completo con ruolo e stato |
| `PATCH` | `/members/:id` | ruolo, stato e livello |
| `POST` | `/raid` | registra il risultato di un raid |

### Account — traguardi

`GET /api/account/achievements` restituisce i 14 traguardi del catalogo con lo stato per l'utente.
Il server li ricalcola a ogni login, modifica profilo e iscrizione a un evento.

### Ruoli

`membro` → `bushi` → `shogun` → `admin`, con guardie pronte in
`server/src/middleware/auth.js`: `requireAuth`, `requireRole(...)`, `requireMinRole(...)`.
L'area Comando è visibile solo a `bushi`, `shogun` e `admin`: un semplice `membro` riceve `403`.

---

## Il frontend ora è collegato

- `assets/js/api.js` — client con auto-refresh del token, `ApiError` tipizzato, probe di disponibilità.
- `assets/js/views.js` — Eventi, Classifica e Comando: ogni sezione prova il server e, se fallisce,
  ripiega sui dati statici dichiarando che non sono live.
- **Ospiti**: la sezione Account mostra la Gate con accesso e registrazione invece della dashboard.
- **Membri**: profilo, preferenze, avatar, statistiche, badge e foto vengono letti e scritti sul server.
- **Sessioni reali**: l'elenco dispositivi viene dal database, con revoca funzionante.
- **Password dimenticata**: flusso completo in due step dentro la modale di accesso.
- **Candidature e newsletter**: invio reale con `POST`, e fallback in `localStorage` senza server.
- **Notifiche**: badge sull'icona e pannello alimentato da SSE, con stato letto/non letto persistito.
- **Modalità locale**: se il server non risponde il sito resta comunque usabile con `localStorage`
  e lo segnala nella Gate. Serve per aprire `index.html` con doppio click.
- **Accessibilità**: focus trattenuto dentro le modali, focus restituito al pulsante di apertura,
  navigazione da tastiera sulle sezioni e scorciatoia `⌘K` per la palette.

## SEO e PWA

- `robots.txt`, `sitemap.xml` e `manifest.webmanifest` serviti dall'API.
- Open Graph, Twitter card e JSON-LD (`Organization`) nell'head di `index.html`.
- Service worker con shell precaricata: su localhost la cache viene saltata, in produzione gli asset
  usano stale-while-revalidate e le API non vengono mai cacheate.
- `offline.html` mostrata quando la rete manca durante una navigazione.

---

## Prossimi step

**Blocco 2 — CMS e contenuti**
- Pannello admin per modificare hero, notizie, galleria, video e FAQ senza toccare il codice
- Upload video con streaming e miniature automatiche
- Tabella `content` già pronta: è il punto di innesto

**Blocco 3 — Da chiudere**
- Promemoria email per gli eventi (la coda SSE esiste, manca il job)
- Notifiche push e chat del clan con moderazione, ban e mute
- Multilingua IT/EN/ES e cookie banner
- CI/CD, test automatici, backup del database, monitoraggio

---

*Progetto fan non ufficiale. Avakin Life™ è di Life Ninja.*
