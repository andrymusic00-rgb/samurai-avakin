import { rm } from "node:fs/promises";
import { config } from "../src/lib/config.js";

if (config.databaseUrl) {
  console.error("[reset] rifiutato: è impostato un DATABASE_URL. Usa un drop manuale del database.");
  process.exit(1);
}

const done = await rm(config.pgliteDir, { recursive: true, force: true });
console.log(
  done
    ? `[reset] rimossa la directory dati locale: ${config.pgliteDir}\n[reset] la prossima avvio ricrea il database vuoto (poi lancia "npm run seed").`
    : "[reset] nessuna directory dati da rimuovere."
);
