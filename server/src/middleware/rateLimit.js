import rateLimit from "express-rate-limit";
import { ApiError } from "../lib/http.js";

const json = (code, message) => ({ ok: false, error: { code, message } });

export const limiter = (windowMs, max, code = "rate_limited") =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json(json(code, "Troppe richieste. Riprova tra poco."))
  });

export const authLimiter = limiter(15 * 60_000, 30, "auth_rate_limited");
export const writeLimiter = limiter(60_000, 60);
export const apiLimiter = limiter(60_000, 300);

export function idempotencyGuard(req, _res, next) {
  const key = req.get("Idempotency-Key");
  if (key && key.length > 200) return next(ApiError.bad("validation", "Idempotency-Key troppo lunga"));
  next();
}
