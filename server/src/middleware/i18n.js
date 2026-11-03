/**
 * i18n Middleware - Supporto multilingua
 * Gestisce traduzioni e selezione lingua automatica
 * Supporta: Italiano (default), Inglese, Spagnolo
 */

import { query, one } from "../../db/index.js";

// Lingue supportate
const SUPPORTED_LANGS = ['it', 'en', 'es'];
const DEFAULT_LANG = 'it';

// Cache traduzioni
let translationsCache = {};

/**
 * Carica traduzioni dal database
 */
async function loadTranslations() {
  try {
    const result = await query(
      `SELECT key, lang, value FROM translations`
    );
    
    translationsCache = {};
    for (const row of result.rows) {
      if (!translationsCache[row.lang]) {
        translationsCache[row.lang] = {};
      }
      translationsCache[row.lang][row.key] = row.value;
    }
    
    console.log(`[i18n] Caricate ${Object.keys(translationsCache).length} lingue con ${result.rowCount} traduzioni`);
  } catch (err) {
    console.warn('[i18n] Errore caricamento traduzioni:', err.message);
  }
}

// Carica traduzioni all'avvio (lazy - caricamento ritardato)
// Verra' chiamato quando necessario o esplicitamente tramite refreshTranslations()

/**
 * Aggiorna cache delle traduzioni (chiamato dopo modifiche al DB)
 */
export async function refreshTranslations() {
  await loadTranslations();
}

/**
 * Ottieni traduzione per chiave
 * @param {string} key - Chiave di traduzione (es: 'welcome.title')
 * @param {string} lang - Lingua (opzionale, usa default)
 * @param {Object} interpolations - Valori per sostituire placeholders (es: { name: 'John' })
 * @returns {string} Traduzione o chiave originale se non trovata
 */
export function t(key, lang = null, interpolations = {}) {
  // Usa default se lingua non specificata
  const targetLang = lang || getCurrentLanguage();
  
  // Prova con la lingua target
  let translation = getTranslation(key, targetLang);
  
  // Fallback a italiano
  if (!translation) {
    translation = getTranslation(key, 'it');
  }
  
  // Fallback alla chiave stessa
  if (!translation) {
    translation = key;
  }
  
  // Sostituisci placeholders
  for (const [placeholder, value] of Object.entries(interpolations)) {
    const regex = new RegExp(`\${placeholder}`, 'g');
    translation = translation.replace(regex, value);
  }
  
  return translation;
}

/**
 * Ottieni traduzione grezza senza fallback
 */
function getTranslation(key, lang) {
  if (translationsCache[lang] && translationsCache[lang][key]) {
    return translationsCache[lang][key];
  }
  return null;
}

/**
 * Middleware per rilevare lingua utente
 * Ordine priorità:
 * 1. Query param ?lang=xx
 * 2. Cookie lang
 * 3. Header Accept-Language
 * 4. Preferenza utente nel DB
 * 5. Default (it)
 */
export function detectLanguage(req) {
  // Controlla query param
  if (req.query.lang && SUPPORTED_LANGS.includes(req.query.lang)) {
    return req.query.lang;
  }

  // Controlla cookie
  if (req.cookies && req.cookies.lang && SUPPORTED_LANGS.includes(req.cookies.lang)) {
    return req.cookies.lang;
  }

  // Controlla header Accept-Language
  const acceptLang = req.get('Accept-Language') || '';
  if (acceptLang) {
    for (const lang of acceptLang.split(',').map(l => l.trim().split('-')[0])) {
      if (SUPPORTED_LANGS.includes(lang)) {
        return lang;
      }
    }
  }

  // Controlla preferenza utente (se autenticato)
  if (req.user) {
    // Il user object dovrebbe avere la preferenza lingua dal DB
    return req.user.language || DEFAULT_LANG;
  }

  return DEFAULT_LANG;
}

/**
 * Middleware Express per aggiungere funzioni i18n alla request
 */
export function i18nMiddleware(req, res, next) {
  // Rileva lingua
  const lang = detectLanguage(req);
  
  // Aggiungi alla request
  req.lang = lang;
  req.t = (key, interpolations = {}) => t(key, lang, interpolations);
  req.getLanguage = () => lang;
  
  // Imposta header Content-Language
  res.setHeader('Content-Language', lang);
  
  next();
}

/**
 * Ottieni lingua corrente (per uso fuori dal contesto request)
 */
export function getCurrentLanguage() {
  return DEFAULT_LANG;
}

/**
 * Ottieni tutte le lingue supportate
 */
export function getSupportedLanguages() {
  return [...SUPPORTED_LANGS];
}

/**
 * Aggiungi nuova traduzione al database
 */
export async function addTranslation(key, lang, value) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    throw new Error(`Lingua '${lang}' non supportata`);
  }

  await query(
    `INSERT INTO translations (key, lang, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (key, lang) DO UPDATE SET value = $3`,
    [key, lang, value]
  );

  // Aggiorna cache
  await refreshTranslations();
}

/**
 * Rimuovi traduzione
 */
export async function removeTranslation(key, lang) {
  await query(
    `DELETE FROM translations WHERE key = $1 AND lang = $2`,
    [key, lang]
  );

  // Aggiorna cache
  await refreshTranslations();
}

/**
 * Ottieni tutte le traduzioni per una lingua
 */
export async function getAllTranslations(lang) {
  const result = await query(
    `SELECT key, value FROM translations WHERE lang = $1 ORDER BY key`,
    [lang]
  );
  
  return result.rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

/**
 * Importa traduzioni da file JSON
 */
export async function importTranslationsFromJson(jsonData) {
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  
  for (const [lang, translations] of Object.entries(data)) {
    if (!SUPPORTED_LANGS.includes(lang)) continue;
    
    for (const [key, value] of Object.entries(translations)) {
      await addTranslation(key, lang, value);
    }
  }
  
  return true;
}

/**
 * Esporta traduzioni come JSON
 */
export async function exportTranslationsToJson() {
  const result = await query(
    `SELECT key, lang, value FROM translations ORDER BY lang, key`
  );
  
  const data = {};
  for (const row of result.rows) {
    if (!data[row.lang]) {
      data[row.lang] = {};
    }
    data[row.lang][row.key] = row.value;
  }
  
  return JSON.stringify(data, null, 2);
}

/**
 * Middleware per forzare reindirizzamento alla versione localizzata
 * Opzionale: utile se vuoi URL con prefisso lingua (/it/, /en/, /es/)
 */
export function languageRedirectMiddleware(req, res, next) {
  // Implementazione opzionale - non usata per default
  next();
}

export default {
  t,
  detectLanguage,
  i18nMiddleware,
  getCurrentLanguage,
  getSupportedLanguages,
  refreshTranslations,
  addTranslation,
  removeTranslation,
  getAllTranslations,
  importTranslationsFromJson,
  exportTranslationsToJson
};
