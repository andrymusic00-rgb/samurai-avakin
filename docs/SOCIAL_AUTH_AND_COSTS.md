# Samurai — Accesso Social, Profilo Automatico, Email e Costi

## Stato implementato (update)

### 1) Candidatura “Candidati”
- I CTA `data-action="apply"` aprono una finestra a scomparsa (`#applyModal`) con Google Form embedded (`?embedded=true`, lazy load al primo open).
- Fallback: pulsante “Apri in nuova scheda”.
- File: `index.html` (modal + CTA 283/375/820/1095), `assets/js/account.js`, `assets/js/ui.js` (palette).

### 2) Accesso social Google / Microsoft / Apple
- **Flusso produzione (effettivo, quando configurato)**:
  - `GET /api/auth/social/:provider/start` → redirect OAuth con `state` CSRF in cookie `httpOnly`.
  - `GET|POST /api/auth/social/:provider/callback` → scambio codice, lettura profilo, **creazione automatica profilo Samurai** se nuovo utente, oppure collegamento all’account esistente (per `user_social.provider_user_id` o email esistente), sessione cookie, audit, redirect a `/#/account?social=1&provider=...&ok=1&created=...`.
  - Account nuovo: `users.email_verified_at = now()` (email verificata dal provider), password casuale non usata, preferenze/skill iniziali, record `user_social`, invio **email di benvenuto** (best-effort, non blocca login).
- **Dev mode (`SOCIAL_DEV_MODE=true`, default)**: crea/collega account senza credenziali reali; utile per test locali. In produzione va disabilitato.
- **Collegamento social a sessione esistente**: `POST /api/auth/social/link` + callback; in prod richiede utente autenticato lato callback (`requireAuth` consigliato se si espone il link-callback in contesti sensibili — verificare policy).
- File principali: `server/src/routes/auth.js`, `server/src/lib/oauth.js`, `server/src/lib/config.js`, `server/.env.example`, `assets/js/account.js`.

### 3) Anomalie/limiti noti (da gestire in deploy)
- **OAuth reale richiede credenziali provider** + redirect URI HTTPS pubblici esatti. Senza env, prod restituisce errore config.
- **Apple**: richiede Services ID, Team ID, Key ID, chiave `.p8`, dominio/verifica associata; callback può arrivare in `POST form_post` (supportato). Il nome utente Apple è disponibile solo al primo consenso in molti casi.
- **Email benvenuto/reset/verifica** richiede SMTP configurato (`SMTP_*`, `PUBLIC_ORIGIN`). Senza SMTP, `email.js` fallisce o va gestito; il login social non deve dipendere rigidamente dall’email (già best-effort nel nuovo codice).
- **DB**: tabella `user_social` deve esistere (presente in `schema_update.sql`); eseguire migration su DB produzione.
- **Sicurezza**: disabilitare `SOCIAL_DEV_MODE` in produzione; usare `COOKIE_SECURE=true` su HTTPS; ruotare `JWT_SECRET`.

## Configurazione gratuita/low-cost consigliata

| Area | Servizio gratuito consigliato | Note |
|---|---|---|
| Hosting web/API | Render (free tier limitato) / Cloudflare Pages + Workers (limiti) / Fly.io (piccolo) | Render già in uso nel progetto; free tier può andare in sleep. |
| Database | Neon Postgres free / Supabase free / Render Postgres (piani) | PGlite va bene in dev; prod meglio Postgres gestito. |
| OAuth Google | Google Cloud Console (gratuito) | Configurare OAuth consent screen + Web client. |
| OAuth Microsoft | Microsoft Entra ID (gratuito per app registration base) | Supporta account personali/tenant secondo config. |
| OAuth Apple | Apple Developer Program (**$99/anno**, non gratuito) | Obbligatorio per Sign in with Apple in produzione reale. |
| Email transazionale | Resend free (limite mensile), Brevo free, Mailgun trial/flex, SMTP provider | Per “benvenuto”, verifica, reset. |
| Email custom dominio (ricezione) | Cloudflare Email Routing (gratuito) | Inoltra `nome@tuodominio.it` a una casella reale; non è una mailbox completa. |
| Mailbox custom completa | Zoho Mail free (piani limitati) / Google Workspace (a pagamento) | Zoho spesso usato per poche caselle custom. |
| Dominio | A pagamento (Namecheap/Cloudflare Registrar, costo annuale variabile) | Necessario per email custom professionale e OAuth callback stabili. |

## Email custom “@samurai...” (consiglio pratico gratuito)
1. Registra un dominio (costo esterno).
2. Usa **Cloudflare Email Routing** (gratis) per ricevere/inoltrare alias (es. `noreply@dominio` → Gmail personale) — *routing*, non invio transazionale completo.
3. Per inviare email dal sito (benvenuto/reset): usa **Resend** o **Brevo** con dominio verificato (SPF/DKIM). Evita di usare l’alias di solo routing come SMTP di invio senza provider transazionale.
4. Imposta `SMTP_*`, `SMTP_FROM`, `PUBLIC_ORIGIN` in produzione.

## Piano costi indicativo (stima, non contrattuale)
| Voce | Opzione $0 | Opzione minima pagata | Note |
|---|---:|---:|---|
| Dominio | $0 (non possibile) | ~$8–15/anno | Variabile. |
| Hosting app | $0 Render free | ~$7+/mese | Sleep/limiti su free. |
| Postgres | $0 Neon/Supabase free | ~$5–19+/mese | Limiti storage/compute. |
| Google/Microsoft OAuth | $0 | $0 | Costi solo tempo/config. |
| Apple Sign In | non disponibile | $99/anno | Developer Program. |
| Email transazionale | $0 tier (limiti) | ~$0–15/mese | Dipende volume. |
| Email routing custom | $0 Cloudflare | $0 | Con dominio. |
| **Totale realistico (senza Apple)** | **dominio + tempo** | **~$15–50/mese + dominio** | Dipende da traffico. |
| **Totale con Apple** | — | **+$99/anno** | — |

## Checklist deploy Render/produzione
- `NODE_ENV=production`, `SOCIAL_DEV_MODE=false`
- `DATABASE_URL` PostgreSQL + migrazioni (`schema.sql` + `schema_update.sql`/migrate script)
- `JWT_SECRET` forte, `PUBLIC_ORIGIN=https://...`, `COOKIE_SECURE=true`
- OAuth env per provider abilitati; redirect URI identici a quelli registrati
- `SMTP_*` + `SMTP_FROM` + `PUBLIC_ORIGIN` per email
- Test: login Google/Microsoft/Apple, nuovo utente → profilo creato, ritorno a `#/account`, sessione valida
