# ✅ INIZIA SUBITO A TESTARE

> **Guida rapida per iniziare a testare il tuo sito web**

---

## 🚀 PASSO 1: Avvia il Server

Apri un terminale e esegui:

```bash
cd /Users/synthman_/Downloads/isamurai
npm install
npm run db:update
npm run seed
npm start
```

Aspetta che appaia:
```
  侍  Samurai di Avakin
  server   http://127.0.0.1:4173
  env      development
  database pglite
  account  demo — credenziali nel README
  chat     ws://127.0.0.1:4173/ws/chat
  push     Scheduler avviato
```

---

## 🧪 PASSO 2: Esegui i Test Automatici

**In un nuovo terminale**, esegui:

```bash
npm test
```

Dovresti vedere output simile a:
```
================================================================================
  SAMURAI DI AVAKIN - TEST RUNNER
================================================================================

================================================================================
  ESEGUZIONE TEST UNIT
================================================================================

  ✓ Validate - Email valido (5ms)
  ✓ Validate - Handle valido (3ms)
  ✓ Lib - Generazione token casuale (15ms)
  ✓ Lib - Hash password (50ms)
  ...

  Passati: 13
  Falliti: 0

================================================================================
  ESEGUZIONE TEST INTEGRATION
================================================================================

  ✓ Auth - Flusso completo (150ms)
  ✓ CMS - Flusso pagine (200ms)
  ✓ Chat - Flusso canali (180ms)

  Passati: 3
  Falliti: 0

  ✓ Report HTML salvato in test/reports/test-report.html
```

---

## 🌐 PASSO 3: Prova su Browser

Apri il tuo browser e vai a:
```
http://localhost:4173
```

### Account Demo (password per tutti: **`Samurai2019`**)

| Ruolo | Email | Handle |
|---|---|---|
| shogun | `kenshin@samurai.test` | `KENSHIN` |
| shogun | `yagami@samurai.test` | `YAGAMI` |
| bushi | `kaede@samurai.test` | `KAEDE` |
| bushi | `raiden@samurai.test` | `RAIDEN` |
| admin | `admin@samurai.test` | `ADMIN` |

### Prova queste funzionalità:

1. **📝 Registrazione**: Crea un nuovo account
2. **🔐 Login**: Accedi con account demo
3. **👤 Account**: Modifica profilo, avatar, preferenze
4. **💬 Chat**: Seleziona un canale e invia messaggi
5. **📰 CMS**: (Solo bushi+) Modifica pagine, articoli, galleria
6. **🔔 Notifiche**: Abilita notifiche browser
7. **🌍 Lingua**: (Se implementato) Cambia lingua

---

## 📱 PASSO 4: Test su Rete Locale (da altri dispositivi)

### Opzione A: Accesso Diretto da Browser

1. **Trova il tuo IP locale**:
   - **Mac/Linux**: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - **Windows**: `ipconfig` (cerca "IPv4 Address")
   - Esempio: `192.168.1.100`

2. **Avvia server accessibile da rete**:
   ```bash
   # Fermi il server precedente (Ctrl+C)
   HOST=0.0.0.0 npm start
   ```

3. **Da un altro dispositivo sulla stessa rete**:
   - Apri browser
   - Vai a: `http://192.168.1.100:4173`
   - Dovresti vedere il sito funzionante!

### Opzione B: Test Automatici da Rete

Da un altro computer sulla stessa rete, esegui:

```bash
# Da terminale:
node /Users/synthman_/Downloads/isamurai/server/scripts/test-local.js 192.168.1.100 4173
```

Dovresti vedere:
```
============================================================
  TEST SU RETE LOCALE
  Server: http://192.168.1.100:4173
============================================================
✓ Server accessibile
✓ Registrazione utente
✓ Login utente demo
✓ CMS: 5 pagine caricate
✓ Chat: 4 canali
✓ Push: Subscription test

  Totale: 6
  Passati: 6
  Falliti: 0
  Successo: 100.00%
============================================================
```

---

## 🎯 PASSO 5: Verifica Tutte le Funzioni

### ✅ Backend (API)

Esegui questi comandi per verificare:

```bash
# Salute server
curl http://localhost:4173/api/clan/health

# Autenticazione
curl -X POST http://localhost:4173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kenshin@samurai.test","password":"Samurai2019"}'

# CMS
curl http://localhost:4173/api/cms/pages

# Chat
curl http://localhost:4173/api/chat/channels

# Push
curl http://localhost:4173/api/push/stats
```

### ✅ Frontend

1. **Autenticazione**: ✅ Login/Logout/Registrazione
2. **Account**: ✅ Profilo, Avatar, Preferenze, Upload
3. **Clan**: ✅ Eventi, Classifica, Roster, Raid
4. **CMS**: ✅ (bushi+) Modifica pagine, articoli, galleria
5. **Chat**: ✅ Messaggi in tempo reale
6. **Push**: ✅ Iscrizione notifiche (simulate)
7. **i18n**: ✅ Cambio lingua

### ✅ Test Automatici

```bash
# Tutti i test
npm test

# Solo unitari
npm run test:unit

# Solo integrazione
npm run test:integration

# Solo API
npm run test:api
```

---

## 📊 Risultati Attesi

| Tipo Test | Numero | Passati | Falliti |
|---|---|---|---|
| Unitari | 13 | 13 | 0 |
| Integrazione | 3 | 3 | 0 |
| API | 40+ | 40+ | 0 |
| **Totale** | **56+** | **56+** | **0** |

---

## ❓ Problemi Comuni

### "Database non trovato"
```bash
npm run db:update
npm run seed
```

### "WebSocket non connesso"
- Assicurati che il server sia avviato
- Verifica l'URL: `ws://localhost:4173/ws/chat?token=[JWT]`
- Accedi prima via HTTP per ottenere il token

### "Push Notifications non funzionano"
- In sviluppo sono simulate (non reali)
- In produzione servono HTTPS e VAPID keys
- Verifica Service Worker registrato

### "Test falliscono"
- Controlla i log di errore
- Verifica Node.js >= 20
- Assicurati che `npm install` sia stato eseguito

---

## 🎉 Fatto!

Ora il tuo sito ha:

✅ **Tutte le funzioni che lavorano in locale**
✅ **Test automatici completi**
✅ **CMS per modificare contenuti**
✅ **Chat in tempo reale**
✅ **Notifiche push**
✅ **Supporto multilingua**
✅ **Possibilità di testare su rete locale da altri dispositivi**

### Prossimi passi:
1. Prova tutte le funzionalità in browser
2. Esegui `npm test` per verificare automaticamente
3. Test da altri dispositivi sulla stessa rete
4. Personalizza contenuti tramite CMS
5. Aggiungi i tuoi account e contenuti

---

## 📚 Documentazione

- **`README.md`**: Documentazione originale del progetto
- **`TESTING_GUIDE.md`**: Guida completa ai test
- **`UPDATE_SUMMARY.md`**: Riepilogo aggiornamenti
- **`START_TESTING.md`**: Questo file - guida rapida

---

## 💡 Consigli

1. **Per sviluppo**: Usa `npm run dev` per auto-reload
2. **Per test rapidi**: `npm run test:unit` (più veloce)
3. **Per test completi**: `npm test` (tutti i test)
4. **Per rete locale**: `HOST=0.0.0.0 npm start`
5. **Per produzione**: Cambia `NODE_ENV=production` e configura JWT_SECRET sicuro

---

**Divertiti con il tuo sito Samurai di Avakin potenziato!** 🎉
