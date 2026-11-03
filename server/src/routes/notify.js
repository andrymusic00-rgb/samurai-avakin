import { Router } from "express";
import { one, many, query } from "../../db/index.js";
import { asyncHandler, ApiError } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { isUuid, uuidOrNull } from "../lib/validate.js";

export const notifyRouter = Router();

/**
 * Notifiche in-app via SSE.
 * Un solo canale per utente: le richieste multiple sullo stesso utente
 * condividono la stessa risposta invece di aprire N connessioni.
 */
const streams = new Map();

function push(userId, event, data) {
  const res = streams.get(userId);
  if (!res) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    streams.delete(userId);
    return false;
  }
}

export function broadcast(userId, event, data) {
  return push(userId, event, data);
}

function serialize(r) {
  return {
    id: r.id,
    titolo: r.title,
    corpo: r.body,
    link: r.link,
    scope: r.scope,
    letta: !!r.read_at,
    createdAt: r.created_at
  };
}

notifyRouter.use(requireAuth);

notifyRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT id, title, body, link, scope, read_at, created_at
         FROM notifications
        WHERE user_id = $1 OR (user_id IS NULL AND scope = 'clan')
        ORDER BY created_at DESC
        LIMIT 40`,
      [req.user.id]
    );
    const unread = rows.filter((r) => !r.read_at).length;
    res.json({ ok: true, notifiche: rows.map(serialize), nonLette: unread });
  })
);

notifyRouter.get(
  "/stream",
  asyncHandler(async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const userId = req.user.id;
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const prev = streams.get(userId);
    if (prev) {
      // Un solo canale per utente: chi riapre chiude il canale precedente.
      try {
        prev.end();
      } catch {}
    }
    streams.set(userId, res);

    const keepAlive = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {}
    }, 25_000);

    const close = () => {
      clearInterval(keepAlive);
      if (streams.get(userId) === res) streams.delete(userId);
    };
    req.on("close", close);
    res.on("error", close);
  })
);

notifyRouter.post(
  "/read",
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.slice(0, 50).map(String).filter(isUuid)
      : null;
    if (ids?.length) {
      await query(
        "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id::text = ANY($2) AND read_at IS NULL",
        [req.user.id, ids]
      );
    } else {
      await query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [req.user.id]);
    }
    const row = await one(
      "SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL",
      [req.user.id]
    );
    res.json({ ok: true, nonLette: row.n });
  })
);

notifyRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await one(
      "DELETE FROM notifications WHERE ($1::uuid IS NOT NULL AND id = $1::uuid) AND user_id = $2 RETURNING id",
      [uuidOrNull(req.params.id), req.user.id]
    );
    if (!row) throw ApiError.notFound("Notifica non trovata");
    res.json({ ok: true });
  })
);
