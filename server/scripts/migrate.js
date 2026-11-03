import { initDb, closeDb, dbName } from "../db/index.js";

await initDb();
console.log(`[migrate] schema applicato — driver: ${dbName()}`);
await closeDb();
