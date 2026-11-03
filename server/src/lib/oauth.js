import { config } from "./config.js";
import { ApiError } from "./http.js";
import jwt from "jsonwebtoken";

const PROVIDERS = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userinfo: "https://www.googleapis.com/oauth2/v2/userinfo",
    scope: "openid email profile"
  },
  microsoft: {
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfo: "https://graph.microsoft.com/v1.0/me",
    scope: "openid email profile User.Read"
  },
  apple: {
    authorize: "https://appleid.apple.com/auth/authorize",
    token: "https://appleid.apple.com/auth/token",
    scope: "openid email name"
  }
};

export const SOCIAL_PROVIDERS = Object.keys(PROVIDERS);

export function providerLabel(provider) {
  return { google: "Google", microsoft: "Microsoft", apple: "Apple" }[provider] || provider;
}

export function providerConfig(provider) {
  const p = String(provider).toLowerCase();
  if (!PROVIDERS[p]) throw ApiError.bad("validation", "Provider social non supportato");
  return PROVIDERS[p];
}

function qs(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/**
 * Costruisce l'URL di autorizzazione del provider (produzione).
 * Lo stato viene passato dal chiamante (già salvato in cookie httpOnly).
 */
export function buildAuthorizeUrl(provider, state, redirectUri) {
  const cfg = providerConfig(provider);
  const clientId = socialClientId(provider);
  if (!clientId) throw ApiError.bad("config", `OAuth non configurato per ${providerLabel(provider)}`);
  const params = {
    client_id: clientId,
    redirect_uri: redirectUri || socialRedirect(provider),
    response_type: "code",
    scope: cfg.scope,
    state
  };
  if (provider === "apple") params.response_mode = "form_post";
  return `${cfg.authorize}?${qs(params)}`;
}

/** Client ID configurato per il provider. */
export function socialClientId(provider) {
  const c = config.social?.[provider];
  return c ? c.clientId : "";
}

/** Redirect URI configurata per il provider. */
export function socialRedirect(provider) {
  const c = config.social?.[provider];
  return c ? c.redirect : "";
}

/**
 * Firma il client_secret JWT richiesto da Apple per l'autenticazione
 * al token endpoint (client_secret = JWT ES256 firmato con la chiave privata .p8).
 */
function appleClientSecret() {
  const c = config.social.apple;
  if (!c.clientId || !c.teamId || !c.keyId) throw ApiError.bad("config", "Apple OAuth incompleto (clientId, teamId, keyId)");
  const key = process.env.APPLE_PRIVATE_KEY || "";
  if (!key) throw ApiError.bad("config", "APPLE_PRIVATE_KEY mancante");
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: c.teamId, iat: now, exp: now + 86400 * 180, aud: "https://appleid.apple.com", sub: c.clientId },
    key.replace(/\\n/g, "\n"),
    { algorithm: "ES256", keyid: c.keyId, issuer: c.teamId, audience: "https://appleid.apple.com", subject: c.clientId }
  );
}

/**
 * Scambia il codice di autorizzazione per ottenere i token del provider.
 * Restituisce { accessToken, idToken, refreshToken? }.
 */
export async function exchangeCode(provider, code, redirectUri) {
  const cfg = providerConfig(provider);
  const clientId = socialClientId(provider);
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] || "";
  if (!clientId) throw ApiError.bad("config", `OAuth non configurato per ${providerLabel(provider)}`);

  const body = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri || socialRedirect(provider)
  });

  let authHeader;
  if (provider === "apple") {
    if (!clientSecret) {
      body.set("client_secret", appleClientSecret());
    } else {
      body.set("client_secret", clientSecret);
    }
    authHeader = { "Content-Type": "application/x-www-form-urlencoded" };
  } else if (provider === "google") {
    if (!clientSecret) throw ApiError.bad("config", `GOOGLE_CLIENT_SECRET mancante per ${providerLabel(provider)}`);
    body.set("client_secret", clientSecret);
    authHeader = { "Content-Type": "application/x-www-form-urlencoded" };
  } else {
    // Microsoft accetta client_secret nel body
    if (!clientSecret) throw ApiError.bad("config", `MICROSOFT_CLIENT_SECRET mancante per ${providerLabel(provider)}`);
    body.set("client_secret", clientSecret);
    authHeader = { "Content-Type": "application/x-www-form-urlencoded" };
  }

  const r = await fetch(cfg.token, { method: "POST", headers: authHeader, body });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { throw ApiError.bad("provider", `Risposta non valida dal token endpoint di ${providerLabel(provider)}`); }
  if (!r.ok) throw ApiError.bad("provider", `Errore scambio codice ${providerLabel(provider)}: ${data.error_description || data.error || text}`);
  return { accessToken: data.access_token, idToken: data.id_token, refreshToken: data.refresh_token };
}

/**
 * Recupera il profilo utente dal provider.
 * Restituisce { providerUserId, email, name, avatar, emailVerified }.
 */
export async function fetchProfile(provider, { accessToken, idToken }) {
  const cfg = providerConfig(provider);

  if (provider === "google") {
    const r = await fetch(cfg.userinfo, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) throw ApiError.bad("provider", `Impossibile leggere il profilo Google`);
    const d = await r.json();
    return {
      providerUserId: String(d.id),
      email: String(d.email ?? "").toLowerCase() || null,
      name: String(d.name ?? d.email ?? "Utente Google"),
      avatar: d.picture || null,
      emailVerified: Boolean(d.verified_email)
    };
  }

  if (provider === "microsoft") {
    const r = await fetch(cfg.userinfo, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) throw ApiError.bad("provider", `Impossibile leggere il profilo Microsoft`);
    const d = await r.json();
    const email = String(d.mail ?? d.userPrincipalName ?? "").toLowerCase() || null;
    return {
      providerUserId: String(d.id),
      email,
      name: String(d.displayName ?? d.email ?? "Utente Microsoft"),
      avatar: null,
      emailVerified: true
    };
  }

  if (provider === "apple") {
    // Apple restituisce i dati utente nell'ID Token (JWT) al primo consenso;
    // nome ed email non vengono rinnovati alle richieste successive.
    let sub = null, email = null, name = null;
    if (idToken) {
      try {
        const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString("utf8"));
        sub = String(payload.sub);
        email = String(payload.email ?? "").toLowerCase() || null;
      } catch {}
    }
    return {
      providerUserId: sub,
      email,
      name: name || email || "Utente Apple",
      avatar: null,
      emailVerified: Boolean(email)
    };
  }

  throw ApiError.bad("validation", "Provider non supportato");
}
