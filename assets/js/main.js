(() => {
  const { $, $$, store, toast, openModal, observe, countAll, setPanel, go } = UI;
  const artCache = new Map();

  const pic = (item) => {
    const key = `${item.seed}-${item.w}-${item.h}-${item.comp}`;
    if (!artCache.has(key)) artCache.set(key, ART.make(item));
    return artCache.get(key);
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
      <div class="stat glass-violet stat-violet border-glow border-beam glass-morph" data-reveal="scale" style="--d:${i * 70}ms">
        <div class="stat-num stat-number text-gradient-animate" data-to="${s.num}"><span class="n">0</span><span class="suffix">${s.suffix}</span></div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-bar"><i data-w="${s.bar}"></i></div>
      </div>`).join("");

    $("#pillarsGrid").innerHTML = DATA.pillars.map((p, i) => `
      <article class="pillar glass-violet violet border-glow glass-morph card-3d" data-kanji="${p.kanji}" data-reveal style="--d:${i * 80}ms">
        <div class="card-icon">${p.kanji}</div>
        <h3>${p.titolo}</h3>
        <p>${p.testo}</p>
        <div class="pillar-foot">◆ ${p.foot}</div>
      </article>`).join("");

    $("#ranksList").innerHTML = DATA.ranks.map((r, i) => `
      <div class="rank-row violet border-beam" data-reveal="right" style="--d:${i * 60}ms">
        <div class="rank-badge">${r.kanji}</div>
        <div class="rank-info"><b>${r.nome}</b><small>${r.ruolo}</small></div>
        <div class="rank-meter"><i data-w="${r.pct}"></i></div>
        <span class="mono" style="font-size:10px;color:var(--silver-600);width:34px;text-align:right">${r.pct}%</span>
      </div>`).join("");

    $("#newsList").innerHTML = DATA.news.map((n, i) => `
      <article class="news-item border-beam" data-reveal style="--d:${i * 70}ms" tabindex="0">
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
      <article class="card glass border-beam card-3d" data-reveal style="--d:${i * 55}ms">
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
        <div class="leader-category reveal-stagger" data-reveal>
          <div class="leader-category-head">
            <span class="leader-category-icon">${categoryIcons[category] || "◆"}</span>
            <h3 class="leader-category-title">${categoryLabels[category] || category}</h3>
          </div>
          <div class="grid g-auto-lg leader-category-grid">
            ${leaders.map((l, i) => `
              <article class="leader glass border-beam card-3d" data-reveal style="--d:${i * 70}ms">
                <div class="leader-av">${l.kanji}</div>
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
    $("#galleryGrid").innerHTML = all.map((g) => `
      <figure class="gal-item image-parallax card-3d" data-cat="${g.cat}" data-id="${g.id}" tabindex="0" role="button" aria-label="${esc(g.titolo)}">
        <img loading="lazy" src="${g.src}" alt="${esc(g.titolo)}" width="${g.w}" height="${g.h}">
        <span class="gal-zoom" aria-hidden="true">⤢</span>
        <figcaption class="gal-overlay">
          <small>${String(g.cat).toUpperCase()}</small>
          <b>${esc(g.titolo)}</b>
          <small>${esc(g.autore)} · ${g.data}</small>
        </figcaption>
      </figure>`).join("");
    applyFilter(gFilter);
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
      `<button class="btn btn-violet btn-sm" id="btnCaricaVideo" style="margin-left:auto">+ Carica il tuo video</button>`;

    const creativiHtml = creativeVideos.length
      ? `<section class="vid-section" style="margin-top:44px">
           <span class="eyebrow violet" style="display:block;margin-bottom:10px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase">Video del clan</span>
           <div class="video-grid" id="videoGridCreativi"></div>
         </section>`
      : "";

    $("#videoGrid").innerHTML = rest.map((v, i) => `
      <article class="vid-card image-parallax card-3d" data-vcat="${v.cat}" data-vid="${v.id}" data-reveal style="--d:${i * 60}ms" tabindex="0">
        <div class="vid-thumb">
          <img src="${v.thumb}" alt="${esc(v.titolo)}" loading="lazy">
          <div class="vid-play"><div class="vid-play-btn">▶</div><span class="vid-dur">${v.dur}</span></div>
        </div>
        <div class="vid-meta">
          <b>${esc(v.titolo)}</b>
          <small>${esc(v.desc.slice(0, 72))}…</small>
          <span class="tag" style="align-self:flex-start;margin-top:4px">${v.cat.toUpperCase()}</span>
        </div>
      </article>`).join("") + creativiHtml;

    if (creativeVideos.length) {
      const cg = $("#videoGridCreativi");
      cg.innerHTML = creativeVideos.map((v, i) => `
        <article class="vid-card vid-card-creativo image-parallax card-3d" data-vid="${v.id}" data-reveal style="--d:${i * 60}ms" tabindex="0">
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
    }
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

    const v = DATA.videos.find((x) => x.id === id);
    if (!v) return;
    $("#vmTitle").textContent = v.titolo;
    $("#vmDesc").textContent = v.desc;
    $("#vmCat").textContent = v.cat.toUpperCase();
    $("#vmDur").textContent = v.dur;
    const wrap = $("#playerWrap");
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

  let lastView = null;

  async function navigate() {
    const raw = (location.hash.replace("#/", "") || "home").split("?")[0];
    let view = ROUTES.includes(raw) ? raw : "home";
    if (view === "comando" && !Account.isCommand) {
      view = "home";
      history.replaceState(null, "", "#/home");
    }

    const fromView = document.querySelector(".view.is-active");
    const toView = document.getElementById(`view-${view}`);

    if (fromView && toView && fromView !== toView && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromView.style.transition = "opacity 0.3s var(--ease-out), transform 0.3s var(--ease-out)";
      fromView.style.opacity = "0";
      fromView.style.transform = "translateY(-16px) scale(0.99)";
      await new Promise(r => setTimeout(r, 280));
      fromView.classList.remove("is-active");
      fromView.style.transition = "";
      fromView.style.opacity = "";
      fromView.style.transform = "";
    } else if (fromView) {
      fromView.classList.remove("is-active");
    }

    toView.classList.add("is-active");
    toView.style.opacity = "0";
    toView.style.transform = "translateY(16px) scale(0.99)";
    toView.offsetHeight;
    toView.style.transition = "opacity 0.4s var(--ease-out), transform 0.4s var(--ease-out)";
    toView.style.opacity = "1";
    toView.style.transform = "none";

    setTimeout(() => {
      toView.style.transition = "";
      toView.style.opacity = "";
      toView.style.transform = "";
    }, 450);

    $$(".nav-link").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === view));
    $("#nav").classList.remove("is-open");
    $("#btnMenu").setAttribute("aria-expanded", "false");
    document.title = `Samurai di Avakin — ${DATA.nav.find((n) => n.id === view).label}`;
    if (view === "account") { Account.fillForm(); Account.renderBadge(); Account.renderSessions(); }
    Views.onRoute(view);
    if (view === "video") renderVideos();
    observe($(`#view-${view}`));
    UI.animateInside($(`#view-${view}`));
    countAll($(`#view-${view}`));
    window.scrollTo(0, 0);
    
    // Update filigrana for new section
    if (typeof FILIGRANA !== "undefined") {
      FILIGRANA.setSection(view);
    }
    
    lastView = view;
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
      if (vchip) {
        $$("#videoFilters .chip").forEach((c) => c.classList.toggle("is-active", c === vchip));
        const cat = vchip.dataset.vcat;
        $$("#videoGrid .vid-card").forEach((c) => c.classList.toggle("is-hidden", cat !== "all" && c.dataset.vcat !== cat));
        return;
      }

      const gal = e.target.closest(".gal-item");
      if (gal) { openLightbox(gal.dataset.id); return; }

      const vcard = e.target.closest("[data-vid]");
      if (vcard) { playVideo(vcard.dataset.vid); return; }

      const carica = e.target.closest("#btnCaricaVideo");
      if (carica) {
        if (!Account.authed) { toast("Accedi prima", "Servono credenziali per caricare un video.", "warn"); openModal("enterModal"); return; }
        // Apri il creatore post con tipo video preselezionato
        const modal = $("#createPostModal");
        const tipo = $("#cp-tipo");
        if (modal && tipo) {
          tipo.value = "video";
          modal.classList.add("is-open");
          $("#cp-titolo").focus();
        }
        return;
      }

      const cvcat = e.target.closest("#btnVideoCatCreativi");
      if (cvcat) {
        $$("#videoFilters .chip").forEach((c) => c.classList.remove("is-active"));
        cvcat.classList.add("is-active");
        const grid = $("#videoGrid");
        grid.innerHTML = creativeVideos.length
          ? creativeVideos.map((v, i) => `
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
            </article>`).join("")
          : `<div class="empty-state" style="text-align:center;padding:40px 20px"><span style="font-size:2rem">🎬</span><h3>Nessun video caricato ancora</h3><p>Sii il primo a condividere un video del tuo percorso samurai.</p></div>`;
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
    renderVideos();
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
    initMicroInteractions();
    
    // Check for post-login onboarding
    checkPostLoginOnboarding();
    
    setTimeout(() => toast("Samurai di Avakin", "Premi ⌘K per i comandi rapidi.", "ok", 6000), 2400);

    if (typeof window !== 'undefined') window.renderVideos = renderVideos;
  }

  function checkPostLoginOnboarding() {
    // Check if user just logged in and needs onboarding
    const justLoggedIn = sessionStorage.getItem("sam.justLoggedIn");
    if (justLoggedIn && Account.authed) {
      sessionStorage.removeItem("sam.justLoggedIn");
      setTimeout(() => {
        toast("Bentornato!", "Il tuo profilo è aggiornato.", "ok", 3000);
        // If profile incomplete, suggest onboarding
        const S = Account.data;
        if (S && (!S.avatar || !S.linked)) {
          setTimeout(() => {
            if (confirm("Vuoi completare il tuo profilo? (Avatar, collegamento Avakin, preferenze)")) {
              UI.go("account");
              setTimeout(() => Account.launchOnboarding(), 500);
            }
          }, 2000);
        }
      }, 1000);
    }
  }

  // Listen for auth success to trigger onboarding
  document.addEventListener("sam:auth", (e) => {
    if (e.detail?.authenticated) {
      sessionStorage.setItem("sam.justLoggedIn", "true");
      if (e.detail?.role && !Account.data?.avatar) {
        // New user or incomplete profile
        setTimeout(() => {
          toast("Benvenuto nel clan!", "Completa il tuo profilo per iniziare.", "ok", 5000);
        }, 1500);
      }
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

function initMicroInteractions() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.querySelectorAll(".btn:not([data-magnetic])").forEach(btn => {
    btn.dataset.magnetic = "0.25";
    btn.classList.add("magnetic");
  });

  document.querySelectorAll(".card:not([data-tilt]), .pillar:not([data-tilt]), .leader:not([data-tilt]), .rank-row:not([data-tilt]), .gal-item:not([data-tilt]), .vid-card:not([data-tilt]), .roster-card:not([data-tilt])").forEach(card => {
    card.dataset.tilt = "6";
    card.classList.add("tilt-card");
  });

  document.querySelectorAll(".nav-link:not([data-magnetic])").forEach(link => {
    link.dataset.magnetic = "0.15";
  });

  document.querySelectorAll(".acc-tab:not([data-magnetic])").forEach(tab => {
    tab.dataset.magnetic = "0.2";
  });

  document.querySelectorAll(".chip:not([data-magnetic])").forEach(chip => {
    chip.dataset.magnetic = "0.2";
  });

  if (typeof PARALLAX !== "undefined") {
    document.querySelectorAll(".hero-bg-logo svg, .hero-mon, .hero-visual .ring").forEach(el => {
      PARALLAX.add(el, 0.1);
    });
    document.querySelectorAll(".pillar, .card, .stat").forEach(el => {
      PARALLAX.add(el, 0.05);
    });
  }

  if (typeof SHADERS !== "undefined") {
    const season = document.body.className.match(/season-(\w+)/)?.[1] || "spring";
    const modeMap = { spring: 0, summer: 1, autumn: 2, winter: 3 };
    SHADERS.setMode(modeMap[season] || 0);
    SHADERS.setIntensity(0.6);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        if (entry.target.classList.contains("reveal-stagger")) {
          entry.target.querySelectorAll(":scope > *").forEach((child, i) => {
            child.style.animationDelay = `${i * 80}ms`;
          });
        }
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  document.querySelectorAll("[data-reveal], .reveal-stagger").forEach(el => observer.observe(el));
}
