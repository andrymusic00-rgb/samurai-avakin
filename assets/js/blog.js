const Blog = (() => {
  const $ = (sel, r = document) => r.querySelector(sel);
  const $$ = (sel, r = document) => Array.from(r.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => Number(v ?? 0).toLocaleString("it-IT");
  const dt = (v) => v ? new Date(v).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "—";

  let _posts = [];
  let _filter = "all";
  let _selectedFiles = []; // { file, preview, tipo }

  /* ---------------------------------------------------------------- init */
  function init() {
    bindFilters();
    bindCreatePost();
    bindPostActions();
  }

  function bindFilters() {
    $$("#blogGrid").length; // no-op
    document.addEventListener("click", (e) => {
      const newPostBtn = e.target.closest("#btnNuovoPost");
      if (newPostBtn) {
        openCreatePost();
        return;
      }
      const chip = e.target.closest("#blogGrid ~ .filter-bar [data-btype], .filter-bar [data-btype]");
      if (chip) {
        $$(".filter-bar [data-btype]").forEach((c) => c.classList.toggle("is-active", c === chip));
        _filter = chip.dataset.btype;
        paintBlog();
        return;
      }
      const refresh = e.target.closest("#btnRefreshBlog");
      if (refresh) { loadBlog(); return; }
    });
  }

  /* ---------------------------------------------------------------- carica */
  async function loadBlog() {
    const box = $("#blogGrid");
    const status = $("#blogStatus");
    if (!box) return;
    box.innerHTML = "";
    if (status) status.textContent = "Caricamento contenuti creativi…";

    let dati;
    try {
      const r = await API.get("/api/creative");
      dati = r.post ?? [];
    } catch {
      dati = [];
      if (status) status.textContent = "Server non raggiungibile: mostra solo contenuti locali.";
    }

    _posts = dati;
    paintBlog();
    if (status) {
      status.textContent = `${_posts.length} ${_posts.length === 1 ? "contenuto" : "contenuti creativi"} · dati dal server`;
    }
  }

  function paintBlog() {
    const box = $("#blogGrid");
    const empty = $("#blogEmpty");
    if (!box) return;

    const list = _posts.filter((p) => _filter === "all" || p.tipo === _filter);

    if (!list.length) {
      box.innerHTML = "";
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";

    box.innerHTML = list.map((p) => renderPostCard(p)).join("");
    observePosts();
  }

  function renderPostCard(p) {
    const mioLike = p.mioLike ? " is-liked" : "";
    const tipoTag = { foto: "📷", video: "🎬", audio: "🎵", testo: "📝", misto: "📎" }[p.tipo] || "📎";
    const mediaHtml = p.mediaUrl ? `<div class="bp-media"><img src="${esc(p.mediaUrl)}" alt="${esc(p.titolo)}" loading="lazy"></div>` : "";
    const tagsHtml = (p.tags ?? []).map((t) => `<span class="bp-tag">${esc(t)}</span>`).join("");
    return `
      <article class="bp-card glass-violet${mioLike}" data-post="${esc(p.id)}" data-reveal>
        <div class="bp-head">
          <div class="bp-av">${esc((p.autore?.handle || "?")[0])}</div>
          <div style="min-width:0">
            <b>${esc(p.autore?.nome || p.autore?.handle || "Samurai")}</b>
            <small class="mono">${esc(p.autore?.handle)} · Lv ${p.autore?.level ?? 1} · ${dt(p.creatoIl)}</small>
          </div>
        </div>
        <div class="bp-body">
          <div class="bp-meta" style="margin-bottom:8px">
            <span class="bp-tipo">${tipoTag} ${esc(p.tipo)}</span>
            ${tagsHtml}
          </div>
          <h3 style="margin:0 0 8px;color:var(--silver-100)">${esc(p.titolo)}</h3>
          <p style="color:var(--silver-400);font-size:.9rem;line-height:1.5;margin:0 0 12px">${esc(p.corpo)}</p>
          ${mediaHtml}
        </div>
        <div class="bp-foot">
          <button class="bp-btn${mioLike}" data-like="${esc(p.id)}" aria-label="Like">
            <span>⚔</span> <b>${num(p.likes)}</b>
          </button>
          <button class="bp-btn" data-commenti="${esc(p.id)}" aria-label="Commenti">
            <span>💬</span> <b>${num(p.commenti)}</b>
          </button>
          ${p.autore?.id === (Account?.data?.id) ? `<button class="bp-btn bp-danger" data-elimina="${esc(p.id)}" aria-label="Elimina">🗑</button>` : ""}
        </div>
      </article>`;
  }

  function observePosts() {
    $$("[data-post]").forEach((card) => {
      if (card.dataset.bpBound) return;
      card.dataset.bpBound = "1";
    });
  }

  /* ---------------------------------------------------------------- azioni post */
  function bindPostActions() {
    document.addEventListener("click", async (e) => {
      const like = e.target.closest("[data-like]");
      if (like) { e.preventDefault(); await toggleLike(like.dataset.like); return; }

      const commenti = e.target.closest("[data-commenti]");
      if (commenti) { e.preventDefault(); openCommenti(commenti.dataset.commenti); return; }

      const elimina = e.target.closest("[data-elimina]");
      if (elimina) { e.preventDefault(); eliminaPost(elimina.dataset.elimina); return; }
    });
  }

  async function toggleLike(postId) {
    try {
      const r = await API.post(`/api/creative/${encodeURIComponent(postId)}/like`);
      loadBlog();
      toast(`Ti piace questo contenuto`, r.like ? "Like aggiunto" : "Like rimosso", r.like ? "ok" : "warn", 1500);
    } catch (err) {
      toast("Like non registrato", err?.message || "Riprova.", "err");
    }
  }

  async function eliminaPost(postId) {
    const ok = confirm("Eliminare questo contenuto creativo? L'operazione è irreversibile.");
    if (!ok) return;
    try {
      await API.del(`/api/creative/${encodeURIComponent(postId)}`);
      loadBlog();
      toast("Contenuto eliminato", "", "ok", 2000);
    } catch (err) {
      toast("Eliminazione fallita", err?.message || "Riprova.", "err");
    }
  }

  /* ---------------------------------------------------------------- commenti */
  async function openCommenti(postId) {
    const post = _posts.find((p) => p.id === postId);
    if (!post) return;
    const wrap = document.createElement("div");
    wrap.className = "modal violet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box glass violet" style="max-width:560px;max-height:85vh;overflow:auto;display:flex;flex-direction:column">
        <button class="modal-x" data-close aria-label="Chiudi">✕</button>
        <div class="modal-head" style="padding:16px 24px;border-bottom:1px solid var(--silver-800)">
          <span class="eyebrow violet">Commenti</span>
          <h3>${esc(post.titolo)}</h3>
        </div>
        <div style="flex:1;overflow:auto;padding:20px 24px;display:flex;flex-direction:column;gap:10px" id="cmList">
          <div style="color:var(--silver-500);font-size:.86rem">Caricamento commenti…</div>
        </div>
        <form id="cmForm" style="padding:14px 24px;border-top:1px solid var(--silver-800);display:flex;gap:8px">
          <input class="input violet" id="cmCorpo" type="text" placeholder="Scrivi un commento…" required>
          <button type="submit" class="btn btn-violet">Invia</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    wrap.classList.add("is-open");

    const list = wrap.querySelector("#cmList");
    const form = wrap.querySelector("#cmForm");

    async function caricaCommenti() {
      try {
        const r = await API.get(`/api/creative/${encodeURIComponent(postId)}/comments`);
        const cs = r.commenti ?? [];
        list.innerHTML = cs.map((c) => `
          <div class="cm-item" style="display:flex;gap:8px">
            <div class="cm-av">${esc((c.autore?.handle || "?")[0])}</div>
            <div style="min-width:0">
              <b>${esc(c.autore?.nome || c.autore?.handle)}</b>
              <p style="color:var(--silver-400);font-size:.88rem;margin:2px 0">${esc(c.corpo)}</p>
              <small class="mono" style="color:var(--silver-600)">${dt(c.creatoIl)}</small>
            </div>
          </div>`).join("");
      } catch {
        list.innerHTML = `<div style="color:var(--silver-500)">Commenti non disponibili.</div>`;
      }
    }
    caricaCommenti();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = wrap.querySelector("#cmCorpo");
      const corpo = input.value.trim();
      if (!corpo) return;
      try {
        await API.post(`/api/creative/${encodeURIComponent(postId)}/comments`, { corpo });
        input.value = "";
        caricaCommenti();
        loadBlog();
      } catch (err) {
        toast("Commento non inviato", err?.message || "Riprova.", "err");
      }
    });

    wrap.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { wrap.remove(); }
    });
  }

  /* ---------------------------------------------------------------- crea post */
  function bindCreatePost() {
    const dz = $("#cp-files");
    const fileList = $("#cp-fileList");
    const preview = $("#cp-preview");
    const form = $("#createPostForm");

    dz?.addEventListener("change", (e) => {
      const files = Array.from(e.target.files ?? []);
      _selectedFiles = files.map((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        tipo: mediaTipo(f.name)
      }));
      renderFileList();
      preview.style.display = _selectedFiles.length ? "" : "none";
    });

    function renderFileList() {
      if (!fileList) return;
      fileList.innerHTML = _selectedFiles.map((f, i) => `
        <div class="bp-file" style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--glass);border-radius:6px">
          <span style="font-size:1.2rem">${f.tipo === "video" ? "🎬" : f.tipo === "audio" ? "🎵" : "📷"}</span>
          <span style="flex:1;font-size:.86rem;color:var(--silver-300)">${esc(f.file.name)}</span>
          <button type="button" data-rm="${i}" class="bp-btn bp-danger" style="padding:4px 8px;font-size:1.2rem">✕</button>
        </div>`).join("");
      $$("[data-rm]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = +btn.dataset.rm;
          URL.revokeObjectURL(_selectedFiles[i].preview);
          _selectedFiles.splice(i, 1);
          renderFileList();
          preview.style.display = _selectedFiles.length ? "" : "none";
        });
      });
    }

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titolo = $("#cp-titolo").value.trim();
      const corpo = $("#cp-corpo").value.trim();
      const tipo = $("#cp-tipo").value;
      const pubblico = $("#cp-pubblico").checked;
      const tagsRaw = $("#cp-tags").value.trim();
      const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

      if (!titolo) { toast("Titolo richiesto", "", "warn"); return; }
      if (_selectedFiles.length === 0 && tipo !== "testo") { toast("Aggiungi almeno un file", "", "warn"); return; }

      const btn = $("#cpSubmit");
      btn.disabled = true;
      btn.textContent = "Pubblicazione…";

      const fd = new FormData();
      fd.append("titolo", titolo);
      fd.append("corpo", corpo);
      fd.append("tipo", tipo);
      fd.append("pubblico", String(pubblico));
      fd.append("tags", JSON.stringify(tags));
      _selectedFiles.forEach((f) => fd.append("files", f.file));

      try {
        const r = await API.upload("/api/creative", fd);
        if (r?.ok) {
          toast("Contenuto pubblicato", "Il tuo lavoro è ora visibile al clan.", "ok");
          form.reset();
          _selectedFiles = [];
          renderFileList();
          preview.style.display = "none";
          dz.value = "";
          closeCreatePost();
          loadBlog();
          if (tipo === "video" && typeof window.renderVideos === "function") {
            window.renderVideos();
          }
        } else {
          toast("Pubblicazione fallita", r?.message || "Riprova.", "err");
        }
      } catch (err) {
        toast("Errore pubblicazione", err?.message, "err");
      } finally {
        btn.disabled = false;
        btn.textContent = "Pubblica";
      }
    });
  }

  function openCreatePost() {
    const wrap = $("#createPostModal");
    if (wrap) wrap.classList.add("is-open");
  }

  function closeCreatePost() {
    const wrap = $("#createPostModal");
    if (wrap) wrap.classList.remove("is-open");
  }

  function mediaTipo(name) {
    const e = name.toLowerCase();
    if (/\.(mp4|webm|mov)$/.test(e)) return "video";
    if (/\.(mp3|wav|ogg|m4a)$/.test(e)) return "audio";
    return "foto";
  }

  /* ---------------------------------------------------------------- public */
  return { init, loadBlog, paintBlog, openCreatePost, closeCreatePost };
})();

if (typeof window !== 'undefined') window.Blog = Blog;
