// assets/js/chronicles.js — Cronache del Clan: Carousel, Grid, Upload Unificato
// Liquid Glass 3D, Bolle, Persistenza Reale (Server + localStorage)

const Chronicles = (() => {
  let chroniclesItems = [];
  let chroniclesFilter = "all";
  let chroniclesCursor = null;
  let chroniclesLoading = false;
  let carouselIndex = 0;
  let carouselItems = [];
  let carouselInterval = null;
  let currentUploadTab = "photo";
  let uploadFiles = { photo: [], video: null, eventImage: null };

  // ============ API HELPERS ============
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "include"
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Errore di rete" }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function uploadContent(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/public/upload");
      xhr.withCredentials = true;
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } 
          catch { reject(new Error("Risposta non valida")); }
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).message)); } 
          catch { reject(new Error(`Upload fallito: ${xhr.status}`)); }
        }
      };
      xhr.onerror = () => reject(new Error("Errore di rete"));
      xhr.send(formData);
    });
  }

  // ============ THUMBNAIL GENERATION ============
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
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ============ LOCAL STORAGE (Anonymous persistence) ============
  function getLocalUploads() {
    try { return JSON.parse(localStorage.getItem("sam_chronicles_uploads") || "[]"); }
    catch { return []; }
  }

  function saveLocalUpload(upload) {
    const uploads = getLocalUploads();
    uploads.unshift({ ...upload, id: "local-" + Date.now(), createdAt: new Date().toISOString() });
    localStorage.setItem("sam_chronicles_uploads", JSON.stringify(uploads.slice(0, 100)));
  }

  // ============ NORMALIZZAZIONE DATI ============
  function normalizeItem(item, source) {
    const isLocal = source === "local";
    return {
      id: item.id,
      type: item.type,
      title: item.title || item.titolo || "Senza titolo",
      description: item.description || item.descrizione || item.corpo || "",
      mediaUrl: item.mediaUrl || item.media_url || item.src,
      thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || item.poster || item.mediaUrl || item.media_url,
      duration: item.duration,
      category: item.category || item.categoria || "creativo",
      tags: item.tags || [],
      authorName: item.authorName || item.author_name || "Anonimo",
      likes: item.likes || item.likes_count || 0,
      comments: item.comments || item.commenti_count || 0,
      eventDate: item.eventDate || item.event_date,
      eventLocation: item.eventLocation || item.event_location,
      createdAt: item.createdAt || item.created_at,
      isLocal,
      isMine: false // verrà calcolato dopo
    };
  }

  function getAllItems() {
    const serverItems = chroniclesItems.map(i => normalizeItem(i, "server"));
    const localItems = getLocalUploads().map(i => normalizeItem(i, "local"));
    return [...serverItems, ...localItems];
  }

  // ============ RENDER CAROUSEL ============
  function renderCarousel() {
    const track = $("#chroniclesCarouselTrack");
    const dots = $("#chroniclesCarouselDots");
    const prevBtn = $("#chroniclesCarouselPrev");
    const nextBtn = $("#chroniclesCarouselNext");
    if (!track || !dots) return;

    // Prendi primi 5 item (featured + recenti)
    const all = getAllItems().filter(i => i.mediaUrl);
    carouselItems = all.slice(0, 5);
    
    if (carouselItems.length === 0) {
      track.innerHTML = `<div class="chronicles-carousel-slide" style="display:flex;align-items:center;justify-content:center;color:var(--silver-500)"><span>Nessun contenuto in evidenza</span></div>`;
      dots.innerHTML = "";
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }

    track.innerHTML = carouselItems.map((item, i) => `
      <div class="chronicles-carousel-slide${i === 0 ? " is-active" : ""}" data-index="${i}" data-id="${item.id}" style="--d:${i * 80}ms">
        ${item.type === "video" && item.thumbnailUrl ? `
          <img class="chronicles-carousel-media" src="${item.thumbnailUrl}" alt="${esc(item.title)}" loading="${i === 0 ? "eager" : "lazy"}">
          <div class="chronicles-carousel-video"><span class="chronicles-carousel-play">▶</span></div>
        ` : `
          <img class="chronicles-carousel-media" src="${item.mediaUrl}" alt="${esc(item.title)}" loading="${i === 0 ? "eager" : "lazy"}">
        `}
        <div class="chronicles-carousel-overlay">
          <span class="chronicles-carousel-category">${item.category.toUpperCase()}</span>
          <h3 class="chronicles-carousel-title">${esc(item.title)}</h3>
          <div class="chronicles-carousel-meta">
            <span class="chronicles-carousel-author">
              ${item.authorName !== "Anonimo" ? `<img class="chronicles-carousel-author-avatar" src="${item.mediaUrl}" alt="">` : ""}
              <span>${esc(item.authorName)}</span>
            </span>
            <span>·</span>
            <span>${formatDate(item.createdAt)}</span>
            ${item.duration ? `<span>·</span><span>${item.duration}</span>` : ""}
          </div>
        </div>
      </div>
    `).join("");

    dots.innerHTML = carouselItems.map((_, i) => `
      <button class="chronicles-carousel-dot${i === 0 ? " is-active" : ""}" data-index="${i}" role="tab" aria-selected="${i === 0}" aria-label="Slide ${i + 1}"></button>
    `).join("");

    prevBtn.disabled = false;
    nextBtn.disabled = false;
    bindCarouselEvents();
    startCarouselAutoPlay();
  }

  function bindCarouselEvents() {
    const track = $("#chroniclesCarouselTrack");
    const prevBtn = $("#chroniclesCarouselPrev");
    const nextBtn = $("#chroniclesCarouselNext");
    const dots = $$("#chroniclesCarouselDots .chronicles-carousel-dot");
    const slides = $$("#chroniclesCarouselTrack .chronicles-carousel-slide");

    if (!track) return;

    const goTo = (index) => {
      if (index < 0) index = carouselItems.length - 1;
      if (index >= carouselItems.length) index = 0;
      carouselIndex = index;
      track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
      dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
      dots.forEach((d, i) => d.setAttribute("aria-selected", i === index));
    };

    prevBtn.onclick = () => { goTo(carouselIndex - 1); resetAutoPlay(); };
    nextBtn.onclick = () => { goTo(carouselIndex + 1); resetAutoPlay(); };
    dots.forEach((dot, i) => { dot.onclick = () => { goTo(i); resetAutoPlay(); }; });

    // Keyboard
    track.onkeydown = (e) => {
      if (e.key === "ArrowLeft") { goTo(carouselIndex - 1); resetAutoPlay(); }
      if (e.key === "ArrowRight") { goTo(carouselIndex + 1); resetAutoPlay(); }
    };
  }

  function startCarouselAutoPlay() {
    stopCarouselAutoPlay();
    carouselInterval = setInterval(() => { 
      const track = $("#chroniclesCarouselTrack");
      if (track && !track.matches(":hover")) goTo(carouselIndex + 1);
    }, 6000);
  }

  function stopCarouselAutoPlay() { if (carouselInterval) clearInterval(carouselInterval); }
  function resetAutoPlay() { stopCarouselAutoPlay(); startCarouselAutoPlay(); }

  function goTo(index) {
    if (index < 0) index = carouselItems.length - 1;
    if (index >= carouselItems.length) index = 0;
    carouselIndex = index;
    const track = $("#chroniclesCarouselTrack");
    if (track) track.style.transform = `translateX(-${index * 100}%)`;
    $$("#chroniclesCarouselTrack .chronicles-carousel-slide").forEach((s, i) => s.classList.toggle("is-active", i === index));
    $$("#chroniclesCarouselDots .chronicles-carousel-dot").forEach((d, i) => {
      d.classList.toggle("is-active", i === index);
      d.setAttribute("aria-selected", i === index);
    });
  }

  // ============ RENDER GRID ============
  function applyFilter() {
    const cards = $$("#chroniclesGrid .chronicle-card");
    let visible = 0;
    cards.forEach(card => {
      const cat = card.dataset.type;
      const show = chroniclesFilter === "all" || 
                   (chroniclesFilter === "mine" && card.dataset.mine === "true") ||
                   cat === chroniclesFilter;
      card.classList.toggle("is-hidden", !show);
      if (show) visible++;
    });
    $("#chroniclesEmpty").style.display = visible === 0 ? "block" : "none";
    $("#chroniclesLoadMore").style.display = (visible > 0 && chroniclesCursor) ? "block" : "none";
  }

  function renderGrid(append = false) {
    const grid = $("#chroniclesGrid");
    const items = getAllItems();
    
    if (items.length === 0) {
      if (!append) grid.innerHTML = "";
      $("#chroniclesEmpty").style.display = "block";
      $("#chroniclesLoadMore").style.display = "none";
      return;
    }

    const filtered = items.filter(item => {
      if (chroniclesFilter === "all") return true;
      if (chroniclesFilter === "mine") return item.isMine;
      return item.type === chroniclesFilter;
    });

    if (!append) grid.innerHTML = "";
    
    filtered.forEach((item, i) => {
      const isVideo = item.type === "video";
      const isEvent = item.type === "event";
      const card = document.createElement("article");
      card.className = "chronicle-card reveal-glass";
      card.dataset.type = item.type;
      card.dataset.mine = item.isMine.toString();
      card.dataset.id = item.id;
      card.style.setProperty("--d", `${i * 50}ms`);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${item.title} - ${item.category}`);

      const thumb = isVideo && item.thumbnailUrl ? item.thumbnailUrl : item.mediaUrl;
      const durationHtml = item.duration && isVideo ? `<span class="unified-preview-duration" style="position:absolute;bottom:8px;right:8px;padding:2px 6px;border-radius:4px;font-size:.7rem;font-family:var(--ff-mono);color:var(--shiro-kabe);background:rgba(3,6,15,.9);backdrop-filter:blur(10px)">${item.duration}</span>` : "";
      
      card.innerHTML = `
        <img class="chronicle-media" src="${thumb}" alt="${esc(item.title)}" loading="lazy">
        ${isVideo ? `<button class="chronicle-video-badge" aria-label="Guarda video">▶</button>` : ""}
        ${isEvent ? `<span class="chronicle-category">${item.category.toUpperCase()}</span>` : `<span class="chronicle-category">${item.category.toUpperCase()}</span>`}
        <div class="chronicle-info">
          <h4 class="chronicle-title">${esc(item.title)}</h4>
          <div class="chronicle-meta">
            <span class="chronicle-author">
              ${item.authorName !== "Anonimo" ? `<img class="chronicle-author-avatar" src="${item.mediaUrl}" alt="">` : ""}
              <span>${esc(item.authorName)}</span>
            </span>
            <span>·</span>
            <span>${formatDate(item.createdAt)}</span>
            ${item.eventDate ? `<span>·</span><span>📅 ${formatDate(item.eventDate)}</span>` : ""}
            ${item.eventLocation ? `<span>·</span><span>📍 ${esc(item.eventLocation)}</span>` : ""}
          </div>
        </div>
        ${durationHtml}
      `;
      
      // Click handler per aprire lightbox/player
      card.onclick = () => openContentModal(item);
      card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openContentModal(item); } };
      
      grid.appendChild(card);
    });

    // Observe per animazioni
    setTimeout(() => {
      $$("#chroniclesGrid .chronicle-card:not(.is-in)").forEach(el => {
        if (window.UI && UI.observe) UI.observe(el);
      });
    }, 50);

    applyFilter();
    $("#chroniclesEmpty").style.display = filtered.length === 0 ? "block" : "none";
  }

  // ============ CONTENT MODAL (Lightbox/Player) ============
  function openContentModal(item) {
    if (item.type === "video") {
      openVideoModal(item);
    } else if (item.type === "photo") {
      openPhotoLightbox(item);
    } else if (item.type === "event") {
      openEventModal(item);
    }
  }

  function openVideoModal(item) {
    const wrap = $("#playerWrap");
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="vid-player-creativo player-cine-frame" style="width:100%;height:100%;background:#060812;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
        <span class="player-cine-vignette" aria-hidden="true"></span>
        <video controls playsinline preload="metadata" style="max-width:100%;max-height:82vh;border-radius:12px;background:#01030a;position:relative;z-index:1">
          <source src="${esc(item.mediaUrl)}" type="video/mp4">
          Il tuo browser non supporta la riproduzione video.
        </video>
      </div>`;
    $("#vmTitle").textContent = item.title;
    $("#vmDesc").textContent = item.description || "";
    $("#vmCat").textContent = item.category.toUpperCase();
    $("#vmDur").textContent = item.duration || "—";
    UI.openModal("videoModal");
    UI.lockBodyScroll(true);
    setTimeout(() => { const v = wrap.querySelector("video"); if (v) v.play().catch(() => {}); }, 90);
  }

  function openPhotoLightbox(item) {
    // Usa lightbox esistente
    const idx = getAllItems().findIndex(i => i.id === item.id && i.type === "photo");
    if (typeof openLightbox === "function") openLightbox(item.id);
  }

  function openEventModal(item) {
    const content = `
      <div style="text-align:left;padding:var(--sp-4)">
        <h3 style="font-family:var(--ff-display);color:var(--violet-300);margin-bottom:var(--sp-3)">${esc(item.title)}</h3>
        <p style="color:var(--silver-300);margin-bottom:var(--sp-4)">${esc(item.description || "Nessuna descrizione")}</p>
        <div style="display:flex;flex-direction:column;gap:12px;font-size:.9rem;color:var(--silver-400)">
          <div class="row" style="gap:8px"><span style="color:var(--violet-300);font-family:var(--ff-mono)">📅</span><span>${formatDateTime(item.eventDate)}</span></div>
          <div class="row" style="gap:8px"><span style="color:var(--violet-300);font-family:var(--ff-mono)">📍</span><span>${esc(item.eventLocation || "—")}</span></div>
          <div class="row" style="gap:8px"><span style="color:var(--violet-300);font-family:var(--ff-mono)">👤</span><span>${esc(item.authorName)}</span></div>
          <div class="row" style="gap:8px"><span style="color:var(--violet-300);font-family:var(--ff-mono)">🏷️</span><span>${item.category}</span></div>
        </div>
      </div>
    `;
    UI.toast(item.title, "Dettagli evento", "ok", 5000);
    // Potremmo aprire un modal dedicato qui
  }

  // ============ UPLOAD MODAL ============
  function initUploadModal() {
    const modal = $("#unifiedUploadModal");
    if (!modal) return;

    // Tabs
    $$("#unifiedUploadModal .unified-upload-tab").forEach(tab => {
      tab.onclick = () => switchUploadTab(tab.dataset.tab);
    });

    // Dropzones
    initDropzone("photoDropzone", "photoInput", "photoPreviews", "photo", handlePhotoFiles);
    initDropzone("videoDropzone", "videoInput", "videoPreviews", "video", handleVideoFile);
    initDropzone("eventImageDropzone", "eventImageInput", "eventImagePreviews", "eventImage", handleEventImageFile);

    // Form submit
    $("#unifiedUploadForm").onsubmit = handleUploadSubmit;

    // Input nickname salvato
    const savedName = localStorage.getItem("sam_uploader_name");
    if (savedName) $("#uploaderName").value = savedName;
    $("#uploaderName").onchange = () => localStorage.setItem("sam_uploader_name", $("#uploaderName").value);
  }

  function switchUploadTab(tab) {
    currentUploadTab = tab;
    $$("#unifiedUploadModal .unified-upload-tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === tab));
    $$("#unifiedUploadModal .unified-tab-panel").forEach(p => p.style.display = p.dataset.panel === tab ? "block" : "none");
  }

  function initDropzone(dropzoneId, inputId, previewsId, type, handler) {
    const dropzone = $(`#${dropzoneId}`);
    const input = $(`#${inputId}`);
    const previews = $(`#${previewsId}`);
    if (!dropzone || !input || !previews) return;

    ["dragenter", "dragover"].forEach(evt => {
      dropzone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add("dragover"); });
    });
    ["dragleave", "drop"].forEach(evt => {
      dropzone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("dragover"); });
    });
    dropzone.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("dragover"); handler(e.dataTransfer.files); });
    dropzone.addEventListener("click", () => input.click());
    input.onchange = () => handler(input.files);
  }

  function handlePhotoFiles(files) {
    uploadFiles.photo = Array.from(files).slice(0, 10);
    renderPreviews("photoPreviews", uploadFiles.photo);
  }

  function handleVideoFile(files) {
    if (files.length > 0) {
      uploadFiles.video = files[0];
      renderPreviews("videoPreviews", [files[0]], true);
      generateVideoThumbnail(files[0]).then(thumb => {
        if (thumb) {
          const preview = $("#videoPreviews .unified-preview");
          if (preview) preview.querySelector(".unified-preview-media").src = thumb;
        }
      });
    }
  }

  function handleEventImageFile(files) {
    uploadFiles.eventImage = files[0] || null;
    renderPreviews("eventImagePreviews", files.length ? [files[0]] : []);
  }

  function renderPreviews(containerId, files, isVideo = false) {
    const container = $(`#${containerId}`);
    if (!container) return;
    container.innerHTML = "";
    files.forEach((file, i) => {
      const item = document.createElement("div");
      item.className = "unified-preview";
      item.style.animationDelay = `${i * 50}ms`;
      
      if (isVideo || file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        item.innerHTML = `
          <video class="unified-preview-media" src="${url}" muted></video>
          <button class="unified-preview-remove" aria-label="Rimuovi" data-index="${i}">✕</button>
          <span class="unified-preview-duration">--:--</span>
        `;
        // Estrai durata
        const video = item.querySelector("video");
        video.onloadedmetadata = () => {
          item.querySelector(".unified-preview-duration").textContent = formatDuration(video.duration);
        };
      } else {
        const url = URL.createObjectURL(file);
        item.innerHTML = `
          <img class="unified-preview-media" src="${url}" alt="Preview ${i+1}">
          <button class="unified-preview-remove" aria-label="Rimuovi" data-index="${i}">✕</button>
        `;
      }
      
      item.querySelector(".unified-preview-remove").onclick = () => {
        URL.revokeObjectURL(item.querySelector(".unified-preview-media").src);
        if (type === "photo") uploadFiles.photo.splice(i, 1);
        else if (type === "video") uploadFiles.video = null;
        else if (type === "eventImage") uploadFiles.eventImage = null;
        renderPreviews(containerId, type === "photo" ? uploadFiles.photo : (type === "video" ? (uploadFiles.video ? [uploadFiles.video] : []) : (uploadFiles.eventImage ? [uploadFiles.eventImage] : [])), isVideo);
      };
      
      container.appendChild(item);
    });
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    const submitBtn = $("#unifiedSubmit");
    const progress = $("#unifiedProgress");
    const progressBar = $("#unifiedProgressBar");
    const progressText = $("#unifiedProgressText");

    // Validazione base
    const authorName = $("#uploaderName").value.trim();
    if (!authorName) { UI.toast("Errore", "Inserisci il tuo nome/nickname", "err"); return; }

    let title, description, category, tags, eventDate, eventLocation;
    const formData = new FormData();
    formData.append("authorName", authorName);

    if (currentUploadTab === "photo") {
      if (!uploadFiles.photo.length) { UI.toast("Errore", "Seleziona almeno una foto", "err"); return; }
      title = $("#photoTitle").value.trim();
      if (!title) { UI.toast("Errore", "Titolo richiesto", "err"); return; }
      description = $("#photoDescription").value.trim();
      category = $("#photoCategory").value;
      tags = $("#photoTags").value.split(",").map(t => t.trim()).filter(Boolean);
      
      formData.append("type", "photo");
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("tags", JSON.stringify(tags));
      uploadFiles.photo.forEach((f, i) => formData.append("files", f, f.name));
    } 
    else if (currentUploadTab === "video") {
      if (!uploadFiles.video) { UI.toast("Errore", "Seleziona un video", "err"); return; }
      title = $("#videoTitle").value.trim();
      if (!title) { UI.toast("Errore", "Titolo richiesto", "err"); return; }
      description = $("#videoDescription").value.trim();
      category = $("#videoCategory").value;
      tags = $("#videoTags").value.split(",").map(t => t.trim()).filter(Boolean);
      
      formData.append("type", "video");
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("tags", JSON.stringify(tags));
      formData.append("files", uploadFiles.video, uploadFiles.video.name);
      
      // Genera thumbnail e durata
      const thumb = await generateVideoThumbnail(uploadFiles.video);
      if (thumb) formData.append("thumbnailUrl", thumb);
      
      const duration = await getVideoDuration(uploadFiles.video);
      if (duration) formData.append("duration", duration);
    }
    else if (currentUploadTab === "event") {
      title = $("#eventTitle").value.trim();
      if (!title) { UI.toast("Errore", "Titolo evento richiesto", "err"); return; }
      description = $("#eventDescription").value.trim();
      eventDate = $("#eventDate").value;
      if (!eventDate) { UI.toast("Errore", "Data evento richiesta", "err"); return; }
      eventLocation = $("#eventLocation").value.trim();
      if (!eventLocation) { UI.toast("Errore", "Luogo richiesto", "err"); return; }
      category = $("#eventCategory").value;
      tags = $("#eventTags").value.split(",").map(t => t.trim()).filter(Boolean);
      
      formData.append("type", "event");
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("tags", JSON.stringify(tags));
      formData.append("eventDate", eventDate);
      formData.append("eventLocation", eventLocation);
      
      if (uploadFiles.eventImage) {
        formData.append("files", uploadFiles.eventImage, uploadFiles.eventImage.name);
      }
    }

    // Upload con progress
    submitBtn.disabled = true;
    submitBtn.textContent = "Pubblicazione...";
    progress.style.display = "block";
    progressBar.style.width = "0%";
    progressText.textContent = "0%";

    try {
      const result = await uploadContent(formData, (pct) => {
        progressBar.style.width = `${pct}%`;
        progressText.textContent = `${Math.round(pct)}%`;
      });

      // Salva in localStorage per visibilità immediata (anche se pending)
      const localItem = {
        type: currentUploadTab,
        title, description, category, tags,
        authorName,
        mediaUrl: result.content?.mediaUrl || URL.createObjectURL(
          currentUploadTab === "photo" ? uploadFiles.photo[0] : 
          currentUploadTab === "video" ? uploadFiles.video : 
          uploadFiles.eventImage
        ),
        thumbnailUrl: currentUploadTab === "video" ? await generateVideoThumbnail(uploadFiles.video) : null,
        duration: currentUploadTab === "video" ? await getVideoDuration(uploadFiles.video) : null,
        eventDate, eventLocation,
        createdAt: new Date().toISOString()
      };
      saveLocalUpload(localItem);

      UI.toast("Successo!", result.content?.message || "Cronaca pubblicata!", "ok");
      UI.closeModal("unifiedUploadModal");
      resetUploadForm();
      refreshChronicles();
    } catch (err) {
      UI.toast("Errore", err.message || "Upload fallito", "err");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Pubblica Cronaca";
      progress.style.display = "none";
    }
  }

  function getVideoDuration(file) {
    return new Promise(resolve => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        resolve(formatDuration(video.duration));
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    });
  }

  function resetUploadForm() {
    uploadFiles = { photo: [], video: null, eventImage: null };
    $$("#unifiedUploadModal .unified-previews").forEach(c => c.innerHTML = "");
    $$("#unifiedUploadModal .unified-input, #unifiedUploadModal .unified-textarea, #unifiedUploadModal .unified-select").forEach(i => { 
      if (i.tagName === "SELECT") i.selectedIndex = 0; 
      else i.value = ""; 
    });
    switchUploadTab("photo");
  }

  // ============ LOAD FROM SERVER ============
  async function loadServerChronicles(append = false) {
    if (chroniclesLoading) return;
    chroniclesLoading = true;
    
    const cursorParam = append && chroniclesCursor ? `&cursor=${encodeURIComponent(chroniclesCursor)}` : "";
    const url = `/api/public/content?limit=20${cursorParam}&status=approved`;
    
    try {
      const res = await apiFetch(url);
      if (!append) chroniclesItems = res.items;
      else chroniclesItems = [...chroniclesItems, ...res.items];
      chroniclesCursor = res.nextCursor;
      chroniclesLoading = false;
      renderCarousel();
      renderGrid(append);
    } catch (err) {
      chroniclesLoading = false;
      console.error("Errore caricamento cronache:", err);
      UI.toast("Errore", "Impossibile caricare le cronache", "err");
    }
  }

  function refreshChronicles() {
    chroniclesCursor = null;
    loadServerChronicles(false);
  }

  // ============ EVENT BINDINGS ============
  function bindEvents() {
    // Filtri
    $$("#chroniclesFilters .chronicles-filter").forEach(btn => {
      btn.onclick = () => {
        $$("#chroniclesFilters .chronicles-filter").forEach(b => b.classList.toggle("is-active", b === btn));
        chroniclesFilter = btn.dataset.filter;
        applyFilter();
      };
    });

    // Load more
    $("#chroniclesLoadMore").onclick = () => loadServerChronicles(true);

    // Empty state upload
    $("#chroniclesEmptyUpload").onclick = () => UI.openModal("unifiedUploadModal");

    // Modal open from various places
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-open-upload]");
      if (btn) UI.openModal("unifiedUploadModal");
    });
  }

  // ============ INIT ============
  function init() {
    bindEvents();
    initUploadModal();
    loadServerChronicles(false);
    
    // Listener per nuovi upload da altre sezioni
    document.addEventListener("sam:public-uploaded", () => refreshChronicles());
    document.addEventListener("sam:uploads", () => { renderCarousel(); renderGrid(); });
  }

  // ============ UTILS ============
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function esc(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&",
      "<": "<",
      ">": ">",
      '"': "\"",
      "'": "'"
    })[c]);
  }

  return { init, refreshChronicles, openContentModal };
})();

// Auto-init quando la vista chronicles è attiva
document.addEventListener("sam:route", () => {
  if (location.hash.includes("chronicles")) {
    setTimeout(() => Chronicles.init(), 100);
  }
});

// Se già nella vista chronicles al load
if (location.hash.includes("chronicles")) {
  document.addEventListener("DOMContentLoaded", () => setTimeout(() => Chronicles.init(), 100));
}