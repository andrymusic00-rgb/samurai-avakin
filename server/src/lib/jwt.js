import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function signAccess(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      handle: user.handle,
      lvl: user.level,
      typ: "access"
    },
    config.jwtSecret,
    { expiresIn: config.accessTtl, issuer: config.issuer }
  );
}

export function verifyAccess(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: config.issuer });
    return payload.typ === "access" ? payload : null;
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: config.cookieSecure,
  path: "/",
  domain: config.cookieDomain,
  maxAge: maxAgeMs
});

export const REFRESH_COOKIE = "sam_refresh";

export function setAuthCookies(res, { access, refresh }) {
  res.cookie(config.cookieName, access, cookieOptions(undefined));
  res.cookie(REFRESH_COOKIE, refresh, cookieOptions(config.refreshDays * 86400_000));
}

export function clearAuthCookies(res) {
  res.clearCookie(config.cookieName, cookieOptions(undefined));
  res.clearCookie(REFRESH_COOKIE, cookieOptions(undefined));
}
