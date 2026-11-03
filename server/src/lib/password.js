import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(plain) {
  if (typeof plain !== "string" || plain.length < 8) {
    throw new Error("password troppo corta");
  }
  const salt = crypto.randomBytes(16);
  const key = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(plain, stored) {
  if (typeof plain !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(plain, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024
  });
  return crypto.timingSafeEqual(key, expected);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
