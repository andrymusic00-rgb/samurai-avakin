import nodemailer from "nodemailer";
import { config } from "./config.js";

let transporter = null;
let etherealAccount = null;
let etherealTransporter = null;

/**
 * Crea un account Ethereal Email per sviluppo/testing.
 * Ethereal è un servizio SMTP fake gratuito di Nodemailer che:
 * - Crea account temporanei automaticamente
 * - Mostra le email in una web UI (https://ethereal.email)
 * - È completamente gratuito e open source
 * - Non richiede configurazione
 */
async function createEtherealTransporter() {
  if (etherealTransporter) return etherealTransporter;

  // Crea account Ethereal (una volta sola)
  if (!etherealAccount) {
    etherealAccount = await nodemailer.createTestAccount();
    console.log(`[email] 📧 Account Ethereal creato: ${etherealAccount.user}`);
    console.log(`[email] 🔗 Visualizza email su: https://ethereal.email`);
    console.log(`[email] 🔑 Login: ${etherealAccount.user} / ${etherealAccount.pass}`);
  }

  etherealTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass
    }
  });

  return etherealTransporter;
}

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Modalità PRODUZIONE: SMTP reale configurato
  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    console.log("[email] 📦 Trasporto SMTP produzione configurato");
    return transporter;
  }

  // Modalità SVILUPPO: Ethereal Email (gratuito, automatico)
  if (!config.isProd) {
    console.log("[email] 🛠 Modalità sviluppo: usando Ethereal Email (gratuito)");
    return createEtherealTransporter();
  }

  // Produzione senza SMTP configurato
  transporter = {
    sendMail: async () => {
      throw new Error("SMTP non configurato: imposta SMTP_HOST, SMTP_USER, SMTP_PASS in server/.env per produzione");
    }
  };
  return transporter;
}

export const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@samurai.test";
export const FROM_NAME = process.env.SMTP_FROM_NAME || "Samurai di Avakin";

export async function sendMail({ to, subject, html, text }) {
  const tr = getTransporter();
  const info = await tr.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text
  });

  // In sviluppo con Ethereal, logga l'URL di preview
  if (!config.isProd && info.messageId) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[email] 📨 Email inviata a ${to}`);
      console.log(`[email] 🔍 Preview: ${previewUrl}`);
    }
  }

  return info;
}

export async function sendVerificationEmail(to, token, displayName) {
  const verifyUrl = `${process.env.PUBLIC_ORIGIN || `http://${config.host}:${config.port}`}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:sans-serif;background:#0b0d14;color:#e8eaf2;padding:32px;border-radius:16px;max-width:480px;margin:0 auto;border:1px solid rgba(168,85,247,0.2)">
      <h2 style="color:#a855f7;margin:0 0 12px">Benvenuto nel clan Samurai</h2>
      <p style="margin:0 0 20px;color:#cbd5e1">Ciao ${displayName || "Samurai"},</p>
      <p style="margin:0 0 24px;color:#cbd5e1">Clicca il pulsante qui sotto per verificare la tua email e attivare l'account:</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Verifica email</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Se non ti sei registrato su Samurai di Avakin, ignora questa email. Il link scade tra 24 ore.</p>
    </div>
  `;
  const text = `Ciao ${displayName || "Samurai"},\n\nVerifica la tua email per attivare l'account su Samurai di Avakin:\n${verifyUrl}\n\nIl link scade tra 24 ore.`;
  return sendMail({ to, subject: "Verifica la tua email — Samurai di Avakin", html, text });
}

export async function sendPasswordResetEmail(to, token, displayName) {
  const resetUrl = `${process.env.PUBLIC_ORIGIN || `http://${config.host}:${config.port}`}/#/reset?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:sans-serif;background:#0b0d14;color:#e8eaf2;padding:32px;border-radius:16px;max-width:480px;margin:0 auto;border:1px solid rgba(168,85,247,0.2)">
      <h2 style="color:#a855f7;margin:0 0 12px">Reimposta la password</h2>
      <p style="margin:0 0 20px;color:#cbd5e1">Ciao ${displayName || "Samurai"},</p>
      <p style="margin:0 0 24px;color:#cbd5e1">Hai richiesto il reset della password. Clicca qui sotto per impostarne una nuova:</p>
      <a href="${resetUrl}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Reimposta password</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Il link scade tra 1 ora. Se non è stata una tua richiesta, ignora questa email.</p>
    </div>
  `;
  const text = `Ciao ${displayName || "Samurai"},\n\nReimposta la tua password su Samurai di Avakin:\n${resetUrl}\n\nIl link scade tra 1 ora.`;
  return sendMail({ to, subject: "Reimposta la tua password — Samurai di Avakin", html, text });
}

export async function sendWelcomeEmail(to, displayName) {
  const html = `
    <div style="font-family:sans-serif;background:#0b0d14;color:#e8eaf2;padding:32px;border-radius:16px;max-width:480px;margin:0 auto;border:1px solid rgba(168,85,247,0.2)">
      <h2 style="color:#a855f7;margin:0 0 12px">Account attivato</h2>
      <p style="margin:0 0 20px;color:#cbd5e1">Ciao ${displayName || "Samurai"},</p>
      <p style="margin:0 0 24px;color:#cbd5e1">Il tuo account è stato attivato. Benvenuto nel clan!</p>
    </div>
  `;
  const text = `Ciao ${displayName || "Samurai"},\n\nIl tuo account è stato attivato. Benvenuto nel clan Samurai di Avakin!`;
  return sendMail({ to, subject: "Account attivato — Samurai di Avakin", html, text });
}