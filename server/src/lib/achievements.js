import { many, query } from "../../db/index.js";

/**
 * Definizione dei traguardi. `check` riceve i dati gia' aggregati del
 * membro e restituisce true quando il traguardo e' stato ottenuto.
 * Nessuna condizione puo' dipendere dal solo tempo trascorso.
 */
export const CATALOG = [
  {
    code: "primo_sangue",
    nome: "Primo sangue",
    kanji: "初",
    desc: "Prima vittoria ufficiale con il clan.",
    tier: "bronzo",
    check: (s) => s.vittorie >= 1
  },
  {
    code: "centurio",
    nome: "Centurio",
    kanji: "百",
    desc: "100 vittorie registrate.",
    tier: "argento",
    check: (s) => s.vittorie >= 100
  },
  {
    code: "cinquecento",
    nome: "Vittorie d'acciaio",
    kanji: "戦",
    desc: "500 vittorie registrate.",
    tier: "oro",
    check: (s) => s.vittorie >= 500
  },
  {
    code: "ronin",
    nome: "Ronin",
    kanji: "浪",
    desc: "Raggiungi il livello 30.",
    tier: "bronzo",
    check: (s) => s.level >= 30
  },
  {
    code: "bushi",
    nome: "Bushi",
    kanji: "武",
    desc: "Raggiungi il livello 40.",
    tier: "argento",
    check: (s) => s.level >= 40
  },
  {
    code: "shogun",
    nome: "La via dello Shogun",
    kanji: "侍",
    desc: "Raggiungi il livello 48.",
    tier: "oro",
    check: (s) => s.level >= 48
  },
  {
    code: "veterano",
    nome: "Veterano",
    kanji: "武",
    desc: "Presenta un'arma almeno Troppa 4 stelle.",
    tier: "argento",
    check: (s) => (s.mainChar || "").match(/⋆/g)?.length >= 4
  },
  {
    code: "fedele",
    nome: "Fedele",
    kanji: "信",
    desc: "100 ore di presenza in clan.",
    tier: "bronzo",
    check: (s) => s.ore >= 100
  },
  {
    code: "mille_ore",
    nome: "Costanza millenne",
    kanji: "時",
    desc: "1000 ore di presenza in clan.",
    tier: "oro",
    check: (s) => s.ore >= 1000
  },
  {
    code: "raider",
    nome: "Raider",
    kanji: "襲",
    desc: "Partecipa a 10 raid.",
    tier: "bronzo",
    check: (s) => s.raid >= 10
  },
  {
    code: "veterano_raid",
    nome: "Flagello dei raid",
    kanji: "嵐",
    desc: "Partecipa a 100 raid.",
    tier: "oro",
    check: (s) => s.raid >= 100
  },
  {
    code: "leale",
    nome: "Leale",
    kanji: "義",
    desc: "Collega il tuo ID Avakin al profilo.",
    tier: "bronzo",
    check: (s) => !!s.avakinId
  },
  {
    code: "indistruttibile",
    nome: "Indistruttibile",
    kanji: "不",
    desc: "Win rate del 75% con almeno 100 scontri.",
    tier: "oro",
    check: (s) => {
      const total = s.vittorie + s.sconfitte;
      return total >= 100 && s.vittorie / total >= 0.75;
    }
  },
  {
    code: "veterano_social",
    nome: "Portavoce",
    kanji: "声",
    desc: "Scrivi una bio sul tuo profilo.",
    tier: "argento",
    check: (s) => (s.bio || "").trim().length >= 10
  },
  {
    code: "primo_passo",
    nome: "Primo passo",
    kanji: "初",
    desc: "Supera il livello 1.",
    tier: "bronzo",
    check: (s) => s.level >= 2
  },
  {
    code: "scalatore",
    nome: "Scalatore",
    kanji: "登",
    desc: "Raggiungi il livello 10.",
    tier: "bronzo",
    check: (s) => s.level >= 10
  },
  {
    code: "maestro",
    nome: "Maestro",
    kanji: "匠",
    desc: "Raggiungi il livello 25.",
    tier: "argento",
    check: (s) => s.level >= 25
  },
  {
    code: "leggenda_viva",
    nome: "Leggenda vivente",
    kanji: "伝",
    desc: "Raggiungi il livello massimo (50).",
    tier: "oro",
    check: (s) => s.level >= 50
  },
  {
    code: "difensore_accanito",
    nome: "Difensore accanito",
    kanji: "守",
    desc: "Porta la skill Difesa con scudo al 50.",
    tier: "bronzo",
    check: (s) => (s.skills?.difesa ?? 0) >= 50
  },
  {
    code: "attaccante_spietato",
    nome: "Attaccante spietato",
    kanji: "攻",
    desc: "Porta la skill Attacco al 50.",
    tier: "bronzo",
    check: (s) => (s.skills?.attacco ?? 0) >= 50
  },
  {
    code: "tattico_da_arena",
    nome: "Tattico da arena",
    kanji: "戦",
    desc: "Porta la skill Lettura dell'arena al 50.",
    tier: "argento",
    check: (s) => (s.skills?.arena ?? 0) >= 50
  },
  {
    code: "polivalente",
    nome: "Polivalente",
    kanji: "円",
    desc: "Tutte le skill almeno al 30.",
    tier: "argento",
    check: (s) => {
      const sk = s.skills ?? {};
      return sk.difesa >= 30 && sk.attacco >= 30 && sk.risorse >= 30 && sk.arena >= 30 && sk.squadra >= 30;
    }
  },
  {
    code: "dedizioso",
    nome: "Dedizioso",
    kanji: "誠",
    desc: "Compiuti almeno 5 azioni che fanno crescere il tuo profilo.",
    tier: "bronzo",
    check: (s) => (s.azioni ?? 0) >= 5
  },
  {
    code: "serie_vincente",
    nome: "Serie vincente",
    kanji: "連勝",
    desc: "Kill streak di almeno 5 vittorie consecutive.",
    tier: "bronzo",
    check: (s) => (s.killStreak ?? 0) >= 5
  }
];

async function snapshot(userId) {
  const stats = await query(
    `SELECT COALESCE(s.vittorie, 0)  AS vittorie,
            COALESCE(s.sconfitte, 0) AS sconfitte,
            COALESCE(s.raid, 0)      AS raid,
            COALESCE(s.ore, 0)       AS ore,
            COALESCE(s.kill_streak, 0) AS kill_streak
           FROM users u
           LEFT JOIN user_stats s ON s.user_id = u.id
          WHERE u.id = $1`,
    [userId]
  );
  const row = stats.rows[0] ?? {};
  const u = await query("SELECT level, main_char, avakin_id, bio FROM users WHERE id = $1", [userId]);
  const usr = u.rows[0] ?? {};

  const azioni = await query(
    "SELECT COUNT(*) AS n FROM user_xp_log WHERE user_id = $1",
    [userId]
  );
  const nAzioni = Number(azioni.rows[0]?.n ?? 0);

  const skillRows = await many(
    "SELECT chiave, livello FROM user_skills WHERE user_id = $1",
    [userId]
  );
  const skillsMap = {};
  skillRows.forEach((r) => { skillsMap[r.chiave] = Number(r.livello ?? 1); });

  return {
    vittorie: Number(row.vittorie ?? 0),
    sconfitte: Number(row.sconfitte ?? 0),
    raid: Number(row.raid ?? 0),
    ore: Number(row.ore ?? 0),
    level: Number(usr.level ?? 1),
    mainChar: usr.main_char ?? "",
    avakinId: usr.avakin_id ?? null,
    bio: usr.bio ?? "",
    azioni: nAzioni,
    killStreak: Number(row.kill_streak ?? 0),
    skills: skillsMap
  };
}

/**
 * Ricalcola i traguardi di un utente e persiste solo quelli nuovi.
 * `earned` e' un Set di codici gia' registrati; `gained` i codici appena
 * inseriti, cosi' il frontend puo' festeggiarli una volta sola.
 */
export async function syncAchievements(userId) {
  const snap = await snapshot(userId);
  const earned = new Set(
    (await many("SELECT code FROM achievements WHERE user_id = $1", [userId])).map((r) => r.code)
  );

  const gained = [];
  for (const a of CATALOG) {
    let ok = false;
    try {
      ok = !!a.check(snap);
    } catch {
      ok = false;
    }
    if (ok && !earned.has(a.code)) {
      const res = await query(
        `INSERT INTO achievements (user_id, code) VALUES ($1, $2)
         ON CONFLICT (user_id, code) DO NOTHING RETURNING code`,
        [userId, a.code]
      );
      if (res.rowCount) gained.push(a.code);
      earned.add(a.code);
    }
  }
  return { snap, earned, gained };
}

export async function achievementsFor(userId) {
  const { snap, earned, gained } = await syncAchievements(userId);
  const sbloccati = earned.size;
  return {
    gained,
    totale: CATALOG.length,
    sbloccati,
    progresso: CATALOG.length ? Math.round((sbloccati / CATALOG.length) * 100) : 0,
    traguardi: CATALOG.map((a) => ({
      code: a.code,
      nome: a.nome,
      kanji: a.kanji.trim(),
      desc: a.desc,
      tier: a.tier,
      earned: earned.has(a.code)
    })),
    numeri: snap
  };
}
