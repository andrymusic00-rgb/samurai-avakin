(() => {
  const { $, $$, store, toast, openModal, closeModal, observe, countAll, setPanel, go } = UI;
  const artCache = new Map();

  const pic = (item) => {
    if (item.src) return item.src;
    if (item.fonte?.url) return item.thumb || "/assets/icons/icon-512.png";
    const key = `${item.seed}-${item.w}-${item.h}-${item.comp}`;
    if (!artCache.has(key)) artCache.set(key, ART.make(item));
    return artCache.get(key);
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const escapeHtml = esc;
  const num = (n) => {
    const v = Number(n);
    return Number.isFinite(v) ? v.toLocaleString("it-IT") : String(n ?? 0);
  };
  const revealScope = (scope) => {
    const root = scope && scope.nodeType ? scope : document;
    observe(root);
    UI.animateInside(root);
    countAll(root);
  };

  const MARQUEE = DATA.marquee.map((t) => `<span class="marquee-item"><i></i>${t}</span>`).join("");

  /* ── Seasonal system ── */
  let currentSeason = store.get("season", "spring");

  function setSeason(seasonId) {
    currentSeason = seasonId;
    store.set("season", seasonId);
    const theme = document.querySelector(".season-theme");
    if (theme) {
      theme.className = `season-theme ${seasonId}`;
    }
    document.querySelectorAll(".season-theme").forEach(el => {
      el.className = `season-theme ${seasonId}`;
    });
    document.body.className = document.body.className.replace(/season-\w+/g, "");
    document.body.classList.add(`season-${seasonId}`);
    document.querySelectorAll(".seasonal-particle").forEach(el => el.remove());
    spawnSeasonalParticles(seasonId);
    toast(`Stagione: ${DATA.seasons.find(s => s.id === seasonId).nome}`, "L'atmosfera del clan cambia con le stagioni.", "", 4000);
  }

  function spawnSeasonalParticles(seasonId) {
    const count = window.innerWidth < 700 ? 12 : 24;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = `seasonal-particle ${seasonId}`;
      p.style.left = Math.random() * 100 + "vw";
      p.style.top = Math.random() * 100 + "vh";
      p.style.animationDelay = Math.random() * 6 + "s";
      p.style.animationDuration = (4 + Math.random() * 4) + "s";
      document.body.appendChild(p);
    }
  }

  function renderSeasonSelector(containerId) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = `<div class="season-grid">${DATA.seasons.map(s => `
      <div class="season-card${currentSeason === s.id ? " active" : ""}" data-season="${s.id}" role="button" tabindex="0" aria-label="${s.nome}">
        <span style="font-size:2.4rem">${s.icon}</span>
        <span>${s.nome}</span>
      </div>`).join("")}</div>`;
    container.querySelectorAll(".season-card").forEach(card => {
      card.addEventListener("click", () => setSeason(card.dataset.season));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSeason(card.dataset.season); }
      });
    });
  }

  function renderHome() {
    $("#marqueeTrack").innerHTML = MARQUEE + MARQUEE;
    $("#statStrip").innerHTML = DATA.stats.map((s, i) => `
      <div class="stat glass-violet stat-violet border-glow" data-reveal="scale" style="--d:${i * 70}ms">
        <div class="stat-num" data-to="${s.num}"><span class="n">0</span><span class="suffix">${s.suffix}</span></div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-bar"><i data-w="${s.bar}"></i></div>
      </div>`).join("");

    $("#pillarsGrid").innerHTML = DATA.pillars.map((p, i) => `
      <article class="pillar glass-violet violet border-glow" data-kanji="${p.kanji}" data-reveal style="--d:${i * 80}ms">
        <div class="card-icon">${p.kanji}</div>
        <h3>${p.titolo}</h3>
        <p>${p.testo}</p>
        <div class="pillar-foot">◆ ${p.foot}</div>
      </article>`).join("");

    $("#ranksList").innerHTML = DATA.ranks.map((r, i) => `
      <div class="rank-row violet" data-reveal="right" style="--d:${i * 60}ms">
        <div class="rank-badge">${r.kanji}</div>
        <div class="rank-info"><b>${r.nome}</b><small>${r.ruolo}</small></div>
        <div class="rank-meter"><i data-w="${r.pct}"></i></div>
        <span class="mono" style="font-size:10px;color:var(--silver-600);width:34px;text-align:right">${r.pct}%</span>
      </div>`).join("");

    $("#newsList").innerHTML = DATA.news.map((n, i) => `
      <article class="news-item" data-reveal style="--d:${i * 70}ms" tabindex="0">
        <div class="news-date"><b>${n.giorno}</b><span>${n.mese}</span></div>
        <div class="news-body">
          <div class="row" style="gap:8px;margin-bottom:6px">
            <h4 style="margin:0">${n.titolo}</h4>
            <span class="tag violet" style="font-size:8px">${n.tag}</span>
          </div>
          <p>${n.testo}</p>
        </div>
      </article>`).join("");
  }

  function renderAbout() {
    $("#valuesGrid").innerHTML = DATA.values.map((v, i) => `
      <article class="card glass" data-reveal style="--d:${i * 55}ms">
        <div class="card-icon">${v.kanji}</div>
        <h3>${v.titolo}</h3>
        <p>${v.testo}</p>
      </article>`).join("");

    $("#timelineList").innerHTML = DATA.timeline.map((t) => `
      <div class="tl-item" data-reveal>
        <time>${t.anno}</time>
        <h4>${t.titolo}</h4>
        <p>${t.testo}</p>
      </div>`).join("");

    $("#credoList").innerHTML = DATA.credo.map((c) => `
      <li class="row" style="gap:12px;align-items:flex-start">
        <span style="color:var(--blue-300);font-size:.9rem">◆</span>
        <span style="color:var(--silver-300);font-size:.92rem">${c}</span>
      </li>`).join("");

    const leadersHtml = Object.entries(DATA.leaders).map(([category, leaders]) => {
      const categoryLabels = {
        leader: "Leader",
        helperSupport: "Helper & Support",
        collaboratori: "Collaboratori"
      };
      const categoryIcons = {
        leader: "⚔",
        helperSupport: "⛨",
        collaboratori: "✦"
      };
      return `
        <div class="leader-category" data-reveal>
          <div class="leader-category-head">
            <span class="leader-category-icon">${categoryIcons[category] || "◆"}</span>
            <h3 class="leader-category-title">${categoryLabels[category] || category}</h3>
          </div>
          <div class="grid g-auto-lg leader-category-grid">
            ${leaders.map((l, i) => `
               <article class="leader glass" data-leader="${esc(l.nome)}" data-reveal style="--d:${i * 70}ms">                <div class="leader-av">${l.kanji}</div>
                <b>${l.nome}</b>
                <small>${l.ruolo}</small>
                <span class="tag silver" style="margin-top:4px">${l.da}</span>
              </article>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

     $("#leaderGrid").innerHTML = leadersHtml;
     $("#leaderGrid").addEventListener("click", (e) => {
       const c = e.target.closest("[data-leader]");
       if (!c) return;
       const name = c.dataset.leader;
       let l = null;
       Object.values(DATA.leaders).forEach((arr) => { const f = arr.find((x) => x.nome === name); if (f) l = f; });
       if (!l) return;
       const m = document.getElementById("memberModal");
       if (!m) return;
       document.getElementById("memberModalName").textContent = l.nome;
       document.getElementById("memberModalRole").textContent = `${l.ruolo}`;
       document.getElementById("memberModalDesc").textContent = l.da || "";
       document.getElementById("memberModalImg").innerHTML = `<span class="kanji" style="font-size:4rem">${l.kanji}</span>`;
       m.style.display = "flex";
     });
   }

  let gItems = [], gFilter = "all", gRemote = [];

  /**
   * Le foto arrivano da due fonti diverse:
   *  - il server, con `id/createdAt/filename`
   *  - il localStorage, con `src/name` in base64
   * Le normalizziamo qui per non duplicare la logica piu' avanti.
   */
  const toItem = (u, i, prefix) => ({
    id: u.id ? `${prefix}${u.id}` : `${prefix}${i}`,
    cat: "personali",
    titolo: u.filename || u.name || "Foto personale",
    autore: "Tu",
    data: u.createdAt ? new Date(u.createdAt).toLocaleDateString("it-IT") : "Oggi",
    src: u.url || u.src,
    w: 900,
    h: 900,
    comp: "crest",
    ref: u
  });

  function gAll() {
    const local = !Account?.authed
      ? store.get("uploads", []).map((u, i) => toItem(u, i, "l"))
      : [];
    const remote = gRemote.map((u, i) => toItem(u, i, "r"));
    return [...gItems, ...remote, ...local].filter((g) => g.src);
  }

  function renderGallery() {
    $("#galleryFilters").innerHTML = DATA.galleryCats.map((c) =>
      `<button class="chip${c.id === "all" ? " is-active" : ""}" data-cat="${c.id}">${c.label}</button>`).join("") +
      `<button class="chip" data-cat="personali">Le mie foto</button>`;

    gItems = DATA.gallery.map((g) => ({ ...g, src: pic(g) }));
    paintGallery();
    document.addEventListener("sam:uploads", (e) => {
      const detail = e.detail;
      if (Array.isArray(detail)) {
        // Il server manda upload gia' salvati: accodali.
        const known = new Set(gRemote.map((u) => u.url || u.src));
        detail.filter((u) => u.url || u.src).forEach((u) => { if (!known.has(u.url || u.src)) gRemote.push(u); });
      }
      paintGallery();
      applyFilter(gFilter);
    });
  }

  function paintGallery() {
    const all = gAll();
    const grid = $("#galleryGrid");
    if (!grid) return;
    grid.innerHTML = all.map((g) => `
      <figure class="gal-item" data-cat="${g.cat}" data-id="${g.id}" tabindex="0" role="button" aria-label="${esc(g.titolo)}">
        <img loading="lazy" src="${g.src}" alt="${esc(g.titolo)}" width="${g.w}" height="${g.h}" onerror="this.src='/assets/icons/icon-512.png';this.onerror=null;">
        <span class="gal-zoom" aria-hidden="true">⤢</span>
        <figcaption class="gal-overlay">
          <small>${String(g.cat).toUpperCase()}</small>
          <b>${esc(g.titolo)}</b>
          <small>${esc(g.autore)} · ${g.data}</small>
        </figcaption>
      </figure>`).join("");
    applyFilter(gFilter);
    revealScope(grid);
  }

  function applyFilter(cat) {
    gFilter = cat;
    let shown = 0;
    $$("#galleryGrid .gal-item").forEach((el) => {
      const show = cat === "all" || el.dataset.cat === cat;
      el.classList.toggle("is-hidden", !show);
      if (show) shown++;
    });
    const ups = gAll().filter((g) => g.cat === "personali").length;
    $("#galleryCount").textContent =
      `${shown} ${shown === 1 ? "immagine" : "immagini"} mostrate · ${gAll().length} in totale${ups ? ` · ${ups} tue` : ""}`;
  }

  let lbList = [], lbIdx = 0;
  let creativeVideos = []; // video caricati dagli utenti (tipo video da /api/creative)

  async function loadCreativeVideos() {
    try {
      const r = await API.get("/api/creative?tipo=video&limit=24");
      creativeVideos = (r.post ?? []).map((p) => ({
        id: "cv-" + p.id,
        titolo: p.titolo,
        desc: p.corpo,
        dur: "—",
        cat: "creativo",
        fonte: { url: p.mediaUrl },
        autore: p.autore,
        creatoIl: p.creatoIl,
        likes: p.likes,
        commenti: p.commenti
      }));
    } catch {
      creativeVideos = [];
    }
  }

  /* ── Video caricati dall'utente (IndexedDB locale) ── */
  let userVideos = [];

  function videoDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("SamuraiVideoDB", 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("videos")) db.createObjectStore("videos", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadUserVideos() {
    try {
      const db = await videoDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(["videos"], "readonly");
        const store = tx.objectStore("videos");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async function saveUserVideo(video) {
    const db = await videoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["videos"], "readwrite");
      const store = tx.objectStore("videos");
      const req = store.put(video);
      req.onsuccess = () => resolve(video);
      req.onerror = () => reject(req.error);
    });
  }

  function generateThumb(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const el = document.createElement("video");
      el.preload = "metadata";
      el.src = url;
      el.onloadedmetadata = () => { el.currentTime = Math.min(1, el.duration * 0.15); };
      el.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(el, 0, 0, 320, 180);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
        URL.revokeObjectURL(url);
      };
      el.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    });
  }

  /* ── Samurai Video Post (stile gallery, ma per video) ── */
  let videoPosts = [];

  function videoPostDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("SamuraiVideoDB", 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("videoposts")) db.createObjectStore("videoposts", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadVideoPosts() {
    try {
      const db = await videoPostDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(["videoposts"], "readonly");
        const store = tx.objectStore("videoposts");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async function saveVideoPost(post) {
    const db = await videoPostDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["videoposts"], "readwrite");
      const store = tx.objectStore("videoposts");
      const req = store.put(post);
      req.onsuccess = () => resolve(post);
      req.onerror = () => reject(req.error);
    });
  }

  function makeReactions() {
    const r = {};
    (DATA.reactionDefs || []).forEach((d) => { r[d.emoji] = 0; });
    return r;
  }

  async function createVideoPost(video) {
    const post = {
      id: "vp-" + Date.now(),
      videoId: video.id,
      titolo: video.titolo,
      desc: video.desc,
      cat: video.cat,
      autore: video.autore || "Tu",
      creatoIl: video.creatoIl || new Date().toISOString(),
      thumb: video.thumb,
      videoUrl: video.fonte?.url || null,
      visualizzazioni: 0,
      like: 0,
      miaReazione: false,
      reazioni: makeReactions(),
      commenti: []
    };
    await saveVideoPost(post);
    videoPosts.unshift(post);
    return post;
  }

  async function toggleLike(postId) {
    const post = videoPosts.find((p) => p.id === postId);
    if (!post) return;
    post.like = post.like + 1;
    await saveVideoPost(post);
    renderVideoPosts();
  }

  async function toggleReaction(postId, emoji) {
    const post = videoPosts.find((p) => p.id === postId);
    if (!post) return;
    post.miaReazione = !post.miaReazione;
    if (post.miaReazione) post.reazioni[emoji] = (post.reazioni[emoji] || 0) + 1;
    else if ((post.reazioni[emoji] || 0) > 0) post.reazioni[emoji] -= 1;
    await saveVideoPost(post);
    renderVideoPosts();
  }

  async function addComment(postId, testo) {
    const post = videoPosts.find((p) => p.id === postId);
    if (!post || !testo.trim()) return;
    post.commenti.push({ autore: "Tu", testo: testo.trim(), data: new Date().toISOString() });
    await saveVideoPost(post);
    renderVideoPosts();
  }

  async function incrementViews(postId) {
    const post = videoPosts.find((p) => p.id === postId);
    if (!post) return;
    post.visualizzazioni = (post.visualizzazioni || 0) + 1;
    await saveVideoPost(post);
  }

  function renderVideoPosts() {
    const grid = $("#videoGridPosts");
    if (!grid) return;
    if (!videoPosts.length) {
      grid.innerHTML = `<div class="empty-state" style="text-align:center;padding:40px 20px"><span style="font-size:2rem">📜</span><h3>Nessun post video ancora</h3><p>Carica un video e pubblicalo come post del clan.</p></div>`;
      return;
    }
    grid.innerHTML = videoPosts.map((p, i) => {
      const totaleReazioni = Object.values(p.reazioni || {}).reduce((a, b) => a + b, 0);
      return `
        <article class="vp-card" data-vpid="${p.id}" data-reveal style="--d:${i * 50}ms" tabindex="0">
          <div class="vp-thumb" style="aspect-ratio:16/9;background:#01030a;position:relative;overflow:hidden;border-radius:12px">
            ${p.videoUrl ? `<video src="${esc(p.videoUrl)}" muted playsinline class="vp-preview" style="width:100%;height:100%;object-fit:cover;display:block"></video>` : `<img src="${esc(p.thumb || "/assets/icons/icon-512.png")}" alt="${esc(p.titolo)}" style="width:100%;height:100%;object-fit:cover;display:block">`}
            <div class="vp-seal" style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,.55);color:#5aa8ff;border:1px solid rgba(90,168,255,.45);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:1.25rem">侍</div>
            <div class="vp-play" style="position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s">
              <div style="background:var(--accent-violet,#5aa8ff);width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#01030a;box-shadow:0 0 20px rgba(90,168,255,.5)">▶</div>
            </div>
          </div>
          <div class="vp-body" style="padding:12px 10px 8px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
              <span class="tag silver" style="font-size:.75rem">${(p.cat || "video").toUpperCase()}</span>
              <span class="mono" style="font-size:.7rem;color:var(--silver-600)">${p.visualizzazioni} visualizz.</span>
            </div>
            <h4 style="margin:0 0 6px;color:var(--silver-100);font-size:1rem">${esc(p.titolo)}</h4>
            <p style="color:var(--silver-400);font-size:.82rem;margin:0 0 8px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.desc || "")}</p>
            <div class="vp-actions" style="display:flex;gap:10px;align-items:center">
              <button class="vp-btn" data-action="vplike" data-vpid="${p.id}" title="Like" style="flex:1;display:flex;align-items:center;gap:6px;justify-content:center"><span>⚔</span><span style="font-size:.75rem">${p.like}</span></button>
              <button class="vp-btn" data-action="vpreact" data-vpid="${p.id}" title="Reazione" style="flex:1;display:flex;align-items:center;gap:6px;justify-content:center"><span>🔥</span><span style="font-size:.75rem">${totaleReazioni}</span></button>
              <button class="vp-btn" data-action="vpcomment" data-vpid="${p.id}" title="Commenti" style="flex:1;display:flex;align-items:center;gap:6px;justify-content:center"><span>💬</span><span style="font-size:.75rem">${(p.commenti || []).length}</span></button>
            </div>
            <div class="vp-reazioni" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
              ${Object.entries(p.reazioni || {}).map(([emoji, conta]) => conta > 0 ? `<span class="vp-reaction" title="${emoji}">${emoji} <span style="font-size:.7rem">${conta}</span></span>` : "").join("")}
            </div>
            <div class="vp-commenti" style="margin-top:6px;display:none;flex-direction:column;gap:4px">
              <input type="text" id="vpcomment-input-${p.id}" placeholder="Scrivi un commento…" style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--silver-700);background:#0b0f1a;color:var(--silver-100);font-size:.8rem">
              <button class="vp-btn vp-send" data-action="vpsend" data-vpid="${p.id}" style="width:100%;padding:6px;background:var(--accent-violet,#5aa8ff);color:#01030a;border:none;border-radius:8px;font-weight:700;font-size:.8rem">Invia</button>
              <div class="vp-lista-commenti" style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
                ${(p.commenti || []).slice(-3).map((c) => `<div style="font-size:.78rem;color:var(--silver-300);padding:4px 8px;background:rgba(255,255,255,.04);border-radius:6px"><b style="color:var(--silver-100)">${esc(c.autore)}:</b> ${esc(c.testo)}</div>`).join("")}
              </div>
            </div>
          </div>
        </article>`;
    }).join("");
    grid.querySelectorAll(".vp-preview").forEach((v) => { v.muted = true; v.loop = true; v.play().catch(() => {}); });
    bindVideoPostActions();
    revealScope(grid);
  }

  function bindVideoPostActions() {
    document.querySelectorAll(".vp-btn[data-action=vplike]").forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); toggleLike(b.dataset.vpid); };
    });
    document.querySelectorAll(".vp-btn[data-action=vpreact]").forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); const p = videoPosts.find((x) => x.id === b.dataset.vpid); if (p) toggleReaction(b.dataset.vpid, Object.keys(p.reazioni || {})[0] || "🔥"); };
    });
    document.querySelectorAll(".vp-btn[data-action=vpcomment]").forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); const box = document.getElementById("vpcomment-input-" + b.dataset.vpid); const area = box.parentElement.querySelector(".vp-commenti"); if (area) area.style.display = area.style.display === "flex" ? "none" : "flex"; };
    });
    document.querySelectorAll(".vp-btn.vp-send").forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); const pid = b.dataset.vpid; const input = document.getElementById("vpcomment-input-" + pid); if (input && input.value.trim()) { addComment(pid, input.value); input.value = ""; } };
    });
    document.querySelectorAll(".vp-card").forEach((card) => {
      card.onclick = (e) => {
        if (e.target.closest(".vp-btn")) return;
        const pid = card.dataset.vpid;
        const post = videoPosts.find((p) => p.id === pid);
        if (!post) return;
        incrementViews(pid);
        openVideoPost(post);
      };
    });
  }

  function openVideoPost(post) {
    $("#vmTitle").textContent = post.titolo;
    $("#vmDesc").textContent = post.desc || "Condiviso da " + post.autore;
    $("#vmCat").textContent = (post.cat || "VIDEO").toUpperCase();
    $("#vmDur").textContent = "--:--";
    const wrap = $("#playerWrap");
    wrap.innerHTML = `
      <div class="vid-player-creativo" style="width:100%;height:100%;background:#060812;display:flex;align-items:center;justify-content:center;position:relative">
        <video controls style="max-width:100%;max-height:70vh;border-radius:12px;background:#01030a">
          <source src="${esc(post.videoUrl || "")}" type="video/mp4">
          Il tuo browser non supporta la riproduzione video.
        </video>
        ${post.videoUrl ? `` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--silver-500);font-size:.9rem">Video non disponibile</div>`}
      </div>
      <div style="margin-top:16px;display:flex;gap:10px">
        <button class="btn btn-violet" onclick="toggleLikeVP('${post.id}')" style="flex:1;padding:10px;border-radius:10px">⚔ Mi piace <span id="vpmlike-${post.id}">${post.like}</span></button>
        <button class="btn btn-ghost" onclick="toggleReactionVP('${post.id}')" style="flex:1;padding:10px;border-radius:10px">🔥 Reagisci</button>
      </div>
      <div style="margin-top:12px">
        <strong style="color:var(--silver-100)">Reazioni:</strong>
        <div id="vpmreazioni-${post.id}" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>
      <div style="margin-top:12px">
        <strong style="color:var(--silver-100)">Commenti</strong>
        <input type="text" id="vpmcomment-${post.id}" placeholder="Scrivi un commento…" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid var(--silver-700);background:#0b0f1a;color:var(--silver-100);margin-top:6px">
        <button class="btn btn-violet btn-sm" onclick="sendCommentVP('${post.id}')" style="margin-top:6px;padding:6px 16px;border-radius:10px">Invia</button>
        <div id="vpmlista-${post.id}" style="margin-top:8px;display:flex;flex-direction:column;gap:5px"></div>
      </div>`;
    renderPostMeta(post.id);
    openModal("videoModal");
  }

  window.toggleLikeVP = async (pid) => { await toggleLike(pid); renderPostMeta(pid); };
  window.toggleReactionVP = async (pid) => { const p = videoPosts.find((x) => x.id === pid); if (p) { await toggleReaction(pid, Object.keys(p.reazioni || {})[0] || "🔥"); renderPostMeta(pid); } };
  window.sendCommentVP = async (pid) => { const input = document.getElementById("vpmcomment-" + pid); if (input && input.value.trim()) { await addComment(pid, input.value); input.value = ""; renderPostMeta(pid); } };

  async function renderPostMeta(pid) {
    const post = videoPosts.find((p) => p.id === pid);
    if (!post) return;
    const likeBtn = document.getElementById("vpmlike-" + pid);
    if (likeBtn) likeBtn.innerHTML = "⚔ Mi piace <span>" + post.like + "</span>";
    const reazioniEl = document.getElementById("vpmreazioni-" + pid);
    if (reazioniEl) reazioniEl.innerHTML = Object.entries(post.reazioni || {}).map(([emoji, conta]) => conta > 0 ? `<span style="font-size:1.1rem">${emoji} <span style="font-size:.75rem;color:var(--silver-500)">${conta}</span></span>` : "").join("");
    const listaEl = document.getElementById("vpmlista-" + pid);
    if (listaEl) listaEl.innerHTML = (post.commenti || []).slice(-5).map((c) => `<div style="font-size:.82rem;color:var(--silver-300);padding:4px 10px;background:rgba(255,255,255,.04);border-radius:6px"><b style="color:var(--silver-100)">${esc(c.autore)}:</b> ${esc(c.testo)}</div>`).join("");
  }

  function openVideoUpload() {
    const modal = $("#videoUploadModal");
    if (!modal) return;
    resetUploadForm();
    modal.classList.add("is-open");
    $("#vuFile").focus();
  }

  function resetUploadForm() {
    $("#vuFile").value = "";
    $("#vuTitolo").value = "";
    $("#vuCategoria").value = "";
    $("#vuDesc").value = "";
    $("#vuPreview").style.display = "none";
    $("#vuVideoPreview").src = "";
    $("#vuStatus").textContent = "";
    $("#vuCarica").disabled = false;
    $("#vuDropzone").style.borderColor = "var(--silver-600)";
    $("#vuDropzone").style.background = "#0b0f1a";
  }

  function renderVideoGridOnly(list, gridId, emptyText) {
    const grid = $("#" + gridId);
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="text-align:center;padding:40px 20px"><span style="font-size:2rem">🎬</span><h3>${emptyText}</h3></div>`;
      return;
    }
    grid.innerHTML = list.map((v, i) => {
      const mio = v.id.startsWith("uv-");
      return `
        <article class="vid-card${mio ? " vid-card-mio" : " vid-card-creativo"}" data-vid="${v.id}" data-reveal style="--d:${i * 60}ms" tabindex="0">
          <div class="vid-thumb${mio ? " vid-thumb-mio" : " vid-thumb-creativo"}" style="aspect-ratio:16/9;background:${mio ? "#01030a" : "transparent"}">
            ${mio ? `<img src="${v.thumb || "/assets/icons/icon-512.png"}" alt="${esc(v.titolo)}" loading="lazy" style="width:100%;height:100%;object-fit:cover"><span class="vid-play-badge">▶</span>` : `<span class="vid-play-badge">▶</span><span class="vid-placeholder">${v.autore?.nome || v.autore?.handle}</span>`}
          </div>
          <div class="vid-meta">
            <b>${esc(v.titolo)}</b>
            <small style="color:var(--silver-500)">${esc(v.desc.slice(0, 72))}…</small>
            <div class="row" style="gap:6px;margin-top:6px">
              <span class="tag silver">${(v.cat || "video").toUpperCase()}</span>
              ${mio ? `<span class="tag silver">Tuo</span>` : `<span class="tag silver">${num(v.likes ?? 0)} ⚔</span>`}
            </div>
          </div>
        </article>`;
    }).join("");
    revealScope(grid);
  }

  function openLightbox(id) {
    lbList = gAll().filter((g) => gFilter === "all" || g.cat === gFilter || (gFilter === "personali" && g.cat === "personali"));
    lbIdx = Math.max(0, lbList.findIndex((g) => g.id === id));
    paintLightbox();
    openModal("lightbox");
  }

  function paintLightbox() {
    const g = lbList[lbIdx];
    if (!g) return;
    $("#lbImg").src = g.src;
    $("#lbImg").alt = g.titolo;
    $("#lbTitle").textContent = g.titolo;
    $("#lbMeta").textContent = `${g.autore} · ${g.data} · ${(g.cat || "").toUpperCase()}`;
    $("#lbCount").textContent = `${lbIdx + 1} / ${lbList.length}`;
    $("#lbThumbs").innerHTML = lbList.map((x, i) =>
      `<img src="${x.src}" class="${i === lbIdx ? "is-on" : ""}" data-lb="${i}" alt="${esc(x.titolo)}" loading="lazy">`).join("");
  }

  function step(d) {
    lbIdx = (lbIdx + d + lbList.length) % lbList.length;
    paintLightbox();
  }

  async function renderVideos() {
    await loadCreativeVideos();
    await loadUserVideos();
    videoPosts = await loadVideoPosts();
    // Integra video creativi server come post visibili (senza duplicare post locali)
    const known = new Set(videoPosts.map((p) => p.id || p.videoId));
    creativeVideos.forEach((cv) => {
      const id = "cvp-" + cv.id;
      if (known.has(id)) return;
      videoPosts.push({
        id,
        videoId: cv.id,
        titolo: cv.titolo,
        desc: cv.desc || "",
        cat: "creativo",
        autore: cv.autore?.nome || cv.autore?.handle || "Clan",
        creatoIl: cv.creatoIl || new Date().toISOString(),
        thumb: null,
        videoUrl: cv.fonte?.url || null,
        visualizzazioni: 0,
        like: cv.likes || 0,
        miaReazione: false,
        reazioni: makeReactions(),
        commenti: []
      });
    });
    const [feat, ...rest] = DATA.videos.map((v) => ({ ...v, thumb: pic(v) }));

    $("#vidFeatured").innerHTML = `
      <div class="vid-thumb" data-vid="${feat.id}">
        <img src="${feat.thumb}" alt="${esc(feat.titolo)}" loading="lazy">
        <div class="vid-play">
          <div class="vid-play-btn">▶</div>
          <span class="vid-dur">${feat.dur}</span>
        </div>
      </div>
      <div class="vid-featured-info">
        <span class="eyebrow">In evidenza</span>
        <h3 style="font-family:var(--ff-display);font-size:clamp(1.3rem,2.4vw,1.9rem);color:var(--silver-100);line-height:1.15">${esc(feat.titolo)}</h3>
        <p style="color:var(--silver-400);font-size:.92rem">${esc(feat.desc)}</p>
        <div class="row">
          <button class="btn btn-primary" data-vid="${feat.id}">Riproduci ora</button>
          <span class="tag">${feat.cat.toUpperCase()}</span>
        </div>
      </div>`;

    $("#videoFilters").innerHTML = DATA.videoCats.map((c, i) =>
      `<button class="chip${i === 0 ? " is-active" : ""}" data-vcat="${c.id}">${c.label}</button>`).join("") +
      `<button class="chip btn-ghost" id="btnVideoCatCreativi">Creatività</button>` +
      `<button class="chip btn-ghost" id="btnVideoCatMiei">I miei video</button>` +
      `<button class="chip btn-ghost" id="btnVideoCatPost">Post</button>` +
      `<button class="btn btn-violet btn-sm" id="btnCaricaVideo" style="margin-left:auto">+ Carica il tuo video</button>`;

    const creativiHtml = creativeVideos.length
      ? `<section class="vid-section" style="margin-top:44px">
           <span class="eyebrow violet" style="display:block;margin-bottom:10px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase">Video del clan</span>
           <div class="video-grid" id="videoGridCreativi"></div>
         </section>`
      : "";

    const mieiHtml = userVideos.length
      ? `<section class="vid-section" style="margin-top:44px">
           <span class="eyebrow violet" style="display:block;margin-bottom:10px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase">I tuoi video</span>
           <div class="video-grid" id="videoGridMiei"></div>
         </section>`
      : "";

    const postHtml = `<section class="vid-section" id="videoPostsSection" style="margin-top:44px">
           <span class="eyebrow violet" style="display:block;margin-bottom:10px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase">Post video del clan</span>
           <p class="mono" style="font-size:.8rem;color:var(--silver-500);margin:0 0 12px">Pubblica un tuo video come post: apparirà qui con like, reazioni e commenti.</p>
           <div class="video-grid" id="videoGridPosts"></div>
         </section>`;

    const videoGrid = $("#videoGrid");
    if (videoGrid) videoGrid.innerHTML = rest.map((v, i) => `
      <article class="vid-card" data-vcat="${v.cat}" data-vid="${v.id}" data-reveal style="--d:${i * 60}ms" tabindex="0">
        <div class="vid-thumb">
          <img src="${v.thumb}" alt="${esc(v.titolo)}" loading="lazy">
          <div class="vid-play"><div class="vid-play-btn">▶</div><span class="vid-dur">${v.dur}</span></div>
        </div>
        <div class="vid-meta">
          <b>${esc(v.titolo)}</b>
          <small>${esc(v.desc.slice(0, 72))}…</small>
          <span class="tag" style="align-self:flex-start;margin-top:4px">${v.cat.toUpperCase()}</span>
        </div>
      </article>`).join("") + creativiHtml + mieiHtml + postHtml;

    if (videoPosts.length) {
      renderVideoPosts();
    }

    if (creativeVideos.length) {
      const cg = $("#videoGridCreativi");
      if (cg) cg.innerHTML = creativeVideos.map((v, i) => `
        <article class="vid-card vid-card-creativo" data-vid="${v.id}" data-reveal style="--d:${i * 60}ms" tabindex="0">
          <div class="vid-thumb vid-thumb-creativo" style="aspect-ratio:16/9">
            <span class="vid-play-badge">▶</span>
            <span class="vid-placeholder">${v.autore?.nome || v.autore?.handle}</span>
          </div>
          <div class="vid-meta">
            <b>${esc(v.titolo)}</b>
            <small style="color:var(--silver-500)">${esc(v.autore?.handle)} · Lv ${v.autore?.level ?? 1}</small>
            <div class="row" style="gap:6px;margin-top:6px">
              <span class="tag silver">${num(v.likes)} ⚔</span>
              <span class="tag silver">${num(v.commenti)} 💬</span>
            </div>
          </div>
        </article>`).join("");
      if (cg) revealScope(cg);
    }

    if (userVideos.length) {
      const mg = $("#videoGridMiei");
      if (mg) mg.innerHTML = userVideos.map((v, i) => `
        <article class="vid-card vid-card-mio" data-vid="${v.id}" data-reveal style="--d:${i * 60}ms" tabindex="0">
          <div class="vid-thumb vid-thumb-mio" style="aspect-ratio:16/9;background:#01030a">
            <img src="${v.thumb || "/assets/icons/icon-512.png"}" alt="${esc(v.titolo)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
            <span class="vid-play-badge">▶</span>
          </div>
          <div class="vid-meta">
            <b>${esc(v.titolo)}</b>
            <small style="color:var(--silver-500)">${esc(v.desc.slice(0, 72))}…</small>
            <div class="row" style="gap:6px;margin-top:6px">
              <span class="tag silver">${v.cat.toUpperCase()}</span>
              <span class="tag silver">Tuo</span>
            </div>
          </div>
        </article>`).join("");
      if (mg) revealScope(mg);
    }
    if (videoGrid) revealScope(videoGrid);
  }

  function playVideo(id) {
    // Video creativi caricati dagli utenti
    const cv = creativeVideos.find((x) => x.id === id);
    if (cv) {
      $("#vmTitle").textContent = cv.titolo;
      $("#vmDesc").textContent = cv.desc || "Condiviso da " + (cv.autore?.nome || cv.autore?.handle);
      $("#vmCat").textContent = "CREATIVO";
      $("#vmDur").textContent = cv.dur;
      const wrap = $("#playerWrap");
      wrap.innerHTML = `
        <div class="vid-player-creativo" style="width:100%;height:100%;background:#060812;display:flex;align-items:center;justify-content:center">
          <video controls style="max-width:100%;max-height:80vh;border-radius:12px;background:#01030a">
            <source src="${esc(cv.fonte?.url || "")}" type="video/mp4">
            Il tuo browser non supporta la riproduzione video. Scarica il file per vederlo.
          </video>
        </div>`;
      openModal("videoModal");
      return;
    }

    const vp = videoPosts.find((x) => x.id === id);
    if (vp) { openVideoPost(vp); return; }

    const uv = userVideos.find((x) => x.id === id);
    if (uv) {
      $("#vmTitle").textContent = uv.titolo;
      $("#vmDesc").textContent = uv.desc || "Condiviso da te";
      $("#vmCat").textContent = (uv.cat || "video").toUpperCase();
      $("#vmDur").textContent = uv.dur || "--:--";
      const wrap = $("#playerWrap");
      wrap.innerHTML = `
        <div class="vid-player-creativo" style="width:100%;height:100%;background:#060812;display:flex;align-items:center;justify-content:center">
          <video controls style="max-width:100%;max-height:80vh;border-radius:12px;background:#01030a">
            <source src="${esc(uv.fonte?.url || "")}" type="video/mp4">
            Il tuo browser non supporta la riproduzione video. Scarica il file per vederlo.
          </video>
        </div>`;
      openModal("videoModal");
      return;
    }

    const v = DATA.videos.find((x) => x.id === id);
    if (!v) return;
    $("#vmTitle").textContent = v.titolo;
    $("#vmDesc").textContent = v.desc;
    $("#vmCat").textContent = v.cat.toUpperCase();
    $("#vmDur").textContent = v.dur;
    const wrap = $("#playerWrap");
    if (v.fonte && v.fonte.url) {
      wrap.innerHTML = `
        <div class="vid-player-creativo" style="width:100%;height:100%;background:#060812;display:flex;align-items:center;justify-content:center">
          <video controls style="max-width:100%;max-height:80vh;border-radius:12px;background:#01030a">
            <source src="${esc(v.fonte.url)}" type="video/mp4">
            Il tuo browser non supporta la riproduzione video. Scarica il file per vederlo.
          </video>
        </div>`;
      openModal("videoModal");
      return;
    }
    if (v.fonte && v.fonte.youtube) {
      wrap.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v.fonte.youtube}?autoplay=1&rel=0" title="${esc(v.titolo)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      wrap.innerHTML = `
        <div class="player-fallback">
          <div class="scan" aria-hidden="true"></div>
          <span class="kanji">${v.cat === "raid" ? "戦" : v.cat === "guida" ? "道" : v.cat === "evento" ? "門" : "影"}</span>
          <h4>${esc(v.titolo)}</h4>
          <p>Il file video non è ancora stato caricato. Questo player è pronto: basta
             aggiungere l'URL del video in <code>assets/js/data.js</code> (campo <code>fonte.youtube</code>)
             e comparirà qui, incorporato e pronto alla riproduzione.</p>
          <div class="row" style="justify-content:center">
            <span class="tag">Durata ${v.dur}</span>
            <span class="tag silver">4K pronto</span>
            <span class="tag silver">Audio ON</span>
          </div>
        </div>`;
    }
    openModal("videoModal");
  }

  const ROUTES = ["home", "chi-siamo", "eventi", "gallery", "video", "blog", "classifica", "comando", "account"];

  function navigate() {
    const raw = (location.hash.replace("#/", "") || "home").split("?")[0];
    let view = ROUTES.includes(raw) ? raw : "home";
    if (view === "comando" && !Account.isCommand) {
      view = "home";
      // Il ruolo arriva dal server dopo il primo render: se l'URL resta su
      // #/comando il link sembra funzionare e il refresh lo riaprirebbe.
      history.replaceState(null, "", "#/home");
    }
    $$(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === view));
    $$(".nav-link").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === view));
    $("#nav").classList.remove("is-open");
    $("#btnMenu").setAttribute("aria-expanded", "false");
    document.title = `Samurai di Avakin — ${DATA.nav.find((n) => n.id === view).label}`;
    if (view === "account") { Account.fillForm(); Account.renderBadge(); Account.renderSessions(); }
    Views.onRoute(view);
    if (view === "video") renderVideos().catch((err) => console.warn("[Samurai] renderVideos:", err));
    const scope = $(`#view-${view}`) || document;
    observe(scope);
    UI.animateInside(scope);
    countAll(scope);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      observe(scope);
      UI.animateInside(scope);
      countAll(scope);
    });
  }


  function bind() {
    window.addEventListener("hashchange", navigate);

    // Il ruolo salvato in locale può essere più permissivo di quello reale:
    // quando il server conferma la sessione, la vista Comando va rivalutata.
    document.addEventListener("sam:route", () => navigate());

    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-nav]");
      if (link) { e.preventDefault(); go(link.dataset.nav); return; }

      const chip = e.target.closest("#galleryFilters .chip");
      if (chip) {
        $$("#galleryFilters .chip").forEach((c) => c.classList.toggle("is-active", c === chip));
        applyFilter(chip.dataset.cat);
        return;
      }
      const vchip = e.target.closest("#videoFilters .chip");
      if (vchip && !vchip.closest("#btnVideoCatCreativi,#btnVideoCatMiei,#btnVideoCatPost") && vchip.id !== "btnVideoCatCreativi" && vchip.id !== "btnVideoCatMiei" && vchip.id !== "btnVideoCatPost") {
        $$("#videoFilters .chip").forEach((c) => c.classList.toggle("is-active", c === vchip));
        const cat = vchip.dataset.vcat || "all";
        $$("#videoGrid > .vid-card[data-vcat]").forEach((c) => c.classList.toggle("is-hidden", cat !== "all" && c.dataset.vcat !== cat));
        const postSec = document.getElementById("videoPostsSection");
        if (postSec) postSec.style.display = (cat === "all") ? "" : "none";
        return;
      }

      const gal = e.target.closest(".gal-item");
      if (gal) { openLightbox(gal.dataset.id); return; }

      const vcard = e.target.closest("[data-vid]");
      if (vcard) { playVideo(vcard.dataset.vid); return; }

      const carica = e.target.closest("#btnCaricaVideo");
      if (carica) {
        if (!Account.authed) { toast("Accedi prima", "Servono credenziali per caricare un video.", "warn"); openModal("enterModal"); return; }
        openVideoUpload();
        return;
      }

      const cvcat = e.target.closest("#btnVideoCatCreativi");
      if (cvcat) {
        $$("#videoFilters .chip").forEach((c) => c.classList.remove("is-active"));
        cvcat.classList.add("is-active");
        renderVideoGridOnly(creativeVideos, "videoGrid", "Nessun video del clan caricato ancora.");
        return;
      }

      const mvcat = e.target.closest("#btnVideoCatMiei");
      if (mvcat) {
        $$("#videoFilters .chip").forEach((c) => c.classList.remove("is-active"));
        mvcat.classList.add("is-active");
        renderVideoGridOnly(userVideos, "videoGrid", "Non hai ancora caricato video. Usa «+ Carica il tuo video».");
        return;
      }

      const pc = e.target.closest("#btnVideoCatPost");
      if (pc) {
        $$("#videoFilters .chip").forEach((c) => c.classList.remove("is-active"));
        pc.classList.add("is-active");
        renderVideoPosts();
        const postSec = document.getElementById("videoPostsSection");
        if (postSec) { postSec.style.display = ""; postSec.scrollIntoView({ behavior: "smooth", block: "start" }); }
        const vg = $("#videoGrid"); if (vg) $$("#videoGrid > .vid-card[data-vcat]").forEach((c) => c.classList.add("is-hidden"));
        return;
      }

      const vuDz = e.target.closest("#vuDropzone");
      if (vuDz) { $("#vuFile").click(); return; }

      const vuCarica = e.target.closest("#vuCarica");
      if (vuCarica) {
        const file = $("#vuFile").files[0];
        const titolo = $("#vuTitolo").value.trim();
        const cat = $("#vuCategoria").value.trim() || "video";
        const desc = $("#vuDesc").value.trim();
        if (!file) { $("#vuStatus").textContent = "Seleziona prima un file video."; return; }
        if (!titolo) { $("#vuStatus").textContent = "Inserisci un titolo."; return; }
        $("#vuCarica").disabled = true;
        $("#vuStatus").textContent = "Generante anteprima e salvataggio…";
        generateThumb(file).then((thumb) => {
          const videoUrl = URL.createObjectURL(file);
          const video = {
            id: "uv-" + Date.now(),
            titolo,
            desc,
            cat,
            dur: "--:--",
            thumb,
            fonte: { url: videoUrl },
            autore: Account?.handle || "Tu",
            creatoIl: new Date().toISOString()
          };
          return saveUserVideo(video);
        }).then((video) => {
          userVideos.push(video);
          $("#vuStatus").textContent = "Pubblicando come post…";
          return createVideoPost(video);
        }).then((post) => {
          videoPosts.unshift(post);
          $("#vuStatus").textContent = "Video pubblicato come post!";
          setTimeout(() => { closeModal("videoUploadModal"); resetUploadForm(); renderVideos(); }, 700);
        }).catch((err) => {
          $("#vuStatus").textContent = "Errore: " + err.message;
          $("#vuCarica").disabled = false;
        });
        return;
      }

      const thumb = e.target.closest("[data-lb]");
      if (thumb) { lbIdx = +thumb.dataset.lb; paintLightbox(); return; }

      const rc = e.target.closest(".news-item");
      if (rc) { toast(rc.querySelector("h4").textContent, rc.querySelector("p").textContent, "", 6000); }
    });

    document.addEventListener("keydown", (e) => {
      if (!$("#lightbox").classList.contains("is-open")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });

    $("#lbPrev").addEventListener("click", () => step(-1));
    $("#lbNext").addEventListener("click", () => step(1));

    // Swipe orizzontale sul touch: il lightbox si usa anche da telefono.
    let touchX = null;
    const stage = $(".lightbox-stage");
    stage.addEventListener(
      "touchstart",
      (e) => { touchX = e.touches[0].clientX; },
      { passive: true }
    );
    stage.addEventListener(
      "touchend",
      (e) => {
        if (touchX == null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) < 45) return;
        step(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );
    $("#lbDownload").addEventListener("click", () => {
      const g = lbList[lbIdx];
      if (!g) return;
      // Le foto locali sono data URL: <a download> su quegli href non
      // scarica nulla, quindi si passa da un blob.
      if (String(g.src).startsWith("data:")) {
        const a = document.createElement("a");
        a.href = g.src;
        a.download = `samurai-${String(g.id).replace(/[^\w-]/g, "")}.png`;
        a.click();
      } else {
        const a = document.createElement("a");
        a.href = g.src;
        a.download = `samurai-${String(g.id).replace(/[^\w-]/g, "")}.jpg`;
        a.target = "_blank";
        a.rel = "noopener";
        a.click();
      }
      toast("Immagine scaricata", g.titolo, "ok");
    });

    $("#vuFile").addEventListener("change", async () => {
      const file = $("#vuFile").files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      $("#vuVideoPreview").src = url;
      $("#vuPreview").style.display = "block";
      $("#vuDropzone").style.borderColor = "var(--accent-violet, #5aa8ff)";
      $("#vuDropzone").style.background = "#121828";
      if (!$("#vuTitolo").value.trim()) $("#vuTitolo").value = file.name.replace(/\.[^/.]+$/, "");
    });

    $("#btnEnter").addEventListener("click", () => openModal("enterModal"));

    $("#btnRefreshLb").addEventListener("click", async () => {
      await Views.loadLeaderboard();
      await Views.loadRaid();
      UI.observe($("#view-classifica"));
      toast("Classifica aggiornata", "Numeri letti dal database.", "ok", 2400);
    });

    $("#btnRefreshCmd").addEventListener("click", async () => {
      await Views.loadComando(true);
      toast("Dati del comando aggiornati", "", "ok", 2400);
    });

    $("#year").textContent = new Date().getFullYear();

    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const a = $("#lbThumbs");
        if ($("#lightbox").classList.contains("is-open")) paintLightbox();
        if (a) a.scrollTop = 0;
      }, 220);
    }, { passive: true });
  }

  function init() {
    renderHome();
    renderAbout();
    renderGallery();
    renderVideos().catch((err) => console.warn("[Samurai] renderVideos:", err));
    renderSeasonSelector("#seasonSelector");
    UI.initFaq();
    UI.typing();
    Views.init();
    Blog.init();
    Account.init();
    FX.start();
    setSeason(currentSeason);
    bind();
    navigate();
    UI.observe();
    UI.initWelcome();
    UI.setAccent(store.get("accent", "#5aa8ff"));
    setTimeout(() => toast("Samurai di Avakin", "Premi ⌘K per i comandi rapidi.", "ok", 6000), 2400);

    if (typeof window !== 'undefined') window.renderVideos = renderVideos;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
