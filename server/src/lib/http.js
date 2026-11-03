export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static bad(code, message, details) {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = "Autenticazione richiesta") {
    return new ApiError(401, "unauthorized", message);
  }
  static forbidden(message = "Non hai i permessi per questa azione") {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "Risorsa non trovata") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(message = "Conflitto") {
    return new ApiError(409, "conflict", message);
  }
  static tooMany(message = "Troppe richieste, riprova più tardi") {
    return new ApiError(429, "rate_limited", message);
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function sendError(res, err) {
  const status = err.status ?? 500;
  if (status >= 500) console.error("[api]", err);
  res.status(status).json({
    ok: false,
    error: {
      code: err.code ?? "internal_error",
      message: status >= 500 && config_isProd() ? "Errore interno del server" : err.message,
      ...(err.details ? { details: err.details } : {})
    }
  });
}

function config_isProd() {
  return process.env.NODE_ENV === "production";
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? "";
}
