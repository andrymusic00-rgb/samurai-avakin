import { ApiError } from "./http.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const HANDLE = /^[A-Za-z0-9_]{3,16}$/;

export const ROLES = ["membro", "bushi", "shogun", "admin"];
export const RANK = { membro: 10, bushi: 30, shogun: 45, admin: 100 };

export function str(v, { min = 0, max = 500, trim = true, required = false, field = "campo" } = {}) {
  let s = v == null ? "" : String(v);
  if (trim) s = s.trim();
  if (!s) {
    if (required) throw ApiError.bad("validation", `${field} è obbligatorio`, { field });
    return "";
  }
  if (s.length < min) throw ApiError.bad("validation", `${field}: minimo ${min} caratteri`, { field });
  if (s.length > max) throw ApiError.bad("validation", `${field}: massimo ${max} caratteri`, { field });
  return s;
}

export function email(v, { required = true } = {}) {
  const s = str(v, { max: 254, required, field: "Email" }).toLowerCase();
  if (!s) return "";
  if (!EMAIL.test(s)) throw ApiError.bad("validation", "Email non valida", { field: "email" });
  return s;
}

export function handle(v) {
  const s = str(v, { min: 3, max: 16, required: true, field: "Handle" });
  if (!HANDLE.test(s)) throw ApiError.bad("validation", "Handle: solo A-Z, 0-9 e _ (3-16 caratteri)", { field: "handle" });
  return s.toUpperCase();
}

export function password(v) {
  const s = str(v, { min: 8, max: 200, required: true, field: "Password", trim: false });
  if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) {
    throw ApiError.bad("validation", "La password deve contenere lettere e numeri", { field: "password" });
  }
  return s;
}

export function confirmPassword(password, confirm, { field = "conferma_password" } = {}) {
  if (confirm == null || String(confirm).trim() === "") return "";
  if (String(confirm) !== password) {
    throw ApiError.bad("validation", "La conferma password non coincide", { field });
  }
  return String(confirm);
}

export function passwordStrength(p) {
  const s = p == null ? "" : String(p);
  let score = 0;
  const feedback = [];
  if (!s) return { score: 0, feedback: ["Inserisci una password"], max: 5 };
  if (s.length >= 8) score += 1; else feedback.push("almeno 8 caratteri");
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score += 1; else feedback.push("maiuscole e minuscole");
  if (/[0-9]/.test(s)) score += 1; else feedback.push("almeno un numero");
  if (/[^a-zA-Z0-9]/.test(s)) score += 1; else feedback.push("un simbolo");
  if (s.length >= 12) score += 1;
  return { score, feedback, max: 5 };
}

export function minAge(birthdate, minYears = 13, { field = "data_nascita" } = {}) {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (isNaN(d.getTime())) throw ApiError.bad("validation", "Data di nascita non valida", { field });
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  if (age < minYears) {
    throw ApiError.bad("validation", `Devi avere almeno ${minYears} anni per registrarti`, { field });
  }
  return age;
}

export function oneOf(v, allowed, { required = false, field = "valore", fallback = null } = {}) {
  const s = str(v, { max: 40, required, field });
  if (!s) return fallback;
  if (!allowed.includes(s)) throw ApiError.bad("validation", `${field}: valore non ammesso`, { field, allowed });
  return s;
}

export function intInRange(v, { min, max, fallback }) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw ApiError.bad("validation", `Valore fuori intervallo (${min}-${max})`);
  }
  return n;
}

export function bool(v, fallback = false) {
  if (v == null) return fallback;
  if (typeof v === "boolean") return v;
  return /^(1|true|yes|on)$/i.test(String(v));
}

export function hexColor(v, fallback = "#5aa8ff") {
  const s = str(v, { max: 7, field: "Colore" });
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

export function digits(v, { field = "ID", min = 4, max = 10 } = {}) {
  const s = str(v, { min, max, required: true, field });
  if (!/^\d+$/.test(s)) throw ApiError.bad("validation", `${field}: solo cifre`, { field });
  return s;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

/**
 * Un id malformato non deve arrivare a Postgres: `id = $1` con una stringa non
 * UUID solleva 22P02 e trasforma un semplice 404 in un 500. La query deve pero'
 * accettare anche gli slug, quindi non si puo' semplicemente rifiutare: meglio
 * passare $2 come UUID solo quando lo e', e lasciare $1 per il confronto testuale.
 */
export function uuidOrNull(v) {
  return isUuid(v) ? v : null;
}
