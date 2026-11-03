import { query } from "../../db/index.js";

export async function audit(userId, action, meta = {}, ip = "") {
  try {
    await query("INSERT INTO audit_log (user_id, action, meta, ip) VALUES ($1, $2, $3::jsonb, $4)", [
      userId ?? null,
      action,
      JSON.stringify(meta),
      ip ?? ""
    ]);
  } catch (err) {
    console.error("[audit] fallimento:", err.message);
  }
}

export async function auditTrail(userId, limit = 50) {
  const r = await query(
    "SELECT action, meta, ip, created_at FROM audit_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );
  return r.rows;
}
