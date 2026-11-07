const Account = (() => {
  const { $, $$, store, toast, openModal, closeModal, confirmBox, animateInside, setAccent } = UI;
  const KEY = "profile";

  const DEFAULTS = {
    name: "Samuraj",
    handle: "SAMURAJ",
    email: "samurai@esempio.it",
    region: "Europa",
    main: "Troppa ⋆ ⋆ ⋆ ⋆ ⋆",
    device: "iOS",
    bio: "Difensore di mestiere. Se c'è uno scudo, sono lì.",
    level: 1,
    xp: 0,
    xpPerNext: 100,
    progressoPct: 0,
    avatar: null,
    linked: null,
    stats: { vittorie: 0, sconfitte: 0, raid: 0, ore: 0 },
    prefs: {},
    created: null
  };

  let S = load();
  let authed = false;
  let remote = false;
  let rosterLive = null;

  function load() {
    const saved = store.get(KEY, null);
    const base = { ...DEFAULTS, prefs: { ...prefsDefaults() } };
    if (!saved) { base.created = Date.now(); return base; }
    return { ...base, ...saved, prefs: { ...base.prefs, ...(saved.prefs || {}) } };
  }

  function prefsDefaults() {
    return DATA.switchDefs.reduce((o, s) => ((o[s.key] = s.def), o), {});
  }

  const cache = () => store.set(KEY, S);
  const save = () => { cache(); renderSide();
    const lbx = $("#btnLinkAvakin");
    if (lbx) lbx.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin"; renderStats(); renderBadge(); };

  const fail = (id, msg) => {
    const el = $(`[data-for="${id}"]`);
    const input = $("#" + id);
    if (el) el.textContent = msg || "";
    if (input) input.classList.toggle("err", !!msg);
    return !msg;
  };
  const clearErr = (id) => fail(id, "");

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v).trim());
  const isHandle = (v) => /^[A-Za-z0-9_]{3,16}$/.test(String(v).trim());
  const isPassword = (v) => typeof v === "string" && v.length >= 8 && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);

  function netError(err) {
    const map = {
      conflict: "warn",
      unauthorized: "err",
      validation: "err",
      rate_limited: "warn",
      auth_rate_limited: "warn",
      offline: "warn"
    };
    toast(err?.message || "Errore di rete", remote ? "Il server ha rifiutato la richiesta." : "Modalità locale: nulla salvato sul server.", map[err?.code] || "err");
  }

  async function guard(fn) {
    try {
      return await fn();
    } catch (err) {
      netError(err);
      return null;
    }
  }

  function setMode(text) {
    const el = $("#accGateStatus");
    if (el) el.textContent = text;
  }

  function showGate(show) {
    const gate = $("#accGate"), shell = $("#accShell");
    if (gate) gate.style.display = show ? "" : "none";
    if (shell) shell.style.display = show ? "none" : "";
  }

  function setAuthed(v) {
    authed = v;
    showGate(!v);
    document.body.classList.toggle("is-guest", !v);
    if (!v) {
      S.role = undefined;
      syncCommandLink();
    }
  }

  /** Notifica il resto dell'app che la sessione e' cambiata. */
  function announce(detail) {
    document.dispatchEvent(new CustomEvent("sam:auth", { detail }));
  }

  async function bootstrap() {
    await API.probe();
    remote = API.online();

    // Gestisce il ritorno dal callback OAuth (query o hash: il server redirige a /#/account?...).
    const socialParams = (() => {
      const q = new URLSearchParams(location.search);
      if (q.get("social") || q.get("social_link")) return q;
      const h = String(location.hash || "");
      const i = h.indexOf("?");
      return i >= 0 ? new URLSearchParams(h.slice(i + 1)) : q;
    })();
    if (socialParams.get("social") === "1") {
      const provider = socialParams.get("provider") || "social";
      const ok = socialParams.get("ok") === "1";
      const dev = socialParams.get("dev") === "1";
      const created = socialParams.get("created") === "1";
      if (ok) {
        toast(created ? "Profilo Samurai creato" : "Accesso social completato", created ? `Benvenuto: account creato con ${provider}.` : `Account collegato/acceduto con ${provider}.`, dev ? "warn" : "ok", 6500);
      } else {
        toast("Accesso social", `Tentativo con ${provider} non completato.`, "warn", 5000);
      }
      history.replaceState(null, "", location.pathname + (location.hash ? "#/account" : ""));
    }
    if (socialParams.get("social_link") === "1") {
      const provider = socialParams.get("provider") || "social";
      const ok = socialParams.get("ok") === "1";
      const dev = socialParams.get("dev") === "1";
      if (ok) {
        toast("Account social collegato", `${provider} è ora collegato al tuo profilo.`, dev ? "warn" : "ok", 6000);
        if (remote && authed) await refreshAccount();
      } else {
        toast("Collegamento social", `${provider} non è stato collegato.`, "warn", 5000);
      }
      history.replaceState(null, "", location.pathname + (location.hash ? "#/account" : ""));
    }

    const me = await guard(() => API.get("/api/auth/me"));
    if (!me || !me.authenticated) {
      if (!remote) {
        setMode("Server non raggiungibile — profilo salvato solo su questo dispositivo.");
        setAuthed(true);
      } else {
        setAuthed(false);
        setMode(`Server online (${API.meta.db}) — sessione non attiva.`);
        announce({ authenticated: false });
      }
      return;
    }

    remote = true;
    S.role = me.user.role;
    const data = await guard(() => API.get("/api/account"));
    if (data) {
      const sp = new URLSearchParams(location.search);
      if (sp.get("social") === "1") {
        const p = sp.get("provider") || "";
        const map = { google: "Google", microsoft: "Microsoft", apple: "Apple" };
        toast("Accesso social", p ? `Benvenuto tramite ${map[p] || p}.` : "Accesso effettuato.", "ok");
        history.replaceState(null, "", location.pathname);
      }
      applyRemote(data);
      setAuthed(true);
      setMode(`Connesso come ${S.handle} · ruolo ${S.role}`);
      loadRosterLive();
      Views.connectStream();
      Views.loadNotifications();
      announce({ authenticated: true, role: S.role });
    }
  }

  function applyRemote(d) {
    const u = d.user;
    S = {
      ...S,
      name: u.name,
      handle: u.handle,
      email: u.email,
      region: u.region,
      main: u.mainChar,
      device: u.device,
      bio: u.bio,
      level: u.level,
      xp: u.xp,
      avatar: u.avatarUrl,
      role: u.role,
      linked: u.avakin ? { id: u.avakin.id, name: u.avakin.name, server: u.avakin.server, alliance: u.avakin.alliance } : null,
      stats: { vittorie: d.stats.vittorie, sconfitte: d.stats.sconfitte, raid: d.stats.raid, ore: d.stats.ore },
      skills: d.stats.skills,
      created: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      emailVerifiedAt: u.emailVerifiedAt
    };
    S.prefs = { ...S.prefs, ...d.prefs };
    S.xpPerNext = d.progression?.xpPerNext ?? 100;
    S.progressoPct = d.progression?.progressoPct ?? 0;
    S.skills = d.stats?.skills ?? [];
    cache();
    fillForm();
    renderSide();
    {
      const lbBtn = $("#btnLinkAvakin");
      if (lbBtn) lbBtn.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin";
    }
    renderStats();
    syncSwitches();
    syncAccents();
    renderBadge();
    renderSessions();
    renderAudit();
    applyPrefs();
    if (d.achievements) {
      Views.renderAchievements(d.achievements);
      celebrate(d.achievements.gained);
    }
    syncCommandLink();
    if (d.uploads) document.dispatchEvent(new CustomEvent("sam:uploads", { detail: d.uploads }));
  }

  /** Mostra l'earned di un traguardo appena sbloccato, una volta sola. */
  function celebrate(codes) {
    if (!Array.isArray(codes) || !codes.length) return;
    const shown = store.get("achSeen", []);
    const fresh = codes.filter((c) => !shown.includes(c));
    if (!fresh.length) return;
    store.set("achSeen", [...new Set([...shown, ...fresh])].slice(-40));
    fresh.forEach((code, i) => {
      setTimeout(() => toast(`Traguardo sbloccato: ${code.replace(/_/g, " ")}`, "Vai in Account → Traguardi per i dettagli.", "ok", 5000), i * 400);
    });
  }

  /** Mostra la voce "Comando" solo a chi ha davvero il ruolo. */
  function syncCommandLink() {
    const link = document.querySelector('[data-nav="comando"]');
    if (link) link.hidden = !isCommand();
    document.dispatchEvent(new CustomEvent("sam:route", { detail: { role: S.role } }));
  }

  const isCommand = () => ["bushi", "shogun", "admin"].includes(S.role);

  function bindProfile() {
    const form = $("#profileForm");
    const map = { "pf-name": "name", "pf-handle": "handle", "pf-email": "email", "pf-region": "region", "pf-main": "main", "pf-device": "device", "pf-bio": "bio" };
    Object.entries(map).forEach(([id, key]) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => {
        clearErr(id);
        const cnt = { "pf-name": "cnt-name", "pf-email": "cnt-email", "pf-bio": "cnt-bio" }[id];
        if (cnt && $("#" + cnt)) $("#" + cnt).textContent = `${el.value.length}/${el.maxLength}`;
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = {};
      Object.entries(map).forEach(([id, key]) => (v[key] = $("#" + id).value.trim()));
      let ok = true;
      ok = fail("pf-name", v.name.length >= 3 ? "" : "Servono almeno 3 caratteri.") && ok;
      ok = fail("pf-handle", isHandle(v.handle) ? "" : "Solo A-Z, 0-9 e _ (3-16 caratteri).") && ok;
      ok = fail("pf-email", isEmail(v.email) ? "" : "Email non valida.") && ok;
      ok = fail("pf-bio", v.bio.length <= 140 ? "" : "Massimo 140 caratteri.") && ok;
      if (!ok) { toast("Controlla i campi evidenziati", "Alcuni dati non sono validi.", "err"); return; }

      if (!remote) {
        S = { ...S, ...v, handle: v.handle.toUpperCase(), level: S.level + 1, xp: Math.min(100, S.xp + 4) };
        save();
        toast("Profilo salvato in locale", `Livello ${S.level}.`, "ok");
        return;
      }

      const res = await guard(() =>
        API.patch("/api/account/profile", {
          name: v.name,
          handle: v.handle,
          bio: v.bio,
          region: v.region,
          mainChar: v.main,
          device: v.device
        })
      );
      if (!res) return;
      const oldLevel = S.level;
      S = { ...S, name: res.user.name, handle: res.user.handle, region: res.user.region, main: res.user.mainChar, device: res.user.device, bio: res.user.bio, level: res.user.level, xp: res.user.xp };
      cache();
      renderSide();
    (function(){ const x=$("#btnLinkAvakin"); if(x) x.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin"; })();
      renderBadge();
      const lvMsg = res.user.level > oldLevel ? ` — Livello ${res.user.level} raggiunto!` : "";
      toast("Profilo salvato sul server", `Benvenuto, ${S.name}. Livello ${res.user.level}.${lvMsg}`, "ok");
    });

    $("#btnResetProfile").addEventListener("click", () =>
      confirmBox("Ripristinare il profilo?", "Torni ai valori iniziali del clan.", async () => {
        S = { ...DEFAULTS, prefs: { ...S.prefs }, created: Date.now() };
        save();
        fillForm();
        toast("Profilo ripristinato", "Tutto è tornato ai valori iniziali.", "warn");
      })
    );
  }

  function fillForm() {
    const map = { "pf-name": "name", "pf-handle": "handle", "pf-email": "email", "pf-region": "region", "pf-main": "main", "pf-device": "device", "pf-bio": "bio" };
    Object.entries(map).forEach(([id, key]) => {
      const el = $("#" + id);
      if (el) el.value = S[key] ?? "";
    });
    if ($("#pf-email")) $("#pf-email").readOnly = remote;
    if ($("#cnt-name")) $("#cnt-name").textContent = `${(S.name || "").length}/24`;
    if ($("#cnt-email")) $("#cnt-email").textContent = `${(S.email || "").length}/40`;
    if ($("#cnt-bio")) $("#cnt-bio").textContent = `${(S.bio || "").length}/140`;
  }

  function renderSide() {
    if (!authed) return;
    $("#accNameDisplay").textContent = S.name;
    $("#accHandleDisplay").textContent = "@" + S.handle;
    const roleIdx = Math.min(DATA.ranks.length - 1, Math.floor(S.level / 11));
    const role = DATA.ranks[roleIdx].nome;
    const tag = $("#accRoleTag");
    tag.textContent = role;
    tag.className = "tag" + (roleIdx >= 3 ? " gold" : "");
    const link = $("#accLinkTag");
    if (S.linked) {
      link.textContent = `Avakin • ${S.linked.id}`;
      link.className = "tag";
      link.title = `Collegato a ${S.linked.name} • ${S.linked.server}${S.linked.alliance ? ` • ${S.linked.alliance}` : ""}`;
    } else {
      link.textContent = "Non collegato";
      link.className = "tag silver";
      link.title = "";
    }
    $("#accLevelText").textContent = `${S.level} / 50`;
    const bar = $("#accLevelBar");
    bar.dataset.w = Math.round((S.level / 50) * 100);
    requestAnimationFrame(() => (bar.style.width = bar.dataset.w + "%"));
    const xpText = $("#accXpText");
    if (xpText) {
      const pct = S.progressoPct ?? 0;
      const p = S.xp ?? 0;
      const per = S.xpPerNext ?? 100;
      xpText.textContent = `XP ${p} / ${per} · ${pct}%`;
    }
    const xpBar = $("#accXpBar");
    if (xpBar) {
      xpBar.style.width = `${S.progressoPct ?? 0}%`;
    }
    if ($("#accXpText")) $("#accXpText").textContent = `XP ${S.xp ?? 0} / ${S.xpPerNext ?? 100} · ${S.progressoPct ?? 0}%`;

    const meta = $("#accMeta");
    if (meta) {
      const parts = [];
      if (S.created) parts.push(`Membro dal ${new Date(S.created).toLocaleDateString("it-IT")}`);
      if (S.lastLoginAt) parts.push(`Ultimo accesso ${new Date(S.lastLoginAt).toLocaleDateString("it-IT")}`);
      meta.textContent = parts.join(" • ");
      meta.style.display = parts.length ? "" : "none";
    }
    const vtag = $("#accVerifiedTag");
    if (vtag) {
      const verified = !!S.emailVerifiedAt || !!(S.role && ["bushi", "shogun", "admin"].includes(S.role));
      vtag.textContent = verified ? "Email verificata" : "Email non verificata";
      vtag.className = verified ? "tag" : "tag danger";
      vtag.style.display = "";
    }

    const av = $("#accAvatar");
    if (av) {
      const avSrc = (typeof S.avatar === 'object' && S.avatar) ? S.avatar.dataUrl : S.avatar;
      av.innerHTML = avSrc
        ? `<img src="${avSrc}" alt="Avatar">`
        : `<span>${(S.handle[0] || "侍")}</span>`;
      av.insertAdjacentHTML("beforeend", `<span class="edit-badge">✎</span><input type="file" id="avatarInput" accept="image/png,image/jpeg,image/webp,image/gif" class="sr-only">`);
    }
    // also update any other avatar elements if they exist
    try {
      const avSrcAll = (typeof S.avatar === 'object' && S.avatar) ? S.avatar.dataUrl : S.avatar;
      document.querySelectorAll(".sidebar-avatar, .user-badge-img").forEach(img => { if (img && avSrcAll) img.src = avSrcAll; });
    } catch (e) {}

    $("#avatarInput").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (window.AvatarCreator) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          AvatarCreator.openWithImage(ev.target.result);
        };
        reader.readAsDataURL(f);
        e.target.value = "";
        return;
      }
      if (f.size > 4 * 1024 * 1024) { toast("Immagine troppo grande", "Massimo 4 MB.", "err"); return; }
      const local = URL.createObjectURL(f);
      S.avatar = local;
      renderSide();
      const lbBtn = $("#btnLinkAvakin");
      if (lbBtn) lbBtn.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin";

      if (!remote) {
          const rd = new FileReader();
        rd.onload = () => { S.avatar = rd.result; save(); toast("Avatar aggiornato in locale", "", "ok"); };
        rd.readAsDataURL(f);
        return;
      }
      const fd = new FormData();
      fd.append("avatar", f);
      const res = await guard(() => API.upload("/api/account/avatar", fd));
      if (!res) {
        renderSide();
        const lbx = $("#btnLinkAvakin");
        if (lbx) lbx.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin";
        return;
      }
      S.avatar = res.avatarUrl;
      cache();
      renderSide();
      {
        const lbx2 = $("#btnLinkAvakin");
        if (lbx2) lbx2.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin";
      }
      renderBadge();
      toast("Avatar caricato sul server", "", "ok");
    });

    // Avatar click: modifica se esiste avatar Mii, altrimenti apri selezione file
    const accAvatar = $("#accAvatar");
    if (accAvatar && !accAvatar.dataset.avatarBound) {
      accAvatar.dataset.avatarBound = "1";
      accAvatar.addEventListener("click", (e) => {
        if (e.target.closest("#avatarInput")) return;
        const hasMii = (typeof S.avatar === 'object' && S.avatar && S.avatar.type === 'mii');
        if (hasMii && window.AvatarCreator) {
          AvatarCreator.openWithAvatar(S.avatar);
          return;
        }
        const input = $("#avatarInput");
        if (input) input.click();
      });
    }
  }

  function renderStats() {
    const st = S.stats;
    const total = st.vittorie + st.sconfitte;
    const cards = [
      ["Vittorie", st.vittorie], ["Sconfitte", st.sconfitte],
      ["Raid disputati", st.raid], ["Ore in clan", st.ore],
      ["Livello", S.level], ["Win rate", total ? Math.round((st.vittorie / total) * 100) + "%" : "—"]
    ];
    $("#accStats").innerHTML = cards.map(([l, v]) => `<div class="acc-stat"><b>${Number(v).toLocaleString("it-IT")}</b><small>${l}</small></div>`).join("");
    const skills = S.skills || DATA.skills;
    $("#accSkills").innerHTML = skills.map((s) => `
      <div class="skill-row"><b>${s.nome}</b><span class="skill-bar"><i data-w="${s.v}"></i></span><span>${s.v}%</span></div>`).join("");
    animateInside($('[data-apanel="statistiche"]'));
  }

  async function renderSessions() {
    const box = $("#accSessions");
    if (!box) return;
    if (remote && authed) {
      const d = await guard(() => API.get("/api/auth/sessions"));
      if (d) {
        box.innerHTML = d.sessions.length
          ? d.sessions
              .map((s, i) => {
                const ua = escapeHtml(s.device || s.userAgent || "Sconosciuto");
                const last = s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString("it-IT") : "—";
                const ip = s.ip ? escapeHtml(s.ip) : "—";
                return `
                <div class="sess-item">
                  <div class="sess-ico">${i === 0 ? "◉" : "▣"}</div>
                  <div class="sess-info">
                    <b>${ua} ${i === 0 ? '<span class="tag" style="font-size:8px">Attuale</span>' : ""}</b>
                    <small>Ultimo uso ${last} · IP ${ip}</small>
                  </div>
                  <button class="btn btn-sm btn-ghost" data-revoke="${escapeHtml(s.id)}" ${i === 0 ? "disabled" : ""} title="${i === 0 ? "Non puoi revocare la sessione attuale" : "Revoca"}">Revoca</button>
                </div>`;
              })
              .join("")
          : `<div class="empty-state"><span class="kanji">無</span>Nessuna sessione attiva.</div>`;
        return;
      }
    }
    box.innerHTML = `<div class="empty-state"><span class="kanji">無</span>Sessioni visibili in modalità connessa al server.</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let prefTimer = null;

  /** Delegation: un solo listener per container, mai uno per ogni render. */
  function bindSwitchesOnce() {
    const box = $("#accSwitches");
    if (!box || box.dataset.bound) return;
    box.dataset.bound = "1";
    box.addEventListener("change", async (e) => {
      const t = e.target.closest("[data-pref]");
      if (!t) return;
      S.prefs[t.dataset.pref] = t.checked;
      cache();
      applyPrefs();
      applyAccentRemote();
      toast(t.checked ? "Preferenza attivata" : "Preferenza disattivata", t.dataset.pref, "ok", 2000);
    });
  }

  /** Aggiorna i checkbox senza ricreare il DOM (e senza duplicare listener). */
  function syncSwitches() {
    bindSwitchesOnce();
    $$("#accSwitches [data-pref]").forEach((input) => {
      input.checked = !!S.prefs[input.dataset.pref];
    });
  }

  function renderSwitches() {
    $("#accSwitches").innerHTML = DATA.switchDefs.map((s) => `
      <label class="switch">
        <span class="switch-info"><b>${s.label}</b><small>${s.sub}</small></span>
        <input type="checkbox" data-pref="${s.key}">
        <span class="switch-track"></span>
      </label>`).join("");
    syncSwitches();
  }

  function applyAccentRemote() {
    if (!remote || !authed) return;
    clearTimeout(prefTimer);
    prefTimer = setTimeout(() => {
      API.patch("/api/account/preferences", {
        motion: S.prefs.motion, petals: S.prefs.petals, grain: S.prefs.grain,
        sound: S.prefs.sound, notif: S.prefs.notif, compact: S.prefs.compact,
        accent: store.get("accent", "#5aa8ff")
      }).catch(() => {});
    }, 400);
  }

  function bindAccentsOnce() {
    const box = $("#accentDots");
    if (!box || box.dataset.bound) return;
    box.dataset.bound = "1";
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-accent]");
      if (!b) return;
      setAccent(b.dataset.accent);
      $$("#accentDots .accent-dot").forEach((d) => d.classList.toggle("is-on", d === b));
      renderBadge();
      applyAccentRemote();
      toast("Accent aggiornato", b.title, "ok", 2000);
    });
  }

  function renderAccents() {
    $("#accentDots").innerHTML = DATA.accenti.map((a) => `
      <button class="accent-dot" style="background:linear-gradient(140deg, ${a.hex}, #0a1a3d);color:${a.hex}" data-accent="${a.hex}" title="${a.name}" aria-label="${a.name}"></button>`).join("");
    syncAccents();
  }

  function syncAccents() {
    bindAccentsOnce();
    const cur = (store.get("accent", "#5aa8ff") || "").toLowerCase();
    $$("#accentDots .accent-dot").forEach((d) => {
      d.classList.toggle("is-on", (d.dataset.accent || "").toLowerCase() === cur);
    });
  }

  function renderRoster(filter = "") {
    const q = filter.trim().toLowerCase();
    const src = rosterLive || DATA.roster;
    const rows = src.filter((r) => !q || r.nome.toLowerCase().includes(q) || (r.ruolo || "").toLowerCase().includes(q));
    const box = $("#accRoster");
    if (!rows.length) { box.innerHTML = `<div class="empty-state"><span class="kanji">無</span>Nessun compagno trovato.</div>`; return; }
    box.innerHTML = rows.map((r) => `
      <div class="roster-card ${r.nome.toUpperCase() === S.handle ? "is-me" : ""}" data-roster="${escapeHtml(r.nome)}">
        <div class="roster-av">${r.kanji || escapeHtml(r.nome[0])}</div>
        <b>${escapeHtml(r.nome)}</b>
        <small>${escapeHtml(r.ruolo)}</small>
        <div class="mono" style="font-size:9px;color:var(--silver-600);margin-top:6px">Lv ${r.lvl} · ${escapeHtml((r.spada || r.mainChar || "").split("").pop().trim())}</div>
        <div style="margin-top:8px;font-size:9px;letter-spacing:.2em;color:${r.online ? "#6ee7a8" : "#71809a"}">${r.online ? "● ONLINE" : "○ OFFLINE"}</div>
      </div>`).join("");
  }

  async function loadRosterLive() {
    if (!remote) return;
    const d = await guard(() => API.get("/api/clan/roster"));
    if (!d || !d.membri?.length) return;
    const known = new Map(DATA.roster.map((r) => [r.nome.toUpperCase(), r]));
    rosterLive = d.membri.map((m) => {
      const k = known.get(m.handle);
      return {
        nome: m.name || m.handle,
        ruolo: m.role,
        lvl: m.level,
        spada: m.mainChar,
        kanji: k?.kanji || "侍",
        online: m.lastLoginAt ? Date.now() - new Date(m.lastLoginAt).getTime() < 3600e3 : false
      };
    });
    renderRoster($("#rosterSearch")?.value || "");
  }

  function badgeSvg() {
    if (remote && authed) return fetch("/api/account/badge.svg", { credentials: "same-origin" }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    return Promise.resolve(ART.badge({ name: S.handle, level: S.level, accent: store.get("accent", "#5aa8ff") }));
  }


  async function renderAudit() {
    const box = $("#accAudit");
    if (!box) return;
    if (!remote || !authed) {
      box.innerHTML = `<div class="empty-state"><span class="kanji">無</span>Log visibile in modalità connessa al server.</div>`;
      return;
    }
    const d = await guard(() => API.get("/api/account/audit?limit=80"));
    if (!d || !Array.isArray(d.entries)) {
      box.innerHTML = `<div class="empty-state"><span class="kanji">無</span>Nessuna attività disponibile.</div>`;
      return;
    }
    box.innerHTML = d.entries.length
      ? d.entries
          .map((e) => `
            <div class="sess-item">
              <div class="sess-ico">◇</div>
              <div class="sess-info">
                <b>${escapeHtml(e.action || "evento")}</b>
                <small>${e.createdAt ? new Date(e.createdAt).toLocaleString("it-IT") : "—"}${e.ip ? ` · IP ${escapeHtml(e.ip)}` : ""}</small>
              </div>
              ${e.meta ? `<span class="mono" style="font-size:9px;color:var(--silver-600);max-width:160px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(typeof e.meta === "string" ? e.meta : JSON.stringify(e.meta))}</span>` : ""}
            </div>`)
          .join("")
      : `<div class="empty-state"><span class="kanji">無</span>Nessuna attività disponibile.</div>`;
  }


  async function renderBadge() {
    const w = $("#badgeWrap");
    if (!w) return;
    const svg = await badgeSvg();
    w.innerHTML = svg || "";
  }

  async function downloadBadge() {
    const svg = await badgeSvg();
    if (!svg) { toast("Stemma non disponibile", "", "err"); return; }
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stemma-${(S.handle||"samurai").toLowerCase()}-${new Date().toISOString().slice(0,10)}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Stemma scaricato", "SVG pronto da condividere.", "ok");
  }

  async function exportData() {
    if (remote && authed) {
      const res = await fetch("/api/account/export", { credentials: "same-origin" });
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `samurai-${S.handle.toLowerCase()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast("Profilo esportato dal server", "File JSON scaricato.", "ok");
        return;
      }
    }
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `samurai-${(S.handle||"samurai").toLowerCase()}-locale.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Profilo esportato in locale", "", "warn");
  }

  const WIPE_KEYS = [
    "profile", "accent", "sound", "uploads", "welcomeDone", "welcomeSilent",
    "applications", "subscribers", "achSeen"
  ];

  function wipeLocal() {
    WIPE_KEYS.forEach((k) => {
      try { localStorage.removeItem("sam." + k); } catch {}
    });
  }

  async function wipe() {
    if (remote && authed) {
      const pw = prompt("Conferma eliminazione account.\nInserisci la password:");
      if (pw == null) return;
      const res = await guard(() => API.del("/api/account", { password: pw, confirm: "ELIMINA" }));
      if (!res) return;
      wipeLocal();
      setAuthed(false);
      S = { ...DEFAULTS, prefs: prefsDefaults() };
      fillForm();
      toast("Account eliminato", "I tuoi dati sono stati rimossi.", "warn", 6000);
      return;
    }
    wipeLocal();
    location.reload();
  }

  async function renderSocial() {
    const box = $("#accSocial");
    if (!box) return;
    const dev = !!(API.meta?.auth?.socialDev);
    const list = store.get("socialAccounts", []);
    box.innerHTML = list.length
      ? list.map((s) => `
        <div class="sess-item" style="margin:6px 0">
          <div class="sess-ico" style="background:${s.color || "#71809a"}">${s.icon}</div>
          <div class="sess-info">
            <b>${escapeHtml(s.label)}</b>
            <small>${escapeHtml(s.email || s.providerUserId || "")} · ${dev ? "simulato" : "collegato"}</small>
          </div>
        </div>`).join("")
      : `<div class="empty-state"><span class="kanji">無</span>Nessun account social collegato.</div>`;
  }

  function bindGlobal() {
    $("#btnExport").addEventListener("click", exportData);
    $("#rosterSearch").addEventListener("input", (e) => renderRoster(e.target.value));
    $("#accRoster").addEventListener("click", (e) => {
       const c = e.target.closest("[data-roster]");
       if (!c) return;
       const r = (rosterLive || DATA.roster).find((x) => x.nome === c.dataset.roster);
       if (!r) return;
       $("#memberModalName").textContent = r.nome;
       $("#memberModalRole").textContent = `${r.ruolo} · Lv ${r.lvl}`;
       $("#memberModalDesc").textContent = r.spada || r.mainChar || "";
       $("#memberModalImg").innerHTML = `<span class="kanji" style="font-size:4rem">${r.kanji || r.nome[0]}</span>`;
       openModal("memberModal");
    });
    $("#accSessions").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-revoke]");
      if (!b) return;
      confirmBox("Revocare la sessione?", "Quel dispositivo verrà disconnesso immediatamente.", async () => {
        if (remote) {
          const res = await guard(() => API.del(`/api/auth/sessions/${b.dataset.revoke}`));
          if (!res) return;
        }
        b.closest(".sess-item").remove();
        toast("Sessione revocata", "", "warn");
      });
    });
    $("#btnRefreshSession").addEventListener("click", async () => {
      if (!remote) { toast("Modalità locale", "Nessuna sessione da rinnovare.", "warn"); return; }
      const r = await guard(() => API.refresh());
      toast(r ? "Sessione rinnovata" : "Sessione scaduta", r ? "Accesso prolungato di 20 minuti." : "Accedi di nuovo.", r ? "ok" : "err");
    });
    $("#btnRefreshSessions")?.addEventListener("click", () => renderSessions());
    $("#btnRefreshAudit")?.addEventListener("click", () => renderAudit());

    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action;
      if (a === "apply") {
        const frame = $("#applyFormFrame");
        if (frame && frame.dataset.src && frame.getAttribute("src") !== frame.dataset.src) frame.src = frame.dataset.src;
        openModal("applyModal");
      }
      if (a === "login") { showLoginTab(); openModal("enterModal"); }
      if (a === "register") { showRegisterTab(); openModal("enterModal"); }
      if (a === "forgot") { $("#enterForm").style.display = "none"; $("#resetForm").style.display = ""; }
      if (a === "link-avakin") {
        if (!authed) { toast("Accedi prima", "L'area account richiede una sessione.", "warn"); showLoginTab(); openModal("enterModal"); return; }
        openModal("linkModal");
        if (!$("#lk-id").value && S.linked) { $("#lk-id").value = S.linked.id; $("#lk-name").value = S.linked.name; }
      }
      if (a === "social") window.socialLogin?.(b.dataset.provider);
      if (a === "social-link") {
        const provider = b.dataset.provider;
        const dev = !!(API.meta?.auth?.socialDev);
        closeModal("enterModal");
        if (dev) {
          // Simula il collegamento social in modalità dev
          const email = prompt(`Email simulata per ${providerLabelName(provider)}:`, `dev_${provider}@samurai.test`);
          if (email == null) return;
          const name = prompt(`Nome simulato per ${providerLabelName(provider)}:`, `${providerLabelName(provider)} Utente`);
          if (name == null) return;
          guard(() => API.post("/api/auth/social/link", {
            provider,
            email: email.trim(),
            name: name.trim(),
            avatar: ""
          }, { noRetry: true })).then((res) => {
            if (res) {
              const socials = store.get("socialAccounts", []);
              socials.push({ provider, label: providerLabelName(provider), email: email.trim(), icon: provider === "google" ? "G" : provider === "microsoft" ? "M" : "A", color: provider === "google" ? "#ea4335" : provider === "microsoft" ? "#0078d4" : "#000000" });
              store.set("socialAccounts", socials);
              renderSocial();
              toast("Account social collegato (dev)", `${providerLabelName(provider)} simulato e collegato.`, "ok");
            }
          });
        } else {
          guard(() => API.post("/api/auth/social/link", { provider }, { noRetry: true })).then((res) => {
            if (res) {
              if (res.authorizeUrl) location.href = res.authorizeUrl;
              else toast("Account social collegato", `${providerLabelName(provider)} collegato.`, "ok");
            }
          });
        }
      }
      if (a === "upload") { openModal("uploadModal"); }
      if (a === "export") exportData();
      if (a === "create-avatar") { if (window.AvatarCreator) { AvatarCreator.open(); } else { toast("Creatore avatar non caricato", "", "err"); } }
      if (a === "badge-preview") UI.setPanel("badge");
      if (a === "badge-download") downloadBadge();
      if (a === "badge-copy") badgeSvg().then((svg) => {
        if (!svg) return;
        navigator.clipboard?.writeText(svg).then(
          () => toast("Markup copiato", "Incollalo dove vuoi.", "ok"),
          () => toast("Copia non disponibile", "Il browser ha bloccato il clipboard.", "err")
        );
      });
      if (a === "logout-all") confirmBox("Disconnettere ovunque?", "Tutte le sessioni verranno chiuse, tranne questa.", async () => {
        if (remote) { const r = await guard(() => API.post("/api/auth/logout-all", {})); if (!r) return; }
        toast("Sessioni chiuse", "Ora sei connesso solo da qui.", "warn");
        renderSessions();
        renderAudit();
      });
      if (a === "logout") doLogout();
      if (a === "wipe") confirmBox("Cancellare tutti i dati?", "Profilo, preferenze, foto e impostazioni verranno rimossi definitivamente.", wipe);
    });

    bindEnter();
    bindLink();
    bindSocial();
    bindEmail();
    bindPassword();
    bindUpload();
    bindNewsletter();

    API.on("auth", (info) => {
      if (info.authenticated === false) {
        setAuthed(false);
        setMode("Sessione scaduta — accedi di nuovo.");
        announce({ authenticated: false });
        toast("Sessione terminata", "Accedi di nuovo per continuare.", "warn", 6000);
      }
    });
  }

  async function doLogout() {
    if (remote) await guard(() => API.post("/api/auth/logout", {}));
    S = { ...DEFAULTS, prefs: { ...S.prefs } };
    cache();
    setAuthed(false);
    setMode("Sei uscito. I dati del server sono intatti.");
    fillForm();
    announce({ authenticated: false });
    toast("Sei uscito", "Il profilo resta salvato sul server.", "ok");
  }

  function showLoginTab() {
    $("#tabLogin").classList.add("is-active");
    $("#tabRegister").classList.remove("is-active");
    $("#regOnly").style.display = "none";
    $("#enSubmit").textContent = "Accedi";
    $("#enterTitle").textContent = "Entra nella Gate";
    $("#enterLead").textContent = "Accedi al tuo profilo samurai.";
    $("#enPass").setAttribute("autocomplete", "current-password");
  }

  function showRegisterTab() {
    $("#tabRegister").classList.add("is-active");
    $("#tabLogin").classList.remove("is-active");
    $("#regOnly").style.display = "";
    $("#enSubmit").textContent = "Crea il mio account";
    $("#enterTitle").textContent = "Diventa un samurai";
    $("#enterLead").textContent = "Crea il tuo profilo. Servono email, handle e una password con numeri.";
    $("#enPass").setAttribute("autocomplete", "new-password");
  }

  function bindEnter() {
    $("#tabLogin").addEventListener("click", showLoginTab);
    $("#tabRegister").addEventListener("click", showRegisterTab);
    $("#rsBack").addEventListener("click", () => {
      $("#resetForm").style.display = "none";
      $("#enterForm").style.display = "";
    });

    $("#enterForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const registering = $("#tabRegister").classList.contains("is-active");
      const mail = $("#en-email").value.trim();
      const pw = $("#en-pass").value;
      let ok = fail("en-email", isEmail(mail) ? "" : "Email non valida.");
      ok = fail("en-pass", isPassword(pw) ? "" : "Password: almeno 8 caratteri con lettere e numeri.") && ok;

      let payload = { email: mail, password: pw };
      if (registering) {
        const nm = $("#en-name").value.trim();
        const hd = $("#en-handle").value.trim();
        const dob = $("#en-dob").value || null;
        const sesso = $("#en-sesso").value;
        const pronome = $("#en-pronome").value.trim() || "lui/lei";
        const tz = $("#en-tz").value || "Europe/Rome";
        const bio = $("#en-bio").value.trim();
        const mainChar = $("#en-mainchar").value || "Senza scudiero";
        ok = fail("en-name", nm.length >= 3 ? "" : "Nome troppo corto.") && ok;
        ok = fail("en-handle", isHandle(hd) ? "" : "Handle: solo A-Z, 0-9 e _ (3-16).") && ok;
        ok = fail("en-dob", dob ? "" : "Data di nascita richiesta.") && ok;
        ok = fail("en-sesso", sesso ? "" : "Sesso richiesto.") && ok;

        // Questionario attitudine
        const att = {};
        ["difesa","attacco","risorse","arena","squadra"].forEach((k) => {
          const v = Number($(`#en-att-${k}`).value);
          att[k] = v;
        });

        payload = {
          ...payload,
          name: nm,
          handle: hd,
          region: $("#en-region").value,
          device: $("#en-device").value,
          data_nascita: dob,
          sesso,
          pronome,
          timezone: tz,
          bio,
          mainChar: mainChar,
          difesa: att.difesa,
          attacco: att.attacco,
          risorse: att.risorse,
          arena: att.arena,
          squadra: att.squadra,
          termini: true
        };
      }
      if (!ok) return;

      const btn = $("#enSubmit");
      btn.disabled = true;
      const res = await guard(() => (registering ? API.post("/api/auth/register", payload, { noRetry: true }) : API.post("/api/auth/login", payload, { noRetry: true })));
      btn.disabled = false;
      if (!res) return;
      API.resetAuthLock(); // login/registrazione riuscita: sblocca futuri avvisi di sessione scaduta

      if (registering && res.data?.needsEmailVerification) {
        // Registrazione effettuata, ma serve verifica email
        const email = res.user.email;
        $("#enterForm").reset();
        showLoginTab();
        const devToken = res.data.devToken;
        if (devToken) {
          $("#rs-email").value = email;
          $("#rs-token-wrap").style.display = "";
          $("#rsSubmit").textContent = "Imposta la nuova password";
          $("#rs-token").value = devToken;
          toast("Account creato — verifica la email", `Codice di verifica (dev): ${devToken}. Incollalo qui sotto e clicca "Invia il link".`, "warn", 10000);
        } else {
          toast("Account creato", "Controlla la tua email per il link di verifica.", "ok", 8000);
        }
        $("#resetForm").style.display = "none";
        $("#enterForm").style.display = "";
        return;
      }

      S = { ...S, name: res.user.name, handle: res.user.handle, email: res.user.email, level: res.user.level, role: res.user.role, xp: res.user.xp };
      cache();
      setAuthed(true);
      setMode(`Connesso come ${S.handle} · ruolo ${res.user.role}`);
      await refreshAccount();
      announce({ authenticated: true, role: res.user.role });
      Views.connectStream();
      Views.loadNotifications();
      closeModal("enterModal");
      $("#enterForm").reset();
      toast(registering ? "Account creato" : "Benvenuto nella Gate", `${res.user.name} · livello ${res.user.level}`, "ok");
      if (registering) {
        setTimeout(() => {
          toast("Ora crea il tuo avatar Samurai", "Personalizza volto, capelli, elmo, armatura e armi", "ok", 4000);
          if (window.AvatarCreator) AvatarCreator.open();
          else if (window.avatarV2) avatarV2.init();
        }, 800);
      }
      UI.go("account");
    });

    $("#resetForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const mail = $("#rs-email").value.trim();
      const token = $("#rs-token").value.trim();
      const pw = $("#rs-pass").value;

      if (token) {
        if (!fail("rs-pass", isPassword(pw) ? "" : "Password: almeno 8 caratteri con lettere e numeri.")) return;
        const res = await guard(() => API.post("/api/auth/reset-password", { token, password: pw }, { noRetry: true }));
        if (!res) return;
        $("#resetForm").reset();
        $("#resetForm").style.display = "none";
        $("#enterForm").style.display = "";
        showLoginTab();
        toast("Password reimpostata", "Accedi con la nuova password.", "ok");
        return;
      }

      if (!fail("rs-email", isEmail(mail) ? "" : "Email non valida.")) return;
      const res = await guard(() => API.post("/api/auth/forgot-password", { email: mail }, { noRetry: true }));
      if (!res) return;
      $("#rs-token-wrap").style.display = "";
      $("#rsSubmit").textContent = "Imposta la nuova password";
      toast(res.devToken ? "Token sviluppo pronto" : "Controlla la tua email", res.devToken ? "Incollalo nel campo qui sotto." : "Se l'account esiste riceverai un link.", res.devToken ? "warn" : "ok", 8000);
      if (res.devToken) $("#rs-token").value = res.devToken;
    });

    // Slider attitudine: aggiorna valori visualizzati
    ["difesa","attacco","risorse","arena","squadra"].forEach((k) => {
      const sld = $(`#en-att-${k}`);
      const lbl = $(`#att-val-${k}`);
      if (sld && lbl) {
        sld.addEventListener("input", () => { lbl.textContent = sld.value; });
      }
    });
    // Max data di nascita = oggi
    const dob = $("#en-dob");
    if (dob) dob.max = new Date().toISOString().slice(0, 10);
  }

  async function refreshAccount() {
    const d = await guard(() => API.get("/api/account"));
    if (!d) return;
    applyRemote(d);
    renderSessions();
    renderAudit();
    if ($("#em-current")) $("#em-current").value = S.email || "";
  }

  function bindSocial() {
    const dev = !!(API.meta?.auth?.socialDev);
    // Indicatore visivo modalità dev sui pulsanti social
    if (dev) {
      $$('[data-action="social"]').forEach((b) => {
        if (!b.dataset.socialBadge) {
          b.dataset.socialBadge = "1";
          const badge = document.createElement("span");
          badge.className = "dev-badge";
          badge.textContent = "DEV";
          badge.style.cssText = "float:right;font-size:9px;background:#a855f7;color:#fff;border-radius:4px;padding:1px 6px;margin-left:6px";
          b.appendChild(badge);
        }
      });
    }
    async function socialLogin(provider) {
      if (!["google", "microsoft", "apple"].includes(provider)) { toast("Provider non valido", "", "err"); return; }
      closeModal("enterModal");
      if (dev) {
        // In dev simula il provider: usa l'email già inserita nel form se presente
        const emailInput = $("#en-email");
        const email = emailInput ? String(emailInput.value ?? "").toLowerCase() : `dev_${provider}@samurai.test`;
        const nameInput = $("#en-name");
        const name = nameInput ? String(nameInput.value ?? "").trim() : `${providerLabelName(provider)} Test`;
        const res = await guard(() => API.post("/api/auth/social/dev", {
          provider,
          email: email || `dev_${provider}@samurai.test`,
          name: name || `${providerLabelName(provider)} Test`,
          avatar: ""
        }, { noRetry: true }));
        if (!res) return;
        S = { ...S, name: res.user.name, handle: res.user.handle, email: res.user.email, role: res.user.role, level: res.user.level, xp: res.user.xp };
        cache();
        setAuthed(true);
        setMode(`Connesso con ${providerLabelName(provider)} (dev)`);
        await refreshAccount();
        announce({ authenticated: true, role: res.user.role });
        toast("Accesso social (modalità dev)", `Account creato/collegato con ${providerLabelName(provider)} (simulato).`, "ok");
        UI.go("account");
      } else {
        location.href = `/api/auth/social/${provider}/start`;
      }
    }
    window.socialLogin = socialLogin;
  }

  function providerLabelName(p) {
    return { google: "Google", microsoft: "Microsoft", apple: "Apple" }[p] || p;
  }

  function bindLink() {
    const form = $("#linkForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("#lk-id").value.trim();
      const name = $("#lk-name").value.trim();
      let ok = fail("lk-id", /^\d{4,10}$/.test(id) ? "" : "L'ID Avakin è numerico (4-10 cifre).");
      ok = fail("lk-name", name.length >= 3 ? "" : "Nickname troppo corto.") && ok;
      if (!ok) return;

      if (!remote) {
        S.linked = { id, name, server: $("#lk-server").value, alliance: $("#lk-alliance").value.trim() || "Nessuna" };
        S.level = Math.min(50, S.level + 3);
        save();
        closeModal("linkModal");
        toast("Account Avakin collegato in locale", `${name} · +3 livelli`, "ok");
        return;
      }

      const res = await guard(() =>
        API.post("/api/account/link-avakin", {
          avakinId: id,
          avakinName: name,
          server: $("#lk-server").value,
          alliance: $("#lk-alliance").value.trim()
        })
      );
      if (!res) return;
      S.linked = res.user.avakin;
      const oldLevelLink = S.level;
      S.level = res.user.level;
      cache();
      renderSide();
    { const x=$("#btnLinkAvakin"); if(x) x.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin"; renderBadge(); }
      closeModal("linkModal");
      await refreshAccount();
      const lvMsgLink = res.user.level > oldLevelLink ? ` — Livello ${res.user.level} raggiunto!` : "";
      toast("Account Avakin collegato", `${name} · ID ${id} · +${res.bonus.level} livelli${lvMsgLink}`, "ok");
    });
  }

  function bindApply() {
    const form = $("#applyForm");
    if (!form) return;
    // Form Google embedded in #applyModal; legacy handler kept inert.
  }


  function bindEmail() {
    const form = $("#emailForm");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newv = $("#em-new").value.trim();
      const pass = $("#em-pass").value;
      let ok = fail("em-new", isEmail(newv) ? "" : "Email non valida.");
      ok = fail("em-pass", pass.length >= 4 ? "" : "Inserisci la password attuale.") && ok;
      if (!ok) return;
      if (!remote || !authed) {
        toast("Modalità locale", "Cambia email solo se connesso al server.", "warn");
        return;
      }
      const res = await guard(() => API.patch("/api/account/email", { email: newv, password: pass }, { noRetry: true }));
      if (!res) return;
      S.email = newv;
      S.emailVerifiedAt = null;
      cache();
      if ($("#em-current")) $("#em-current").value = newv;
      const vtag = $("#accVerifiedTag");
      if (vtag) { vtag.textContent = "Email non verificata"; vtag.className = "tag danger"; }
      form.reset();
      if ($("#em-current")) $("#em-current").value = newv;
      toast("Email aggiornata", "Potrebbe essere necessaria una nuova verifica.", "ok", 6000);
    });
  }
  function bindPassword() {
    $("#passForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const cur = $("#pw-old").value;
      const next = $("#pw-new").value;
      let ok = fail("pw-old", cur.length >= 4 ? "" : "Inserisci la password attuale.");
      ok = fail("pw-new", isPassword(next) ? "" : "Minimo 8 caratteri con lettere e numeri.") && ok;
      if (!ok) return;
      if (cur === next) { fail("pw-new", "La nuova password deve essere diversa."); return; }

      if (!remote) {
        $("#passForm").reset();
        toast("Modalità locale", "La sicurezza è gestita dal server: accedi per cambiarla davvero.", "warn", 6000);
        return;
      }

      const res = await guard(() => API.post("/api/account/password", { currentPassword: cur, newPassword: next }));
      if (!res) return;
      $("#passForm").reset();
      setAuthed(false);
      setMode("Password aggiornata — accedi di nuovo.");
      toast("Password aggiornata", `Chiuso ${res.sessionsRevoked} sessioni.`, "ok", 6000);
      showLoginTab();
      openModal("enterModal");
    });
  }

  function bindUpload() {
    const zone = $("#dropZone"), input = $("#uploadInput");
    const readAll = (list) => {
      const files = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, 6);
      if (!files.length) { toast("Nessuna foto valida", "Solo immagini, massimo 6 file.", "err"); return; }
      const box = $("#uploadPreview");
      box.innerHTML = "";
      files.forEach((f, i) => {
        const rd = new FileReader();
        rd.onload = () => {
          const img = document.createElement("img");
          img.src = rd.result;
          img.alt = f.name;
          img.style.cssText = "width:100%;border-radius:14px;border:1px solid rgba(143,198,255,.2)";
          img.dataset.src = rd.result;
          img.dataset.name = f.name;
          img.dataset.bytes = String(f.size);
          box.appendChild(img);
        };
        rd.readAsDataURL(f);
      });
      box.dataset.files = String(files.length);
      window.__samFiles = files;
    };
    zone.addEventListener("click", () => input.click());
    input.addEventListener("change", (e) => readAll(e.target.files));
    ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("is-over"); }));
    zone.addEventListener("drop", (e) => readAll(e.dataTransfer.files));

    $("#uploadSave").addEventListener("click", async () => {
      const files = window.__samFiles || [];
      if (!files.length) { toast("Nessuna foto selezionata", "Trascina o scegli almeno un'immagine.", "err"); return; }

      if (remote && authed) {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        const res = await guard(() => API.upload("/api/account/uploads", fd));
        if (!res) return;
        closeModal("uploadModal");
        resetUpload();
        document.dispatchEvent(new CustomEvent("sam:uploads", { detail: res.uploads }));
        UI.go("gallery");
        setTimeout(() => toast("Foto caricate sul server", `${res.uploads.length} immagini nella tua galleria.`, "ok"), 500);
        return;
      }

      const prev = store.get("uploads", []);
      const previews = $$("#uploadPreview img")
        .map((i) => ({ src: i.dataset.src, name: i.dataset.name || "Foto", bytes: Number(i.dataset.bytes || 0) }))
        .filter((p) => p.src);
      if (!previews.length) {
        toast("Anteprime non pronte", "Attendi il caricamento delle immagini.", "err");
        return;
      }
      store.set("uploads", prev.concat(previews).slice(-12));
      document.dispatchEvent(new CustomEvent("sam:uploads", { detail: previews }));
      closeModal("uploadModal");
      resetUpload();
      UI.go("gallery");
      setTimeout(() => toast("Foto salvate in locale", `${previews.length} immagini. Avvia il server per salvarle davvero.`, "warn"), 500);
    });
  }

  function resetUpload() {
    window.__samFiles = [];
    $("#uploadPreview").innerHTML = "";
    $("#uploadInput").value = "";
  }

  function bindNewsletter() {
    const form = $("#newsletterForm");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("#nl-email");
      const v = input.value.trim();
      if (!isEmail(v)) { toast("Email non valida", "Controlla l'indirizzo.", "err"); return; }

      if (!remote) {
        const list = store.get("subscribers", []);
        if (!list.some((m) => m.toLowerCase() === v.toLowerCase())) list.push(v);
        store.set("subscribers", list);
        input.value = "";
        toast("Iscrizione salvata in locale", "Avvia il server per registrarla davvero.", "warn");
        return;
      }

      const res = await guard(() => API.post("/api/clan/subscribe", { email: v, source: "footer" }));
      if (!res) return;
      input.value = "";
      toast("Iscrizione confermata", res.message || "Riceverai il prossimo bollettino del clan.", "ok");
    });
  }

  function applyPrefs() {
    FX.setOption("motion", S.prefs.motion !== false);
    FX.setOption("petals", S.prefs.petals !== false);
    FX.setOption("grain", S.prefs.grain !== false);
    document.querySelector(".fx-grid-lines").style.opacity = S.prefs.grain === false ? "0" : "";
    document.body.classList.toggle("compact", !!S.prefs.compact);
    document.documentElement.style.setProperty("--glass-blur", S.prefs.compact ? "12px" : "");
    document.documentElement.style.setProperty("--sp-5", S.prefs.compact ? "16px" : "");
    document.documentElement.style.setProperty("--sp-6", S.prefs.compact ? "22px" : "");
  }

  function init() {
    if (!S.created) S.created = Date.now();
    // merge legacy avatar if present
    try {
      if (!S.avatar) {
        const la = localStorage.getItem("user_avatar");
        if (la) { S.avatar = la; }
      }
    } catch (e) {}

    S.prefs = { ...prefsDefaults(), ...(S.prefs || {}) };
    cache();
    fillForm();
    if ($("#em-current")) $("#em-current").value = S.email || "";
    bindProfile();
    renderSide();
{ const x=$("#btnLinkAvakin"); if(x) x.textContent = S.linked ? "Gestisci Avakin" : "Collega il tuo Avakin"; }
    renderStats();
    renderSwitches();
    renderAccents();
    renderRoster();
    renderBadge();
    renderSessions();
    renderAudit();
    renderSocial();
    bindGlobal();
  }

  return {
    init,
    get data() { return S; },
    get authed() { return authed; },
    get isCommand() { return isCommand(); },
    wipe: () => wipe(),
    save, renderBadge, fillForm, renderStats, renderSessions, renderAudit, renderAchievements: (d) => Views.renderAchievements(d),
    loadRosterLive, celebrate
  };
})();

if (typeof window !== "undefined") window.Account = Account;
