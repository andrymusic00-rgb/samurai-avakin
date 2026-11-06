/**
 * Viste Eventi, Classifica e Comando.
 *
 * Regola unica: ogni funzione pubblica prova il server e, se fallisce,
 * ripiega sui dati statici di DATA. L'utente vede sempre qualcosa di
 * coerente, e un badge indica quando i dati non sono live.
 */
const Views = (() => {
  const { $, $$, store, toast, openModal, closeModal, observe, animateInside, confirmBox, go } = UI;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const CFG = {
    eventi: { days: 2, hours: 2 },
    eventiFallback: false,
    classificaFallback: false,
    raidFallback: false,
    comando: { loaded: false, candid: [], membri: [], overview: null, filter: "in_bozza" },
    notif: { items: [], unread: 0, source: null, timer: null },
    react: new Map()
  };

  /* ------------------------------------------------------------ helpers */

  const dt = (v, opt) =>
    v ? new Date(v).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", ...opt }) : "—";
  const tm = (v) => (v ? new Date(v).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "");
  const num = (v) => Number(v ?? 0).toLocaleString("it-IT");

  function countdown(target) {
    if (!target) return "Data da definire";
    const diff = new Date(target).getTime() - Date.now();
    if (Number.isNaN(diff)) return "Data da definire";
    if (diff <= 0) return "In corso";
    const m = Math.floor(diff / 60000);
    const days = Math.floor(m / 1440);
    const hours = Math.floor((m % 1440) / 60);
    const mins = m % 60;
    const parts = [];
    if (days) parts.push(`${days}g`);
    if (hours) parts.push(`${hours}h`);
    if (!days) parts.push(`${mins}m`);
    return `Tra ${parts.join(" ")}`;
  }

  const CAT_ICON = { raid: "戦", evento: "門", guida: "道", riunione: "議" };
  const CAT_LABEL = { raid: "Raid", evento: "Evento", guida: "Guida", riunione: "Riunione" };

  /* ------------------------------------------------------------- eventi */

  async function loadEvents() {
    let list = DATA.eventi;
    let custom = [];
    try {
      const [d, c] = await Promise.all([
        API.get("/api/clan/events"),
        API.get("/api/clan/events-custom")
      ]);
      if (Array.isArray(d.eventi)) list = d.eventi;
      if (Array.isArray(c.eventi)) custom = c.eventi;
      CFG.eventiFallback = false;
    } catch {
      CFG.eventiFallback = true;
    }
    // Unifica eventi standard e custom in una lista unica
    CFG.eventi = [...list, ...custom].sort((a, b) => {
      const da = new Date(a.inizio || a.starts_at || 0).getTime();
      const db = new Date(b.inizio || b.starts_at || 0).getTime();
      return da - db;
    });
    paintEvents();
  }

  function paintEvents() {
    const box = $("#eventList");
    if (!box) return;
    const list = CFG.eventi || [];
    const status = $("#eventsStatus");
    if (status) {
      const live = !CFG.eventiFallback;
      status.textContent = live
        ? `${num(list.length)} ${list.length === 1 ? "evento in programma" : "eventi in programma"} · dati dal server`
        : `${num(list.length)} ${list.length === 1 ? "evento" : "eventi"} di esempio · server non raggiungibile`;
      status.classList.toggle("is-offline", !live);
    }
    if (!list.length) {
      box.innerHTML = `
        <div class="empty-state ev-empty-sophisticated" data-reveal="scale">
          <div class="ev-empty-illustration">
            <div class="ev-empty-ring"></div>
            <div class="ev-empty-ring"></div>
            <div class="ev-empty-ring"></div>
            <span class="kanji ev-empty-kanji">門</span>
          </div>
          <h3 class="ev-empty-title">Nessun evento in programma</h3>
          <p class="ev-empty-lead">Il calendario del clan è vuoto. Sii il primo a organizzare un raid, una guida o una riunione.</p>
          <div class="ev-empty-actions">
            <button class="btn btn-violet btn-lg ev-empty-create" data-action="create-first">
              <span class="ico">+</span> Crea il primo evento
            </button>
            <button class="btn btn-glass btn-lg ev-empty-template" data-action="template">
              <span class="ico">◈</span> Usa un template
            </button>
          </div>
          <div class="ev-empty-hint">
            <span class="ico">💡</span> Gli eventi appaiono qui automaticamente quando vengono creati da te o dal comando.
          </div>
        </div>`;
      observe(box);
      box.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          if (e.currentTarget.dataset.action === "create-first") createEvent();
          else if (e.currentTarget.dataset.action === "template") openTemplatePicker();
        });
      });
      return;
    }
    box.innerHTML = list
      .map((e) => {
        const isCustom = e.categoria != null && (e.immagine || e.autore);
        const full = e.completo || (e.posti > 0 && e.iscritti >= e.posti);
        const pct = e.posti > 0 ? Math.min(100, Math.round((e.iscritti / e.posti) * 100)) : 0;
        const inizio = e.inizio || e.starts_at;
        const immagineHtml = e.immagine
          ? `<div class="ev-img-wrap"><img class="ev-img" src="${esc(e.immagine)}" alt="${esc(e.titolo)}" loading="lazy"></div>`
          : "";
        return `
      <article class="ev-card glass-violet card-3d border-beam${e.iscritto ? " is-joined" : ""}${isCustom ? " ev-custom" : ""}" data-ev="${esc(e.id)}" data-reveal>
        ${immagineHtml}
        <div class="ev-side">
          <span class="ev-kanji">${CAT_ICON[e.categoria] || "門"}</span>
          <span class="ev-cat">${esc(CAT_LABEL[e.categoria] || e.categoria)}</span>
        </div>
        <div class="ev-body">
          <div class="row-between" style="align-items:flex-start">
            <div style="min-width:0">
              <h3>${esc(e.titolo)}</h3>
              <p class="ev-sum">${esc(e.sommario || "")}</p>
            </div>
            ${e.iscritto ? '<span class="tag violet">Iscritto</span>' : full ? '<span class="tag danger">Completo</span>' : ""}
          </div>
          <div class="ev-meta">
            <span title="${esc(inizio || "")}">◷ ${esc(dt(inizio))} · ${esc(tm(inizio))}</span>
            <span class="ev-count" data-count="${esc(inizio || "")}">${esc(countdown(inizio))}</span>
          </div>
          <div class="ev-capacity">
            <div class="ev-bar"><i style="width:${pct}%"></i></div>
            <span class="mono">${e.posti > 0 ? `${num(e.iscritti)} / ${num(e.posti)} posti` : `${num(e.iscritti)} iscritti`}</span>
          </div>
          <div class="row ev-actions">
            <button class="btn btn-sm ${e.iscritto ? "" : "btn-violet"}" data-rsvp="${esc(e.id)}" ${full && !e.iscritto ? "disabled" : ""}>
              ${e.iscritto ? "Annulla iscrizione" : full ? "Posti esauriti" : "Iscriviti"}
            </button>
            <button class="btn btn-sm btn-ghost" data-ev-detail="${esc(e.id)}">Dettagli</button>
            ${inizio ? `<button class="btn btn-sm btn-ghost" data-ev-ics="${esc(e.id)}">Aggiungi al calendario</button>` : ""}
            ${isCustom && e.autore && e.autore.id === (Account?.data?.id) ? `<button class="btn btn-sm btn-danger" data-ev-delete="${esc(e.id)}">Elimina</button>` : ""}
          </div>
        </div>
      </article>`;
      })
      .join("");
    observe(box);
    animateInside(box);
  }

  function openTemplatePicker() {
    const templates = [
      { id: "raid-settimanale", label: "Raid Settimanale", icon: "戦", cat: "raid", desc: "Appuntamento fisso per il raid del clan", posti: 20, duration: 2 },
      { id: "guida-build", label: "Guida Build", icon: "道", cat: "guida", desc: "Sessione per ottimizzare build e strategie", posti: 15, duration: 1.5 },
      { id: "riunione-clan", label: "Riunione Clan", icon: "議", cat: "riunione", desc: "Allineamento settimanale con i Bushi", posti: 0, duration: 1 },
      { id: "evento-social", label: "Evento Sociale", icon: "門", cat: "evento", desc: "Divertimento libero: foto, chat, minigiochi", posti: 0, duration: 3 }
    ];
    const wrap = document.createElement("div");
    wrap.id = "templatePickerModal";
    wrap.className = "modal violet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box glass violet glass-morph" style="max-width:560px;max-height:85vh;overflow:auto">
        <button class="modal-x" data-close aria-label="Chiudi">✕</button>
        <div class="modal-head">
          <span class="eyebrow violet">Template Eventi</span>
          <h3>Scegli un template</h3>
          <p>Parti da una base precompilata e personalizza i dettagli.</p>
        </div>
        <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
          ${templates.map(t => `
            <button class="template-card glass-violet card-3d border-beam" data-template="${t.id}" style="padding:20px;display:flex;gap:16px;align-items:center;text-align:left">
              <span class="template-icon" style="font-size:2.5rem">${t.icon}</span>
              <div style="flex:1">
                <h4 style="color:var(--silver-100);margin-bottom:4px">${t.label}</h4>
                <p style="color:var(--silver-500);font-size:.9rem;margin-bottom:8px">${t.desc}</p>
                <div class="row" style="gap:8px;font-size:.8rem">
                  <span class="tag violet">${t.cat.toUpperCase()}</span>
                  <span class="tag silver">${t.posti > 0 ? t.posti + " posti" : "Illimitato"}</span>
                  <span class="tag silver">${t.duration}h</span>
                </div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.classList.add("is-open");
    observe(wrap);
    wrap.querySelectorAll(".template-card").forEach(card => {
      card.addEventListener("click", () => {
        wrap.remove();
        createEventWithTemplate(card.dataset.template);
      });
    });
    wrap.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", () => wrap.remove()));
  }

  async function createEventWithTemplate(templateId) {
    const templates = {
      "raid-settimanale": { titolo: "Raid Settimanale del Clan", categoria: "raid", sommaio: "Appuntamento fisso per il raid del clan. Porta la tua build migliore!", posti: 20, durata: 2 },
      "guida-build": { titolo: "Guida Build & Strategie", categoria: "guida", sommaio: "Sessione per ottimizzare build, rotazioni e strategie di combattimento.", posti: 15, durata: 1.5 },
      "riunione-clan": { titolo: "Riunione Settimanale Clan", categoria: "riunione", sommaio: "Allineamento con i Bushi: obiettivi, reclute, eventi futuri.", posti: 0, durata: 1 },
      "evento-social": { titolo: "Evento Sociale: Foto & Minigiochi", categoria: "evento", sommaio: "Serata libera: screenshot, foto di gruppo, minigiochi in arena.", posti: 0, durata: 3 }
    };
    const t = templates[templateId];
    if (!t) return;
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
    const inizio = now.toISOString().slice(0, 16);
    const fine = new Date(now.getTime() + t.durata * 3600000).toISOString().slice(0, 16);
    createEvent({ ...t, inizio, fine });
  }

  function createEvent(prefill = {}) {
    if (!Account.authed) {
      toast("Accedi prima", "Per creare un evento devi essere loggato.", "warn");
      openModal("enterModal");
      return;
    }
    const wrap = document.createElement("div");
    wrap.id = "createEventModal";
    wrap.className = "modal violet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    const today = new Date().toISOString().slice(0, 16);
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box glass violet glass-morph" style="max-width:560px;max-height:90vh;overflow:auto;display:flex;flex-direction:column">
        <button class="modal-x" data-close aria-label="Chiudi">✕</button>
        <div class="modal-head">
          <span class="eyebrow violet">Crea evento samurai</span>
          <h3>Nuovo evento personalizzato</h3>
        </div>
        <form id="createEventForm" novalidate style="flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:14px">
          <div class="field">
            <label for="cev-titolo">Titolo evento <span class="hint">Max 90 caratteri</span></label>
            <input class="input violet" id="cev-titolo" maxlength="90" placeholder="Es. Torneo di Kendo al tramonto" required value="${esc(prefill.titolo || "")}">
            <span class="err-msg" data-for="cev-titolo"></span>
          </div>
          <div class="field">
            <label for="cev-descrizione">Descrizione completa <span class="hint">Max 1000 caratteri</span></label>
            <textarea class="input violet" id="cev-descrizione" rows="4" maxlength="1000" placeholder="Racconta cosa succederà, chi può partecipare, cosa portare, regole speciali...">${esc(prefill.sommario || "")}</textarea>
            <span class="err-msg" data-for="cev-descrizione"></span>
          </div>
          <div class="form-grid" style="gap:10px">
            <div class="field">
              <label for="cev-categoria">Categoria</label>
              <select class="input violet" id="cev-categoria">
                <option value="evento"${prefill.categoria === "evento" ? " selected" : ""}>Evento</option>
                <option value="raid"${prefill.categoria === "raid" ? " selected" : ""}>Raid</option>
                <option value="guida"${prefill.categoria === "guida" ? " selected" : ""}>Guida</option>
                <option value="riunione"${prefill.categoria === "riunione" ? " selected" : ""}>Riunione</option>
              </select>
            </div>
            <div class="field">
              <label for="cev-posti">Posti disponibili <span class="hint">0 = illimitato</span></label>
              <input class="input violet" id="cev-posti" type="number" min="0" value="${prefill.posti ?? 0}">
            </div>
          </div>
          <div class="form-grid" style="gap:10px">
            <div class="field">
              <label for="cev-inizio">Data e ora inizio <span class="hint">Obbligatorio</span></label>
              <input class="input violet" id="cev-inizio" type="datetime-local" required min="${today}" value="${prefill.inizio || ""}">
            </div>
            <div class="field">
              <label for="cev-fine">Data e ora fine</label>
              <input class="input violet" id="cev-fine" type="datetime-local" min="${today}" value="${prefill.fine || ""}">
            </div>
          </div>
          <div class="field">
            <label for="cev-luogo">Luogo <span class="hint">Max 100 caratteri</span></label>
            <input class="input violet" id="cev-luogo" maxlength="100" placeholder="Es. Dojo Centrale, Arena 3, Discord #generale" value="${esc(prefill.luogo || "")}">
            <span class="err-msg" data-for="cev-luogo"></span>
          </div>
          <div class="field">
            <label for="cev-immagine">URL immagine copertina <span class="hint">Opzionale</span></label>
            <input class="input violet" id="cev-immagine" placeholder="https://esempio.it/immagine.jpg" value="${esc(prefill.immagine || "")}">
            <small style="color:var(--silver-600);font-size:.82rem">Link diretto a JPG, PNG, WEBP. Aspect ratio consigliato 16:9</small>
          </div>
          <div class="field">
            <label class="row" style="gap:10px;align-items:center;font-size:.9rem">
              <input type="checkbox" id="cev-pubblico"${prefill.pubblico !== false ? " checked" : ""}> Visibile a tutto il clan
              <span class="tag violet" style="font-size:10px">Pubblico</span>
            </label>
          </div>
          <div class="field">
            <label class="row" style="gap:10px;align-items:center;font-size:.9rem">
              <input type="checkbox" id="cev-notifica" checked> Notifica membri all'uscita
              <span class="tag silver" style="font-size:10px">Push</span>
            </label>
          </div>
          <div style="margin-top:auto;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn btn-ghost" data-close>Annulla</button>
            <button type="button" class="btn btn-glass" id="cevSaveDraft">Salva bozza</button>
            <button type="submit" class="btn btn-violet btn-lg" id="cevSubmit">Crea evento</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    wrap.classList.add("is-open");
    observe(wrap);
    animateInside(wrap);

    // Set min date to now
    const inizioInput = $("#cev-inizio", wrap);
    const fineInput = $("#cev-fine", wrap);
    if (inizioInput) inizioInput.min = today;
    if (fineInput) fineInput.min = today;
    inizioInput?.addEventListener("change", () => {
      if (fineInput && fineInput.value < inizioInput.value) fineInput.value = inizioInput.value;
      fineInput.min = inizioInput.value;
    });

    wrap.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { wrap.remove(); }
    });

    $("#createEventForm", wrap).addEventListener("submit", async (e) => {
      e.preventDefault();
      const titolo = $("#cev-titolo", wrap).value.trim();
      const descrizione = $("#cev-descrizione", wrap).value.trim();
      const categoria = $("#cev-categoria", wrap).value;
      const inizio = $("#cev-inizio", wrap).value;
      const fine = $("#cev-fine", wrap).value || null;
      const posti = Number($("#cev-posti", wrap).value || 0);
      const luogo = $("#cev-luogo", wrap).value.trim();
      const immagine = $("#cev-immagine", wrap).value.trim();
      const pubblico = $("#cev-pubblico", wrap).checked;
      const notifica = $("#cev-notifica", wrap).checked;

      if (!titolo) { toast("Titolo richiesto", "", "warn"); return; }
      if (!inizio) { toast("Data inizio richiesta", "", "warn"); return; }
      if (new Date(inizio) < new Date()) { toast("Data passata", "Scegli una data futura.", "warn"); return; }

      const btn = $("#cevSubmit", wrap);
      btn.disabled = true;
      btn.textContent = "Creazione…";

      try {
        const r = await API.post("/api/clan/events-custom", {
          titolo, descrizione, categoria, inizio, fine, posti, luogo, immagine, pubblico, notifica
        }, { noRetry: true });
        if (r?.ok) {
          toast("Evento creato", "Il tuo evento è ora visibile al clan.", "ok");
          wrap.remove();
          loadEvents();
        } else {
          toast("Creazione fallita", r?.message || "Riprova.", "err");
        }
      } catch (err) {
        toast("Errore creazione", err?.message, "err");
      } finally {
        btn.disabled = false;
        btn.textContent = "Crea evento";
      }
    });

    $("#cevSaveDraft", wrap)?.addEventListener("click", async () => {
      const draft = {
        titolo: $("#cev-titolo", wrap).value.trim(),
        descrizione: $("#cev-descrizione", wrap).value.trim(),
        categoria: $("#cev-categoria", wrap).value,
        inizio: $("#cev-inizio", wrap).value,
        fine: $("#cev-fine", wrap).value || null,
        posti: Number($("#cev-posti", wrap).value || 0),
        luogo: $("#cev-luogo", wrap).value.trim(),
        immagine: $("#cev-immagine", wrap).value.trim(),
        pubblico: $("#cev-pubblico", wrap).checked,
        notifica: $("#cev-notifica", wrap).checked,
        savedAt: Date.now()
      };
      const drafts = JSON.parse(localStorage.getItem("sam.eventDrafts") || "[]");
      drafts.unshift(draft);
      if (drafts.length > 10) drafts.pop();
      localStorage.setItem("sam.eventDrafts", JSON.stringify(drafts));
      toast("Bozza salvata", "La ritrovi qui la prossima volta.", "ok");
    });

    // Load existing draft if any
    const drafts = JSON.parse(localStorage.getItem("sam.eventDrafts") || "[]");
    if (drafts.length && !prefill.titolo) {
      const latest = drafts[0];
      const use = confirm("Hai una bozza salvata. Vuoi riprenderla?");
      if (use) {
        Object.keys(latest).forEach(k => {
          const el = $(`#cev-${k}`, wrap);
          if (el) el.value = latest[k];
        });
        if (latest.pubblico !== undefined) $("#cev-pubblico", wrap).checked = latest.pubblico;
        if (latest.notifica !== undefined) $("#cev-notifica", wrap).checked = latest.notifica;
      }
    }
  }

  function tickCountdowns() {
    $$("#eventList [data-count]").forEach((el) => {
      el.textContent = countdown(el.dataset.count);
    });
  }

  /** La scheda dell'evento vive fuori da #eventList: va aggiornata a mano. */
  function syncDetailModal(ev) {
    const modal = document.getElementById("evDetailModal");
    if (!modal || !ev) return;
    const full = ev.completo || (ev.posti > 0 && ev.iscritti >= ev.posti);
    const btn = modal.querySelector("[data-rsvp]");
    if (btn) {
      btn.textContent = ev.iscritto ? "Annulla iscrizione" : full ? "Posti esauriti" : "Iscriviti";
      btn.classList.toggle("btn-violet", !ev.iscritto);
      btn.disabled = full && !ev.iscritto;
    }
    const pct = ev.posti > 0 ? Math.min(100, Math.round((ev.iscritti / ev.posti) * 100)) : 0;
    const bar = modal.querySelector(".ev-bar i");
    if (bar) bar.style.width = `${pct}%`;
    const cap = modal.querySelector(".ev-capacity .mono");
    if (cap) {
      cap.textContent = ev.posti > 0 ? `${num(ev.iscritti)} / ${num(ev.posti)} posti` : `${num(ev.iscritti)} iscritti`;
    }
  }

  async function toggleRsvp(id) {
    const ev = (CFG.eventi || []).find((x) => String(x.id) === String(id));
    if (!ev) return;
    const isCustom = ev.categoria != null && (ev.immagine || ev.autore);
    if (!Account.authed) {
      toast("Accedi per iscriverti", "L'iscrizione agli eventi richiede una sessione.", "warn");
      openModal("enterModal");
      return;
    }
    if (isCustom) {
      const go_ = ev.iscritto
        ? () => API.del(`/api/clan/events-custom/${encodeURIComponent(id)}/rsvp`)
        : () => API.post(`/api/clan/events-custom/${encodeURIComponent(id)}/rsvp`);
      try {
        const r = await go_();
        ev.iscritto = !!r.iscritto;
        if (typeof r.iscritti === "number") ev.iscritti = r.iscritti;
        ev.postoRimasti = r.postoRimasti ?? ev.postoRimasti;
        ev.completo = ev.posti > 0 && ev.iscritti >= ev.posti;
        paintEvents();
        animateInside($("#eventList"));
        toast(
          ev.iscritto ? "Iscrizione confermata" : "Iscrizione annullata",
          ev.iscritto ? `${ev.titolo} — ti aspettiamo.` : "Non sei più in lista.",
          ev.iscritto ? "ok" : "warn"
        );
      } catch (err) {
        toast("Operazione non riuscita", err?.message || "Riprova.", err?.code === "conflict" ? "warn" : "err");
      }
      return;
    }
    const go_ = ev.iscritto
      ? () => API.del(`/api/clan/events/${encodeURIComponent(id)}/rsvp`)
      : () => API.post(`/api/clan/events/${encodeURIComponent(id)}/rsvp`);

    try {
      const r = await go_();
      ev.iscritto = !!r.iscritto;
      if (typeof r.iscritti === "number") ev.iscritti = r.iscritti;
      ev.postiRimasti = r.postiRimasti ?? ev.postiRimasti;
      ev.completo = ev.posti > 0 && ev.iscritti >= ev.posti;
      paintEvents();
      syncDetailModal(ev);
      animateInside($("#eventList"));
      toast(
        ev.iscritto ? "Iscrizione confermata" : "Iscrizione annullata",
        ev.iscritto ? `${ev.titolo} — ti aspettiamo.` : "Non sei più in lista.",
        ev.iscritto ? "ok" : "warn"
      );
    } catch (err) {
      toast("Operazione non riuscita", err?.message || "Riprova.", err?.code === "conflict" ? "warn" : "err");
    }
  }

  /** Scheda completa dell'evento: immagine sovraimposta, descrizione e animazione testo al primo apertura. */
  function eventDetail(id) {
    const ev = (CFG.eventi || []).find((x) => String(x.id) === String(id));
    if (!ev) return;
    const isCustom = ev.categoria != null && (ev.immagine || ev.autore);
    const inizio = ev.inizio || ev.starts_at;
    const fine = ev.fine || ev.ends_at;
    const full = ev.completo || (ev.posti > 0 && ev.iscritti >= ev.posti);
    const pct = ev.posti > 0 ? Math.min(100, Math.round((ev.iscritti / ev.posti) * 100)) : 0;
    const immagineHtml = ev.immagine
      ? `<div class="ev-detail-img"><img src="${esc(ev.immagine)}" alt="${esc(ev.titolo)}" loading="lazy"><div class="ev-detail-img-overlay"></div></div>`
      : "";
    const wrap = document.createElement("div");
    wrap.id = "evDetailModal";
    wrap.className = "modal violet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box glass violet ev-detail-modal" style="max-width:640px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column">
        <button class="modal-x" data-close aria-label="Chiudi">✕</button>
        ${immagineHtml}
        <div class="ev-detail-body" style="flex:1;padding:24px;overflow-y:auto">
          <div class="row" style="gap:12px;align-items:center;margin-bottom:14px">
            <span class="ev-kanji">${CAT_ICON[ev.categoria] || "門"}</span>
            <div style="min-width:0">
              <span class="eyebrow violet">${esc(CAT_LABEL[ev.categoria] || ev.categoria || "Evento")}</span>
              <h3 class="ev-detail-title animate-text" style="font-size:1.5rem;margin:0;color:var(--silver-100)">${esc(ev.titolo)}</h3>
            </div>
            ${isCustom && ev.autore ? `<span class="tag silver" style="font-size:10px">di ${esc(ev.autore.nome || ev.autore.handle)}</span>` : ""}
          </div>
          <p class="ev-detail-desc animate-text" style="color:var(--silver-400);line-height:1.7;font-size:1rem;margin:0 0 16px">${esc(ev.sommario || "Nessuna descrizione disponibile.")}</p>
          <div class="ev-detail-meta" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px">
            <span class="ev-meta-item animate-text"><span class="kanji">◷</span> ${esc(dt(inizio, { year: "numeric" }))} · ${esc(tm(inizio))}</span>
            ${fine ? `<span class="ev-meta-item animate-text"><span class="kanji">⟡</span> ${esc(dt(fine, { year: "numeric" }))} · ${esc(tm(fine))}</span>` : ""}
            <span class="ev-meta-item animate-text"><span class="kanji">📍</span> ${esc(ev.luogo || "Luogo da definire")}</span>
            <span class="ev-meta-item animate-text"><span class="ev-count" data-count="${esc(inizio || "")}">${esc(countdown(inizio))}</span></span>
          </div>
          <div class="ev-detail-capacity" style="margin-bottom:16px">
            <div class="ev-bar"><i style="width:${pct}%"></i></div>
            <span class="mono">${ev.posti > 0 ? `${num(ev.iscritti)} / ${num(ev.posti)} posti` : `${num(ev.iscritti)} iscritti`}</span>
          </div>
          <div class="row ev-actions" style="gap:10px">
            <button class="btn ${ev.iscritto ? "" : "btn-violet"}" data-rsvp="${esc(ev.id)}" ${full && !ev.iscritto ? "disabled" : ""}>
              ${ev.iscritto ? "Annulla iscrizione" : full ? "Posti esauriti" : "Iscriviti"}
            </button>
            ${inizio ? `<button class="btn btn-ghost" data-ev-ics="${esc(ev.id)}">Aggiungi al calendario</button>` : ""}
            ${isCustom && ev.autore && ev.autore.id === (Account?.data?.id) ? `<button class="btn btn-sm btn-danger" data-ev-delete="${esc(ev.id)}">Elimina evento</button>` : ""}
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    observe(wrap);
    openModal("evDetailModal");

    // Animazione testo: al primo apertura, gli elementi .animate-text entrano in sequenza
    const animEls = wrap.querySelectorAll(".animate-text");
    animEls.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(12px)";
      el.style.transition = "opacity .4s ease, transform .4s ease";
      el.style.transitionDelay = `${i * 70}ms`;
    });
    requestAnimationFrame(() => {
      animEls.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    });

    wrap.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeModal("evDetailModal");
    });
    // Il countdown continua a scendere anche dentro la scheda.
    const t = setInterval(() => {
      if (!document.body.contains(wrap)) return clearInterval(t);
      const c = wrap.querySelector("[data-count]");
      if (c) c.textContent = countdown(c.dataset.count);
    }, 1000);
  }

  /** Crea un evento custom (richiede login). Apre il modal di creazione. */
  async function createEvent() {
    if (!Account.authed) {
      toast("Accedi prima", "Per creare un evento devi essere loggato.", "warn");
      openModal("enterModal");
      return;
    }
    const wrap = document.createElement("div");
    wrap.id = "createEventModal";
    wrap.className = "modal violet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box glass violet" style="max-width:560px;max-height:85vh;overflow:auto;display:flex;flex-direction:column">
        <button class="modal-x" data-close aria-label="Chiudi">✕</button>
        <div class="modal-head" style="padding:16px 24px;border-bottom:1px solid var(--silver-800)">
          <span class="eyebrow violet">Crea evento samurai</span>
          <h3>Nuovo evento personalizzato</h3>
        </div>
        <form id="createEventForm" novalidate style="flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:14px">
          <div class="field">
            <label for="cev-titolo">Titolo evento</label>
            <input class="input violet" id="cev-titolo" maxlength="90" placeholder="Es. Torneo di Kendo al tramonto" required>
            <span class="err-msg" data-for="cev-titolo"></span>
          </div>
          <div class="field">
            <label for="cev-descrizione">Descrizione</label>
            <textarea class="input violet" id="cev-descrizione" rows="4" maxlength="1000" placeholder="Racconta cosa succederà, chi può partecipare, cosa portare..."></textarea>
            <span class="err-msg" data-for="cev-descrizione"></span>
          </div>
          <div class="form-grid" style="gap:10px">
            <div class="field">
              <label for="cev-categoria">Categoria</label>
              <select class="input violet" id="cev-categoria">
                <option value="evento">Evento</option>
                <option value="raid">Raid</option>
                <option value="guida">Guida</option>
                <option value="riunione">Riunione</option>
              </select>
            </div>
            <div class="field">
              <label for="cev-posti">Posti disponibili (0 = illimitato)</label>
              <input class="input violet" id="cev-posti" type="number" min="0" value="0">
            </div>
          </div>
          <div class="form-grid" style="gap:10px">
            <div class="field">
              <label for="cev-inizio">Data e ora inizio</label>
              <input class="input violet" id="cev-inizio" type="datetime-local" required>
            </div>
            <div class="field">
              <label for="cev-fine">Data e ora fine</label>
              <input class="input violet" id="cev-fine" type="datetime-local">
            </div>
          </div>
          <div class="field">
            <label for="cev-luogo">Luogo</label>
            <input class="input violet" id="cev-luogo" maxlength="100" placeholder="Es. Dojo Centrale">
            <span class="err-msg" data-for="cev-luogo"></span>
          </div>
          <div class="field">
            <label for="cev-immagine">URL immagine (opzionale)</label>
            <input class="input violet" id="cev-immagine" placeholder="https://esempio.it/immagine.jpg">
            <small style="color:var(--silver-600);font-size:.82rem">Usa un link diretto a un'immagine (JPG, PNG, WEBP)</small>
          </div>
          <div class="field">
            <label class="row" style="gap:10px;align-items:center;font-size:.9rem">
              <input type="checkbox" id="cev-pubblico" checked> Visibile a tutto il clan
            </label>
          </div>
          <div style="margin-top:auto;display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="btn btn-ghost" data-close>Annulla</button>
            <button type="submit" class="btn btn-violet btn-lg" id="cevSubmit">Crea evento</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    wrap.classList.add("is-open");

    // Imposta data minima = oggi
    const oggi = new Date().toISOString().slice(0, 16);
    $("#cev-inizio").min = oggi;

    wrap.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { wrap.remove(); }
    });

    $("#createEventForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const titolo = $("#cev-titolo").value.trim();
      const descrizione = $("#cev-descrizione").value.trim();
      const categoria = $("#cev-categoria").value;
      const inizio = $("#cev-inizio").value;
      const fine = $("#cev-fine").value || null;
      const posti = Number($("#cev-posti").value || 0);
      const luogo = $("#cev-luogo").value.trim();
      const immagine = $("#cev-immagine").value.trim();
      const pubblico = $("#cev-pubblico").checked;

      if (!titolo) { toast("Titolo richiesto", "", "warn"); return; }
      if (!inizio) { toast("Data inizio richiesta", "", "warn"); return; }

      const btn = $("#cevSubmit");
      btn.disabled = true;
      btn.textContent = "Creazione…";

      try {
        const r = await API.post("/api/clan/events-custom", {
          titolo, descrizione, categoria, inizio, fine, posti, luogo, immagine, pubblico
        }, { noRetry: true });
        if (r?.ok) {
          toast("Evento creato", "Il tuo evento è ora visibile al clan.", "ok");
          wrap.remove();
          loadEvents();
        } else {
          toast("Creazione fallita", r?.message || "Riprova.", "err");
        }
      } catch (err) {
        toast("Errore creazione", err?.message, "err");
      } finally {
        btn.disabled = false;
        btn.textContent = "Crea evento";
      }
    });
  }

  async function eliminaEvento(id) {
    const ok = confirm("Eliminare questo evento? L'operazione è irreversibile.");
    if (!ok) return;
    try {
      await API.del(`/api/clan/events-custom/${encodeURIComponent(id)}`);
      toast("Evento eliminato", "", "ok", 2000);
      loadEvents();
    } catch (err) {
      toast("Eliminazione fallita", err?.message || "Riprova.", "err");
    }
  }

  function addToCalendar(id) {
    const ev = (CFG.eventi || []).find((x) => String(x.id) === String(id));
    if (!ev?.inizio) return;
    const start = new Date(ev.inizio);
    const end = ev.fine ? new Date(ev.fine) : new Date(start.getTime() + 2 * 3600_000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Samurai di Avakin//IT",
      "BEGIN:VEVENT",
      `UID:${ev.slug || ev.id}@samurai-di-avakin`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${ev.titolo}`,
      `DESCRIPTION:${(ev.sommario || "").replace(/\n/g, " ")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(ev.slug || "evento").replace(/[^\w-]/g, "-")}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Evento scaricato", "Apri il file per aggiungerlo al calendario.", "ok");
  }

  /* --------------------------------------------------------- classifica */

  async function loadLeaderboard() {
    let list = DATA.classifica;
    try {
      const d = await API.get("/api/clan/leaderboard");
      if (Array.isArray(d.classifica) && d.classifica.length) list = d.classifica;
      CFG.classificaFallback = false;
    } catch {
      CFG.classificaFallback = true;
    }
    CFG.classifica = list;
    paintLeaderboard();
  }

  async function loadRaid() {
    try {
      const d = await API.get("/api/clan/raid");
      if (Array.isArray(d.raid) && d.raid.length) {
        CFG.raid = d.raid;
        CFG.raidFallback = false;
      } else {
        CFG.raid = [];
        CFG.raidFallback = false;
      }
    } catch {
      CFG.raid = DATA.raid;
      CFG.raidFallback = true;
    }
    paintRaid();
  }

  function paintLeaderboard() {
    const box = $("#lbList");
    if (!box) return;
    const rows = CFG.classifica || [];
    const st = $("#lbStatus");
    if (st) {
      const live = !CFG.classificaFallback;
      st.textContent = live
        ? `${num(rows.length)} ${rows.length === 1 ? "membro in classifica" : "membri in classifica"} · dati dal server`
        : `${num(rows.length)} membri · classifica di esempio, server non raggiungibile`;
      st.classList.toggle("is-offline", !live);
    }
    if (!rows.length) {
      box.innerHTML = `<div class="empty-state"><span class="kanji">無</span>Classifica non disponibile.</div>`;
    } else {
      const max = Math.max(...rows.map((r) => r.vittorie || 0), 1);
      box.innerHTML = rows
        .map((r) => {
          const me = r.seiTu || (Account.authed && r.handle === Account.data.handle);
          const wr = Number(r.winRate ?? 0);
          return `
        <div class="lb-row${me ? " is-me" : ""}" data-reveal="right">
          <span class="lb-pos${r.posizione <= 3 ? " top" : ""}">${r.posizione}</span>
          <div class="lb-av">${esc((r.handle || "?")[0])}</div>
          <div class="lb-info">
            <b>${esc(r.nome || r.handle)}${me ? ' <span class="tag violet" style="font-size:8px">Tu</span>' : ""}</b>
            <small class="mono">${esc(r.handle)} · ${esc(roleLabel(r.role))} · Lv ${r.level}</small>
          </div>
          <div class="lb-bar"><i style="width:${Math.round(((r.vittorie || 0) / max) * 100)}%"></i></div>
          <div class="lb-nums">
            <span title="Vittorie"><b>${num(r.vittorie)}</b><small>V</small></span>
            <span title="Raid"><b>${num(r.raid)}</b><small>R</small></span>
            <span title="Ore in clan"><b>${num(r.ore)}</b><small>h</small></span>
            <span title="Win rate"><b>${wr}%</b><small>wr</small></span>
            <span title="Traguardi"><b>${num(r.traguardi ?? 0)}</b><small>◆</small></span>
          </div>
        </div>`;
        })
        .join("");
    }
    paintPodium();
    paintLbStat();
  }

  function paintPodium() {
    const box = $("#lbPodium");
    if (!box) return;
    const top = (CFG.classifica || []).slice(0, 3);
    if (top.length < 3) {
      box.innerHTML = "";
      return;
    }
    const order = [top[1], top[0], top[2]];
    const place = [2, 1, 3];
    box.innerHTML = order
      .map((r, i) => {
        if (!r) return "";
        return `<div class="podium-slot p${place[i]}">
          <div class="podium-av">${esc((r.handle || "?")[0])}</div>
          <b>${esc(r.nome || r.handle)}</b>
          <small class="mono">${num(r.vittorie)} vittorie</small>
          <div class="podium-base"><span>${place[i]}</span></div>
        </div>`;
      })
      .join("");
  }

  function paintLbStat() {
    const el = $("#lbStat");
    if (!el) return;
    const rows = CFG.classifica || [];
    if (!rows.length) {
      el.innerHTML = "";
      return;
    }
    const totalW = rows.reduce((a, r) => a + (r.vittorie || 0), 0);
    const totalR = rows.reduce((a, r) => a + (r.raid || 0), 0);
    const totalH = rows.reduce((a, r) => a + (r.ore || 0), 0);
    const avgWr = Math.round(rows.reduce((a, r) => a + (r.winRate ?? 0), 0) / rows.length);
    el.innerHTML = [
      [num(totalW), "Vittorie totali"],
      [num(totalR), "Raid disputati"],
      [num(totalH), "Ore in clan"],
      [`${avgWr}%`, "Win rate medio"]
    ]
      .map(([v, l]) => `<div class="stat glass-violet stat-violet border-glow border-beam glass-morph"><div class="stat-num stat-number text-gradient-animate"><span class="n">${v}</span></div><div class="stat-label">${l}</div></div>`)
      .join("");
  }

  function paintRaid() {
    const box = $("#raidList");
    if (!box) return;
    const rows = CFG.raid || [];
    if (!rows.length) {
      box.innerHTML = `<div class="empty-state"><span class="kanji">無</span>Nessun raid registrato.</div>`;
      return;
    }
    const icon = { vittoria: "勝", sconfitta: "敗", pareggio: "引" };
    box.innerHTML = rows
      .map(
        (r) => `
      <div class="raid-row ${esc(r.esito)}" data-reveal>
        <span class="raid-mark">${icon[r.esito] || "戦"}</span>
        <div class="raid-info">
          <b>${esc(r.titolo)}</b>
          <small>${esc(r.avversario || "—")} · <span class="mono">${esc(CAT_LABEL[r.categoria] || r.categoria || "")}</span></small>
        </div>
        <span class="raid-score">${num(r.score)}</span>
        <span class="tag ${r.esito === "vittoria" ? "" : r.esito === "sconfitta" ? "danger" : "silver"}">${esc(r.esito)}</span>
      </div>`
      )
      .join("");
  }

  const roleLabel = (r) => ({ membro: "Membro", bushi: "Bushi", shogun: "Shogun", admin: "Admin" })[r] || r || "Membro";

  /* ------------------------------------------------------------ comando */

  const canCommand = () => {
    const role = Account.data?.role;
    return role === "bushi" || role === "shogun" || role === "admin";
  };

  async function loadComando(force = false) {
    if (!Account.authed) {
      paintComandoGate();
      return;
    }
    if (!canCommand()) {
      paintComandoGate();
      return;
    }
    if (CFG.comando.loaded && !force) {
      paintComando();
      return;
    }
    try {
      const [ov, ap, mb] = await Promise.all([
        API.get("/api/admin/overview"),
        API.get(`/api/clan/applications?status=${CFG.comando.filter}`),
        API.get("/api/admin/members")
      ]);
      CFG.comando.overview = ov;
      CFG.comando.candid = ap.candidature || [];
      CFG.comando.conteggi = ap.conteggi || {};
      CFG.comando.membri = mb.membri || [];
      CFG.comando.loaded = true;
      paintComando();
    } catch (err) {
      $("#cmdBody").innerHTML = `<div class="empty-state"><span class="kanji">無</span>${
        err?.status === 403 ? "Non hai i permessi di comando." : "Dati non disponibili."
      }</div>`;
    }
  }

  function paintComandoGate() {
    const box = $("#cmdBody");
    if (!box) return;
    const authed = Account.authed;
    box.innerHTML = `
      <div class="glass-violet card card-pad-lg" style="text-align:center;padding:60px 28px">
        <div class="samurai-seal violet" style="margin:0 auto 22px;width:88px;height:88px;font-size:2.4rem"><span>帥</span></div>
        <h2 class="section-title" style="font-size:clamp(1.5rem,3.2vw,2.2rem)">Area <span class="accent-violet">riservata</span></h2>
        <p class="section-lead" style="margin:14px auto 26px">
          ${
            authed
              ? "Questa sezione è aperta a Bushi, Shogun e admin. Il tuo ruolo attuale non è sufficiente."
              : "Accedi con un account Bushi o superiore per gestire candidature, ruoli e statistiche."
          }
        </p>
        <div class="row" style="justify-content:center">
          ${
            authed
              ? '<a class="btn btn-lg btn-violet" href="#/account" data-nav="account">Vai al tuo account</a>'
              : '<button class="btn btn-primary btn-lg" data-action="login">Accedi</button>'
          }
        </div>
      </div>`;
  }

  function paintComando() {
    const ov = CFG.comando.overview;
    const box = $("#cmdBody");
    if (!box) return;

    const stats = ov
      ? `<div class="stat-strip stat-violet" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          ${[
            [ov.membri.attivi, "Membri attivi"],
            [ov.candidature.n, "Candidature da valutare"],
            [ov.eventi.n, "Eventi in programma"],
            [ov.subscribers.n, "Iscritti newsletter"]
          ]
            .map(([v, l]) => `<div class="stat glass-violet stat-violet border-glow border-beam glass-morph"><div class="stat-num stat-number text-gradient-animate"><span class="n">${num(v)}</span></div><div class="stat-label">${l}</div></div>`)
            .join("")}
        </div>`
      : "";

    const tabs = ["in_bozza", "approvata", "rifiutata"]
      .map(
        (s) =>
          `<button class="chip violet${CFG.comando.filter === s ? " is-active" : ""}" data-cfilter="${s}">${
            { in_bozza: "Da valutare", approvata: "Approvate", rifiutata: "Rifiutate" }[s]
          } <b>${CFG.comando.conteggi?.[s] ?? 0}</b></button>`
      )
      .join("");

    const cands = CFG.comando.candid.length
      ? CFG.comando.candid
          .map(
            (a) => `
        <article class="ap-card glass-violet" data-ap="${esc(a.id)}">
          <div class="ap-head">
            <div class="ap-av">${esc((a.nickname || "?")[0])}</div>
            <div style="min-width:0">
              <b>${esc(a.nickname)}</b>
              <small class="mono">ID ${esc(a.avakinId)} · ${esc(a.region)} · ${esc(dt(a.createdAt))}</small>
            </div>
            <span class="tag ${a.status === "approvata" ? "" : a.status === "rifiutata" ? "danger" : "violet"}">${esc(a.status)}</span>
          </div>
          <p class="ap-msg">${esc(a.message)}</p>
          ${a.note ? `<p class="ap-note">Nota del comando: ${esc(a.note)}</p>` : ""}
          ${
            a.status === "in_bozza"
              ? `<div class="row ap-actions">
                  <button class="btn btn-sm btn-violet" data-decide="${esc(a.id)}" data-decision="approvata">Approva</button>
                  <button class="btn btn-sm btn-danger" data-decide="${esc(a.id)}" data-decision="rifiutata">Rifiuta</button>
                  <span class="mono" style="font-size:10px;color:var(--silver-600)">ID ${esc(a.avakinId)} · collega manualmente</span>
                </div>`
              : `<div class="row"><span class="mono" style="font-size:10px;color:var(--silver-600)">Decisa da ${esc(a.decidedBy || "comando")} · ${esc(dt(a.decidedAt))}</span></div>`
          }
        </article>`
          )
          .join("")
      : `<div class="empty-state"><span class="kanji">無</span>Nessuna candidatura in questa categoria.</div>`;

    const membri = CFG.comando.membri.length
      ? `<div class="mb-grid">${CFG.comando.membri
          .map(
            (m) => `
        <div class="mb-card" data-mb="${esc(m.id)}">
          <div class="mb-top">
            <span class="mb-av">${esc((m.handle || "?")[0])}</span>
            <div style="min-width:0;flex:1">
              <b>${esc(m.nome)}</b>
              <small class="mono">${esc(m.handle)} · Lv ${m.level}</small>
            </div>
          </div>
          <div class="mb-stats">
            <span><b>${num(m.stats.vittorie)}</b><small>V</small></span>
            <span><b>${num(m.stats.raid)}</b><small>R</small></span>
            <span><b>${num(m.traguardi)}</b><small>◆</small></span>
          </div>
          <div class="mb-actions">
            <select class="input violet" data-role-for="${esc(m.id)}" aria-label="Ruolo di ${esc(m.nome)}">
              ${["membro", "bushi", "shogun", "admin"]
                .map((r) => `<option value="${r}"${m.role === r ? " selected" : ""}>${roleLabel(r)}</option>`)
                .join("")}
            </select>
            <select class="input violet" data-status-for="${esc(m.id)}" aria-label="Stato di ${esc(m.nome)}">
              ${["attivo", "sospeso", "espulso"]
                .map((s) => `<option value="${s}"${m.status === s ? " selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </div>
        </div>`
          )
          .join("")}</div>`
      : `<div class="empty-state"><span class="kanji">無</span>Nessun membro.</div>`;

    box.innerHTML = `
      ${stats}
      <div class="grid g-2" style="align-items:start;gap:var(--sp-5)">
        <section class="glass-violet card card-pad-lg">
          <span class="eyebrow violet">Reclutamento</span>
          <h3 style="font-family:var(--ff-display);font-size:1.4rem;color:var(--silver-100);margin:12px 0 16px">Candidature</h3>
          <div class="filter-bar" style="margin-bottom:18px">${tabs}</div>
          <div class="stack" style="gap:12px">${cands}</div>
        </section>
        <section class="glass-violet card card-pad-lg">
          <span class="eyebrow violet">Organigramma</span>
          <h3 style="font-family:var(--ff-display);font-size:1.4rem;color:var(--silver-100);margin:12px 0 16px">Membri</h3>
          <div>${membri}</div>
        </section>
      </div>`;
  }

  async function decide(id, decision) {
    const cands = CFG.comando.candid;
    const ap = cands.find((a) => String(a.id) === String(id));
    const label = decision === "approvata" ? "Approvare" : "Rifiutare";
    confirmBox(
      `${label} la candidatura?`,
      ap ? `${ap.nickname} · ID ${ap.avakinId}. ${
        decision === "approvata"
          ? "Il giocatore potrà poi creare il suo account collegando questo ID."
          : "Potrai rivalutarla in seguito."
      }` : "",
      async () => {
        const note = ap?.note ? ap.note : "";
        try {
          await API.post(`/api/clan/applications/${encodeURIComponent(id)}/decision`, { decision, note });
          toast(
            decision === "approvata" ? "Candidatura approvata" : "Candidatura rifiutata",
            ap ? `${ap.nickname} · ID ${ap.avakinId}` : "",
            decision === "approvata" ? "ok" : "warn"
          );
          CFG.comando.loaded = false;
          await loadComando(true);
        } catch (err) {
          toast("Decisione non registrata", err?.message || "Riprova.", "err");
        }
      }
    );
  }

  async function patchMember(id, patch, label) {
    try {
      await API.patch(`/api/admin/members/${encodeURIComponent(id)}`, patch);
      toast("Membro aggiornato", label, "ok", 2400);
      const m = CFG.comando.membri.find((x) => String(x.id) === String(id));
      if (m) Object.assign(m, patch);
    } catch (err) {
      toast("Aggiornamento non riuscito", err?.message || "Riprova.", "err");
    }
  }

  /* --------------------------------------------------------- reazioni */

  async function loadReactions(key) {
    const list = Array.isArray(key) ? key : [key];
    const out = new Map();
    for (const k of list) {
      if (CFG.react.has(k)) {
        out.set(k, CFG.react.get(k));
        continue;
      }
      try {
        const d = await API.get(`/api/clan/content/${encodeURIComponent(k)}/reactions`);
        const v = { reactions: d.reactions || [], mie: d.mie || [], commenti: d.commenti || [] };
        CFG.react.set(k, v);
        out.set(k, v);
      } catch {
        out.set(k, null);
      }
    }
    return out;
  }

  async function toggleReaction(key, emoji) {
    if (!Account.authed) {
      toast("Accedi per reagire", "Le reazioni richiedono una sessione.", "warn");
      openModal("enterModal");
      return null;
    }
    const cur = CFG.react.get(key) || { reactions: [], mie: [] };
    const mine = cur.mie.includes(emoji);
    try {
      const r = mine
        ? await API.del(`/api/clan/content/${encodeURIComponent(key)}/reactions`, { emoji })
        : await API.post(`/api/clan/content/${encodeURIComponent(key)}/reactions`, { emoji });
      const next = { ...cur, reactions: r.reactions || [] };
      next.mie = mine ? cur.mie.filter((e) => e !== emoji) : [...cur.mie, emoji];
      CFG.react.set(key, next);
      return next;
    } catch (err) {
      toast("Reazione non salvata", err?.message || "Riprova.", "err");
      return null;
    }
  }

  /* ----------------------------------------------------- notifiche SSE */

  async function loadNotifications() {
    if (!Account.authed) return;
    try {
      const d = await API.get("/api/notifications");
      CFG.notif.items = d.notifiche || [];
      CFG.notif.unread = d.nonLette || 0;
      paintBell();
    } catch {}
  }

  function openNotifications() {
    const existing = $("#notifModal");
    if (existing) return openModal("notifModal");
    const items = CFG.notif.items;
    const list = items.length
      ? items
          .map(
            (n) => `
      <li class="notif-item${n.letta ? "" : " is-new"}" data-notif="${esc(n.id)}">
        <span class="notif-dot"></span>
        <div>
          <b>${esc(n.titolo)}</b>
          <p>${esc(n.corpo || "")}</p>
          <small class="mono">${esc(dt(n.createdAt, { hour: "2-digit", minute: "2-digit" }))}</small>
        </div>
      </li>`
          )
          .join("")
      : `<div class="empty-state"><span class="kanji">無</span>Nessuna notifica.</div>`;

    const wrap = document.createElement("div");
    wrap.className = "modal violet";
    wrap.id = "notifModal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box glass violet">
        <button class="modal-x" data-close aria-label="Chiudi">✕</button>
        <div class="modal-head">
          <span class="eyebrow violet">Avvisi</span>
          <h3>Notifiche</h3>
          <p>Eventi, approvazioni e comunicazioni del comando.</p>
        </div>
        <ul class="notif-list" style="margin:0;padding:0;list-style:none">${list}</ul>
        <div class="modal-foot">
          <button class="btn btn-sm btn-ghost" data-notif-read>Segna tutte come lette</button>
          <button class="btn btn-sm btn-violet" data-close>Chiudi</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    openModal("notifModal");

    wrap.addEventListener("click", async (e) => {
      const all = e.target.closest("[data-notif-read]");
      if (all) {
        try {
          await API.post("/api/notifications/read", {});
          CFG.notif.items = CFG.notif.items.map((n) => ({ ...n, letta: true }));
          CFG.notif.unread = 0;
          paintBell();
          UI.closeModal("notifModal");
          wrap.remove();
          toast("Notifiche segnate come lette", "", "ok", 2000);
        } catch {
          toast("Operazione non riuscita", "", "err");
        }
      }
    });
  }

  function paintBell() {
    const bell = $("#btnNotif");
    if (!bell) return;
    const n = CFG.notif.unread;
    bell.hidden = !Account.authed;
    bell.setAttribute("aria-label", n ? `Notifiche: ${n} non lette` : "Notifiche");
    let badge = bell.querySelector(".notif-badge");
    if (!n) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notif-badge";
      bell.appendChild(badge);
    }
    badge.textContent = n > 9 ? "9+" : String(n);
  }

  function connectStream() {
    if (CFG.notif.source || !Account.authed) return;
    let source;
    try {
      source = new EventSource("/api/notifications/stream", { withCredentials: true });
    } catch {
      return;
    }
    CFG.notif.source = source;

    source.addEventListener("ready", () => {
      CFG.notif.connected = true;
    });
    source.addEventListener("notification", (e) => {
      let payload;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      CFG.notif.items.unshift(payload);
      CFG.notif.unread += 1;
      paintBell();
      toast(payload.titolo, payload.corpo || "Nuovo avviso dal comando.", "ok", 6000);
    });
    source.addEventListener("traguardo", (e) => {
      let payload;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      toast(`Traguardo sbloccato: ${payload.nome}`, payload.desc || "", "ok", 7000);
    });
    source.onerror = () => {
      CFG.notif.connected = false;
    };
  }

  function disconnectStream() {
    CFG.notif.source?.close();
    CFG.notif.source = null;
    CFG.notif.connected = false;
  }

  /* -------------------------------------------------------------- init */

  function onRoute(view) {
    if (view === "eventi") {
      loadEvents();
      tickCountdowns();
    }
    if (view === "classifica") {
      loadLeaderboard();
      loadRaid();
    }
    if (view === "comando") loadComando();
    if (view === "blog" && window.Blog) window.Blog.loadBlog();
    if (view === "video") loadVideos();
  }

  function bind() {
    document.addEventListener("click", (e) => {
      const rsvp = e.target.closest("[data-rsvp]");
      if (rsvp) return toggleRsvp(rsvp.dataset.rsvp);

      const det = e.target.closest("[data-ev-detail]");
      if (det) return eventDetail(det.dataset.evDetail);

      const ics = e.target.closest("[data-ev-ics]");
      if (ics) return addToCalendar(ics.dataset.evIcs);

      const crea = e.target.closest("#btnCreaEvento");
      if (crea) return createEvent();

      const elimina = e.target.closest("[data-ev-delete]");
      if (elimina) return eliminaEvento(elimina.dataset.evDelete);

      const cf = e.target.closest("[data-cfilter]");
      if (cf) {
        CFG.comando.filter = cf.dataset.cfilter;
        CFG.comando.loaded = false;
        return loadComando(true);
      }

      const dec = e.target.closest("[data-decide]");
      if (dec) return decide(dec.dataset.decide, dec.dataset.decision);

      if (e.target.closest("#btnNotif")) return openNotifications();
      
      if (e.target.closest("#btnOpenVideoUpload")) {
        if (!Account.authed) {
          toast("Accedi per caricare", "Devi essere loggato per caricare video.", "warn");
          openModal("enterModal");
          return;
        }
        if (typeof VideoSystem !== 'undefined') {
          const dropzone = VideoSystem.createUploadDropzone({
            onUploadStart: (count) => toast("Caricamento", `${count} video in coda`, "info"),
            onUploadProgress: (id, progress) => {
              const el = document.querySelector(`[data-vid="${id}"] .vid-progress`);
              if (el) el.style.width = `${progress}%`;
            },
            onUploadComplete: (video) => {
              toast("Video caricato", `"${video.title}" è online`, "ok");
              loadVideos();
            },
            onUploadError: (id, error) => {
              toast("Errore upload", error.message, "err");
            }
          });
          document.body.appendChild(dropzone.element);
        }
        return;
      }
    });

    document.addEventListener("change", (e) => {
      const role = e.target.closest("[data-role-for]");
      if (role) {
        const m = CFG.comando.membri.find((x) => String(x.id) === String(role.dataset.roleFor));
        return patchMember(role.dataset.roleFor, { role: role.value }, `${m?.nome || ""} → ${roleLabel(role.value)}`);
      }
      const st = e.target.closest("[data-status-for]");
      if (st) {
        const m = CFG.comando.membri.find((x) => String(x.id) === String(st.dataset.statusFor));
        return patchMember(st.dataset.statusFor, { status: st.value }, `${m?.nome || ""} → ${st.value}`);
      }
    });

    bindVideoActions();

    // Il countdown gira una volta al secondo finche' la vista Eventi e' aperta.
    setInterval(() => {
      if ($("#view-eventi")?.classList.contains("is-active")) tickCountdowns();
    }, 1000);

    document.addEventListener("sam:auth", (e) => {
      if (e.detail?.authenticated) {
        connectStream();
        loadNotifications();
      } else {
        disconnectStream();
        CFG.notif.items = [];
        CFG.notif.unread = 0;
        CFG.comando.loaded = false;
        paintBell();
      }
    });
  }

  /* ----------------------------------------------- traguardi (account) */

  function renderAchievements(d) {
    const box = $("#accAchievements");
    if (!box) return;
    const a = d || CFG.achievements;
    if (!a?.traguardi?.length) {
      box.innerHTML = `<div class="empty-state"><span class="kanji">無</span>Traguardi disponibili dopo il primo accesso.</div>`;
      return;
    }
    CFG.achievements = a;
    const order = { oro: 0, argento: 1, bronzo: 2 };
    const sorted = [...a.traguardi].sort((x, y) => (x.earned === y.earned ? order[y.tier] - order[x.tier] : x.earned ? -1 : 1));
    box.innerHTML = `
      <div class="ach-progress">
        <div class="ach-bar"><i data-w="${a.progresso}" style="width:${a.progresso}%"></i></div>
        <span class="mono">${a.sbloccati} / ${a.totale} sbloccati · ${a.progresso}%</span>
      </div>
      <div class="ach-grid">${sorted
        .map(
          (t) => `
        <div class="ach ${t.earned ? "is-earned" : ""} tier-${esc(t.tier)}" title="${esc(t.desc)}">
          <span class="ach-kanji">${esc(t.kanji)}</span>
          <b>${esc(t.nome)}</b>
          <small>${esc(DATA.tierLabels[t.tier] || t.tier)}</small>
        </div>`
        )
        .join("")}</div>`;
  }

  /* --------------------------------------------------------- video */

  async function loadVideos() {
    const box = $("#videoGrid");
    const filterBar = $("#videoFilters");
    if (!box) return;
    
    box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--silver-500)">Caricamento video…</div>';
    
    let list = [];
    try {
      const d = await API.get("/api/video?limit=50");
      list = d.videos ?? [];
    } catch {
      list = [];
    }
    
    CFG.videos = list;
    paintVideos();
    
    if (filterBar && !filterBar.dataset.bound) {
      filterBar.dataset.bound = "1";
      filterBar.innerHTML = `
        <button class="chip violet is-active" data-vfilter="all">Tutti</button>
        <button class="chip violet" data-vfilter="video">Video</button>
        <button class="chip violet" data-vfilter="raid">Raid</button>
        <button class="chip violet" data-vfilter="guida">Guide</button>
        <button class="chip violet" data-vfilter="evento">Eventi</button>
      `;
      filterBar.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-vfilter]");
        if (!btn) return;
        $$("#videoFilters .chip").forEach(c => c.classList.toggle("is-active", c === btn));
        paintVideos(btn.dataset.vfilter);
      });
    }
  }

  function paintVideos(filter = "all") {
    const box = $("#videoGrid");
    if (!box) return;
    const list = (CFG.videos || []).filter(v => filter === "all" || v.categoria === filter);
    
    if (!list.length) {
      box.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 20px" data-reveal="scale">
          <div style="font-size:3rem;margin-bottom:16px">🎬</div>
          <h3 style="color:var(--silver-100);margin-bottom:8px">Nessun video</h3>
          <p style="color:var(--silver-500);max-width:400px;margin:0 auto">
            ${filter === "all" ? "Nessun video caricato. Sii il primo a condividere una guida o un raid!" : `Nessun video nella categoria "${filter}".`}
          </p>
        </div>`;
      return;
    }
    
    box.innerHTML = list.map(v => renderVideoCard(v)).join("");
    observePosts(box);
    animateInside(box);
  }

  function renderVideoCard(v) {
    const thumb = v.thumbnailUrl || `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect fill="%231a1f2e" width="320" height="180"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%238b5cf6" font-size="24">🎬</text></svg>`)}`;
    const dur = v.durata ? formatDuration(v.durata) : "—";
    const miaReazione = v.miaReazione ? ` is-liked` : "";
    
    return `
      <article class="vid-card glass-violet card-3d border-beam${miaReazione}" data-vid="${esc(v.id)}" data-reveal>
        <div class="vid-thumb">
          <img src="${esc(v.thumbnailUrl || thumb)}" alt="${esc(v.titolo)}" loading="lazy">
          <span class="vid-dur">${esc(dur)}</span>
          <button class="vid-like${miaReazione}" data-vlike="${esc(v.id)}" aria-label="Like">
            <span>⚔</span> <b>${num(v.likes ?? 0)}</b>
          </button>
        </div>
        <div class="vid-body">
          <div class="vid-meta">
            <span class="vid-tipo">${esc(v.categoria || "video")}</span>
            ${(v.tags ?? []).map(t => `<span class="bp-tag">${esc(t)}</span>`).join("")}
          </div>
          <h3 style="margin:8px 0 6px;color:var(--silver-100)">${esc(v.titolo)}</h3>
          <p style="color:var(--silver-400);font-size:.85rem;line-height:1.5;margin:0 0 10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(v.descrizione || "")}</p>
          <div class="vid-meta2">
            <span class="mono">${esc(v.autore?.handle)} · Lv ${v.autore?.level ?? 1}</span>
            <span class="mono">${dt(v.creatoIl)}</span>
          </div>
        </div>
      </article>`;
  }

  function formatDuration(seconds) {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
  }

  function bindVideoActions() {
    document.addEventListener("click", async (e) => {
      const like = e.target.closest("[data-vlike]");
      if (like) {
        e.preventDefault();
        const vid = like.dataset.vlike;
        try {
          const r = await API.post(`/api/video/${encodeURIComponent(vid)}/reaction`, { emoji: "⚔" });
          loadVideos();
        } catch (err) {
          toast("Reazione non salvata", err?.message || "Riprova.", "err");
        }
        return;
      }
      
      const card = e.target.closest("[data-vid]");
      if (card && !like && !e.target.closest("button")) {
        openVideoDetail(card.dataset.vid);
      }
    });
  }

  async function openVideoDetail(vid) {
    try {
      const d = await API.get(`/api/video/${encodeURIComponent(vid)}`);
      const v = d.video;
      if (!v) return;
      
      const wrap = document.createElement("div");
      wrap.id = "vidDetailModal";
      wrap.className = "modal violet";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.innerHTML = `
        <div class="modal-backdrop" data-close></div>
        <div class="modal-box glass violet vid-detail-modal" style="max-width:800px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column">
          <button class="modal-x" data-close aria-label="Chiudi">✕</button>
          ${v.thumbnailUrl ? `<div class="vid-detail-img"><img src="${esc(v.thumbnailUrl)}" alt="${esc(v.titolo)}"></div>` : ""}
          <div class="vid-detail-body" style="flex:1;padding:24px;overflow-y:auto;display:flex;flex-direction:column">
            <div class="row" style="gap:12px;align-items:center;margin-bottom:14px">
              <span class="vid-kanji">🎬</span>
              <div style="min-width:0">
                <span class="eyebrow violet">${esc(v.categoria || "Video")}</span>
                <h3 class="vid-detail-title animate-text" style="font-size:1.5rem;margin:0;color:var(--silver-100)">${esc(v.titolo)}</h3>
              </div>
              ${v.autore ? `<span class="tag silver" style="font-size:10px">di ${esc(v.autore.nome || v.autore.handle)}</span>` : ""}
            </div>
            <p class="vid-detail-desc animate-text" style="color:var(--silver-400);line-height:1.7;font-size:1rem;margin:0 0 16px">${esc(v.descrizione || "Nessuna descrizione.")}</p>
            
            <video class="vid-player" controls style="width:100%;border-radius:var(--r-md);background:#000" poster="${esc(v.thumbnailUrl || "")}">
              <source src="${esc(v.mediaUrl)}" type="${esc(v.mimeType || "video/mp4")}">
            </video>
            
            <div class="vid-detail-meta" style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0">
              <span class="vid-meta-item animate-text"><span class="kanji">◷</span> ${esc(dt(v.creatoIl, { year: "numeric" }))}</span>
              <span class="vid-meta-item animate-text"><span class="kanji">⏱</span> ${formatDuration(v.durata)}</span>
              <span class="vid-meta-item animate-text"><span class="kanji">⚔</span> ${num(v.likes ?? 0)} like</span>
              <span class="vid-meta-item animate-text"><span class="kanji">💬</span> ${num(v.commenti?.length ?? 0)} commenti</span>
            </div>
            
            <div class="row vid-actions" style="gap:10px;margin-top:auto">
              <button class="btn ${v.miaReazione ? "" : "btn-violet"}" data-vlike="${esc(v.id)}" style="flex:1">
                ${v.miaReazione ? "Hai messo like" : "Like ⚔"}
              </button>
              <button class="btn btn-ghost" data-vcomment="${esc(v.id)}">Commenti</button>
              ${v.autore?.id === (Account?.data?.id) ? `<button class="btn btn-sm btn-danger" data-vdelete="${esc(v.id)}">Elimina</button>` : ""}
            </div>
            
            <div class="vid-comments" style="margin-top:16px;max-height:300px;overflow:auto">
              <h4 style="margin:0 0 12px;color:var(--silver-100)">Commenti</h4>
              <div id="vidCommentList">${(v.commenti ?? []).map(c => `
                <div class="cm-item" style="display:flex;gap:8px;margin-bottom:12px">
                  <div class="cm-av">${esc((c.autore?.handle || "?")[0])}</div>
                  <div style="min-width:0">
                    <b>${esc(c.autore?.nome || c.autore?.handle)}</b>
                    <p style="color:var(--silver-400);font-size:.88rem;margin:2px 0">${esc(c.corpo)}</p>
                    <small class="mono" style="color:var(--silver-600)">${dt(c.creatoIl)}</small>
                  </div>
                </div>`).join("")}</div>
              <form id="vidCommentForm" style="margin-top:16px;display:flex;gap:8px">
                <input class="input violet" id="vidCommentInput" type="text" placeholder="Scrivi un commento…" required style="flex:1">
                <button type="submit" class="btn btn-violet">Invia</button>
              </form>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      wrap.classList.add("is-open");
      
      wrap.querySelector("#vidCommentForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = wrap.querySelector("#vidCommentInput");
        const corpo = input.value.trim();
        if (!corpo) return;
        try {
          await API.post(`/api/video/${encodeURIComponent(vid)}/comments`, { corpo });
          input.value = "";
          loadVideos();
          openVideoDetail(vid);
        } catch (err) {
          toast("Commento non inviato", err?.message || "Riprova.", "err");
        }
      });
      
      wrap.addEventListener("click", (e) => {
        if (e.target.closest("[data-close]")) { wrap.remove(); }
        if (e.target.closest("[data-vlike]")) {
          e.preventDefault();
          // handled by global listener
        }
        if (e.target.closest("[data-vdelete]")) {
          if (confirm("Eliminare questo video?")) {
            try {
              await API.del(`/api/video/${encodeURIComponent(vid)}`);
              toast("Video eliminato", "", "ok", 2000);
              wrap.remove();
              loadVideos();
            } catch (err) {
              toast("Eliminazione fallita", err?.message || "Riprova.", "err");
            }
          }
        }
      });
    } catch (err) {
      toast("Errore caricamento video", err?.message, "err");
    }
  }

  function observePosts(container = document) {
    container.querySelectorAll("[data-post]").forEach((card) => {
      if (card.dataset.bpBound) return;
      card.dataset.bpBound = "1";
    });
  }

  return {
    init: bind,
    onRoute,
    loadEvents,
    loadLeaderboard,
    loadRaid,
    loadComando,
    loadVideos,
    loadLeaderboard,
    loadRaid,
    loadComando,
    connectStream,
    loadNotifications,
    renderAchievements,
    loadReactions,
    toggleReaction,
    roleLabel,
    countdown,
    formatDuration,
    openVideoDetail,
    bindVideoActions
  };
})();
