import { readFile } from "node:fs/promises";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { config } from "../src/lib/config.js";

const here = dirname(fileURLToPath(import.meta.url));

let driver = null;
let ready = null;

const PG_LOCK_FILES = ["postmaster.pid", "postmaster.opts"];

function clearPgliteLocks() {
  try {
    for (const f of PG_LOCK_FILES) {
      const p = join(config.pgliteDir, f);
      if (existsSync(p)) rmSync(p, { force: true });
    }
  } catch {
    /* ignora */
  }
}

function isConnectionError(err) {
  const msg = String(err?.message ?? err ?? "");
  return /ENOTFOUND|ECONNREFUSED|getaddrinfo|connection timeout|socket hang up/i.test(msg);
}

async function createPostgresDriver() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined
  });
  pool.on("error", (err) => console.error("[db] errore pool inatteso:", err.message));
  return {
    name: "postgres",
    query: (sql, params) => pool.query(sql, params),
    connect: () => pool.connect(),
    close: () => pool.end()
  };
}

async function createPgliteDriver() {
  clearPgliteLocks();
  let pg;
  try {
    pg = await PGlite.create({ dataDir: config.pgliteDir });
  } catch {
    clearPgliteLocks();
    pg = await PGlite.create({ dataDir: config.pgliteDir });
  }
  return {
    name: "pglite",
    query: (sql, params) => pg.query(sql, params),
    exec: (sql) => pg.exec(sql),
    close: () => pg.close()
  };
}

async function createDriver() {
  if (config.databaseUrl) {
    try {
      return await createPostgresDriver();
    } catch {
      // Postgres non raggiungibile: fallback a PGlite locale
    }
  }
  return await createPgliteDriver();
}

export function dbName() {
  return driver?.name ?? "non-inizializzato";
}

export async function initDb() {
  if (ready) return ready;
  ready = (async () => {
    driver = await createDriver();
    try {
      const schema = await readFile(join(here, "schema.sql"), "utf8");
      if (driver.exec) await driver.exec(schema);
      else await driver.query(schema);

      // Applica gli aggiornamenti di schema (nuove tabelle, campi, indici)
      try {
        const schemaUpdate = await readFile(join(here, "schema_update.sql"), "utf8");
        const statements = schemaUpdate.split(";").filter((s) => s.trim());
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (!trimmed) continue;
          try {
            if (driver.exec) await driver.exec(trimmed);
            else await driver.query(trimmed);
          } catch (e) {
            // Ignora errori idempotenti (tabelle già esistenti, etc.)
          }
        }
      } catch {
        // schema_update.sql potrebbe non esistere ancora in alcuni deploy
      }
    } catch (err) {
      // Postgres non raggiungibile: tear down e fallback a PGlite locale
      if (driver.name === "postgres" && isConnectionError(err)) {
        try {
          await driver.close();
        } catch {
          /* ignora */
        }
        driver = await createPgliteDriver();
        const schema = await readFile(join(here, "schema.sql"), "utf8");
        await driver.exec(schema);
        try {
          const schemaUpdate = await readFile(join(here, "schema_update.sql"), "utf8");
          const statements = schemaUpdate.split(";").filter((s) => s.trim());
          for (const stmt of statements) {
            const trimmed = stmt.trim();
            if (!trimmed) continue;
            try {
              await driver.exec(trimmed);
            } catch {
              /* ignora errori idempotenti */
            }
          }
        } catch {
          /* ignora */
        }
      } else {
        throw err;
      }
    }

    console.log(
      `[db] pronto — driver: ${driver.name}` +
        (driver.name === "pglite" ? ` (dati locali in ${config.pgliteDir})` : "")
    );
    return driver;
  })();
  return ready;
}

export async function query(sql, params = []) {
  await ready;
  return driver.query(sql, params);
}

export async function one(sql, params = []) {
  const r = await query(sql, params);
  return r.rows[0] ?? null;
}

export async function many(sql, params = []) {
  const r = await query(sql, params);
  return r.rows;
}

export async function tx(fn) {
  await ready;
  const exec = async (sql, params) => (driver.name === "pglite" ? driver.query(sql, params) : null);

  if (driver.name === "pglite") {
    await exec("BEGIN");
    try {
      const out = await fn({ query: (sql, params) => driver.query(sql, params) });
      await exec("COMMIT");
      return out;
    } catch (err) {
      await exec("ROLLBACK").catch(() => {});
      throw err;
    }
  }

  const conn = await driver.connect();
  try {
    await conn.query("BEGIN");
    const out = await fn(conn);
    await conn.query("COMMIT");
    return out;
  } catch (err) {
    await conn.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

export async function closeDb() {
  if (!driver) return;
  try {
    if (driver.name === "pglite") {
      // PGlite (WASM) lancia Aborted() in chiusura del driver. I dati sono già
      // persistiti su disco, quindi si salta la close esplicita all'uscita del
      // processo per evitare l'unhandledRejection allo shutdown.
      driver = null;
      ready = null;
      return;
    }
    await driver.close();
  } catch {
    // Ignora errori di chiusura driver
  }
  driver = null;
  ready = null;
}
