/**
 * i18n Manager - Gestione multilingua lato client
 * Supporta: Italiano, Inglese, Spagnolo
 * Fallback automatico all'italiano
 */

// ============================================
// CONFIGURAZIONE
// ============================================

const SUPPORTED_LANGS = ['it', 'en', 'es'];
const DEFAULT_LANG = 'it';

// Traduzioni cache
let translations = {};
let currentLang = DEFAULT_LANG;

// ============================================
// CARICAMENTO TRADUZIONI
// ============================================

/**
 * Carica traduzioni dal server
 */
async function loadTranslations(lang = null) {
  const targetLang = lang || currentLang;
  
  try {
    const response = await fetch(`/api/i18n/translations?lang=${targetLang}`);
    if (response.ok) {
      translations[targetLang] = await response.json();
      console.log(`[i18n] Caricate traduzioni per ${targetLang}`);
    }
  } catch (err) {
    console.warn(`[i18n] Errore caricamento traduzioni per ${targetLang}:`, err.message);
  }
}

/**
 * Carica tutte le traduzioni
 */
async function loadAllTranslations() {
  await Promise.all(SUPPORTED_LANGS.map(lang => loadTranslations(lang)));
}

// Carica subitole traduzioni di default
loadTranslations();

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Imposta lingua corrente
 */
export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    console.warn(`[i18n] Lingua '${lang}' non supportata, uso '${DEFAULT_LANG}'`);
    lang = DEFAULT_LANG;
  }
  
  currentLang = lang;
  
  // Salva preferenza
  localStorage.setItem('preferred_language', lang);
  document.cookie = `lang=${lang}; path=/; max-age=${365 * 24 * 60 * 60}`;
  
  // Carica traduzioni se non in cache
  if (!translations[lang]) {
    loadTranslations(lang);
  }
  
  // Aggiorna attributo lang su html
  document.documentElement.lang = lang;
  
  // Dispatch event per aggiornamento UI
  window.dispatchEvent(new CustomEvent('language:changed', { detail: { lang } }));
}

/**
 * Ottieni lingua corrente
 */
export function getLanguage() {
  return currentLang;
}

/**
 * Ottieni traduzione per chiave
 * @param {string} key - Chiave di traduzione (es: 'welcome.title')
 * @param {Object} interpolations - Valori per sostituire placeholders
 * @returns {string} Traduzione o chiave originale
 */
export function t(key, interpolations = {}) {
  let translation = getTranslation(key, currentLang);
  
  // Fallback a italiano
  if (!translation) {
    translation = getTranslation(key, 'it');
  }
  
  // Fallback alla chiave
  if (!translation) {
    translation = key;
  }
  
  // Sostituisci placeholders
  for (const [placeholder, value] of Object.entries(interpolations)) {
    const regex = new RegExp(`\\${placeholder}`, 'g');
    translation = translation.replace(regex, value);
  }
  
  return translation;
}

/**
 * Ottieni traduzione grezza
 */
function getTranslation(key, lang) {
  if (translations[lang] && translations[lang][key]) {
    return translations[lang][key];
  }
  return null;
}

/**
 * Ottieni tutte le lingue supportate
 */
export function getSupportedLanguages() {
  return [...SUPPORTED_LANGS];
}

// ============================================
// DETEZIONE AUTOMATICA
// ============================================

/**
 * Rileva lingua preferita dall'utente
 */
export function detectPreferredLanguage() {
  // Controlla localStorage
  const stored = localStorage.getItem('preferred_language');
  if (stored && SUPPORTED_LANGS.includes(stored)) {
    return stored;
  }
  
  // Controlla cookie
  const cookieLang = getCookie('lang');
  if (cookieLang && SUPPORTED_LANGS.includes(cookieLang)) {
    return cookieLang;
  }
  
  // Controlla header Accept-Language
  const acceptLang = navigator.language || navigator.userLanguage || '';
  if (acceptLang) {
    const lang = acceptLang.split('-')[0];
    if (SUPPORTED_LANGS.includes(lang)) {
      return lang;
    }
  }
  
  return DEFAULT_LANG;
}

/**
 * Ottieni cookie
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// ============================================
// INIZIALIZZAZIONE
// ============================================

/**
 * Inizializza i18n con la lingua preferita
 */
export function initI18n() {
  const lang = detectPreferredLanguage();
  setLanguage(lang);
  
  // Carica tutte le traduzioni in background
  loadAllTranslations();
  
  // Osserva cambiamenti lingua
  window.addEventListener('language:changed', (e) => {
    // Ricarica la pagina se necessario (opzionale)
    // location.reload();
  });
}

// ============================================
// INTERFACCIA GLOBALE
// ============================================

// Espandi funzioni globalmente (opzionale)
window.i18n = {
  setLanguage,
  getLanguage,
  t,
  getSupportedLanguages,
  detectPreferredLanguage,
  init: initI18n
};

// ============================================
// TRADUZIONE AUTOMATICA INTERFACCIA
// ============================================

/**
 * Traduce automaticamente tutti gli elementi con attributo data-i18n
 */
export function translateDocument() {
  const elements = document.querySelectorAll('[data-i18n]');
  
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    
    const translation = t(key);
    
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translation;
    } else {
      el.textContent = translation;
    }
  });
}

/**
 * Traduce automaticamente attributi data-i18n-* con placeholders
 */
export function translateWithInterpolation() {
  const elements = document.querySelectorAll('[data-i18n-key]');
  
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    const interpolationKey = el.getAttribute('data-i18n-interpolation');
    
    if (!key) return;
    
    let interpolations = {};
    if (interpolationKey) {
      const value = el.getAttribute(interpolationKey);
      if (value) {
        try {
          interpolations = JSON.parse(value);
        } catch (e) {
          // Ignora errore parsing
        }
      }
    }
    
    const translation = t(key, interpolations);
    
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translation;
    } else {
      el.textContent = translation;
    }
  });
}

// ============================================
// GESTIONE TRADUZIONI DINAMICHE
// ============================================

/**
 * Aggiungi traduzione in runtime
 */
export function addTranslation(key, lang, value) {
  if (!translations[lang]) {
    translations[lang] = {};
  }
  translations[lang][key] = value;
}

/**
 * Rimuovi traduzione
 */
export function removeTranslation(key, lang) {
  if (translations[lang] && translations[lang][key]) {
    delete translations[lang][key];
  }
}

// ============================================
// API PER COMPONENTI
// ============================================

/**
 * Hook per React-like components (semplificato)
 */
export function useTranslation() {
  return {
    t,
    currentLang: getLanguage(),
    setLanguage,
    supportedLanguages: getSupportedLanguages()
  };
}

// ============================================
// EXPORT
// ============================================

export default {
  // Funzioni principali
  t,
  setLanguage,
  getLanguage,
  getSupportedLanguages,
  
  // Inizializzazione
  initI18n,
  detectPreferredLanguage,
  
  // Traduzione document
  translateDocument,
  translateWithInterpolation,
  
  // Gestione traduzioni
  addTranslation,
  removeTranslation,
  loadTranslations,
  loadAllTranslations,
  
  // Hook
  useTranslation
};
