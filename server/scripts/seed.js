import { initDb, query, closeDb, dbName } from "../db/index.js";
import { hashPassword } from "../src/lib/password.js";

const PASSWORD = process.env.SEED_PASSWORD || "Samurai2019";

const PEOPLE = [
  { email: "kenshin@samurai.test", name: "Kenshin", handle: "KENSHIN", role: "shogun", level: 50, xp: 100, bio: "Shogun del clan.", stats: [300, 20, 50, 2000] },
  { email: "yagami@samurai.test", name: "Yagami", handle: "YAGAMI", role: "shogun", level: 50, xp: 100, bio: "Shogun del clan.", stats: [280, 15, 45, 1800] },
  { email: "kaede@samurai.test", name: "Kaede", handle: "KAEDE", role: "bushi", level: 43, xp: 55, bio: "Difensore di mestiere.", stats: [214, 58, 96, 1240] },
  { email: "raiden@samurai.test", name: "Raiden", handle: "RAIDEN", role: "bushi", level: 47, xp: 61, bio: "Gestione eventi.", stats: [255, 49, 121, 1480] },
  { email: "admin@samurai.test", name: "Amministratore", handle: "ADMIN", role: "admin", level: 50, xp: 100, bio: "Amministrazione del sito.", stats: [0, 0, 0, 0] }
];

const EVENTS = [
  { slug: "raid-notturno-248", title: "Raid notturno — Settore 4", summary: "Sessione coordinata su tutti i server. Presenza richiesta.", category: "raid", days: 2, capacity: 40 },
  { slug: "torneo-2v2", title: "Torneo interno 2v2", summary: "Otto coppie, eliminazione diretta, premio in diamanti.", category: "evento", days: 6, capacity: 16 },
  { slug: "briefing-strategia", title: "Briefing strategia settimanale", summary: "Analisi delle meta e delle build della settimana.", category: "guida", days: 1, capacity: 0 }
];

const reset = process.argv.includes("--reset");

await initDb();

if (reset) {
  await query("TRUNCATE users, sessions, password_resets, uploads, audit_log CASCADE");
  console.log("[seed] dati precedenti rimossi");
}

const hash = await hashPassword(PASSWORD);
let created = 0;
let kept = 0;

for (const p of PEOPLE) {
  const existing = await query("SELECT id FROM users WHERE lower(email) = $1", [p.email]);
  let id;
  if (existing.rows.length) {
    id = existing.rows[0].id;
    if (reset) {
      await query(
        `UPDATE users SET password_hash = $1, role = $2, level = $3, xp = $4, display_name = $5, handle = $6, bio = $7
          WHERE id = $8`,
        [hash, p.role, p.level, p.xp, p.name, p.handle, p.bio, id]
      );
    } else {
      kept++;
      await query("INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [id]);
      continue;
    }
  } else {
    const r = await query(
      `INSERT INTO users (email, password_hash, display_name, handle, role, level, xp, bio, region, main_char, device, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Europa', 'Troppa ⋆ ⋆ ⋆ ⋆ ⋆', 'iOS', now())
       RETURNING id`,
      [p.email, hash, p.name, p.handle, p.role, p.level, p.xp, p.bio]
    );
    id = r.rows[0].id;
    created++;
  }

  await query("INSERT INTO user_prefs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [id]);
  await query(
    `INSERT INTO user_stats (user_id, vittorie, sconfitte, raid, ore) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET vittorie = $2, sconfitte = $3, raid = $4, ore = $5`,
    [id, ...p.stats]
  );
}

for (const e of EVENTS) {
  await query(
    `INSERT INTO events (slug, title, summary, category, starts_at, capacity)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval, $6)
     ON CONFLICT (slug) DO UPDATE SET title = $2, summary = $3, category = $4, capacity = $6`,
    [e.slug, e.title, e.summary, e.category, String(e.days), e.capacity]
  );
}

// Storico raid: senza questo la tabella RAID e le vittorie in classifica restano vuote.
const RAID = [
  { title: "Raid notturno — Settore 4", category: "raid", result: "vittoria", score: 1840, opponent: "Ishigami", days: 1 },
  { title: "Torneo 2v2 — Finali", category: "evento", result: "vittoria", score: 1210, opponent: "Coppia Kaede/Toru", days: 3 },
  { title: "Luna rossa — Attacco", category: "raid", result: "sconfitta", score: 640, opponent: "Ronin Free", days: 5 },
  { title: "Allenamento coordinato", category: "guida", result: "pareggio", score: 900, opponent: "Interno", days: 8 },
  { title: "Raid notturno — Settore 7", category: "raid", result: "vittoria", score: 2150, opponent: "Kagemusha", days: 12 }
];

// Il seed e' pensato per essere ri-eseguibile: i raid di esempio hanno un
// titolo noto, quindi si sostituiscono invece di accumularsi a ogni run.
await query("DELETE FROM clan_raid_log WHERE title = ANY($1)", [RAID.map((r) => r.title)]);

for (const r of RAID) {
  await query(
    `INSERT INTO clan_raid_log (title, category, result, score, opponent, created_at)
     VALUES ($1, $2, $3, $4, $5, now() - ($6 || ' days')::interval)`,
    [r.title, r.category, r.result, r.score, r.opponent, String(r.days)]
  );
}

console.log(`[seed] database: ${dbName()}`);
console.log(`[seed] creati: ${created} · esistenti lasciati intatti: ${kept}`);
console.log(`[seed] eventi: ${EVENTS.length} · raid registrati: ${RAID.length}`);
console.log("\n  Account di sviluppo — password per tutti: " + PASSWORD);
for (const p of PEOPLE) console.log(`   ${p.role.padEnd(7)} ${p.email.padEnd(24)} ${p.handle}`);
console.log("");

await closeDb();
