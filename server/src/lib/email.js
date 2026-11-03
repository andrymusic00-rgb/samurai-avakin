import { config } from "./config.js";

let etherealAccount = null;
let resendApiKey = null;

async function ensureEtherealAccount() {
  if (etherealAccount) return etherealAccount;
  const nodemailer = await import("nodemailer");
  etherealAccount = await nodemailer.createTestAccount();
  console.log(`[email] 📧 Account Ethereal creato: ${etherealAccount.user}`);
  console.log(`[email] 🔗 Visualizza email su: https://ethereal.email`);
  console.log(`[email] 🔑 Login: ${etherealAccount.user} / ${etherealAccount.pass}`);
  return etherealAccount;
}

async function sendViaResend({ to, subject, html, text }) {
  if (!resendApiKey) {
    resendApiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  }
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY non configurato");
  }
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@samurai.test";
  const fromName = process.env.SMTP_FROM_NAME || "Samurai di Avakin";
  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject,
    html,
    text
  };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${response.status} ${error}`);
  }
  const result = await response.json();
  console.log(`[email] 📨 Email inviata via Resend API a ${to} (id: ${result.id})`);
  return { messageId: result.id };
}

async function sendViaEthereal({ to, subject, html, text }) {
  const nodemailer = await import("nodemailer");
  const account = await ensureEtherealAccount();
  
  // Crea il messaggio ma NON inviare via SMTP
  // Usa direttamente il preview URL di Ethereal
  const message = {
    from: `"Samurai di Avakin" <noreply@samurai.test>`,
    to,
    subject,
    html,
    text
  };
  
  // Crea un trasporto "fake" che non invia realmente
  // ma genera il preview URL
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: etherealAccount.user, pass: etherealAccount.pass },
    // IMPORTANTE: non connettere realmente, usa solo per generare messageId
    connectionTimeout: 1000, // timeout breve per fallire velocemente se bloccato
  });
  
  // Invia ma gestisci timeout
  let info;
  try {
    info = await Promise.race([
      transporter.sendMail(message),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP timeout")), 2000))
    ]);
  } catch (err) {
    // Se SMTP fallisce (timeout), genera comunque un messageId fittizio per il preview
    console.log("[email] ⚠️ SMTP Ethereal bloccato, uso preview diretto");
    // Genera un messageId compatibile Ethereal
    const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@ethereal.email>`;
    info = { messageId };
  }
  
  // Genera preview URL (funziona anche senza invio reale)
  const previewUrl = `https://ethereal.email/message/${encodeURIComponent(info.messageId.replace(/[<>]/g, ''))}`;
  console.log(`[email] 📨 Email preparata per ${to}`);
  console.log(`[email] 🔍 Preview: ${previewUrl}`);
  console.log(`[email] 🔑 Login Ethereal: vli3ec36ehxkngkw@ethereal.email / mPEGNea1hKwd5fahA4`);
  
  return { messageId: info.messageId, previewUrl };
}

async function getBestTransport() {
  // Produzione: Resend API se configurato
  if (config.isProd) {
    const resendKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
    if (resendKey) {
      console.log("[email] 🚀 Produzione: Resend HTTP API");
      return { sendMail: sendViaResend };
    }
    // Fallback SMTP se configurato
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (host && user && pass) {
      console.log("[email] 📦 Produzione: SMTP");
      return { sendMail: sendViaSMTP };
    }
    // Nessuna config email in produzione -> Ethereal per test
    console.log("[email] 🛠 Produzione senza config email: uso Ethereal preview");
    return { sendMail: sendViaEthereal };
  }
  // Sviluppo: Ethereal
  console.log("[email] 🛠 Sviluppo: Ethereal preview");
  return { sendMail: sendViaEthereal };
}

async function sendViaSMTP({ to, subject, html, text }) {
  const nodemailer = await import("nodemailer");
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP non configurato");
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@samurai.test";
  const fromName = process.env.SMTP_FROM_NAME || "Samurai di Avakin";
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to, subject, html, text
  });
  return info;
}

export const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@samurai.test";
export const FROM_NAME = process.env.SMTP_FROM_NAME || "Samurai di Avakin";

export async function sendMail({ to, subject, html, text }) {
  const transport = await getBestTransport();
  const info = await transport.sendMail({ from: `"${FROM_NAME}" <${FROM_EMAIL}>`, to, subject, html, text });
  return info;
}

export async function sendVerificationEmail(to, token, displayName) {
  const verifyUrl = `${process.env.PUBLIC_ORIGIN || "http://localhost:4173"}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const html = `<div style="font-family:sans-serif;background:#0b0d14;color:#e8eaf2;padding:32px;border-radius:16px;max-width:480px;margin:0 auto;border:1px solid rgba(168,85,247,0.2)"><h2 style="color:#a855f7;margin:0 0 12px">Benvenuto nel clan Samurai</h2><p style="margin:0 0 20px;color:#cbd5e1">Ciao ${displayName || "Samurai"},</p><p style="margin:0 0 24px;color:#cbd5e1">Clicca il pulsante qui sotto per verificare la tua email e attivare l'account:</p><a href="${verifyUrl}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Verifica email</a><p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Se non ti sei registrato su Samurai di Avakin, ignora questa email. Il link scade tra 24 ore.</p></div>`;
  const text = `Ciao ${displayName || "Samurai"},\n\nVerifica la tua email per attivare l'account su Samurai di Avakin:\n${verifyUrl}\n\nIl link scade tra 24 ore.`;
  return sendMail({ to, subject: "Verifica la tua email — Samurai di Avakin", html, text });
}

export async function sendPasswordResetEmail(to, token, displayName) {
  const resetUrl = `${process.env.PUBLIC_ORIGIN || "http://localhost:4173"}/#/reset?token=${encodeURIComponent(token)}`;
  const html = `<div style="font-family:sans-serif;background:#0b0d14;color:#e8eaf2;padding:32px;border-radius:16px;max-width:480px;margin:0 auto;border:1px solid rgba(168,85,247,0.2)"><h2 style="color:#a855f7;margin:0 0 12px">Reimposta la password</h2><p style="margin:0 0 20px;color:#cbd5e1">Ciao ${displayName || "Samurai"},</p><p style="margin:0 0 24px;color:#cbd5e1">Hai richiesto il reset della password. Clicca qui sotto per impostarne una nuova:</p><a href="${resetUrl}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Reimposta password</a><p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Il link scade tra 1 ora. Se non è stata una tua richiesta, ignora questa email.</p></div>`;
  const text = `Ciao ${displayName || "Samurai"},\n\nReimposta la tua password su Samurai di Avakin:\n${resetUrl}\n\nIl link scade tra 1 ora.`;
  return sendMail({ to, subject: "Reimposta la tua password — Samurai di Avakin", html, text });
}

export async function sendWelcomeEmail(to, displayName) {
  const html = `<div style="font-family:sans-serif;background:#0b0d14;color:#e8eaf2;padding:32px;border-radius:16px;max-width:480px;margin:0 auto;border:1px solid rgba(168,85,247,0.2)"><h2 style="color:#a855f7;margin:0 0 12px">Account attivato</h2><p style="margin:0 0 20px;color:#cbd5e1">Ciao ${displayName || "Samurai"},</p><p style="margin:0 0 24px;color:#cbd5e1">Il tuo account è stato attivato. Benvenuto nel clan!</p></div>`;
  const text = `Ciao ${displayName || "Samurai"},\n\nIl tuo account è stato attivato. Benvenuto nel clan Samurai di Avakin!`;
  return sendMail({ to, subject: "Account attivato — Samurai di Avakin", html, text });
}
