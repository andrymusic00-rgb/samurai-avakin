// server/src/lib/progression.js — motore XP, level-up e skill per attitudine
import { one, query, many } from "../../db/index.js";

const XP_BASE = 100;
const XP_FACTOR = 1.5;

const SKILL_XP_BASE = 40;
const SKILL_XP_FACTOR = 1.35;

// XP totali necessarie per RAGGIUNGERE un dato livello (livello 1 = 0)
export function xpForLevel(level) {
  const n = Math.max(1, Math.min(50, Number(level ?? 1)));
  let totale = 0;
  for (let l = 1; l < n; l++) {
    totale += Math.floor(XP_BASE * Math.pow(XP_FACTOR, l - 1));
  }
  return totale;
}

// XP necessarie per passare dal livello `level` al successivo
export function xpForNextLevel(level) {
  const n = Math.max(1, Math.min(49, Number(level ?? 1)));
  return Math.floor(XP_BASE * Math.pow(XP_FACTOR, n - 1));
}

// Calcola livello, XP nel livello corrente e soglia successiva da XP totali
export function levelFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp ?? 0));
  let level = 1;
  let rimanente = xp;
  let soglia = xpForNextLevel(level);
  while (level < 50 && rimanente >= soglia) {
    rimanente -= soglia;
    level++;
    soglia = xpForNextLevel(level);
  }
  return { level, xpInLevel: rimanente, xpPerNext: soglia };
}

export function skillXpForLevel(level) {
  const n = Math.max(1, Math.min(99, Number(level ?? 1)));
  return Math.floor(SKILL_XP_BASE * Math.pow(SKILL_XP_FACTOR, n - 1));
}

export function skillLevelFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp ?? 0));
  let livello = 1;
  let rimanente = xp;
  let soglia = skillXpForLevel(livello);
  while (livello < 100 && rimanente >= soglia) {
    rimanente -= soglia;
    livello++;
    soglia = skillXpForLevel(livello);
  }
  return { livello, xpInLevel: rimanente, xpPerNext: soglia };
}

/**
 * Aggiunge XP totali a un utente. Gestisce automaticamente i level-up multipli.
 * Restituisce { leveledUp, oldLevel, newLevel, xp, xpInLevel, xpPerNext, progressoPct, gained }.
 */
export async function addXp(userId, azione, punti) {
  const p = Math.max(0, Number(punti ?? 0));
  if (!p) return { leveledUp: false, gained: 0 };

  const user = await one("SELECT level, xp FROM users WHERE id = $1", [userId]);
  if (!user) return { leveledUp: false, gained: 0 };

  const oldLevel = Number(user.level ?? 1);
  const oldXp = Number(user.xp ?? 0);
  const { level: newLevel, xpInLevel, xpPerNext } = levelFromXp(oldXp + p);

  await query("UPDATE users SET level = $1, xp = $2 WHERE id = $3", [newLevel, oldXp + p, userId]);
  await query(
    "INSERT INTO user_xp_log (user_id, azione, xp_guadagnato) VALUES ($1, $2, $3)",
    [userId, azione, p]
  );

  const progressoPct = xpPerNext > 0 ? Math.round((xpInLevel / xpPerNext) * 100) : 100;
  return {
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
    xp: oldXp + p,
    xpInLevel,
    xpPerNext,
    progressoPct: Math.min(100, progressoPct),
    gained: p,
  };
}

/**
 * Aggiunge XP a una skill specifica (attitudine). Livello skill 1-100.
 */
export async function addSkillXp(userId, chiave, punti) {
  const p = Math.max(0, Number(punti ?? 0));
  if (!p) return;

  await query(
    `INSERT INTO user_skills (user_id, chiave, livello, xp) VALUES ($1, $2, 1, 0)
     ON CONFLICT (user_id, chiave) DO NOTHING`,
    [userId, chiave]
  );

  const row = await one(
    "SELECT livello, xp FROM user_skills WHERE user_id = $1 AND chiave = $2",
    [userId, chiave]
  );
  const oldLivello = Number(row?.livello ?? 1);
  const oldXp = Number(row?.xp ?? 0);
  const { livello: newLivello, xpInLevel, xpPerNext } = skillLevelFromXp(oldXp + p);

  await query(
    `UPDATE user_skills
       SET livello = $1, xp = $2, aggiornato = now()
     WHERE user_id = $3 AND chiave = $4`,
    [newLivello, oldXp + p, userId, chiave]
  );

  return {
    chiave,
    leveledUp: newLivello > oldLivello,
    oldLivello,
    newLivello,
    xp: oldXp + p,
    xpInLevel,
    xpPerNext,
    progressoPct: xpPerNext > 0 ? Math.min(100, Math.round((xpInLevel / xpPerNext) * 100)) : 100,
    gained: p,
  };
}

/**
 * Progressione completa di un utente: livello generale, XP e skill.
 */
export async function getProgression(userId) {
  const user = await one("SELECT level, xp FROM users WHERE id = $1", [userId]);
  const level = Number(user?.level ?? 1);
  const xp = Number(user?.xp ?? 0);
  const { xpInLevel, xpPerNext } = levelFromXp(xp);
  const progressoPct = xpPerNext > 0 ? Math.min(100, Math.round((xpInLevel / xpPerNext) * 100)) : 100;

  const rows = await many(
    "SELECT chiave, livello, xp FROM user_skills WHERE user_id = $1 ORDER BY chiave",
    [userId]
  );
  const skills = rows.map((s) => {
    const { xpInLevel: sxp, xpPerNext: snext } = skillLevelFromXp(Number(s.xp ?? 0));
    return {
      chiave: s.chiave,
      livello: Number(s.livello ?? 1),
      xp: Number(s.xp ?? 0),
      progressoPct: snext > 0 ? Math.min(100, Math.round((sxp / snext) * 100)) : 100,
    };
  });

  return { level, xp, xpInLevel, xpPerNext, progressoPct, skills };
}

/**
 * XP guadagnati negli ultimi giorni (per dashboard / statistiche).
 */
export async function xpSummary(userId, giorni = 30) {
  const rows = await many(
    `SELECT azione, SUM(xp_guadagnato) AS totale, COUNT(*) AS volte
       FROM user_xp_log
      WHERE user_id = $1 AND creato_il > now() - ($2 || ' days')::interval
      GROUP BY azione
      ORDER BY totale DESC`,
    [userId, String(giorni)]
  );
  return rows;
}
