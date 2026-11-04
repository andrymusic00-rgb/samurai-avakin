const DATA = {
  clan: {
    nome: "Samurai di Avakin",
    kanji: "侍",
    motto: "Oath.sworn — No betrayal",
    founded: 2019,
    server: "Europa",
    colore: "#5aa8ff"
  },

  nav: [
    { id: "home", label: "Home", kanji: "序", key: "H" },
    { id: "chi-siamo", label: "Chi Siamo", kanji: "道", key: "C" },
    { id: "eventi", label: "Eventi", kanji: "門", key: "E" },
    { id: "gallery", label: "Gallery", kanji: "画", key: "G" },
    { id: "video", label: "Video", kanji: "影", key: "V" },
    { id: "blog", label: "Creatività", kanji: "筆", key: "B" },
    { id: "classifica", label: "Classifica", kanji: "戦", key: "K" },
    { id: "comando", label: "Comando", kanji: "帥", key: "M" },
    { id: "account", label: "Account", kanji: "帳", key: "A" }
  ],

  marquee: [
    "Nessun tradimento dal 2019",
    "78 samurai attivi",
    "1.284 vittorie in clan war",
    "Troppa ⋆ ⋆ ⋆ ⋆ ⋆ ×4",
    "Onestà prima di tutto",
    "Reclutamento sempre aperto",
    "Bushidō digitale"
  ],

  stats: [
    { num: 78, suffix: "", label: "Samurai attivi", bar: 78 },
    { num: 1284, suffix: "", label: "Vittorie in war", bar: 92 },
    { num: 6, suffix: "", label: "Anni di onore", bar: 64 },
    { num: 99, suffix: "%", label: "Membri fedeli", bar: 99 }
  ],

  pillars: [
    {
      kanji: "義", titolo: "Onestà",
      testo: "Zero smurf, zero bug, zero account venduti. Quello che vedi è quello che giochi: le nostre vittorie sono vere.",
      foot: "Codice § 1"
    },
    {
      kanji: "礼", titolo: "Rispetto",
      testo: "Anche dopo la sconfitta, sempre. Nessun insulto, nessun dispetto. La parola data ha valore.",
      foot: "Codice § 2"
    },
    {
      kanji: "武", titolo: "Competenza",
      testo: "Alleniamo, studiamo le meta, condividiamo strategie. Ogni membro del clan è più bravo grazie agli altri.",
      foot: "Codice § 3"
    },
    {
      kanji: "義", titolo: "Lealtà",
      testo: "Quando entri, sei dei nostri. Ti aiutiamo a crescere, ti aspettiamo quando torni, non ti lasciamo indietro.",
      foot: "Codice § 4"
    },
    {
      kanji: "名", titolo: "Reputazione",
      testo: "Il nome del clan viaggia. Ogni membro è un ambasciatore: fuori dal gioco ci comportiamo da samurai.",
      foot: "Codice § 5"
    },
    {
      kanji: "和", titolo: "Spirito di gruppo",
      testo: "Raid serali, tornei interni, screenshot di vittoria. Il divertimento è parte del codice.",
      foot: "Codice § 6"
    }
  ],

  ranks: [
    { kanji: "肖", nome: "Aspirante", ruolo: "Candidatura in valutazione", pct: 20 },
    { kanji: "下", nome: "Ronin", ruolo: "Membro attivo, under 30 livelli", pct: 40 },
    { kanji: "中", nome: "Samurai", ruolo: "Membro consolidato", pct: 62 },
    { kanji: "上", nome: "Bushi", ruolo: "Veterano, sostiene i nuovi", pct: 82 },
    { kanji: "侍", nome: "Shogun", ruolo: "Capo clan, max 3 membri", pct: 100 }
  ],

  news: [
    { giorno: "26", mese: "SET", titolo: "Clan War — vittoria 248 a 191", testo: "Dominio nella zona 4. I Bushi hanno guidato la strategia fino all'ultimo turno.", tag: "WAR" },
    { giorno: "24", mese: "SET", titolo: "Apertura reclutamento", testo: "Cerchiamo 5 nuovi samurai con Troppa ⋆ ⋆ ⋆ o superiore e presenza costante.", tag: "OPEN" },
    { giorno: "21", mese: "SET", titolo: "Torneo interno 2v2", testo: "Iscrizioni chiuse. Premio: 500 diamanti per la coppia vincitrice.", tag: "EVENTO" },
    { giorno: "18", mese: "SET", titolo: "Nuova guida Troppa ⋆ ⋆ ⋆ ⋆ ⋆", testo: "Pubblicata la guida completa su tutto, statue e priorità. Guarda il video.", tag: "GUIDA" }
  ],

  values: [
    { kanji: "誠", titolo: "Sincerità", testo: "Se non puoi più vincere, si nasconde e si gioca per il clan. Mai con un clan solo." },
    { kanji: "礼", titolo: "Cortesia", testo: "Si saluta, si ringrazia, si chiede scusa. Anche con chi non si parla più." },
    { kanji: "技", titolo: "Maestria", testo: "Il talento si allena. Ogni sera, 20 minuti di arena, e il talento diventa stile di vita." },
    { kanji: "友", titolo: "Fratellanza", testo: "Il clan non finisce alla schermata di fine partita: la chat è sempre aperta." },
    { kanji: "時", titolo: "Costanza", testo: "Non chiediamo presenza totale, chiediamo fedeltà. Chi c'è, c'è davvero." },
    { kanji: "継", titolo: "Tradizione", testo: "Ogni nuovo membro riceve il nome e la storia di chi è stato prima di lui." },
    { kanji: "軍", titolo: "Strategia", testo: "Studiamo le meta, condividiamo build, ci prepariamo. Vincere non è fortuna." },
    { kanji: "心", titolo: "Equilibrio", testo: "Gioco, studio, lavoro, vita. Il clan rispetta i tuoi tempi." }
  ],

  timeline: [
    { anno: "2019", titolo: "Il primo giuramento", testo: "Cinque amici, una stanza Discord e un nome scelto in una notte. Il clan nasce ufficialmente con 5 membri." },
    { anno: "2020", titolo: "Prima guerra di clan", testo: "Superiamo il nostro limite di 25 e otteniamo la nostra prima vittoria ufficiale contro un clan di Livello 4." },
    { anno: "2021", titolo: "La Sala dei Bushi", testo: "Creiamo la struttura a gradi che usiamo ancora oggi, con promozioni solo basate su presenza e rispetto." },
    { anno: "2023", titolo: "100 samurai", testo: "Raggiungiamo quota 100 membri attivi. Da quel momento entriamo nella Top 20 delle classifiche server." },
    { anno: "2025", titolo: "Il Codice scritto", testo: "Pubblichiamo per iscritto le 6 regole del clan. Da allora i nuovi membri leggono prima di entrare." },
    { anno: "2026", titolo: "Nuovo tempio", testo: "Nasce questo sito: la casa digitale del clan, aperta a chiunque voglia conoscerci." }
  ],

  credo: [
    "Non si bara mai, in nessuna circostanza.",
    "Non si compra e non si vende mai un account.",
    "Non si aggredisce fuori dal campo di battaglia.",
    "Non si abbandona un compagno in difficoltà.",
    "Non si mente sulla presenza al clan.",
    "Non si tradisce la parola data."
  ],

  faq: [
    { q: "Come si fa ad entrare nel clan?", a: "Clicca «Candidati» in questa pagina, compila il modulo con i tuoi dati Avakin reali e aspetta il messaggio del capitano. Rispondiamo entro 48 ore. Se sei Troppa ⋆ ⋆ ⋆ o superiore e ti trovi bene nel nostro modo di giocare, le probabilità sono alte." },
    { q: "Serve un livello minimo per candidarsi?", a: "Non un numero fisso, ma serve una spada star consolidata (Troppa ⋆ ⋆ ⋆ minimo) o un personaggio molto avanzato. Più la tua arma è forte, più è facile trovare un posto." },
    { q: "Il clan è gratis?", a: "Sì. Nessuna quota di iscrizione, nessun requisito di spesa. Vietiamo esplicitamente l'acquisto di account e l'uso di account multipli scorretti." },
    { q: "Quante ore a settimana servono?", a: "Non chiediamo presenza totale. Chiediamo fedeltà: chi entra, resta. In pratica 3-4 serate a settimana di raid e qualche evento al mese." },
    { q: "Si entra solo su server Europa?", a: "No, accogliamo membri da tutti i server e continenti. Ci coordiniamo sugli orari, e i raid continentali sono una tradizione del clan." },
    { q: "Avete un bot o un sistema automatizzato?", a: "Nessun bot: questo sito non si collega ai tuoi dati di gioco e non automatizza nulla. È una vetrina e un pannello personale, tutto in locale sul tuo dispositivo." }
  ],

  leaders: {
    leader: [
      { kanji: "✧", nome: "_e.i.l.i.d.h_", ruolo: "Leader", da: "Dal 2024" },
      { kanji: "✦", nome: "__aerith__life", ruolo: "Leader", da: "Dal 2024" }
    ],
    helperSupport: [
      { kanji: "盾", nome: "_xx__ian__xx_", ruolo: "Helper Support", da: "Dal 2024" },
      { kanji: "翼", nome: "ava_andre_00", ruolo: "Helper Support", da: "Dal 2024" }
    ],
    collaboratori: [
      { kanji: "刃", nome: "_sly.kid_", ruolo: "Collaboratore", da: "Dal 2024" },
      { kanji: "音", nome: "iammusic...", ruolo: "Collaboratore", da: "Dal 2024" }
    ]
  },

  gallery: [
    { id: "g4", cat: "events", titolo: "Torneo 2v2 — Finale", autore: "Raiden", data: "21 Set 2026", seed: 44, w: 1000, h: 700, comp: "torii" },
    { id: "g5", cat: "war", titolo: "Settore 4 assediato", autore: "Kazemaru", data: "18 Set 2026", seed: 61, w: 900, h: 900, comp: "moon" },
    { id: "g6", cat: "outfits", titolo: "Corazza d'argento", autore: "Miyamoto", data: "15 Set 2026", seed: 78, w: 900, h: 1150, comp: "waves" },
    { id: "g7", cat: "trophies", titolo: "Stemma del clan inciso", autore: "Studio interno", data: "12 Set 2026", seed: 90, w: 1000, h: 1000, comp: "crest" },
    { id: "g10", cat: "screenshots", titolo: "Schermata del Vault reale", autore: "Miyamoto", data: "02 Set 2026", seed: 131, w: 1000, h: 750, comp: "troppa" },
    { id: "g11", cat: "war", titolo: "Ultimo colpo del capitano", autore: "Raiden", data: "28 Ago 2026", seed: 145, w: 900, h: 1200, comp: "blade" },
    { id: "g12", cat: "outfits", titolo: "Mantello del Ronin", autore: "Kaede", data: "24 Ago 2026", seed: 162, w: 900, h: 1000, comp: "waves" },
    { id: "g13", cat: "events", titolo: "Cerimonia del nuovo Bushi", autore: "Kazemaru", data: "20 Ago 2026", seed: 174, w: 1000, h: 700, comp: "torii" },
    { id: "g14", cat: "trophies", titolo: "Cento samurai", autore: "Studio interno", data: "14 Ago 2026", seed: 188, w: 900, h: 1100, comp: "crest" }
  ],

  galleryCats: [
    { id: "all", label: "Tutte" },
    { id: "war", label: "Guerre" },
    { id: "trophies", label: "Trophies" },
    { id: "outfits", label: "Outfits" },
    { id: "events", label: "Eventi" },
    { id: "screenshots", label: "Screenshots" }
  ],

  videos: [
    {
      id: "v0", cat: "raid", dur: "—", seed: 0, w: 1000, h: 562, comp: "helmet",
      titolo: "Prima visione — isamu opening",
      desc: "Il primo video da vedere nella stagione corrente. Filmato originale del clan, riprodotto direttamente dal file.",
      fonte: { url: "/assets/videos/590424225b594398a70affa018d4e831.MOV" }
    },
    {
      id: "v1", cat: "raid", dur: "12:48", seed: 12, w: 1000, h: 562, comp: "helmet",
      titolo: "RAID NOTTURNO — Domina il settore 4",
      desc: "Sessione completa con analisi delle formazioni avversarie e il momento esatto in cui il comando si rompe. Registrato live con la chat del clan in sovrimpressione.",
      fonte: null
    },
    {
      id: "v2", cat: "guida", dur: "08:12", seed: 24, w: 1000, h: 562, comp: "troppa",
      titolo: "Guida completa: da Troppa ⋆ ⋆ ⋆ a Troppa ⋆ ⋆ ⋆ ⋆ ⋆",
      desc: "Il piano per salire di spada senza bruciare diamanti: statue, priorità, errori da evitare e l'ordine esatto delle spese.",
      fonte: null
    },
    {
      id: "v3", cat: "evento", dur: "05:30", seed: 38, w: 1000, h: 562, comp: "torii",
      titolo: "Torneo interno 2v2 — Le finali",
      desc: "Otto coppie, un vincitore. Le semifinali a eliminazione diretta con commento dal capitano.",
      fonte: null
    },
    {
      id: "v4", cat: "raid", dur: "14:02", seed: 51, w: 1000, h: 562, comp: "waves",
      titolo: "Asedio del Vault reale — Zero morti",
      desc: "Sei ore di assedio conclude con un giro perfetto. La rotazione dei tank e la gestione delle cure.",
      fonte: null
    },
    {
      id: "v5", cat: "dietro", dur: "07:45", seed: 66, w: 1000, h: 562, comp: "moon",
      titolo: "Dietro le quinte: come nasce un clan",
      desc: "Il 2019, una stanza Discord, cinque amici e una notte in cui si è scelto il nome. Raccontato da chi c'era.",
      fonte: null
    },
    {
      id: "v6", cat: "guida", dur: "06:18", seed: 82, w: 1000, h: 562, comp: "crest",
      titolo: "Le 6 regole del clan, spiegate una per una",
      desc: "Non sono regole severe. Sono il motivo per cui siamo ancora gli stessi dopo sette anni.",
      fonte: null
    },
    {
      id: "v7", cat: "evento", dur: "09:05", seed: 96, w: 1000, h: 562, comp: "blade",
      titolo: "Cerimonia di nomina dei nuovi Bushi",
      desc: "Il momento in cui un Ronin riceve il nome. Registrato per chi vuole capire cosa significa davvero.",
      fonte: null
    },
    {
      id: "v8", cat: "raid", dur: "10:44", seed: 112, w: 1000, h: 562, comp: "helmet",
      titolo: "Clan War 248 — Replay e strategia",
      desc: "Ogni nostro attacco, ogni nostra difesa, con l'analisi delle mosse che hanno cambiato l'esito.",
      fonte: null
    }
  ],

  videoCats: [
    { id: "all", label: "Tutti" },
    { id: "raid", label: "Raid" },
    { id: "guida", label: "Guide" },
    { id: "evento", label: "Eventi" },
    { id: "dietro", label: "Dietro le quinte" }
  ],

  roster: [
    { nome: "KENSHIN", ruolo: "Shogun", lvl: 50, spada: "Troppa ⋆ ⋆ ⋆ ⋆ ⋆", kanji: "剣", online: true, bio: "Maestro della lama silenziosa, guida il clan con onore e precisione." },
    { nome: "YAGAMI", ruolo: "Shogun", lvl: 50, spada: "Troppa ⋆ ⋆ ⋆ ⋆ ⋆", kanji: "闇", online: false, bio: "Stratega dell'ombra, domina il campo con tattiche implacabili." },
    { nome: "KAEDE", ruolo: "Bushi", lvl: 43, spada: "Troppa ⋆ ⋆ ⋆ ⋆", kanji: "楓", online: true, bio: "Guardiana del dojo, difende ogni compagno con fermezza." },
    { nome: "RAIDEN", ruolo: "Bushi", lvl: 47, spada: "Troppa ⋆ ⋆ ⋆ ⋆", kanji: "雷", online: true, bio: "Tuono in battaglia, primo a caricare e ultimo a cadere." },
    { nome: "ADMIN", ruolo: "Admin", lvl: 50, spada: "Troppa ⋆ ⋆ ⋆ ⋆ ⋆", kanji: "管", online: false, bio: "Custode del tempio digitale, mantiene ordine e pace." }
  ],

  accenti: [
    { name: "Blu Steel", hex: "#5aa8ff" },
    { name: "Cyan Gelido", hex: "#4fe3d2" },
    { name: "Indigo", hex: "#7b7bff" },
    { name: "Viola", hex: "#a873e6" },
    { name: "Viola Scuro", hex: "#8b52d1" },
    { name: "Viola Reale", hex: "#6d32b8" },
    { name: "Argento", hex: "#c9d8ee" },
    { name: "Rosso Sangue", hex: "#e0556b" }
  ],

  switchDefs: [
    { key: "motion", label: "Motion graphic", sub: "Animazioni di sfondo, particelle e lame", def: true },
    { key: "petals", label: "Petali di ciliegio", sub: "Sciroppo blu che cade sulla scena", def: true },
    { key: "grain", label: "Grain e griglia", sub: "Texture cinematografica sull'immagine", def: true },
    { key: "sound", label: "Suono interfaccia", sub: "Click e conferme in stile tamburo", def: false },
    { key: "notif", label: "Notifiche del clan", sub: "Avvisi su eventi e raid", def: true },
    { key: "compact", label: "Interfaccia compatta", sub: "Riduce spaziature e dimensioni", def: false }
  ],

  skills: [
    { nome: "Difesa con scudo", v: 92 },
    { nome: "Attacco in terapia", v: 78 },
    { nome: "Gestione risorse", v: 85 },
    { nome: "Lettura dell'arena", v: 71 },
    { nome: "Spirito di squadra", v: 96 }
  ],

  /* Fallback statici: il frontend usa questi dati solo se il server
     non risponde, cosi il sito resta leggibile anche in locale. */
  eventi: [
    {
      id: "fb-1",
      titolo: "Raid notturno — Settore 4",
      sommario: "Sessione coordinata su tutti i server. Presenza richiesta per i Bushi.",
      categoria: "raid",
      inizio: null,
      posti: 40,
      iscritti: 31,
      postiRimasti: 9,
      completo: false,
      iscritto: false
    },
    {
      id: "fb-2",
      titolo: "Torneo interno 2v2",
      sommario: "Otto coppie, eliminazione diretta, premio in diamanti per la coppia vincitrice.",
      categoria: "evento",
      inizio: null,
      posti: 16,
      iscritti: 16,
      postiRimasti: 0,
      completo: true,
      iscritto: false
    },
    {
      id: "fb-3",
      titolo: "Briefing strategia settimanale",
      sommario: "Analisi delle meta e delle build della settimana. Aperto a tutti i membri.",
      categoria: "guida",
      inizio: null,
      posti: 0,
      iscritti: 48,
      postiRimasti: null,
      completo: false,
      iscritto: false
    }
  ],

  classifica: [
    { posizione: 1, handle: "RAIDEN", nome: "Raiden", role: "bushi", level: 47, vittorie: 255, sconfitte: 49, raid: 121, ore: 1480, winRate: 84, traguardi: 9 },
    { posizione: 2, handle: "KAEDE", nome: "Kaede", role: "bushi", level: 43, vittorie: 214, sconfitte: 58, raid: 96, ore: 1240, winRate: 79, traguardi: 8 },
    { posizione: 3, handle: "MIYAMOTO", nome: "Miyamoto", role: "membro", level: 45, vittorie: 198, sconfitte: 71, raid: 88, ore: 1105, winRate: 74, traguardi: 7 },
    { posizione: 4, handle: "KAZEMARU", nome: "Kazemaru", role: "membro", level: 44, vittorie: 176, sconfitte: 52, raid: 80, ore: 980, winRate: 77, traguardi: 7 },
    { posizione: 5, handle: "TORU", nome: "Toru", role: "membro", level: 42, vittorie: 141, sconfitte: 66, raid: 64, ore: 860, winRate: 68, traguardi: 5 },
    { posizione: 6, handle: "HANA", nome: "Hana", role: "membro", level: 38, vittorie: 118, sconfitte: 63, raid: 52, ore: 720, winRate: 65, traguardi: 4 }
  ],

  raid: [
    { titolo: "Clan War 248 — Settore 4", categoria: "raid", esito: "vittoria", score: 191, avversario: "Ishin", data: null },
    { titolo: "Asedio del Vault reale", categoria: "raid", esito: "vittoria", score: 240, avversario: "Kurogane", data: null },
    { titolo: "Raid continentale", categoria: "raid", esito: "pareggio", score: 118, avversario: "Ronin Dojo", data: null },
    { titolo: "Torneo 2v2 — Semifinali", categoria: "evento", esito: "vittoria", score: 12, avversario: "Coppia Kaede/Toru", data: null },
    { titolo: "Clan War 247 — Difesa", categoria: "raid", esito: "sconfitta", score: 156, avversario: "Tempest", data: null }
  ],

  reactionDefs: [
    { emoji: "⚔", label: "Battaglia" },
    { emoji: "🔥", label: "Fuoco" },
    { emoji: "🎯", label: "Precisione" },
    { emoji: "侍", label: "Rispetto" },
    { emoji: "👑", label: "Reale" }
  ],

  tierLabels: {
    bronzo: "Bronzo",
    argento: "Argento",
    oro: "Oro"
  },

  /* ── Stagioni del Clan ── */
  seasons: [
    {
      id: "spring",
      nome: "Primavera",
      kanji: "春",
      icon: "🌸",
      desc: "Petali di ciliegio e rinnovamento. I samurai si addestrano nei dojo aperti.",
      color: "#E9D5FF",
      gradient: "linear-gradient(135deg, var(--fuji) 0%, var(--murasaki-light) 50%, var(--ayame) 100%)",
      particle: "#E9D5FF"
    },
    {
      id: "summer",
      nome: "Estate",
      kanji: "夏",
      icon: "☀️",
      desc: "Sole ardente e addestramento intenso. Le lame brillano sotto il sole di mezzogiorno.",
      color: "#F59E0B",
      gradient: "linear-gradient(135deg, var(--kin) 0%, var(--kogan) 50%, var(--hinoki) 100%)",
      particle: "#F59E0B"
    },
    {
      id: "autumn",
      nome: "Autunno",
      kanji: "秋",
      icon: "🍁",
      desc: "Foglie rosse e riflessione. I samurai onorano i caduti e si preparano per l'inverno.",
      color: "#A8835C",
      gradient: "linear-gradient(135deg, var(--hinoki) 0%, var(--kigumi) 50%, var(--akane) 100%)",
      particle: "#A8835C"
    },
    {
      id: "winter",
      nome: "Inverno",
      kanji: "冬",
      icon: "❄️",
      desc: "Neve silenziosa e meditazione. Le spade riposano nei foderi, lo spirito si affila.",
      color: "#CBE4F9",
      gradient: "linear-gradient(135deg, var(--mizugatte) 0%, var(--aizora) 50%, var(--yoru) 100%)",
      particle: "#CBE4F9"
    }
  ],

  /* ── Contenuto interattivo samurai ── */
  interactiveFeatures: [
    { id: "katana", titolo: "Forge della Katana", desc: "Personalizza la tua spada con incisioni e materiali.", icon: "⚔", kanji: "刃" },
    { id: "dojo", titolo: "Dojo di Meditazione", desc: "Allena i tuoi riflessi con kata tradizionali.", icon: "🧘", kanji: "道" },
    { id: "garden", titolo: "Giardino Zen", desc: "Rastrella la sabbia e trova l'equilibrio interiore.", icon: "🍃", kanji: "和" },
    { id: "torii", titolo: "Portale Torii", desc: "Attraversa il portale sacro del clan.", icon: "⛩", kanji: "門" },
    { id: "armor", titolo: "Armatura del Daimyo", desc: "Personalizza l'armatura con stemmi familiari.", icon: "🛡", kanji: "鎧" },
    { id: "scroll", titolo: "Rotoli Antichi", desc: "Leggi le tecniche segrete dei maestri del passato.", icon: "📜", kanji: "巻" }
  ],

  /* ── Achievement kanji ── */
  achievementKanji: {
    bronzo: "銅",
    argento: "銀",
    oro: "金"
  }
};
