const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem("sam." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sam." + k, JSON.stringify(v)); } catch {} }
  };

  let soundOn = store.get("sound", false);

  const audio = {
    ctx: null,
    ensure() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    hit(kind = "tap") {
      if (!soundOn) return;
      const c = this.ensure();
      if (!c) return;
      const now = c.currentTime;
      const master = c.createGain();
      master.gain.value = 0.16;
      master.connect(c.destination);
      if (kind === "ok") {
        [440, 587.33, 880].forEach((f, i) => {
          const o = c.createOscillator(), g = c.createGain();
          o.type = "triangle"; o.frequency.value = f;
          g.gain.setValueAtTime(0, now + i * 0.06);
          g.gain.linearRampToValueAtTime(0.5, now + i * 0.06 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.4);
          o.connect(g).connect(master); o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.45);
        });
      } else {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(220, now);
        o.frequency.exponentialRampToValueAtTime(70, now + 0.16);
        g.gain.setValueAtTime(0.6, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        o.connect(g).connect(master); o.start(now); o.stop(now + 0.25);
      }
    }
  };

  const toastWrap = () => $("#toasts");
  function toast(title, msg = "", kind = "", ms = 4200) {
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.innerHTML = `<i></i><div><b></b><span></span></div>`;
    el.querySelector("b").textContent = title;
    el.querySelector("span").textContent = msg;
    toastWrap().appendChild(el);
    audio.hit("ok");
    setTimeout(() => {
      el.classList.add("is-out");
      setTimeout(() => el.remove(), 400);
    }, ms);
    return el;
  }

  const modalStack = [];
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** Tiene il focus dentro alla modale aperta: Tab non deve scappare al fondo. */
  function trapFocus(e) {
    if (e.key !== "Tab" || !modalStack.length) return;
    const top = modalStack[modalStack.length - 1];
    const box = top.querySelector(".modal-box") || top;
    const items = $$(FOCUSABLE, box).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", trapFocus);

  function openModal(id) {
    const m = typeof id === "string" ? document.getElementById(id) : id;
    if (!m || m.classList.contains("is-open")) return;
    m.classList.add("is-open");
    document.body.classList.add("is-locked");
    modalStack.push(m);
    audio.hit("tap");
    m.dataset.prevFocus = document.activeElement?.id || "";
    const f = m.querySelector("input:not([type=file]), textarea, button:not(.modal-x)");
    if (f && window.innerWidth > 900) setTimeout(() => f.focus({ preventScroll: true }), 320);
  }
  function closeModal(m) {
    let target = m || modalStack[modalStack.length - 1];
    if (typeof target === "string") target = document.getElementById(target);
    if (!target || !target.classList) return;
    target.classList.remove("is-open");
    if (target.id === "welcomeModal") store.set("welcomeDone", true);
    const i = modalStack.indexOf(target);
    if (i > -1) modalStack.splice(i, 1);
    else while (modalStack.length) modalStack.pop();
    if (!modalStack.length) document.body.classList.remove("is-locked");
    // Il focus torna al pulsante che ha aperto la modale.
    const back = target.dataset.prevFocus && document.getElementById(target.dataset.prevFocus);
    if (back) back.focus({ preventScroll: true });
  }

  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-close]");
    if (c) { closeModal(c.closest(".modal")); return; }
    if (e.target.classList.contains("modal")) { closeModal(e.target); return; }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("#paletteWrap").classList.contains("is-open")) return togglePalette(false);
      if (modalStack.length) { closeModal(); return; }
      closeAllPaletteNav();
    }
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); togglePalette(); }
  });

  function closeAllPaletteNav() {
    $("#nav").classList.remove("is-open");
    $("#btnMenu").setAttribute("aria-expanded", "false");
  }

  // `Account` e' definito in account.js, caricato DOPO ui.js: non puo' essere
  // letto qui. Lo stato del ruolo si risolve all'apertura della palette.
  const canSeeComando = () => {
    try { return !!Account?.isCommand; } catch { return false; }
  };

  const commands = [
    ...DATA.nav
      .map((n) => ({
        label: `Vai a ${n.label}`,
        hint: n.kanji,
        k: n.key,
        needsCommand: n.id === "comando",
        act: () => go(n.id)
      })),
    { label: "Apri la tua area account", hint: "帳", k: "P", act: () => go("account") },
    { label: "Vedi i prossimi eventi", hint: "門", k: "E1", act: () => go("eventi") },
    { label: "Classifica del clan", hint: "戦", k: "K1", act: () => go("classifica") },
    { label: "Scarica il calendario eventi", hint: "⇩", k: "I", act: () => { location.href = "/api/clan/events.ics"; } },
    { label: "Candidati al clan", hint: "志", k: "C1", act: () => openModal("applyModal") },
    { label: "Collega account Avakin", hint: "連", k: "L", act: () => openModal("linkModal") },
    { label: "Carica una foto in gallery", hint: "画", k: "U", act: () => openModal("uploadModal") },
    { label: "Genera il tuo badge", hint: "✧", k: "B", act: () => { go("account"); setTimeout(() => setPanel("badge"), 420); } },
    { label: "I tuoi traguardi", hint: "刀", k: "T", act: () => { go("account"); setTimeout(() => setPanel("traguardi"), 420); } },
    { label: "Notifiche", hint: "◔", k: "N", act: () => document.getElementById("btnNotif")?.click() },
    { label: "Suono interfaccia: attiva/disattiva", hint: "♪", k: "M", act: () => setSound(!soundOn) },
    { label: "Pulisci tutti i dati salvati", hint: "✕", k: "D", act: () => confirmBox("Cancellare tutto", "Verranno rimossi profilo, preferenze, foto caricate e candidature locali.", () => { Account.wipe(); location.hash = "#/home"; location.reload(); }) }
  ];

  let pIdx = 0, pItems = [];
  function renderPalette(q = "") {
    const list = $("#paletteList");
    pItems = commands.filter(
      (c) => (!c.needsCommand || canSeeComando()) && c.label.toLowerCase().includes(q.toLowerCase())
    );
    if (!pItems.length) {
      list.innerHTML = `<div class="empty-state" style="padding:30px"><span class="kanji">無</span>Nessun comando trovato.</div>`;
      return;
    }
    pIdx = 0;
    list.innerHTML = pItems.map((c, i) =>
      `<button class="palette-item" data-i="${i}" aria-selected="${i === 0}"><span class="kanji" style="opacity:.6">${c.hint}</span>${c.label}<span class="k">${c.k}</span></button>`
    ).join("");
  }
  function movePalette(d) {
    if (!pItems.length) return;
    pIdx = (pIdx + d + pItems.length) % pItems.length;
    $$("#paletteList .palette-item").forEach((b, i) => b.setAttribute("aria-selected", i === pIdx));
    const el = $(`#paletteList .palette-item[data-i="${pIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  function togglePalette(force) {
    const w = $("#paletteWrap");
    const open = force == null ? !w.classList.contains("is-open") : force;
    w.classList.toggle("is-open", open);
    if (open) {
      const i = $("#paletteInput");
      i.value = "";
      renderPalette("");
      setTimeout(() => i.focus(), 80);
    }
  }
  $("#paletteBackdrop").addEventListener("click", () => togglePalette(false));
  $("#paletteInput").addEventListener("input", (e) => renderPalette(e.target.value));
  $("#paletteInput").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); movePalette(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); movePalette(-1); }
    if (e.key === "Enter" && pItems[pIdx]) { e.preventDefault(); togglePalette(false); pItems[pIdx].act(); }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#paletteList .palette-item");
    if (b) { togglePalette(false); pItems[+b.dataset.i].act(); }
  });

  function setSound(v) {
    soundOn = v;
    store.set("sound", v);
    $("#btnSound").classList.toggle("is-on", v);
    if (v) audio.hit("ok");
    toast(v ? "Suono attivato" : "Suono disattivato", v ? "Interfaccia con feedback da tamburo." : "Modalità silenziosa.", v ? "ok" : "");
  }
  $("#btnSound").addEventListener("click", () => setSound(!soundOn));
  $("#btnSound").classList.toggle("is-on", soundOn);
  $("#btnPalette").addEventListener("click", () => togglePalette());

  let cfCb = null;
  function confirmBox(title, text, cb) {
    $("#cfTitle").textContent = title;
    $("#cfText").textContent = text;
    cfCb = cb;
    openModal("confirmModal");
  }
  $("#cfOk").addEventListener("click", () => { closeModal(); if (cfCb) cfCb(); cfCb = null; });

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target;
      if (el.offsetParent === null && !el.closest(".view.is-active, .acc-panel.is-active, .modal.is-open, .lightbox.is-open")) continue;
      el.classList.add("is-in");
      animateInside(el);
      io.unobserve(el);
    }
  }, { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });

  document.documentElement.classList.add("reveal-ready");

  function visibleReveal(el) {
    if (!el || el.classList.contains("is-in")) return false;
    const hidden = el.closest(".view:not(.is-active), .acc-panel:not(.is-active), [hidden], .modal:not(.is-open), .lightbox:not(.is-open)");
    if (hidden) return false;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    const vh = window.innerHeight || 800;
    const vw = window.innerWidth || 1200;
    return r.bottom > -vh * 0.2 && r.top < vh * 1.1 && r.right > -vw * 0.1 && r.left < vw * 1.1;
  }

  function observe(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    $$("[data-reveal]:not(.is-in)", scope).forEach((el) => {
      if (visibleReveal(el)) {
        el.classList.add("is-in");
        animateInside(el);
      } else {
        io.observe(el);
      }
    });
    flushReveal(scope);
  }

  function flushReveal(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    $$("[data-reveal]:not(.is-in)", scope).forEach((el) => {
      if (!visibleReveal(el)) return;
      el.classList.add("is-in");
      animateInside(el);
      try { io.unobserve(el); } catch {}
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { flushReveal(); countAll(); }
  });

  function animateInside(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    $$(".stat-num[data-to]", root).forEach((el) => countUp(el));
    $$(".stat-bar i", root).forEach((el, i) => setTimeout(() => (el.style.width = el.dataset.w + "%"), 60 * i));
    $$(".rank-meter i", root).forEach((el) => (el.style.width = el.dataset.w + "%"));
    $$(".skill-bar i", root).forEach((el) => (el.style.width = el.dataset.w + "%"));
    $$(".lvl-bar i", root).forEach((el) => (el.style.width = el.dataset.w + "%"));
  }


  function countUp(el) {
    const to = +el.dataset.to;
    if (el.dataset.done) return;
    el.dataset.done = "1";
    const fmt = (v) => v.toLocaleString("it-IT");
    if (reduced || document.hidden) { el.querySelector(".n").textContent = fmt(to); return; }
    const dur = 1500, st = performance.now();
    const step = (ts) => {
      const k = Math.min(1, (ts - st) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(to * e);
      el.querySelector(".n").textContent = v.toLocaleString("it-IT");
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function countAll(root = document) { $$(".stat-num[data-to]:not([data-done])", root).forEach(countUp); }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (!a) return;
    closeAllPaletteNav();
  });

  $("#btnMenu").addEventListener("click", () => {
    const n = $("#nav");
    const open = n.classList.toggle("is-open");
    $("#btnMenu").setAttribute("aria-expanded", String(open));
    audio.hit("tap");
  });

  document.addEventListener("click", (e) => {
    const acc = e.target.closest(".acc-tab");
    if (acc) setPanel(acc.dataset.apanel);
  });

  function setPanel(name) {
    $$(".acc-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.apanel === name));
    $$(".acc-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.apanel === name));
    const panel = $(`.acc-panel[data-apanel="${name}"]`);
    if (panel) {
      observe(panel);
      flushReveal(panel);
      animateInside(panel);
    }
    if (name === "badge") Account.renderBadge();
  }
  function openPanel(name) {
    go("account");
    setTimeout(() => { setPanel(name); flushReveal(document.getElementById("view-account")); }, 260);
  }


  document.addEventListener("pointermove", (e) => {
    const g = e.target.closest(".glass");
    if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
    g.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
  }, { passive: true });

  document.addEventListener("pointerover", (e) => {
    const hot = e.target.closest("button, a, .gal-item, .vid-card, .roster-card, .upload-zone, input, select, textarea, .switch");
    document.body.classList.toggle("cursor-hot", !!hot);
  });

  const dot = $("#cursorDot"), glow = $("#cursorGlow");
  if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
    document.body.classList.add("has-pointer");
    let tx = 0, ty = 0;
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = `translate(${tx}px, ${ty}px)`;
      glow.style.transform = `translate(${tx}px, ${ty}px)`;
    }, { passive: true });
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest(".btn, .chip, .icon-btn, .tab, .vid-play-btn, .modal-x");
    if (b && !b.disabled) audio.hit("tap");
  });

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const tb = $("#topbar");
    tb.classList.toggle("is-compact", y > 40);
    const max = document.body.scrollHeight - window.innerHeight;
    $("#scrollProgress").style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
  }, { passive: true });

  function initFaq() {
    $("#faqList").innerHTML = DATA.faq.map((f, i) => `
      <div class="faq-item${i === 0 ? " is-open" : ""}">
        <button class="faq-q" aria-expanded="${i === 0}"><span>${f.q}</span><span class="faq-ico"></span></button>
        <div class="faq-a" style="${i === 0 ? "max-height:300px" : ""}"><p>${f.a}</p></div>
      </div>`).join("");
    $("#faqList").addEventListener("click", (e) => {
      const q = e.target.closest(".faq-q");
      if (!q) return;
      const item = q.parentElement, open = item.classList.contains("is-open");
      $$("#faqList .faq-item").forEach((it) => {
        it.classList.remove("is-open");
        it.querySelector(".faq-a").style.maxHeight = "";
        it.querySelector(".faq-q").setAttribute("aria-expanded", "false");
      });
      if (!open) {
        item.classList.add("is-open");
        item.querySelector(".faq-a").style.maxHeight = item.querySelector(".faq-a").scrollHeight + 20 + "px";
        q.setAttribute("aria-expanded", "true");
      }
      audio.hit("tap");
    });
  }

  function typing() {
    const el = $("#typeTarget");
    if (!el) return;
    const base = DATA.clan.motto;
    let i = 0;
    if (reduced) { el.textContent = base; return; }
    el.textContent = "";
    const tick = () => {
      el.textContent = base.slice(0, ++i);
      if (i < base.length) setTimeout(tick, 62);
    };
    setTimeout(tick, 600);
  }

  function go(view) {
    location.hash = "#/" + view;
  }

  function initWelcome() {
    if (store.get("welcomeDone", false)) return;
    setTimeout(() => openModal("welcomeModal"), 1200);
    $("#welcomeSilent").addEventListener("click", () => {
      store.set("welcomeDone", true);
      store.set("welcomeSilent", true);
      closeModal("welcomeModal");
      toast("Ok, nessun benvenuto la prossima volta", "Il Gate resta comunque aperta.", "ok");
    });
  }

  function setAccent(hex) {
    document.documentElement.style.setProperty("--accent", hex);
    document.documentElement.style.setProperty("--accent-soft", hex);
    document.documentElement.style.setProperty("--accent-deep", hex);
    store.set("accent", hex);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#03060f");
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = DATA.nav.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
    if (!n) return;
    if (n.id === "comando" && !canSeeComando()) return;
    go(n.id);
  });

  return { $, $$, store, toast, openModal, closeModal, confirmBox, observe, animateInside, countAll, setPanel, openPanel, setSound, setAccent, initFaq, initWelcome, typing, go, togglePalette, get sound() { return soundOn; } };
})();
