import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { initDb, dbName, closeDb } from "../db/index.js";
import { initChatWebSocket, closeWebSocket } from "./lib/chat.js";
import { startEventReminderScheduler, stopEventReminderScheduler } from "./lib/push.js";

await initDb();

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  // Inizializza WebSocket per chat
  initChatWebSocket(server);
  
  // Avvia scheduler promemoria eventi
  startEventReminderScheduler();

  const displayHost = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
  console.log(`\n  侍  Samurai di Avakin`);
  console.log(`  server   http://${displayHost}:${config.port}`);
  console.log(`  env      ${config.env}`);
  console.log(`  database ${dbName()}`);
  console.log(`  account  ${config.env === "production" ? "attivi" : "demo — credenziali nel README"}`);
  console.log(`  chat     ws://${displayHost}:${config.port}/ws/chat`);
  console.log(`  push     Scheduler avviato\n`);
});

async function shutdown(sig) {
  console.log(`\n[server] ${sig} — chiusura in corso…`);
  
  // Ferma scheduler
  stopEventReminderScheduler();
  
  // Chiudi WebSocket
  closeWebSocket();
  
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => console.error("[server] unhandledRejection:", err));

// PGlite (WASM) può lanciare RuntimeError("Aborted...") in modo sincrono/asincrono
// per conflitti sul data directory. Li segnaliamo in modo pulito senza stampare
// l'intero trace del modulo WASM.
process.on("uncaughtException", (err) => {
  const msg = err?.message ?? String(err ?? "");
  const isWasmAbort = /Aborted/.test(msg) || err?.name === "WebAssembly.RuntimeError";
  if (isWasmAbort) {
    console.error("[server] Errore WASM/PGlite sul data directory (lock residuo).");
    console.error("[server] Suggerimento: ferma eventuali processi node in esecuzione e riprova.");
    process.exit(1);
    return;
  }
  console.error("[server] uncaughtException:", err);
  process.exit(1);
});
