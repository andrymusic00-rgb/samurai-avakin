import { Router } from "express";
import { one, query, tx } from "../../db/index.js";
import { ApiError, asyncHandler, clientIp } from "../lib/http.js";
import { hashPassword, verifyPassword, randomToken, sha256 } from "../lib/password.js";
import { signAccess, setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "../lib/jwt.js";
import { config } from "../lib/config.js";
import * as v from "../lib/validate.js";import { requireAuth, publicUser, activeSessions, findUserById } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { audit } from "../lib/audit.js";
import {
  SOCIAL_PROVIDERS, providerLabel, buildAuthorizeUrl, exchangeCode, fetchProfile
} from "../lib/oauth.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email.js";

export const authRouter = Router();

const ua = (req) => String(req.get("user-agent") || "").slice(0, 240);

/** Verifica token Cloudflare Turnstile (solo se configurato). */
async function verifyTurnstile(token) {
  if (!config.turnstile.enabled || !config.turnstile.secret) return;
  if (!token || String(token).length < 10) {
    throw ApiError.bad("validation", "Token anti-bot non valido", { field: "turnstile" });
  }
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.turnstile.secret, response: String(token) })
    });
    const json = await resp.json().catch(() => ({ success: false }));
    if (!json.success) {
      throw ApiError.bad("bot_protection", "Verifica anti-bot fallita", { field: "turnstile" });
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.bad("bot_protection", "Verifica anti-bot non disponibile", { field: "turnstile" });
  }
}

async function issueSession(res, user, req) {
  const refresh = randomToken(48);
  await query(
    `INSERT INTO sessions (user_id, refresh_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)`,
    [user.id, sha256(refresh), ua(req), clientIp(req), String(config.refreshDays)]
  );
  setAuthCookies(res, { access: signAccess(user), refresh });
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
}

function sessionCookiePresent(req) {
  return Boolean(req.cookies?.[REFRESH_COOKIE]);
}

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const mail = v.email(body.email);
    const pass = v.password(body.password);
    const confirm = v.confirmPassword(pass, body.confirm_password, { field: "Conferma password" });
    const strength = v.passwordStrength(pass);
    const name = v.str(body.name, { min: 3, max: 24, required: true, field: "Nome" });
    const cognome = v.str(body.cognome, { min: 3, max: 24, required: true, field: "Cognome" });
    const dataNascita = v.str(body.data_nascita, { max: 10, field: "Data di nascita" });
    const età = v.minAge(dataNascita, config.minAge, { field: "Data di nascita" });
    const sesso = v.oneOf(body.sesso, ["maschio", "femmina", "altro", "preferisco_non_dire"], { required: true, field: "Sesso" });
    const pronome = v.str(body.pronome, { max: 20, field: "Pronome" });
    const timezone = v.str(body.timezone, { max: 60, field: "Timezone" });
    const bio = v.str(body.bio, { max: 140, field: "Bio" });

    // Consenso obbligatorio a Termini di Servizio e Privacy Policy
    const termini = v.bool(body.termini, false);
    if (!termini) {
      throw ApiError.bad("validation", "Devi accettare i Termini di Servizio e la Privacy Policy", { field: "termini" });
    }

    // Protezione anti-bot (Cloudflare Turnstile, attiva solo se configurata)
    await verifyTurnstile(body.turnstile_token);
    const mainChar = v.oneOf(
      body.mainChar,
      ["Troppa ⋆ ⋆ ⋆ ⋆ ⋆", "Troppa ⋆ ⋆ ⋆ ⋆", "Troppa ⋆ ⋆ ⋆", "Troppa ⋆ ⋆", "Troppa ⋆", "Senza scudiero"],
      { required: false, field: "Personaggio" }
    );
    const regione = v.oneOf(body.region, ["Europa", "America", "Asia", "Oceania", "MENA"], { field: "Regione", fallback: "Europa" });
    const dispositivo = v.oneOf(body.device, ["iOS", "Android", "PC", "Console", "Altro"], { field: "Dispositivo", fallback: "iOS" });

    // Questionario attitudine (1-10 per ciascuna attitudine)
    const att = {
      difesa: v.intInRange(body.difesa, { min: 1, max: 10, fallback: 5 }),
      attacco: v.intInRange(body.attacco, { min: 1, max: 10, fallback: 5 }),
      risorse: v.intInRange(body.risorse, { min: 1, max: 10, fallback: 5 }),
      arena: v.intInRange(body.arena, { min: 1, max: 10, fallback: 5 }),
      squadra: v.intInRange(body.squadra, { min: 1, max: 10, fallback: 5 })
    };

    const clashEmail = await one("SELECT id FROM users WHERE lower(email) = $1", [mail]);
    if (clashEmail) throw ApiError.conflict("Esiste già un account con questa email");
    // Usa nome+cognome come handle univoco (slug)
    const tag = `${name.toLowerCase().replace(/\s+/g, '-')}-${cognome.toLowerCase().replace(/\s+/g, '-')}`;
    const clashHandle = await one("SELECT id FROM users WHERE lower(handle) = $1", [tag.toLowerCase()]);
    if (clashHandle) throw ApiError.conflict("Nome e cognome già registrati");

    const hash = await hashPassword(pass);
    const user = await tx(async (c) => {
      const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
      const r = await run(
        `INSERT INTO users (email, password_hash, display_name, handle, region, device, main_char, level, xp, data_nascita, sesso, pronome, timezone, bio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 0, $8, $9, $10, $11, $12)
         RETURNING id, email, display_name, handle, role, status, level, xp, region, main_char, device, avatar_url, avakin_id, avakin_name, avakin_server, avakin_alliance, email_verified_at, last_login_at, created_at, data_nascita, sesso, pronome, timezone, bio`,
        [
          mail,
          hash,
          name,
          tag,
          regione,
          dispositivo,
          mainChar ?? "Senza scudiero",
          dataNascita || null,
          sesso,
          pronome || "lui/lei",
          timezone || "Europe/Rome",
          bio || ""
        ]
      );
      const created = r.rows[0];
      await run("INSERT INTO user_prefs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [created.id]);

      // Inizializza skill basate sull'attitudine (1-10 -> livello skill 10-82)
      const skillInserts = ["difesa","attacco","risorse","arena","squadra"]
        .map((k) => `($1,'${k}',${Math.min(100, Math.max(1, att[k] * 8 + 2))})`)
        .join(",");
      await run(`INSERT INTO user_skills (user_id, chiave, livello) VALUES ${skillInserts}`, [created.id]);

      // Salva risposte questionario attitudine
      await run(
        `INSERT INTO user_attitude (user_id, difesa, attacco, risorse, arena, squadra) VALUES ($1,$2,$3,$4,$5,$6)`,
        [created.id, att.difesa, att.attacco, att.risorse, att.arena, att.squadra]
      );

      // XP di benvenuto
      await run("INSERT INTO user_xp_log (user_id, azione, xp_guadagnato) VALUES ($1,'registrazione_completa',50)", [created.id]);

      // Crea token di verifica email (uso singolo, scadenza 24 ore)
      const verifyToken = randomToken(32);
      await run(
        `INSERT INTO email_verifications (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '24 hours')`,
        [created.id, sha256(verifyToken)]
      );

      return { ...created, verifyToken };
    });

    // Invia email di verifica in background (NON bloccante)
    sendVerificationEmail(user.email, user.verifyToken, user.display_name)
      .catch(err => console.error("[email] errore invio verifica:", err.message));

    await issueSession(res, user, req);
    await audit(user.id, "auth.register", { handle: user.handle, attitudine: att, emailVerified: false, età }, clientIp(req));
    res.status(201).json({ ok: true, user: publicUser(user), data: { needsEmailVerification: true, emailVerified: false, attitudine: att, passwordStrength: strength, età, devToken: config.isProd ? undefined : user.verifyToken } });
  })
);

/** Controllo disponibilità cognome ed email (AUX per validazione in tempo reale). */
authRouter.get(
  "/check-availability",
  authLimiter,
  asyncHandler(async (req, res) => {
    const name = v.str(req.query.name, { min: 3, max: 24, required: false, field: "Nome" });
    const cognome = v.str(req.query.cognome, { min: 3, max: 24, required: false, field: "Cognome" });
    const email = v.email(req.query.email, { required: false });
    const out = { ok: true, available: {} };
    if (name && cognome) {
      const tag = `${name.toLowerCase().replace(/\s+/g, '-')}-${cognome.toLowerCase().replace(/\s+/g, '-')}`;
      const taken = await one("SELECT id FROM users WHERE lower(handle) = $1", [tag.toLowerCase()]);
      out.available.handle = { value: tag, taken: Boolean(taken) };
    }
    if (email) {
      const taken = await one("SELECT id FROM users WHERE lower(email) = $1", [email]);
      out.available.email = { value: email, taken: Boolean(taken) };
    }
    res.json(out);
  })
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const mail = v.email(req.body?.email);
    const pass = String(req.body?.password ?? "");
    if (pass.length < 1) throw ApiError.bad("validation", "Password obbligatoria", { field: "password" });

    const row = await one("SELECT * FROM users WHERE lower(email) = $1", [mail]);
    const ok = row ? await verifyPassword(pass, row.password_hash) : false;
    if (!ok) {
      await audit(row?.id ?? null, "auth.login_failed", { email: mail }, clientIp(req));
      throw ApiError.unauthorized("Email o password non corretti");
    }
    if (row.status !== "attivo") throw ApiError.forbidden("Account non attivo. Contatta un amministratore.");
    if (!row.email_verified_at) {
      await audit(row.id, "auth.login_unverified", { email: mail }, clientIp(req));
      throw ApiError.bad("email_unverified", "Devi verificare la tua email prima di accedere. Controlla la posta in arrivo.", { needsEmailVerification: true, email: row.email });
    }

    const user = await findUserById(row.id);
    await issueSession(res, user, req);
    await audit(user.id, "auth.login", {}, clientIp(req));
    res.json({ ok: true, user: publicUser(user) });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized("Sessione scaduta");

    const hash = sha256(token);
    const sess = await one(
      `SELECT * FROM sessions
        WHERE refresh_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [hash]
    );
    if (!sess) {
      clearAuthCookies(res);
      throw ApiError.unauthorized("Sessione non valida");
    }

    const user = await findUserById(sess.user_id);
    if (!user || user.status !== "attivo") {
      clearAuthCookies(res);
      throw ApiError.unauthorized("Account non disponibile");
    }

    const next = randomToken(48);
    await query(
      `UPDATE sessions
          SET refresh_hash = $1, last_used_at = now()
        WHERE id = $2`,
      [sha256(next), sess.id]
    );
    setAuthCookies(res, { access: signAccess(user), refresh: next });
    res.json({ ok: true, user: publicUser(user) });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await query("UPDATE sessions SET revoked_at = now() WHERE refresh_hash = $1", [sha256(token)]);
    clearAuthCookies(res);
    await audit(req.user?.id ?? null, "auth.logout", {}, clientIp(req));
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(200).json({ ok: true, user: null, authenticated: false });
    }
    res.json({ ok: true, authenticated: true, user: publicUser(req.user) });
  })
);

authRouter.get(
  "/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const list = await activeSessions(req.user.id);
    res.json({ ok: true, sessions: list });
  })
);

authRouter.delete(
  "/sessions/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.user.id
    ]);
    if (!r.rowCount) throw ApiError.notFound("Sessione non trovata");
    await audit(req.user.id, "auth.session_revoked", { sessionId: req.params.id }, clientIp(req));
    res.json({ ok: true });
  })
);

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1", [req.user.id]);
    clearAuthCookies(res);
    await audit(req.user.id, "auth.logout_all", {}, clientIp(req));
    res.json({ ok: true });
  })
);

authRouter.post(
  "/forgot-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const mail = v.email(req.body?.email);
    const user = await one("SELECT id, email FROM users WHERE lower(email) = $1", [mail]);

    const out = { ok: true, message: "Se l'email esiste, riceverai le istruzioni entro pochi minuti." };

    if (user) {
      const token = randomToken(32);
      await query("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [user.id]);
      await query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '1 hour')`,
        [user.id, sha256(token)]
      );
      await audit(user.id, "auth.reset_requested", {}, clientIp(req));
      try {
        if (!config.isProd) {
          out.devToken = token;
          out.devHint = "In sviluppo il token viene restituito nella risposta. In produzione viene inviato via email.";
        } else {
          const fullUser = await one("SELECT email, display_name FROM users WHERE id = $1", [user.id]);
          await sendPasswordResetEmail(fullUser.email, token, fullUser.display_name);
        }
      } catch (err) {
        console.error("[email] errore invio reset:", err.message);
        if (config.isProd) throw ApiError.bad("email_send", "Impossibile inviare l'email di reset");
      }
    }
    res.json(out);
  })
);

authRouter.post(
  "/reset-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token ?? "");
    const pass = v.password(req.body?.password);
    if (token.length < 20) throw ApiError.bad("validation", "Token non valido", { field: "token" });

    const row = await one(
      `SELECT * FROM password_resets
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [sha256(token)]
    );
    if (!row) throw ApiError.bad("token_expired", "Token scaduto o già utilizzato");

    await tx(async (c) => {
      const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
      await run("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(pass), row.user_id]);
      await run("UPDATE password_resets SET used_at = now() WHERE id = $1", [row.id]);
      await run("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [row.user_id]);
    });

    await audit(row.user_id, "auth.password_reset", {}, clientIp(req));
    clearAuthCookies(res);
    res.json({ ok: true, message: "Password aggiornata. Accedi di nuovo." });
  })
);

/** Verifica l'email tramite token (inviato dopo la registrazione). */
authRouter.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? "");
    if (token.length < 20) throw ApiError.bad("validation", "Token non valido", { field: "token" });

    const row = await one(
      `SELECT * FROM email_verifications
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [sha256(token)]
    );
    if (!row) throw ApiError.bad("token_expired", "Token di verifica scaduto o già utilizzato");

    await tx(async (c) => {
      const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
      await run("UPDATE users SET email_verified_at = now() WHERE id = $1", [row.user_id]);
      await run("UPDATE email_verifications SET used_at = now() WHERE id = $1", [row.id]);
    });

    await audit(row.user_id, "auth.email_verified", {}, clientIp(req));
    res.json({ ok: true, message: "Email verificata. L'account è ora attivo." });
  })
);

/** Richiede l'invio di una nuova email di verifica. */
authRouter.post(
  "/resend-verification",
  authLimiter,
  asyncHandler(async (req, res) => {
    const mail = v.email(req.body?.email);
    const user = await one("SELECT id, email, display_name, email_verified_at FROM users WHERE lower(email) = $1", [mail]);
    if (!user) {
      // Non rivelare se l'email esiste (anti-enumerazione)
      return res.json({ ok: true, message: "Se l'account esiste, riceverai un'email di verifica." });
    }
    if (user.email_verified_at) throw ApiError.bad("already_verified", "Email già verificata");

    // Invalida token precedenti
    await query("UPDATE email_verifications SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [user.id]);

    const verifyToken = randomToken(32);
    await query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '24 hours')`,
      [user.id, sha256(verifyToken)]
    );

    try {
      if (!config.isProd) {
        // Dev: restituisci token nella risposta
      } else {
        await sendVerificationEmail(user.email, verifyToken, user.display_name);
      }
    } catch (err) {
      console.error("[email] errore invio verifica:", err.message);
      throw ApiError.bad("email_send", "Impossibile inviare l'email di verifica");
    }

    await audit(user.id, "auth.resend_verification", {}, clientIp(req));
    res.json({ ok: true, message: "Email di verifica inviata", devToken: config.isProd ? undefined : verifyToken });
  })
);

/* ================================================================
   LOGIN SOCIAL — Google, Microsoft, Apple
   In dev mode (SOCIAL_DEV_MODE=true, default) funziona senza
   credenziali reali: simula il provider e crea/collega l'account.
   In produzione imposta SOCIAL_DEV_MODE=false e le env OAuth.
   ================================================================ */

/** ID utente simulato deterministico per la modalità dev (non cambia a ogni login). */
async function devSocialProviderUserId(provider, email) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`samurai-dev:${provider}:${email || provider}`).digest("hex").slice(0, 28);
}

/** Dati profilo simulati per la modalità dev, coerenti per provider. */
async function devSocialProfile(provider, email, name, avatar) {
  return {
    provider,
    providerUserId: await devSocialProviderUserId(provider, email),
    email: email || `social_${provider}_dev@samurai.test`,
    name: name || providerLabel(provider) + " Utente",
    avatar: avatar || null,
    emailVerified: true
  };
}

/** Crea o collega un account social a un utente esistente. */
async function linkSocialAccount(userId, provider, profile) {
  await query(
    `INSERT INTO user_social (user_id, provider, provider_user_id, email, name, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider, provider_user_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`,
    [userId, provider, profile.providerUserId, profile.email, profile.name, profile.avatar || null]
  );
}

/** Inizializza skill e preferenze per un nuovo utente. */
async function initNewUser(id) {
  await query("INSERT INTO user_prefs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [id]);
  await query(
    `INSERT INTO user_skills (user_id, chiave, livello) VALUES ($1,'difesa',1),($1,'attacco',1),($1,'risorse',1),($1,'arena',1),($1,'squadra',1)`,
    [id]
  );
}

/** Avvia il flusso social. In dev mode crea/collega subito l'account. */
authRouter.get(
  "/social/:provider/start",
  authLimiter,
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toLowerCase();
    if (!SOCIAL_PROVIDERS.includes(provider)) throw ApiError.bad("validation", "Provider non supportato");

    const email = String(req.query.email ?? "").toLowerCase();
    const name = String(req.query.name ?? providerLabel(provider) + " Utente");
    const avatar = String(req.query.avatar ?? "");

    if (!config.socialDevMode) {
      // Produzione: redirect verso il provider OAuth con credenziali vere
      const cfg = config.social[provider];
      if (!cfg.clientId || !cfg.redirect) throw ApiError.bad("config", `OAuth non configurato per ${providerLabel(provider)}`);
      const state = randomToken(24);
      res.cookie(`oauth_state_${provider}`, state, { httpOnly: true, sameSite: "lax", maxAge: 10 * 60 * 1000, path: "/" });
      return res.redirect(buildAuthorizeUrl(provider, state, cfg.redirect));
    }

    // --- DEV MODE: crea o collega l'account social istantaneamente ---
    const profile = await devSocialProfile(provider, email, name, avatar);
    const socialEmail = profile.email;

    let user = null;
    if (socialEmail) {
      const existing = await one("SELECT id, email, display_name, handle, role, status, avatar_url FROM users WHERE lower(email) = $1", [socialEmail]);
      if (existing) {
        user = existing;
      }
    }
    if (!user) {
      const handle = (email ? email.split("@")[0] : `social_${provider}`) + "_" + randomToken(6);
      const r = await tx(async (c) => {
        const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
        const ins = await run(
          `INSERT INTO users (email, password_hash, display_name, handle, role, status, level, xp, bio, region, device, email_verified_at)
           VALUES ($1, $2, $3, $4, 'membro', 'attivo', 1, 0, $5, 'Europa', 'iOS', now())
           RETURNING id, email, display_name, handle, role, status, avatar_url`,
          [socialEmail, await hashPassword(randomToken(32)), name, handle, name]
        );
        const id = ins.rows[0].id;
        await initNewUser(id);
        await linkSocialAccount(id, provider, profile);
        return ins.rows[0];
      });
      user = r;
    } else {
      // Collega social se non esiste già
      await linkSocialAccount(user.id, provider, profile);
    }

    await issueSession(res, user, req);
    await audit(user.id, `auth.social_${provider}`, { provider, dev: true }, clientIp(req));
    res.json({ ok: true, user: publicUser(user), provider, dev: true, message: `Accesso con ${providerLabel(provider)} effettuato` });
  })
);

/** Callback OAuth (produzione). Scambia il codice, legge il profilo, crea/collega l'account e rilascia la sessione. */
authRouter.get(
  "/social/:provider/callback",
  authLimiter,
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toLowerCase();
    if (!SOCIAL_PROVIDERS.includes(provider)) throw ApiError.bad("validation", "Provider non supportato");

    if (config.socialDevMode) {
      return res.redirect("/#/account?msg=social_dev_ok");
    }

    const cfg = config.social[provider];
    if (!cfg.clientId || !cfg.redirect) throw ApiError.bad("config", `OAuth non configurato per ${providerLabel(provider)}`);

    // CSRF: lo state deve coincidere con il cookie impostato allo start
    const stateCookie = req.cookies?.[`oauth_state_${provider}`];
    const stateQuery = String(req.query.state ?? "");
    if (!stateCookie || stateCookie !== stateQuery) {
      clearAuthCookies(res);
      throw ApiError.unauthorized("State OAuth non valido (possibile CSRF)");
    }
    res.clearCookie(`oauth_state_${provider}`, { path: "/" });

    const code = String(req.query.code ?? "");
    const error = String(req.query.error ?? "");
    if (error) throw ApiError.bad("provider", `Il provider ${providerLabel(provider)} ha rifiutato l'autorizzazione: ${String(req.query.error_description ?? error)}`);
    if (!code) throw ApiError.bad("validation", "Codice di autorizzazione mancante");

    const tokens = await exchangeCode(provider, code, cfg.redirect);
    const profile = await fetchProfile(provider, tokens);
    if (!profile.providerUserId || !profile.email) {
      throw ApiError.bad("provider", `Il profilo ${providerLabel(provider)} non contiene email e ID utente`);
    }

    let user = null;

    // 1. Account già collegato a questo social
    const social = await one(
      `SELECT u.id, u.email, u.display_name, u.handle, u.role, u.status, u.avatar_url
       FROM user_social s
       JOIN users u ON u.id = s.user_id
       WHERE s.provider = $1 AND s.provider_user_id = $2`,
      [provider, profile.providerUserId]
    );
    if (social) user = social;

    // 2. Email già esistente: collega il social all'account esistente
    if (!user) {
      const existing = await one("SELECT id, email, display_name, handle, role, status, avatar_url FROM users WHERE lower(email) = $1", [profile.email]);
      if (existing) {
        user = existing;
        await query(
          `INSERT INTO user_social (user_id, provider, provider_user_id, email, name, avatar_url)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (provider, provider_user_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`,
          [user.id, provider, profile.providerUserId, profile.email, profile.name, profile.avatar || null]
        );
      }
    }

    // 3. Nessun account: creane uno nuovo (email già verificata dal provider)
    if (!user) {
      const handle = (profile.email.split("@")[0] || provider) + "_" + randomToken(6);
      const r = await tx(async (c) => {
        const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
        const ins = await run(
          `INSERT INTO users (email, password_hash, display_name, handle, role, status, level, xp, bio, region, device, email_verified_at)
           VALUES ($1, $2, $3, $4, 'membro', 'attivo', 1, 0, $5, 'Europa', 'iOS', now())
           RETURNING id, email, display_name, handle, role, status, avatar_url`,
          [profile.email, await hashPassword(randomToken(32)), profile.name, handle, profile.name]
        );
        const id = ins.rows[0].id;
        await run("INSERT INTO user_prefs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [id]);
        await query(
          `INSERT INTO user_skills (user_id, chiave, livello) VALUES ($1,'difesa',1),($1,'attacco',1),($1,'risorse',1),($1,'arena',1),($1,'squadra',1)`,
          [id]
        );
        await run(
          `INSERT INTO user_social (user_id, provider, provider_user_id, email, name, avatar_url)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, provider, profile.providerUserId, profile.email, profile.name, profile.avatar || null]
        );
        return ins.rows[0];
      });
      user = r;
    }

    if (user.status !== "attivo") throw ApiError.forbidden("Account non attivo. Contatta un amministratore.");

    const fullUser = await findUserById(user.id);
    await issueSession(res, fullUser, req);
    await audit(fullUser.id, `auth.social_${provider}`, {}, clientIp(req));

    // Torna al frontend sullo stesso origine; i cookie di sessione sono già stati impostati.
    return res.redirect(`/#/account?social=1&provider=${provider}&ok=1`);
  })
);

/** Login social rapido in dev mode (usa corpo JSON per testare senza browser OAuth). */
authRouter.post(
  "/social/dev",
  authLimiter,
  asyncHandler(async (req, res) => {
    if (!config.socialDevMode) throw ApiError.forbidden("Modalità dev disabilitata");
    const provider = String(req.body?.provider ?? "").toLowerCase();
    if (!SOCIAL_PROVIDERS.includes(provider)) throw ApiError.bad("validation", "Provider non valido");

    const email = String(req.body?.email ?? `dev_${provider}@samurai.test`).toLowerCase();
    const name = String(req.body?.name ?? `${providerLabel(provider)} Test`);
    const cognome = String(req.body?.cognome ?? "Test");
    const avatar = String(req.body?.avatar ?? "");

    let user = await one("SELECT id, email, display_name, handle, role, status, avatar_url FROM users WHERE lower(email) = $1", [email]);
    if (!user) {
      const tag = `${name.toLowerCase().replace(/\s+/g, '-')}-${cognome.toLowerCase().replace(/\s+/g, '-')}`;
      const r = await tx(async (c) => {
        const run = (sql, params) => (c.query ? c.query(sql, params) : query(sql, params));
        const ins = await run(
          `INSERT INTO users (email, password_hash, display_name, handle, role, status, level, xp, bio, region, device, email_verified_at)
           VALUES ($1, $2, $3, $4, 'membro', 'attivo', 1, 0, $5, 'Europa', 'iOS', now())
           RETURNING id, email, display_name, handle, role, status, avatar_url`,
          [email, await hashPassword(randomToken(32)), name, tag, name]
        );
        const id = ins.rows[0].id;
        await initNewUser(id);
        await linkSocialAccount(id, provider, await devSocialProfile(provider, email, name, avatar));
        return ins.rows[0];
      });
      user = r;
    } else {
      await linkSocialAccount(user.id, provider, await devSocialProfile(provider, email, name, avatar));
    }

    await issueSession(res, user, req);
    await audit(user.id, `auth.social_dev_${provider}`, { provider, dev: true }, clientIp(req));
    res.json({ ok: true, user: publicUser(user), provider, dev: true });
  })
);

/** Collega un account social a una sessione già autenticata (produzione e dev). */
authRouter.post(
  "/social/link",
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const provider = String(req.body?.provider ?? "").toLowerCase();
    if (!SOCIAL_PROVIDERS.includes(provider)) throw ApiError.bad("validation", "Provider non valido");

    if (config.socialDevMode) {
      const email = String(req.body?.email ?? `dev_${provider}@samurai.test`).toLowerCase();
      const name = String(req.body?.name ?? `${providerLabel(provider)} Test`);
      const avatar = String(req.body?.avatar ?? "");
      await linkSocialAccount(req.user.id, provider, await devSocialProfile(provider, email, name, avatar));
      await audit(req.user.id, `auth.social_link_dev_${provider}`, { provider, dev: true }, clientIp(req));
      return res.json({ ok: true, provider, dev: true, message: `Account ${providerLabel(provider)} collegato (modalità dev)` });
    }

    // Produzione: restituisce l'URL di autorizzazione OAuth per il collegamento
    const cfg = config.social[provider];
    if (!cfg.clientId || !cfg.redirect) throw ApiError.bad("config", `OAuth non configurato per ${providerLabel(provider)}`);
    const state = randomToken(24);
    res.cookie(`oauth_link_state_${provider}`, state, { httpOnly: true, sameSite: "lax", maxAge: 10 * 60 * 1000, path: "/" });
    const url = buildAuthorizeUrl(provider, state, cfg.redirect);
    res.json({ ok: true, provider, authorizeUrl: url });
  })
);

/** Callback OAuth per collegamento social a sessione esistente. */
authRouter.get(
  "/social/:provider/link-callback",
  authLimiter,
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toLowerCase();
    if (!SOCIAL_PROVIDERS.includes(provider)) throw ApiError.bad("validation", "Provider non supportato");

    if (config.socialDevMode) {
      return res.redirect("/#/account?social_link=1&provider=" + provider + "&dev=1");
    }

    if (!req.user) {
      clearAuthCookies(res);
      throw ApiError.unauthorized("Sessione richiesta per collegare un account social");
    }

    const stateCookie = req.cookies?.[`oauth_link_state_${provider}`];
    const stateQuery = String(req.query.state ?? "");
    if (!stateCookie || stateCookie !== stateQuery) {
      clearAuthCookies(res);
      throw ApiError.unauthorized("State OAuth non valido (possibile CSRF)");
    }
    res.clearCookie(`oauth_link_state_${provider}`, { path: "/" });

    const code = String(req.query.code ?? "");
    const error = String(req.query.error ?? "");
    if (error) throw ApiError.bad("provider", `Il provider ${providerLabel(provider)} ha rifiutato l'autorizzazione: ${String(req.query.error_description ?? error)}`);
    if (!code) throw ApiError.bad("validation", "Codice di autorizzazione mancante");

    const cfg = config.social[provider];
    const tokens = await exchangeCode(provider, code, cfg.redirect);
    const profile = await fetchProfile(provider, tokens);
    if (!profile.providerUserId || !profile.email) {
      throw ApiError.bad("provider", `Il profilo ${providerLabel(provider)} non contiene email e ID utente`);
    }

    await linkSocialAccount(req.user.id, provider, profile);
    await audit(req.user.id, `auth.social_link_${provider}`, { provider }, clientIp(req));

    return res.redirect("/#/account?social_link=1&provider=" + provider + "&ok=1");
  })
);

export const cookieName = config.cookieName;
export const hasSessionCookie = sessionCookiePresent;
