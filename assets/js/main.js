(() => {
  const { $, $$, store, toast, openModal, observe, countAll, setPanel, go } = UI;
  const artCache = new Map();
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || isCoarsePointer;

  function lockBodyScroll(lock) {
    try {
      if (lock) {
        if (document.body.dataset.scrollLocked === '1') return;
        document.body.dataset.scrollLocked = '1';
        document.body.dataset.scrollY = String(window.scrollY || 0);
        document.body.style.overflow = 'hidden';
      } else {
        if (document.body.dataset.scrollLocked !== '1') return;
        const y = parseInt(document.body.dataset.scrollY || '0', 10) || 0;
        delete document.body.dataset.scrollLocked;
        delete document.body.dataset.scrollY;
        document.body.style.overflow = '';
        window.scrollTo(0, y);
      }
    } catch {}
  }

  function updateViewportUnits() {
    try {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', vh + 'px');
      const vv = window.visualViewport;
      if (vv) {
        document.documentElement.style.setProperty('--vvh', vv.height * 0.01 + 'px');
      }
    } catch {}
  }

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

  let gItems = [], gFilter = "all", gRemote = [], gPublicPhotos = [];

  /**
   * Le foto arrivano da tre fonti diverse:
   *  - il server (auth), con `id/createdAt/filename`
   *  - il public API (anonimo cross-device), con `id/createdAt/mediaUrl`
   *  - il localStorage, con `src/name` in base64
   * Le normalizziamo qui per non duplicare la logica piu' avanti.
   */
  const toItem = (u, i, prefix) => ({
    id: u.id ? `${prefix}${u.id}` : `${prefix}${i}`,
    cat: u.category || "personali",
    titolo: u.title || u.filename || u.name || "Foto personale",
    autore: u.authorName || u.autore?.nome || "Tu",
    data: u.createdAt ? new Date(u.createdAt).toLocaleDateString("it-IT") : "Oggi",
    src: u.mediaUrl || u.url || u.src,
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
    const publicPhotos = gPublicPhotos.map((u, i) => toItem(u, i, "p"));
    return [...gItems, ...remote, ...publicPhotos, ...local].filter((g) => g.src);
  }

  // Persistent listener for uploads - works even before gallery is rendered
  document.addEventListener("sam:uploads", (e) => {
    const detail = e.detail;
    if (Array.isArray(detail)) {
      const known = new Set(gRemote.map((u) => u.url || u.src));
      detail.filter((u) => u.url || u.src).forEach((u) => { if (!known.has(u.url || u.src)) gRemote.push(u); });
    }
    if (typeof paintGallery === "function") {
      paintGallery();
      applyFilter(gFilter);
    }
  });

  // Fetch public photos for cross-device sync (anonymous uploads)
  async function loadPublicPhotos() {
    try {
      const res = await fetch("/api/public/content?type=photo&status=approved&limit=50&myIp=true", { credentials: "include" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        gPublicPhotos = data.items;
        if (typeof paintGallery === "function") {
          paintGallery();
          applyFilter(gFilter);
        }
      }
    } catch (err) {
      console.warn("Public photos load failed:", err);
    }
  }

  function renderGallery() {
    $("#galleryFilters").innerHTML = DATA.galleryCats.map((c) =>
      `<button class="chip${c.id === "all" ? " is-active" : ""}" data-cat="${c.id}">${c.label}</button>`).join("") +
      `<button class="chip" data-cat="personali">Le mie foto</button>`;

    gItems = DATA.gallery.map((g) => ({ 
      ...g, 
      src: g.src ? g.src : pic(g) 
    }));
    paintGallery();
    loadPublicPhotos(); // Load cross-device photos
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
  let publicVideos = []; // video anonimi cross-device da /api/public

  // Normalizza video come fa la gallery: unisce DATA.videos + creativeVideos + publicVideos + locali
  function vAll() {
    const base = DATA.videos.map((v) => ({ ...v, thumb: pic(v), srcType: 'data' }));
    const creativi = creativeVideos.map((v) => ({ 
      ...v, 
      thumb: v.poster ? v.poster : pic({ seed: v.id, w: 320, h: 180, comp: 'crest' }),
      srcType: 'creativo',
      cat: v.cat || 'creativo',
      vcat: v.cat || 'creativo'
    }));
    const publicVids = publicVideos.map((v) => ({
      ...v,
      id: v.id,
      titolo: v.title,
      desc: v.description,
      dur: v.duration || "—",
      cat: v.category || 'creativo',
      vcat: v.category || 'creativo',
      fonte: { url: v.mediaUrl },
      poster: v.thumbnailUrl,
      thumb: v.thumbnailUrl ? v.thumbnailUrl : pic({ seed: v.id, w: 320, h: 180, comp: 'crest' }),
      srcType: 'public',
      autore: { nome: v.authorName, handle: v.authorName },
      likes: v.likes || 0,
      commenti: v.comments || 0,
      creatoIl: v.createdAt
    }));
    return [...base, ...creativi, ...publicVids].filter((v) => v.src || v.fonte?.url || v.thumb);
  }

  // Fetch public videos for cross-device sync (anonymous uploads)
  async function loadPublicVideos() {
    try {
      const res = await fetch("/api/public/content?type=video&status=approved&limit=50&myIp=true", { credentials: "include" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        publicVideos = data.items;
        // Re-render if video view is active
        if (location.hash.includes("video")) {
          paintVideoGrid();
        }
      }
    } catch (err) {
      console.warn("Public videos load failed:", err);
    }
  }

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

  function setupVideoFeaturedCinematic() {
    const featEl = $("#vidFeatured");
    if (!featEl) return;
    featEl.onmousemove = (e) => {
      const rect = featEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      featEl.style.setProperty("--mx", x + "%");
      featEl.style.setProperty("--my", y + "%");
    };
    featEl.onmouseleave = () => {
      featEl.style.setProperty("--mx", "50%");
      featEl.style.setProperty("--my", "30%");
    };

    const mv = featEl.querySelector(".vid-featured-motion");
    if (mv) {
      const play = () => { try { mv.play().catch(() => {}); } catch {} };
      play();
      document.addEventListener("visibilitychange", play, { once: false });
      window.addEventListener("focus", play, { passive: true });
    }
  }

  // --- VIDEO CAROUSEL ---
  function setupVideoCarousel(slideCount) {
    const track = $("#vidCarouselTrack");
    const prevBtn = $("#vidCarouselPrev");
    const nextBtn = $("#vidCarouselNext");
    const dots = $("#vidCarouselDots")?.querySelectorAll(".vid-carousel-dot");
    if (!track || slideCount <= 1) { if (prevBtn) prevBtn.style.display = 'none'; if (nextBtn) nextBtn.style.display = 'none'; return; }
    
    let currentIndex = 0;
    let autoSlideTimer = null;
    const autoSlideDelay = 6000;
    
    function goToSlide(index, animate = true) {
      if (index < 0) index = slideCount - 1;
      if (index >= slideCount) index = 0;
      currentIndex = index;
      
      // Update track transform
      track.style.transform = `translateX(-${index * 100}%)`;
      
      // Update slides active state
      track.querySelectorAll(".vid-carousel-slide").forEach((slide, i) => {
        slide.classList.toggle("is-active", i === index);
      });
      
      // Update dots
      dots?.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === index);
        dot.setAttribute("aria-selected", i === index);
      });
    }
    
    function nextSlide() { goToSlide(currentIndex + 1); }
    function prevSlide() { goToSlide(currentIndex - 1); }
    
    function resetAutoSlide() {
      if (autoSlideTimer) clearInterval(autoSlideTimer);
      autoSlideTimer = setInterval(nextSlide, autoSlideDelay);
    }
    
    function pauseAutoSlide() {
      if (autoSlideTimer) clearInterval(autoSlideTimer);
    }
    
    // Button events
    prevBtn?.addEventListener("click", () => { prevSlide(); resetAutoSlide(); });
    nextBtn?.addEventListener("click", () => { nextSlide(); resetAutoSlide(); });
    
    // Dot events
    dots?.forEach((dot, i) => {
      dot.addEventListener("click", () => { goToSlide(i); resetAutoSlide(); });
    });
    
    // Keyboard navigation
    track?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); prevSlide(); resetAutoSlide(); }
      if (e.key === "ArrowRight") { e.preventDefault(); nextSlide(); resetAutoSlide(); }
    });
    
    // Pause on hover
    const carousel = $("#vidCarousel");
    carousel?.addEventListener("mouseenter", pauseAutoSlide);
    carousel?.addEventListener("mouseleave", resetAutoSlide);
    
    // Pause when tab hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseAutoSlide();
      else resetAutoSlide();
    });
    
    // Touch/swipe support
    let touchStartX = 0;
    carousel?.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    carousel?.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx > 0) prevSlide(); else nextSlide();
        resetAutoSlide();
      }
    }, { passive: true });
    
    // Start auto-slide
    resetAutoSlide();
  }

  function maybeShowVideoIntro() {
    try {
      if (localStorage.getItem("samurai_video_official_intro_v1")) return;
      const raw = (location.hash.replace("#/", "") || "").split("?")[0];
      if (raw !== "video") return;
      const overlay = $("#videoIntroOverlay");
      if (!overlay) return;
      overlay.style.display = "flex";
      overlay.classList.add("is-open");
      lockBodyScroll(true);
      const btn = $("#btnVideoIntroPlay");
      let lastFocus = document.activeElement;
      if (btn) {
        btn.onclick = () => {
          try { localStorage.setItem("samurai_video_official_intro_v1", "1"); } catch {}
          overlay.classList.remove("is-open");
          setTimeout(() => { overlay.style.display = "none"; }, 420);
          lockBodyScroll(false);
          try { if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus(); } catch {}
          setTimeout(() => {
            playVideo("v0", { autoplay: true });
            const vm = $("#videoModal");
            if (vm) { vm.classList.add("is-open"); lockBodyScroll(true); }
          }, 520);
        };
      }
      overlay.onkeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          return;
        }
        if (e.key === "Tab") {
          const focusable = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.offsetParent !== null);
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) { last.focus(); e.preventDefault(); }
          } else {
            if (document.activeElement === last) { first.focus(); e.preventDefault(); }
          }
        }
      };
      setTimeout(() => { $("#btnVideoIntroPlay")?.focus(); }, 60);
    } catch {}
  }

  async function renderVideos() {
    await loadCreativeVideos();
    await loadPublicVideos(); // Cross-device anonymous videos
    try { loadLocalVideos(); } catch {}
    
    const allVideos = vAll();
    const [feat, ...rest] = allVideos;
    
    // Build carousel slides: featured + next 4 videos
    const carouselSlides = [feat, ...rest.slice(0, 4)];
    
    $("#vidFeatured").innerHTML = `
      <div class="vid-carousel" id="vidCarousel" role="region" aria-label="Video in evidenza">
        <!-- Slides container -->
        <div class="vid-carousel-track" id="vidCarouselTrack">
          ${carouselSlides.map((v, i) => `
            <div class="vid-carousel-slide${i === 0 ? ' is-active' : ''}" data-index="${i}" data-vid="${v.id}" style="--d:${i * 80}ms">
              <div class="vid-carousel-bg" aria-hidden="true">
                <img src="${v.thumb}" alt="" loading="lazy">
                <span class="vid-carousel-glow"></span>
                <span class="vid-carousel-sheen"></span>
              </div>
              <div class="vid-carousel-motion-wrap" aria-hidden="true">
                <video class="vid-carousel-motion" muted autoplay loop playsinline preload="auto" src="${esc(v.fonte?.url || '')}" type="video/quicktime"></video>
              </div>
              <div class="vid-carousel-content">
                ${i === 0 ? '<span class="vid-badge-prima">PRIMA VISIONE</span>' : ''}
                <span class="eyebrow">In evidenza</span>
                <h3 style="font-family:var(--ff-display);font-size:clamp(1.5rem,3vw,2.2rem);color:var(--silver-100);line-height:1.12;margin:10px 0 8px">${esc(v.titolo)}</h3>
                <p style="color:var(--silver-400);font-size:.94rem;max-width:60ch;margin-bottom:16px">${esc(v.desc)}</p>
                <div class="row" style="gap:12px;flex-wrap:wrap">
                  <button class="btn btn-primary btn-lg" data-vid="${v.id}" style="box-shadow:var(--violet-glow-intense)">Riproduci ora</button>
                  <span class="tag tag-glass">${v.cat.toUpperCase()}</span>
                  ${v.dur && v.dur !== '—' ? `<span class="tag tag-glass">${v.dur}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        
        <!-- Navigation arrows -->
        <button class="vid-carousel-btn vid-carousel-prev" id="vidCarouselPrev" aria-label="Video precedente" title="Precedente">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button class="vid-carousel-btn vid-carousel-next" id="vidCarouselNext" aria-label="Video successivo" title="Successivo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        
        <!-- Dots indicators -->
        <div class="vid-carousel-dots" id="vidCarouselDots" role="tablist" aria-label="Seleziona video">
          ${carouselSlides.map((_, i) => `
            <button class="vid-carousel-dot${i === 0 ? ' is-active' : ''}" data-index="${i}" role="tab" aria-selected="${i === 0}" aria-label="Video ${i + 1}"></button>
          `).join('')}
        </div>
      </div>`;
    
    // Initialize carousel
    setupVideoCarousel(carouselSlides.length);
    setupVideoFeaturedCinematic();

    $("#videoFilters").innerHTML = DATA.videoCats.map((c, i) =>
      `<button class="chip${i === 0 ? " is-active" : ""}" data-vcat="${c.id}">${c.label}</button>`).join("") +
      `<button class="chip btn-ghost" id="btnVideoCatCreativi">Creatività</button>` +
      `<button class="btn btn-violet btn-sm" id="btnCaricaVideo" style="margin-left:auto">+ Carica il tuo video</button>`;

    // Local test mode: add drag-and-drop upload zone in video section
    let localUploadZone = "";
    if (localStorage.getItem(LOCAL_TEST_MODE_KEY) === "true") {
      localUploadZone = `
        <section class="vid-section local-upload-zone" style="margin-top:32px;padding:24px;border:2px dashed var(--glass-violet-brd);border-radius:16px;background:var(--glass-violet-bg);text-align:center;position:relative;overflow:hidden">
          <div style="position:absolute;inset:0;background:var(--grad-radial-glow);opacity:0.3;pointer-events:none"></div>
          <div style="position:relative;z-index:1">
            <div style="font-size:3rem;margin-bottom:12px;filter:drop-shadow(0 0 20px rgba(192,132,252,0.5))">🎬</div>
            <h4 style="color:var(--silver-100);margin-bottom:8px;font-family:var(--ff-display)">Test Locale Video</h4>
            <p style="color:var(--silver-400);margin-bottom:16px;font-size:.9rem">Trascina qui il tuo file <b>.mp4 .mov .mkv .webm</b> per test immediato</p>
            <input type="file" id="localVideoDropInput" accept="video/mp4,video/quicktime,video/x-matroska,video/webm" class="sr-only" multiple>
            <button class="btn btn-violet btn-lg" id="localVideoDropBtn" style="margin-top:8px">Scegli file video</button>
            <p class="mono" style="margin-top:12px;font-size:11px;color:var(--silver-600)">Funziona solo in LOCAL TEST MODE · File salvati in localStorage</p>
          </div>
        </section>`;
    }

    $("#videoGrid").innerHTML = rest.map((v, i) => {
      const isCreativo = v.srcType === 'creativo';
      const thumbStyle = v.poster 
        ? `aspect-ratio:16/9;background-image:url('${esc(v.poster)}');background-size:cover;background-position:center`
        : `aspect-ratio:16/9`;
      const badgeHtml = isCreativo ? `<span class="vid-creativo-badge">CREATIVITÀ</span>` : '';
      const placeholderHtml = (!v.poster && isCreativo) 
        ? `<span class="vid-placeholder">${esc(v.autore?.nome || v.autore?.handle || "Clan")}</span>` 
        : '';
      const metaSmall = isCreativo
        ? `<small style="color:var(--silver-500)">${esc(v.autore?.handle || v.autore?.nome || "Clan")} · ${v.local ? "Caricato da te" : "Clan"}</small>`
        : `<small>${esc(v.desc?.slice(0, 72) || '')}…</small>`;
      const tagHtml = isCreativo
        ? `<div class="row" style="gap:6px;margin-top:6px"><span class="tag silver">${num(v.likes || 0)} ⚔</span><span class="tag silver">${num(v.commenti || 0)} 💬</span></div>`
        : `<span class="tag" style="align-self:flex-start;margin-top:4px">${(v.vcat || v.cat || '').toUpperCase()}</span>`;
      
      return `
        <article class="vid-card${isCreativo ? ' vid-card-creativo' : ''} image-parallax card-3d" data-vcat="${v.vcat || v.cat}" data-vid="${v.id}" data-reveal style="--d:${i * 60}ms" tabindex="0">
          <div class="vid-thumb${isCreativo ? ' vid-thumb-creativo' : ''}" style="${thumbStyle}">
            ${badgeHtml}
            <span class="vid-play-badge">▶</span>
            ${placeholderHtml}
            ${!isCreativo ? `<img src="${v.thumb}" alt="${esc(v.titolo)}" loading="lazy">` : ''}
            ${!isCreativo ? `<div class="vid-play"><div class="vid-play-btn">▶</div><span class="vid-dur">${v.dur}</span></div>` : ''}
          </div>
          <div class="vid-meta">
            <b>${esc(v.titolo)}</b>
            ${metaSmall}
            ${tagHtml}
          </div>
        </article>`;
    }).join("") + localUploadZone;
    
    // Re-observe new elements for animations
    setTimeout(() => {
      document.querySelectorAll('#videoGrid [data-reveal]:not(.is-in)').forEach(el => {
        observer.observe(el);
      });
    }, 50);
  }

  function playVideo(id, opts = {}) {
    const auto = !!opts.autoplay;
    const wasLocked = document.body.dataset.scrollLocked === '1';
    // Video creativi caricati dagli utenti
    const cv = creativeVideos.find((x) => x.id === id);
    if (cv) {
      $("#vmTitle").textContent = cv.titolo;
      $("#vmDesc").textContent = cv.desc || "Condiviso da " + (cv.autore?.nome || cv.autore?.handle);
      $("#vmCat").textContent = "CREATIVO";
      $("#vmDur").textContent = cv.dur || "—";
      const wrap = $("#playerWrap");
      wrap.innerHTML = `
        <div class="vid-player-creativo player-cine-frame" style="width:100%;height:100%;background:#060812;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
          <span class="player-cine-vignette" aria-hidden="true"></span>
          <video ${auto ? "autoplay" : ""} controls playsinline preload="metadata" style="max-width:100%;max-height:82vh;border-radius:12px;background:#01030a;position:relative;z-index:1;touch-action:pan-y pinch-zoom">
            <source src="${esc(cv.fonte?.url || "")}" type="${esc(cv.fonte?.type || "video/mp4")}">
            Il tuo browser non supporta la riproduzione video. Scarica il file per vederlo.
          </video>
        </div>`;
      openModal("videoModal");
      lockBodyScroll(true);
      setTimeout(() => {
        const v = wrap.querySelector("video");
        if (v && auto) { try { v.play().catch(()=>{}); } catch {} }
      }, 90);
      return;
    }

    const v = DATA.videos.find((x) => x.id === id);
    if (!v) return;
    $("#vmTitle").textContent = v.titolo;
    $("#vmDesc").textContent = v.desc;
    $("#vmCat").textContent = v.cat.toUpperCase();
    $("#vmDur").textContent = v.dur;
    const wrap = $("#playerWrap");
    const url = v.fonte?.url;
    if (url && !v.fonte.youtube) {
      const ext = url.slice(url.lastIndexOf(".")).toLowerCase();
      const type = ext === ".mov" ? "video/quicktime" : ext === ".webm" ? "video/webm" : "video/mp4";
      wrap.innerHTML = `
        <div class="vid-player-creativo player-cine-frame" style="width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
          <span class="player-cine-vignette" aria-hidden="true"></span>
          <video ${auto ? "autoplay" : ""} controls playsinline preload="metadata" src="${esc(url)}" type="${type}" style="max-width:100%;max-height:82vh;border-radius:12px;background:#01030a;position:relative;z-index:1;touch-action:pan-y pinch-zoom">
            Il tuo browser non supporta la riproduzione di questo file. <a href="${esc(url)}" download style="color:var(--ruri);text-decoration:underline">Scarica il video</a>.
          </video>
        </div>`;
      openModal("videoModal");
      lockBodyScroll(true);
      setTimeout(() => {
        const vv = wrap.querySelector("video");
        if (vv && auto) { try { vv.play().catch(()=>{}); } catch {} }
      }, 90);
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
    lockBodyScroll(true);
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

    if (!toView) {
      console.warn(`View not found: view-${view}`);
      return;
    }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (fromView && fromView !== toView && !prefersReduced) {
      fromView.classList.add("view-exit");
      await new Promise(r => setTimeout(r, 200));
    }

    if (fromView) {
      fromView.classList.remove("is-active", "view-exit");
    }

    toView.classList.add("is-active", "view-enter");
    toView.offsetHeight;
    requestAnimationFrame(() => {
      toView.classList.remove("view-enter");
    });

    $$(".nav-link").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === view));
    $("#nav").classList.remove("is-open");
    $("#btnMenu").setAttribute("aria-expanded", "false");
    document.title = `Samurai di Avakin — ${DATA.nav.find((n) => n.id === view).label}`;
    if (view === "account") { Account.fillForm(); Account.renderBadge(); Account.renderSessions(); }
    Views.onRoute(view);
    const fc = document.getElementById('filigranaCanvas');
    if (fc) {
      fc.style.opacity = view === 'home' ? '0.06' : '0.04';
    }
    if (view === "video") {
      setTimeout(() => {
        renderVideos();
        observe($(`#view-${view}`));
        maybeShowVideoIntro();
      }, 60);
    } else if (view === "gallery") {
      if (typeof paintGallery === "function") {
        paintGallery();
        applyFilter(gFilter);
      }
    } else if (view === "chi-siamo") {
      if (typeof UI.initChiSiamoBubbles === "function") {
        UI.initChiSiamoBubbles();
      }
    } else {
      const overlay = $("#videoIntroOverlay");
      if (overlay && overlay.classList.contains("is-open")) {
        overlay.classList.remove("is-open");
        setTimeout(() => { overlay.style.display = "none"; }, 320);
        lockBodyScroll(false);
      } else if (overlay) {
        overlay.classList.remove("is-open");
        overlay.style.display = "none";
      }
    }
    if (lastView === "chi-siamo" && typeof UI.destroyChiSiamoBubbles === "function") {
      UI.destroyChiSiamoBubbles();
    }
    observe($(`#view-${view}`));
    UI.animateInside($(`#view-${view}`));
    countAll($(`#view-${view}`));
    window.scrollTo(0, 0);
    
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
        try {
          const testMode = localStorage.getItem(LOCAL_TEST_MODE_KEY) === "true";
          if (!testMode) {
            localStorage.setItem(LOCAL_TEST_MODE_KEY, "true");
            if (typeof initLocalVideoTesting === 'function') initLocalVideoTesting();
          }
        } catch {}
        // Open advanced upload modal
        const advModal = document.getElementById('videoUploadModal');
        if (advModal) {
          advModal.classList.add('is-open');
          lockBodyScroll(true);
          if (typeof window.initAdvancedVideoUpload === 'function') {
            window.initAdvancedVideoUpload();
          }
          if (typeof window.resetVideoUpload === 'function') {
            window.resetVideoUpload();
          } else {
            setTimeout(() => {
              const rs = document.getElementById('vupStepDrop');
              if (rs) {
                document.querySelectorAll('[id^="vupStep"]').forEach(s => {
                  if (s.id === 'vupStepDrop') { s.style.display = 'flex'; s.style.opacity = '1'; s.style.visibility = 'visible'; }
                  else { s.style.display = 'none'; s.style.opacity = '0'; s.style.visibility = 'hidden'; }
                });
              }
            }, 40);
          }
          return;
        }
        // Fallback to create post modal
        const modal = $("#createPostModal");
        const tipo = $("#cp-tipo");
        if (modal && tipo) {
          tipo.value = "video";
          modal.classList.add("is-open");
          lockBodyScroll(true);
          $("#cp-titolo")?.focus();
        }
        return;
      }

      // Local test mode: handle drag-and-drop video upload
      const localDropZone = e.target.closest(".local-upload-zone");
      if (localDropZone) {
        e.preventDefault();
        e.stopPropagation();
        localDropZone.classList.add("drag-over");
        return;
      }
      
      const localDropInput = e.target.closest("#localVideoDropInput");
      if (localDropInput) return; // Let input handle click
      
      const localDropBtn = e.target.closest("#localVideoDropBtn");
      if (localDropBtn) {
        $("#localVideoDropInput")?.click();
        return;
      }

      const cvcat = e.target.closest("#btnVideoCatCreativi");
      if (cvcat) {
        try { loadLocalVideos(); } catch {}
        // Ricarica da localStorage per sicurezza
        try {
          const stored = localStorage.getItem("samurai_local_videos");
          if (stored) {
            const vids = JSON.parse(stored);
            if (Array.isArray(vids) && vids.length) {
              creativeVideos = [...vids, ...creativeVideos];
              const unique = Array.from(new Map(creativeVideos.map(v => [v.id, v])).values());
              creativeVideos = unique;
            }
          }
        } catch {}
        $$("#videoFilters .chip").forEach((c) => c.classList.remove("is-active"));
        cvcat.classList.add("is-active");
        // Filtra la griglia unificata per mostrare solo video creativi (srcType === 'creativo')
        $$("#videoGrid .vid-card").forEach((c) => {
          const isCreativo = c.classList.contains('vid-card-creativo');
          c.classList.toggle("is-hidden", !isCreativo);
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
    if (stage) {
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
    }
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

    // Local test mode: drag-and-drop handlers for video upload zone
    document.addEventListener("dragover", (e) => {
      const zone = e.target.closest(".local-upload-zone");
      if (zone) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add("drag-over");
      }
    });

    document.addEventListener("dragleave", (e) => {
      const zone = e.target.closest(".local-upload-zone");
      if (zone && !zone.contains(e.relatedTarget)) {
        zone.classList.remove("drag-over");
      }
    });

    document.addEventListener("drop", (e) => {
      const zone = e.target.closest(".local-upload-zone");
      if (zone) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("drag-over");
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          handleLocalVideoFiles(files);
        }
      }
    });

    $("#localVideoDropInput")?.addEventListener("change", (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleLocalVideoFiles(files);
      }
    });

    function handleLocalVideoFiles(files) {
      const validTypes = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"];
      for (const file of files) {
        if (!validTypes.includes(file.type)) {
          toast("Formato non supportato", `${file.name}: usa MP4, MOV, MKV o WebM`, "warn");
          continue;
        }
        uploadLocalVideo(file);
      }
    }

    async function uploadLocalVideo(file) {
      const titulo = file.name.replace(/\.[^/.]+$/, "");
      const videoUrl = URL.createObjectURL(file);
      const duration = await getVideoDuration(file);
      
      const videoData = {
        id: "local_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        titolo,
        desc: `Caricato localmente da ${file.name}`,
        dur: formatDuration(duration),
        cat: "creativo",
        autore: {
          nome: Account.data?.name || "Test User",
          handle: Account.data?.handle || "test_user",
          level: Account.data?.level || 1
        },
        fonte: { url: videoUrl, type: file.type },
        likes: 0, commenti: 0, tags: ["locale"], pubblico: true,
        local: true, createdAt: new Date().toISOString()
      };
      
      creativeVideos.unshift(videoData);
      saveLocalVideos([videoData]);
      renderVideos();
      toast("Video caricato!", `${file.name} pronto nella sezione Creatività`, "ok");
    }

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

  function initHomeCinematics() {
    if (reduceMotion || isCoarsePointer) return;
    const fc = document.getElementById('filigranaCanvas');
    if (fc) {
      fc.style.transition = 'opacity 600ms ease';
      fc.style.opacity = '0.06';
    }
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const heroMon = document.querySelector('.hero-mon');
        const heroVis = document.querySelector('.hero-visual');
        const heroOrbs = document.querySelectorAll('.hero-orb');
        if (heroMon) heroMon.style.transform = `translate3d(0, ${y * 0.06}px, 0)`;
        if (heroVis) heroVis.style.transform = `translate3d(0, ${y * 0.04}px, 0)`;
        heroOrbs.forEach((orb, i) => {
          orb.style.transform = `translate3d(0, ${y * (0.03 + i * 0.01)}px, 0)`;
        });
        ticking = false;
      });
    }, { passive: true });
  }

  function init() {
    updateViewportUnits();
    window.addEventListener('resize', updateViewportUnits, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportUnits, { passive: true });
      window.visualViewport.addEventListener('scroll', updateViewportUnits, { passive: true });
    }

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
    // Init toolbar liquid glass glow
    if (typeof UI.initToolbarGlow === "function") {
      UI.initToolbarGlow();
    }
    UI.setAccent(store.get("accent", "#5aa8ff"));
    if (!reduceMotion && !isCoarsePointer) {
      initMicroInteractions();
      initHomeCinematics();
    } else {
      document.querySelectorAll('.magnetic').forEach(el => el.classList.remove('magnetic'));
      document.querySelectorAll('.tilt-card').forEach(el => el.classList.remove('tilt-card'));
    }
    initLocalVideoTesting();
    
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
  const rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cp = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (rm || cp) return;

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
        if (entry.target.classList.contains("reveal-stagger") || entry.target.classList.contains("reveal-glass-stagger")) {
          entry.target.querySelectorAll(":scope > *").forEach((child, i) => {
            child.style.animationDelay = `${i * 80}ms`;
          });
        }
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  document.querySelectorAll("[data-reveal], .reveal-stagger, .reveal-glass, .reveal-glass-stagger").forEach(el => observer.observe(el));
}

// ===== LOCAL VIDEO TESTING MODE =====
// Allows testing video uploads without authentication (for local development)

const LOCAL_VIDEO_KEY = "samurai_local_videos";
const LOCAL_TEST_MODE_KEY = "samurai_local_test_mode";

function initLocalVideoTesting() {
  // Enable local test mode automatically on localhost, 127.0.0.1, file://, OR samurai-avakin.onrender.com
  const isLocal = location.hostname === "localhost" || 
                  location.hostname === "127.0.0.1" || 
                  location.protocol === "file:" ||
                  location.hostname === "samurai-avakin.onrender.com";
  if (isLocal) {
    localStorage.setItem(LOCAL_TEST_MODE_KEY, "true");
  }
  
  const testMode = localStorage.getItem(LOCAL_TEST_MODE_KEY) === "true";
  
  if (testMode) {
    // Add test mode indicator
    addTestModeIndicator();
    
    // Override auth check for video upload button
    overrideVideoUploadAuth();
    
    // Load local videos into creativeVideos
    loadLocalVideos();
    
    // Handle createPostForm for local video uploads
    handleLocalVideoUpload();
    
    console.log("[LocalTestMode] Enabled - Video uploads enabled without auth");
  }
}

function addTestModeIndicator() {
  if (document.getElementById("testModeBadge")) return;
  
  const badge = document.createElement("div");
  badge.id = "testModeBadge";
  badge.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background: linear-gradient(135deg, var(--violet-600), var(--violet-800));
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: var(--violet-glow-intense);
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--ff-mono);
    animation: pulseGlow 2s ease-in-out infinite;
  `;
  badge.innerHTML = `
    <span>🧪 LOCAL TEST MODE</span>
    <button id="toggleTestMode" style="
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
    ">Disable</button>
  `;
  document.body.appendChild(badge);
  
  $("#toggleTestMode").addEventListener("click", () => {
    const enabled = localStorage.getItem(LOCAL_TEST_MODE_KEY) === "true";
    localStorage.setItem(LOCAL_TEST_MODE_KEY, enabled ? "false" : "true");
    location.reload();
  });
}

function overrideVideoUploadAuth() {
  // Override the btnCaricaVideo click handler to allow local uploads
  const originalHandler = document.querySelector("#btnCaricaVideo");
  if (originalHandler) {
    originalHandler.addEventListener("click", (e) => {
      e.stopPropagation();
      openCreatePostModalForVideo();
    }, true);
  }
}

function loadLocalVideos() {
  const stored = localStorage.getItem(LOCAL_VIDEO_KEY);
  if (stored) {
    try {
      const videos = JSON.parse(stored);
      if (Array.isArray(videos)) {
        creativeVideos = [...videos, ...creativeVideos];
        // Remove duplicates
        const unique = Array.from(new Map(creativeVideos.map(v => [v.id, v])).values());
        creativeVideos = unique;
      }
    } catch (e) {
      console.error("[LocalTestMode] Failed to load local videos:", e);
    }
  }
}

function saveLocalVideos(videos) {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_VIDEO_KEY) || '[]');
    const combined = [...videos, ...existing];
    // Remove duplicates by id
    const unique = Array.from(new Map(combined.map(v => [v.id, v])).values());
    localStorage.setItem(LOCAL_VIDEO_KEY, JSON.stringify(unique));
  } catch (e) {
    localStorage.setItem(LOCAL_VIDEO_KEY, JSON.stringify(videos));
  }
}

function openCreatePostModalForVideo() {
  const modal = $("#createPostModal");
  if (!modal) return;
  
  // Pre-select video type
  const tipo = $("#cp-tipo");
  if (tipo) tipo.value = "video";
  
  modal.classList.add("is-open");
  $("#cp-titolo")?.focus();
}

function handleLocalVideoUpload() {
  const form = $("#createPostForm");
  if (!form) return;
  
  // Remove existing listeners
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  newForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const tipo = $("#cp-tipo")?.value;
    if (tipo !== "video") return; // Only handle video uploads locally
    
    const fileInput = $("#cp-files");
    const files = fileInput?.files;
    if (!files || files.length === 0) {
      toast("Seleziona un video", "Scegli un file MP4 o MOV da caricare", "warn");
      return;
    }
    
    const file = files[0];
    const validTypes = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"];
    if (!validTypes.includes(file.type)) {
      toast("Formato non supportato", "Usa MP4, MOV, MKV o WebM", "err");
      return;
    }
    
    const titolo = $("#cp-titolo")?.value?.trim();
    const corpo = $("#cp-corpo")?.value?.trim();
    const tags = $("#cp-tags")?.value?.split(",").map(t => t.trim()).filter(Boolean) || [];
    const pubblico = $("#cp-pubblico")?.checked !== false;
    
    if (!titolo) {
      toast("Titolo richiesto", "Inserisci un titolo per il video", "warn");
      return;
    }
    
    // Show loading
    const submitBtn = $("#cpSubmit");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Caricamento...";
    submitBtn.disabled = true;
    
    try {
      // Generate thumbnail and duration for immediate local playback
      const videoUrl = URL.createObjectURL(file);
      const duration = await getVideoDuration(file);
      const durStr = formatDuration(duration);
      const thumb = await generateVideoThumbnail(file);
      
      // 1. Upload to public API for cross-device persistence
      const fd = new FormData();
      fd.append("files", file);
      fd.append("type", "video");
      fd.append("title", titolo);
      fd.append("description", corpo || "");
      fd.append("category", "creativo");
      fd.append("tags", JSON.stringify(tags));
      fd.append("authorName", "Anonimo");
      if (thumb) fd.append("thumbnailUrl", thumb);
      fd.append("duration", durStr);
      
      let publicResult = null;
      try {
        const res = await fetch("/api/public/upload", { method: "POST", body: fd, credentials: "include" });
        const data = await res.json();
        if (res.ok && data.ok) {
          publicResult = data.content;
        }
      } catch (err) {
        console.warn("Public upload failed, using local only:", err);
      }
      
      // 2. Create local video data for immediate playback
      const videoData = {
        id: publicResult?.id || ("local_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)),
        titolo,
        desc: corpo || "",
        dur: durStr,
        cat: "creativo",
        autore: {
          nome: Account.data?.name || "Test User",
          handle: Account.data?.handle || "test_user",
          level: Account.data?.level || 1
        },
        fonte: {
          url: publicResult?.mediaUrl || videoUrl,
          type: file.type
        },
        poster: publicResult?.thumbnailUrl || thumb,
        thumb: publicResult?.thumbnailUrl || thumb,
        likes: 0,
        commenti: 0,
        tags,
        pubblico,
        local: !publicResult, // Mark as local-only if public upload failed
        createdAt: new Date().toISOString()
      };
      
      creativeVideos.unshift(videoData);
      saveLocalVideos([videoData]);
      
      // Close modals
      const cpModal = document.getElementById('createPostModal');
      if (cpModal) cpModal.classList.remove("is-open");
      const vupModal = document.getElementById('videoUploadModal');
      if (vupModal) vupModal.classList.remove("is-open");
      lockBodyScroll(false);
      try { newForm.reset(); } catch {}
      
      // Re-render videos
      try { await renderVideos(); } catch { try { renderVideos(); } catch {} }
      
      toast("Video pubblicato!", publicResult ? "Visibile su tutti i dispositivi" : "Salvato in locale (public API non disponibile)", "ok");
      
    } catch (err) {
      console.error("[LocalTestMode] Upload error:", err);
      toast("Errore caricamento", err.message, "err");
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(file);
    };
    video.src = URL.createObjectURL(file);
  });
}

function generateVideoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, 320, 180);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      };
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
  });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

  // Override playVideo to handle local videos
  // Enhanced local video play support
  const _playVideoOrig = playVideo;
  function playVideoEnhanced(id, opts = {}) {
    const video = creativeVideos.find(v => v.id === id);
    if (video && video.fonte?.url && (video.local || video.id?.startsWith('cv-') || video.id?.startsWith('local_'))) {
      $("#vmTitle").textContent = video.titolo;
      $("#vmDesc").textContent = video.desc || "Condiviso da " + (video.autore?.nome || video.autore?.handle || "Clan");
      $("#vmCat").textContent = "CREATIVO";
      $("#vmDur").textContent = video.dur || "—";
      const wrap = $("#playerWrap");
      const auto = !!opts.autoplay;
      wrap.innerHTML = `
        <div class="vid-player-creativo player-cine-frame" style="width:100%;height:100%;background:#060812;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
          <span class="player-cine-vignette" aria-hidden="true"></span>
          <video ${auto ? "autoplay" : ""} controls playsinline preload="metadata" style="max-width:100%;max-height:82vh;border-radius:12px;background:#01030a;position:relative;z-index:1;touch-action:pan-y pinch-zoom">
            <source src="${esc(video.fonte.url)}" type="${esc(video.fonte.type || 'video/mp4')}">
            Il tuo browser non supporta la riproduzione video.
          </video>
        </div>`;
      openModal("videoModal");
      lockBodyScroll(true);
      if (auto) {
        setTimeout(() => { try { wrap.querySelector("video")?.play().catch(()=>{}); } catch {} }, 90);
      }
      return;
    }
    _playVideoOrig(id, opts);
  }
  window.playVideo = playVideoEnhanced;

// Enhanced Video Upload System
function initAdvancedVideoUpload() {
  if (window.__videoUploadInit) return;
  window.__videoUploadInit = true;

  const modal = document.getElementById('videoUploadModal');
  const stepDrop = document.getElementById('vupStepDrop');
  const stepConfirm = document.getElementById('vupStepConfirm');
  const stepProgress = document.getElementById('vupStepProgress');
  const stepSuccess = document.getElementById('vupStepSuccess');
  const dropZone = document.getElementById('vupDropZone');
  const fileInput = document.getElementById('vupFileInput');
  const browseBtn = document.getElementById('vupBrowseBtn');
  const cancelConfirm = document.getElementById('vupCancelConfirm');
  const uploadNowBtn = document.getElementById('vupUploadNowBtn');
  const removeBtn2 = document.getElementById('vupRemove2');
  const doneBtn = document.getElementById('vupDoneBtn');
  const closeBtns = document.querySelectorAll('[data-close-video-upload]');

  let selectedFile = null;
  let uploadInterval = null;

  // Rigorous step engine — un solo step visibile per volta, flat DOM
  function goToStep(stepName) {
    const steps = ['drop', 'confirm', 'progress', 'success'];
    const displayMap = {
      drop: 'flex',
      confirm: 'flex',
      progress: 'flex',
      success: 'flex'
    };
    steps.forEach(s => {
      const el = document.getElementById('vupStep' + s.charAt(0).toUpperCase() + s.slice(1));
      if (!el) return;
      if (s === stepName) {
        el.classList.remove('upload-step');
        el.style.setProperty('display', displayMap[s], 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
      } else {
        el.classList.add('upload-step');
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
      }
    });
  }

  function setHeader(title, sub) {
    const h = document.getElementById('vupTitle');
    const s = document.getElementById('vupSubtitle');
    if (h) h.textContent = title;
    if (s) s.textContent = sub;
  }

  function resetUpload() {
    selectedFile = null;
    if (uploadInterval) { clearInterval(uploadInterval); uploadInterval = null; }
    goToStep('drop');
    setHeader('Trascina il tuo video', 'Trascina il file .mp4 o .mov oppure selezionalo dal finder');
    document.getElementById('vupFileInput').value = '';
    document.getElementById('vupTitleInput').value = '';
    document.getElementById('vupDescInput').value = '';
    document.getElementById('vupTagsInput').value = '';
    const vp = document.getElementById('vupVideoPreview2');
    if (vp.src) { URL.revokeObjectURL(vp.src); vp.src = ''; }
    document.getElementById('vupBar2').style.setProperty('width', '0%', 'important');
    document.getElementById('vupPercent2').textContent = '0%';
    document.getElementById('vupProgressDetail').textContent = 'Preparazione file…';
    document.getElementById('vupFileName2').textContent = '';
    document.getElementById('vupFileSize2').textContent = '';
    // Reset new UI elements
    const durationBadge = document.getElementById('vupDurationBadge');
    const previewTitle = document.getElementById('vupPreviewTitle');
    const previewDuration = document.getElementById('vupPreviewDuration');
    const descCount = document.getElementById('vupDescCount');
    const playOverlay = document.getElementById('vupPlayOverlay');
    const errorOverlay = document.getElementById('vupVideoError');
    const thumbScrub = document.getElementById('vupThumbScrub');
    const thumbTime = document.getElementById('vupThumbTime');
    if (durationBadge) durationBadge.textContent = '0:00';
    if (previewTitle) previewTitle.textContent = 'Titolo del video';
    if (previewDuration) previewDuration.textContent = '0:00';
    if (descCount) descCount.textContent = '0/500';
    if (playOverlay) playOverlay.style.opacity = '1';
    if (errorOverlay) errorOverlay.style.display = 'none';
    if (thumbScrub) { thumbScrub.value = '0'; thumbScrub.style.background = 'rgba(255,255,255,0.08)'; }
    if (thumbTime) thumbTime.textContent = '0:00';
    const thumbCanvas = document.getElementById('vupThumbCanvas');
    const thumbCtx = thumbCanvas?.getContext('2d');
    if (thumbCtx) thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    uploadNowBtn.disabled = false;
    uploadNowBtn.textContent = 'Carica adesso';
    uploadNowBtn.innerHTML = '<span style="position:relative;z-index:1">Carica adesso →</span><span style="position:absolute;inset:0;background:linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);animation:vupShimmer 2s ease-in-out infinite"></span>';
  }

  // Expose reset function globally
  window.resetVideoUpload = resetUpload;

  // Close modal
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (modal) { modal.classList.remove('is-open'); resetUpload(); }
    });
  });
  doneBtn?.addEventListener('click', () => {
    if (modal) { modal.classList.remove('is-open'); resetUpload(); }
  });

  // Click drop zone to browse — handled by <label for="vupFileInput"> natively, no JS needed
  // Drag and drop
  dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); });
  dropZone?.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragover'); });
  dropZone?.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); const files = e.dataTransfer.files; if (files && files.length > 0) handleFile(files[0]); });
  fileInput?.addEventListener('change', (e) => { const files = e.target.files; if (files && files.length > 0) handleFile(files[0]); });

  // Video events for play overlay — use named functions to allow re-binding
  function setupVideoEvents() {
    const vp = document.getElementById('vupVideoPreview2');
    const playOverlay = document.getElementById('vupPlayOverlay');
    const errorOverlay = document.getElementById('vupVideoError');
    const errorDetail = document.getElementById('vupVideoErrorDetail');
    if (!vp || !playOverlay) return;
    vp.removeEventListener('play', onVideoPlay);
    vp.removeEventListener('pause', onVideoPause);
    vp.removeEventListener('ended', onVideoEnded);
    vp.removeEventListener('waiting', onVideoWaiting);
    vp.removeEventListener('canplay', onVideoCanPlay);
    vp.removeEventListener('error', onVideoError);
    vp.addEventListener('play', onVideoPlay);
    vp.addEventListener('pause', onVideoPause);
    vp.addEventListener('ended', onVideoEnded);
    vp.addEventListener('waiting', onVideoWaiting);
    vp.addEventListener('canplay', onVideoCanPlay);
    vp.addEventListener('error', onVideoError);
    
    // Error overlay button handlers
    const retryBtn = document.getElementById('vupRetryVideo');
    const openBtn = document.getElementById('vupOpenExternal');
    if (retryBtn) {
      retryBtn.onclick = () => { vp.load(); if (errorOverlay) errorOverlay.style.display = 'none'; };
    }
    if (openBtn) {
      openBtn.onclick = () => { window.open(vp.src, '_blank'); };
    }
  }
  
  function onVideoPlay() { const o = document.getElementById('vupPlayOverlay'); if (o) o.style.opacity = '0'; }
  function onVideoPause() { const o = document.getElementById('vupPlayOverlay'); if (o) o.style.opacity = '1'; }
  function onVideoEnded() { const o = document.getElementById('vupPlayOverlay'); if (o) o.style.opacity = '1'; }
  function onVideoWaiting() { const o = document.getElementById('vupPlayOverlay'); if (o) o.style.opacity = '0.5'; }
  function onVideoCanPlay() { 
    const o = document.getElementById('vupPlayOverlay'); if (o) o.style.opacity = '1'; 
    // Video can play - hide error if showing
    const err = document.getElementById('vupVideoError'); if (err) err.style.display = 'none';
    // Check if video actually has visual content
    const vp = document.getElementById('vupVideoPreview2');
    if (vp && vp.videoWidth === 0) {
      // Video track exists but no frames - likely codec issue
      setTimeout(() => {
        if (vp.videoWidth === 0) onVideoError.call(vp, new Error('No video frames'));
      }, 1000);
    }
  }
  function onVideoError(e) { 
    const err = document.getElementById('vupVideoError');
    const detail = document.getElementById('vupVideoErrorDetail');
    const vp = document.getElementById('vupVideoPreview2');
    const playOverlay = document.getElementById('vupPlayOverlay');
    if (err) err.style.display = 'flex';
    if (playOverlay) playOverlay.style.opacity = '0';
    if (detail && vp) {
      const codec = vp.error ? vp.error.code : 'UNKNOWN';
      const mediaError = vp.error ? ['MEDIA_ERR_ABORTED','MEDIA_ERR_NETWORK','MEDIA_ERR_DECODE','MEDIA_ERR_SRC_NOT_SUPPORTED'][vp.error.code-1] : 'Unknown';
      detail.innerHTML = `Il browser non riesce a decodificare la traccia video.<br><small style="color:var(--violet-400);font-family:var(--ff-mono)">${mediaError} (code ${codec})</small><br>L'audio funziona ma il video no (es. HEVC/H.265 da iPhone).<br>Prova a convertire in H.264/MP4 o usa un file WebM.`;
    }
  }

  // Thumbnail scrubbing
  let thumbPoster = null;
  const thumbCanvas = document.getElementById('vupThumbCanvas');
  const thumbCtx = thumbCanvas?.getContext('2d');
  const thumbScrub = document.getElementById('vupThumbScrub');
  const thumbTime = document.getElementById('vupThumbTime');
  const vp = document.getElementById('vupVideoPreview2');
  const durationBadge = document.getElementById('vupDurationBadge');
  const playOverlay = document.getElementById('vupPlayOverlay');
  const previewTitle = document.getElementById('vupPreviewTitle');
  const previewDuration = document.getElementById('vupPreviewDuration');
  const descInput = document.getElementById('vupDescInput');
  const descCount = document.getElementById('vupDescCount');

  function drawThumbFrame() {
    if (!thumbCtx || !vp) return;
    if (vp.videoWidth === 0) {
      // No video track - draw placeholder on canvas
      thumbCtx.fillStyle = '#0a0c16';
      thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      // Draw "audio only" indicator
      thumbCtx.fillStyle = 'rgba(192,132,252,0.3)';
      thumbCtx.font = '14px var(--ff-mono)';
      thumbCtx.textAlign = 'center';
      thumbCtx.fillText('🎵 Solo audio', thumbCanvas.width/2, thumbCanvas.height/2);
      thumbPoster = thumbCanvas.toDataURL('image/jpeg', 0.85);
      return;
    }
    thumbCtx.drawImage(vp, 0, 0, thumbCanvas.width, thumbCanvas.height);
    thumbPoster = thumbCanvas.toDataURL('image/jpeg', 0.85);
    if (previewTitle) previewTitle.textContent = document.getElementById('vupTitleInput').value || 'Titolo del video';
    if (previewDuration && durationBadge) previewDuration.textContent = durationBadge.textContent;
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  thumbScrub?.addEventListener('input', (e) => {
    if (!vp || !selectedFile) return;
    const pct = +thumbScrub.value / 100;
    vp.currentTime = vp.duration * pct;
    const t = vp.duration * pct;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    thumbTime.textContent = `${m}:${s}`;
    vp.onseeked = () => { drawThumbFrame(); vp.onseeked = null; };
  });

  thumbScrub?.addEventListener('change', () => {
    drawThumbFrame();
  });

  // Description character counter
  descInput?.addEventListener('input', () => {
    if (descCount) descCount.textContent = `${descInput.value.length}/500`;
  });

  // Title input updates preview card
  document.getElementById('vupTitleInput')?.addEventListener('input', (e) => {
    if (previewTitle) previewTitle.textContent = e.target.value || 'Titolo del video';
  });

  function handleFile(file) {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      toast("Formato non supportato", "Usa MP4, MOV o WebM", "warn");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast("File troppo grande", "Dimensione massima: 500MB", "warn");
      return;
    }
    selectedFile = file;
    document.getElementById('vupFileName2').textContent = file.name;
    document.getElementById('vupFileSize2').textContent = formatFileSize(file.size);
    const baseTitle = file.name.replace(/\.[^/\.]+$/, '');
    document.getElementById('vupTitleInput').value = baseTitle;
    if (previewTitle) previewTitle.textContent = baseTitle;
    if (descCount) descCount.textContent = '0/500';
    const vp = document.getElementById('vupVideoPreview2');
    if (vp.src && vp.src.startsWith('blob:')) URL.revokeObjectURL(vp.src);
    vp.src = URL.createObjectURL(file);
    vp.onloadedmetadata = () => {
      thumbScrub.max = '100';
      thumbScrub.value = '0';
      thumbScrub.style.background = 'linear-gradient(90deg, var(--violet-400) 0%, rgba(255,255,255,0.08) 0%)';
      thumbTime.textContent = '0:00';
      if (durationBadge) durationBadge.textContent = formatTime(vp.duration);
      if (previewDuration) previewDuration.textContent = formatTime(vp.duration);
      drawThumbFrame();
      if (playOverlay) playOverlay.style.opacity = '1';
      setupVideoEvents();
    };
    vp.onerror = () => {
      toast("Errore video", "Impossibile caricare il file video", "err");
    };
    goToStep('confirm');
    setHeader('Dettagli video', 'Inserisci titolo, descrizione e tag');
  }

  removeBtn2?.addEventListener('click', () => {
    const vp = document.getElementById('vupVideoPreview2');
    if (vp.src) { URL.revokeObjectURL(vp.src); vp.src = ''; }
    selectedFile = null;
    goToStep('drop');
    setHeader('Trascina il tuo video', 'Trascina il file .mp4 o .mov oppure selezionalo dal finder');
    document.getElementById('vupFileInput').value = '';
    document.getElementById('vupTitleInput').value = '';
    document.getElementById('vupDescInput').value = '';
    document.getElementById('vupTagsInput').value = '';
    document.getElementById('vupFileName2').textContent = '';
    document.getElementById('vupFileSize2').textContent = '';
  });

  cancelConfirm?.addEventListener('click', () => { resetUpload(); });

  uploadNowBtn?.addEventListener('click', async () => {
    if (!selectedFile) return;
    const title = document.getElementById('vupTitleInput').value.trim();
    if (!title) {
      toast("Titolo richiesto", "Inserisci un titolo per il video", "warn");
      document.getElementById('vupTitleInput').focus();
      return;
    }
    const desc = document.getElementById('vupDescInput').value.trim();
    const tagsRaw = document.getElementById('vupTagsInput').value.trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    goToStep('progress');
    setHeader('Caricamento in corso', 'Elaborazione del file');

    let progressVal = 0;
    const progressBar = document.getElementById('vupBar2');
    const progressPercent = document.getElementById('vupPercent2');
    const progressDetail = document.getElementById('vupProgressDetail');
    const steps = [
      { p: 15, d: "Lettura file…" },
      { p: 35, d: "Decodifica metadati…" },
      { p: 60, d: "Ottimizzazione fotogrammi…" },
      { p: 85, d: "Compressione in corso…" },
      { p: 95, d: "Finalizzazione upload…" }
    ];
    let si = 0;
    uploadInterval = setInterval(() => {
      progressVal += Math.random() * 10 + 5;
      if (progressVal > 98) progressVal = 98;
      progressBar.style.setProperty('width', progressVal + '%', 'important');
      progressPercent.textContent = Math.floor(progressVal) + '%';
      if (si < steps.length && progressVal >= steps[si].p) {
        progressDetail.textContent = steps[si].d;
        si++;
      }
    }, 180);

    try {
      const videoUrl = URL.createObjectURL(selectedFile);
      const duration = await getVideoDuration(selectedFile);
      await new Promise(r => setTimeout(r, 1200));

      clearInterval(uploadInterval);
      uploadInterval = null;
      progressBar.style.setProperty('width', '100%', 'important');
      progressPercent.textContent = '100%';
      progressDetail.textContent = 'Completato';
      await new Promise(r => setTimeout(r, 400));

      const videoData = {
        id: "local_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        titolo: title,
        desc: desc || `Caricato da ${selectedFile.name}`,
        dur: formatDuration(duration),
        cat: "creativo",
        poster: thumbPoster || null,
        autore: {
          nome: Account.data?.name || Account.data?.displayName || "Test User",
          handle: Account.data?.handle || "test_user",
          level: Account.data?.level || 1
        },
        fonte: { url: videoUrl, type: selectedFile.type },
        likes: 0, commenti: 0, tags: ["locale", "video", ...tags], pubblico: true,
        local: true, createdAt: new Date().toISOString()
      };
      if (typeof creativeVideos !== 'undefined') creativeVideos.unshift(videoData);
      saveLocalVideos([videoData]);

      goToStep('success');
      setHeader('Video caricato!', 'Il video è ora nella sezione Creatività');
      if (typeof renderVideos === 'function') renderVideos();
      toast("Video caricato con successo!", "Il video è ora nella sezione Creatività", "ok");
    } catch (err) {
      clearInterval(uploadInterval);
      uploadInterval = null;
      console.error("[VideoUpload] Error:", err);
      toast("Errore durante il caricamento", err.message, "err");
      goToStep('confirm');
      setHeader('Dettagli video', 'Inserisci titolo, descrizione e tag');
      uploadNowBtn.disabled = false;
      uploadNowBtn.textContent = 'Carica adesso';
    }
  });
}


function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ── Watermark / Filigrana Integration ── */
if (typeof WATERMARK !== 'undefined') {
  WATERMARK.integrateWithFiligrana();
  document.addEventListener('DOMContentLoaded', () => {
    WATERMARK.initSectionWatermarks();
    WATERMARK.observeVisibility();
  });
}

/* ── VideoSystem Integration ── */
if (typeof VideoSystem !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await VideoSystem.init();
      VideoSystem.on('onSyncStatusChange', (online) => {
        const indicator = document.getElementById('videoSyncIndicator');
        if (indicator) {
          indicator.textContent = online ? '🟢 Online' : '🔴 Offline';
          indicator.style.color = online ? 'var(--fuji)' : 'var(--danger)';
        }
      });
      VideoSystem.on('onUploadProgress', (id, progress) => {
        const el = document.querySelector(`[data-vid="${id}"] .vid-progress`);
        if (el) el.style.width = `${progress}%`;
      });
      VideoSystem.on('onUploadComplete', (video) => {
        toast("Video caricato", `"${video.title}" è online`, "ok");
        if (window.Views) window.Views.loadVideos();
      });
      VideoSystem.on('onUploadError', (id, error) => {
        toast("Errore upload", error.message, "err");
      });
      VideoSystem.on('onVideoSaved', (video) => {
        console.log("Video salvato localmente:", video.id);
      });
    } catch (error) {
      console.error("VideoSystem init failed:", error);
    }
  });
}

/* ── DomainPurchase Integration ── */
if (typeof DomainPurchase !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    DomainPurchase.init();
    
    document.getElementById('btnDomain')?.addEventListener('click', () => {
      DomainPurchase.createDomainModal();
    });
    
    DomainPurchase.on('onStatusChange', (status, domain) => {
      console.log('Domain status:', status, domain);
    });
  });
}
