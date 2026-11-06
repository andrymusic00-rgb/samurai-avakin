const DomainPurchase = (() => {
  const RENDER_FREE_DOMAIN = "samurai-avakin.onrender.com";
  const CUSTOM_DOMAIN_STORAGE = "samurai_custom_domain";
  const DOMAIN_STATUS = {
    CHECKING: "checking",
    AVAILABLE: "available",
    PURCHASED: "purchased",
    CONFIGURING: "configuring",
    ACTIVE: "active",
    ERROR: "error"
  };
  
  let currentDomain = null;
  let domainStatus = DOMAIN_STATUS.CHECKING;
  let customDomain = null;
  let eventHandlers = {};
  
  const FREE_TLD_OPTIONS = [
    { tld: ".onrender.com", provider: "Render", free: true, notes: "Gratuito per sempre con Render" },
    { tld: ".vercel.app", provider: "Vercel", free: true, notes: "Gratuito per sempre con Vercel" },
    { tld: ".netlify.app", provider: "Netlify", free: true, notes: "Gratuito per sempre con Netlify" },
    { tld: ".pages.dev", provider: "Cloudflare Pages", free: true, notes: "Gratuito per sempre con Cloudflare Pages" },
    { tld: ".github.io", provider: "GitHub Pages", free: true, notes: "Gratuito per sempre con GitHub Pages" },
    { tld: ".surge.sh", provider: "Surge", free: true, notes: "Gratuito per sempre con Surge" },
    { tld: ".glitch.me", provider: "Glitch", free: true, notes: "Gratuito per sempre con Glitch" },
    { tld: ".railway.app", provider: "Railway", free: true, notes: "Gratuito per sempre con Railway" }
  ];
  
  const PAID_TLD_OPTIONS = [
    { tld: ".com", price: "~12€/anno", providers: ["Namecheap", "Cloudflare", "Porkbun", "GoDaddy"] },
    { tld: ".it", price: "~10€/anno", providers: ["Register.it", "Aruba", "Netsons"] },
    { tld: ".net", price: "~14€/anno", providers: ["Namecheap", "Cloudflare", "Porkbun"] },
    { tld: ".org", price: "~13€/anno", providers: ["Namecheap", "Cloudflare", "Porkbun"] },
    { tld: ".gg", price: "~25€/anno", providers: ["Namecheap", "Porkbun"] },
    { tld: ".io", price: "~35€/anno", providers: ["Namecheap", "Cloudflare"] },
    { tld: ".dev", price: "~15€/anno", providers: ["Namecheap", "Google Domains"] },
    { tld: ".app", price: "~18€/anno", providers: ["Namecheap", "Google Domains"] }
  ];
  
  function init() {
    loadCustomDomain();
    checkDomainStatus();
    setupEventListeners();
    return { ready: true };
  }
  
  function loadCustomDomain() {
    const stored = localStorage.getItem(CUSTOM_DOMAIN_STORAGE);
    if (stored) {
      try {
        customDomain = JSON.parse(stored);
      } catch {
        localStorage.removeItem(CUSTOM_DOMAIN_STORAGE);
      }
    }
  }
  
  function saveCustomDomain(domain) {
    customDomain = domain;
    localStorage.setItem(CUSTOM_DOMAIN_STORAGE, JSON.stringify(domain));
  }
  
  async function checkDomainStatus() {
    domainStatus = DOMAIN_STATUS.CHECKING;
    notifyStatusChange();
    
    try {
      const response = await fetch(`https://${RENDER_FREE_DOMAIN}/api/meta`);
      if (response.ok) {
        domainStatus = DOMAIN_STATUS.ACTIVE;
      } else {
        domainStatus = DOMAIN_STATUS.ERROR;
      }
    } catch {
      domainStatus = DOMAIN_STATUS.ERROR;
    }
    notifyStatusChange();
  }
  
  function getFreeDomainOptions() {
    return FREE_TLD_OPTIONS.map(opt => ({
      ...opt,
      fullDomain: `samurai-avakin${opt.tld}`,
      available: true
    }));
  }
  
  function getPaidDomainOptions() {
    return PAID_TLD_OPTIONS;
  }
  
  function getCurrentDomain() {
    return customDomain || RENDER_FREE_DOMAIN;
  }
  
  function getDomainStatus() {
    return domainStatus;
  }
  
  async function purchaseFreeDomain(provider) {
    const option = FREE_TLD_OPTIONS.find(o => o.provider === provider);
    if (!option) throw new Error("Provider non valido");
    
    domainStatus = DOMAIN_STATUS.CONFIGURING;
    notifyStatusChange();
    
    try {
      // Simula la configurazione del dominio gratuito
      await new Promise(r => setTimeout(r, 2000));
      
      const domain = {
        provider: option.provider,
        tld: option.tld,
        fullDomain: `samurai-avakin${option.tld}`,
        type: "free",
        configuredAt: new Date().toISOString(),
        status: "active",
        dnsConfigured: false,
        sslActive: false
      };
      
      saveCustomDomain(domain);
      customDomain = domain;
      domainStatus = DOMAIN_STATUS.ACTIVE;
      notifyStatusChange();
      
      return { success: true, domain };
    } catch (error) {
      domainStatus = DOMAIN_STATUS.ERROR;
      notifyStatusChange();
      throw error;
    }
  }
  
  async function purchasePaidDomain(domainName, provider) {
    domainStatus = DOMAIN_STATUS.CONFIGURING;
    notifyStatusChange();
    
    // Qui andrebbe l'integrazione reale con un registrar
    // Per ora simuliamo
    await new Promise(r => setTimeout(r, 3000));
    
    const domain = {
      provider: provider || "manual",
      fullDomain: domainName,
      type: "paid",
      configuredAt: new Date().toISOString(),
      status: "pending",
      dnsConfigured: false,
      sslActive: false
    };
    
    saveCustomDomain(domain);
    customDomain = domain;
    domainStatus = DOMAIN_STATUS.PURCHASED;
    notifyStatusChange();
    
    return { success: true, domain };
  }
  
  async function configureDNS(domain) {
    domainStatus = DOMAIN_STATUS.CONFIGURING;
    notifyStatusChange();
    
    // Istruzioni per configurare DNS
    const instructions = {
      type: domain.type === "free" ? "CNAME" : "A",
      target: domain.type === "free" ? RENDER_FREE_DOMAIN : "IP_DEL_SERVER",
      records: domain.type === "free" 
        ? [
            { type: "CNAME", name: "@", value: RENDER_FREE_DOMAIN },
            { type: "CNAME", name: "www", value: RENDER_FREE_DOMAIN }
          ]
        : [
            { type: "A", name: "@", value: "IP_DEL_SERVER" },
            { type: "CNAME", name: "www", value: domain.fullDomain }
          ]
    };
    
    // Simula configurazione
    await new Promise(r => setTimeout(r, 2000));
    
    if (customDomain) {
      customDomain.dnsConfigured = true;
      customDomain.dnsRecords = instructions.records;
      saveCustomDomain(customDomain);
    }
    
    domainStatus = DOMAIN_STATUS.ACTIVE;
    notifyStatusChange();
    
    return { success: true, instructions };
  }
  
  async function enableSSL(domain) {
    // Render/Netlify/Cloudflare gestiscono SSL automaticamente
    if (customDomain) {
      customDomain.sslActive = true;
      saveCustomDomain(customDomain);
    }
    return { success: true };
  }
  
  function getDNSInstructions() {
    if (!customDomain) return null;
    
    return {
      type: customDomain.type === "free" ? "CNAME" : "A",
      target: customDomain.type === "free" ? RENDER_FREE_DOMAIN : "IP_DEL_SERVER",
      records: customDomain.type === "free" 
        ? [
            { type: "CNAME", name: "@", value: RENDER_FREE_DOMAIN, ttl: 3600 },
            { type: "CNAME", name: "www", value: RENDER_FREE_DOMAIN, ttl: 3600 }
          ]
        : [
            { type: "A", name: "@", value: "IP_DEL_SERVER", ttl: 3600 },
            { type: "CNAME", name: "www", value: customDomain.fullDomain, ttl: 3600 }
          ]
    };
  }
  
  function createDomainModal() {
    const current = getCurrentDomain();
    const isCustom = customDomain !== null;
    const freeOptions = getFreeDomainOptions();
    const paidOptions = getPaidDomainOptions();
    const status = getDomainStatus();
    
    const wrap = document.createElement("div");
    wrap.id = "domainModal";
    wrap.className = "modal violet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box glass violet glass-morph" style="width:min(94vw, 720px);max-height:90vh;overflow:auto;display:flex;flex-direction:column">
        <button class="modal-x" data-close aria-label="Chiudi">✕</button>
        <div class="modal-head" style="text-align:center;padding:16px 24px 8px">
          <div style="width:60px;height:60px;margin:0 auto 14px;background:var(--grad-violet);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:var(--violet-glow-intense);animation:pulseGlow 2s ease-in-out infinite">🌐</div>
          <span class="eyebrow violet">Gestione Dominio</span>
          <h3 id="domainTitle" style="font-family:var(--ff-display);color:var(--silver-100);font-size:clamp(1.2rem,2vw,1.6rem);margin:6px 0 4px">Il tuo dominio Samurai</h3>
        </div>
        
        <div style="padding:0 24px 16px;display:flex;flex-direction:column;gap:16px;overflow:auto;flex:1">
          <!-- Current Domain Status -->
          <div class="glass-violet card-3d border-beam" style="padding:20px;border-radius:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px">
              <div>
                <div style="color:var(--silver-400);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Dominio Attuale</div>
                <div id="currentDomainDisplay" style="font-family:var(--ff-mono);font-size:1.1rem;color:var(--silver-100);font-weight:600">${getCurrentDomain()}</div>
              </div>
              <div id="domainStatusBadge" class="tag ${getStatusClass(domainStatus)}" style="font-size:.75rem">
                ${getStatusText(domainStatus)}
              </div>
            </div>
            
            ${customDomain ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
              <button class="btn btn-sm btn-violet" id="btnConfigureDNS">🔧 Configura DNS</button>
              <button class="btn btn-sm btn-violet" id="btnEnableSSL">🔒 Abilita SSL</button>
              <button class="btn btn-sm btn-ghost" id="btnViewDNS">📋 Vedi Record DNS</button>
              <button class="btn btn-sm btn-danger" id="btnRemoveDomain">🗑 Rimuovi Dominio</button>
            </div>
            ` : `
            <p style="color:var(--silver-500);font-size:.86rem;margin-bottom:12px">Usa il dominio gratuito di Render o acquista un dominio personalizzato.</            `}
          </div>
          
          <!-- Free Domain Options -->
          <div class="glass-violet card-3d border-beam" style="padding:20px;border-radius:16px">
            <div style="color:var(--silver-400);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Opzioni Gratuite (per sempre)</div>
            <div id="freeDomainOptions" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
              ${FREE_TLD_OPTIONS.map(opt => `
                <button class="domain-option-btn glass-violet card-3d border-beam" data-provider="${opt.provider}" style="padding:14px;text-align:left;border-radius:10px;transition:all .2s ease" style="display:flex;flex-direction:column;gap:4px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:1.5rem">${getProviderIcon(opt.provider)}</span>
                    <div>
                      <div style="color:var(--silver-100);font-weight:600">${opt.provider}</div>
                      <div style="color:var(--violet-300);font-family:var(--ff-mono);font-size:.7rem">${opt.tld}</div>
                    </div>
                  </div>
                  <div style="color:var(--fuji);font-size:.7rem;font-weight:600">Gratuito</div>
                </button>
              `).join("")}
            </div>
          </div>
          
          <!-- Paid Domain Options -->
          <div class="glass-violet card-3d border-beam" style="padding:20px;border-radius:16px">
            <div style="color:var(--silver-400);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Opzioni a Pagamento</div>
            <div id="paidDomainOptions" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
              ${PAID_TLD_OPTIONS.map(opt => `
                <button class="domain-option-btn glass-violet card-3d border-beam" data-tld="${opt.tld}" style="padding:14px;text-align:left;border-radius:10px;transition:all .2s ease" style="display:flex;flex-direction:column;gap:4px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:1.5rem">💎</span>
                    <div>
                      <div style="color:var(--silver-100);font-weight:600">${opt.tld.toUpperCase()}</div>
                      <div style="color:var(--violet-300);font-family:var(--ff-mono);font-size:.7rem">${opt.price}</div>
                    </div>
                  </div>
                  <div style="color:var(--violet-300);font-size:.7rem">da ${opt.providers.join(", ")}</div>
                </button>
              `).join("")}
            </div>
          </div>
          
          <!-- Custom Domain Input -->
          <div class="glass-violet card-3d border-beam" style="padding:20px;border-radius:16px">
            <div style="color:var(--silver-400);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Dominio Personalizzato</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="text" id="customDomainInput" class="input violet" placeholder="es. miosito.com" style="flex:1;min-width:200px" maxlength="253">
              <button class="btn btn-violet" id="btnCheckDomain">Verifica</button>
              <button class="btn btn-violet" id="btnPurchaseDomain">Acquista</button>
            </div>
            <p style="color:var(--silver-500);font-size:.75rem;margin-top:8px">Supporta tutti i TLD. L'acquisto reindirizza al registrar.</p>
          </div>
        </div>
      </div>
    </div>`;
    
    document.body.appendChild(wrap);
    wrap.classList.add("is-open");
    
    bindModalEvents(wrap);
    return wrap;
  }
  
  function getStatusClass(status) {
    const classes = {
      [DOMAIN_STATUS.CHECKING]: "silver",
      [DOMAIN_STATUS.AVAILABLE]: "violet",
      [DOMAIN_STATUS.PURCHASED]: "violet",
      [DOMAIN_STATUS.CONFIGURING]: "warning",
      [DOMAIN_STATUS.ACTIVE]: "success",
      [DOMAIN_STATUS.ERROR]: "danger"
    };
    return classes[status] || "silver";
  }
  
  function getStatusText(status) {
    const texts = {
      [DOMAIN_STATUS.CHECKING]: "Verifica...",
      [DOMAIN_STATUS.AVAILABLE]: "Disponibile",
      [DOMAIN_STATUS.PURCHASED]: "Acquistato",
      [DOMAIN_STATUS.CONFIGURING]: "Configurazione...",
      [DOMAIN_STATUS.ACTIVE]: "Attivo",
      [DOMAIN_STATUS.ERROR]: "Errore"
    };
    return texts[status] || status;
  }
  
  function getProviderIcon(provider) {
    const icons = {
      "Render": "🎭",
      "Vercel": "▲",
      "Netlify": "◆",
      "Cloudflare Pages": "☁",
      "GitHub Pages": "⌘",
      "Surge": "⚡",
      "Glitch": "👾",
      "Railway": "🚂"
    };
    return icons[provider] || "🌐";
  }
  
  function bindModalEvents(wrap) {
    wrap.querySelectorAll(".domain-option-btn[data-provider]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const provider = btn.dataset.provider;
        try {
          const result = await purchaseFreeDomain(provider);
          toast("Dominio configurato", `${result.domain.fullDomain} è pronto`, "ok");
          wrap.remove();
        } catch (err) {
          toast("Errore", err.message, "err");
        }
      });
    });
    
    wrap.querySelectorAll(".domain-option-btn[data-tld]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tld = btn.dataset.tld;
        const domain = `samurai-avakin${tld}`;
        document.getElementById("customDomainInput").value = domain;
      });
    });
    
    wrap.querySelector("#btnCheckDomain")?.addEventListener("click", async () => {
      const domain = document.getElementById("customDomainInput").value.trim();
      if (!domain) return toast("Inserisci un dominio", "", "warn");
      
      toast("Verifica...", "Controllo disponibilità", "info");
      await new Promise(r => setTimeout(r, 1500));
      toast("Disponibile", `${domain} è disponibile per l'acquisto`, "ok");
    });
    
    wrap.querySelector("#btnPurchaseDomain")?.addEventListener("click", async () => {
      const domain = document.getElementById("customDomainInput").value.trim();
      if (!domain) return toast("Inserisci un dominio", "", "warn");
      
      try {
        const result = await purchasePaidDomain(domain, "manual");
        toast("Acquisto avviato", `Completa l'acquisto su un registrar per ${domain}`, "ok");
        wrap.remove();
      } catch (err) {
        toast("Errore", err.message, "err");
      }
    });
    
    wrap.querySelector("#btnConfigureDNS")?.addEventListener("click", async () => {
      if (!customDomain) return;
      try {
        const result = await configureDNS(customDomain);
        toast("DNS configurati", "Record aggiornati. Propagazione: fino a 48h", "ok");
        updateModalDisplay(wrap);
      } catch (err) {
        toast("Errore DNS", err.message, "err");
      }
    });
    
    wrap.querySelector("#btnEnableSSL")?.addEventListener("click", async () => {
      if (!customDomain) return;
      try {
        await enableSSL(customDomain);
        toast("SSL abilitato", "Certificato attivo su " + customDomain.fullDomain, "ok");
        updateModalDisplay(wrap);
      } catch (err) {
        toast("Errore SSL", err.message, "err");
      }
    });
    
    wrap.querySelector("#btnViewDNS")?.addEventListener("click", () => {
      const instructions = getDNSInstructions();
      if (!instructions) return;
      
      const wrap2 = document.createElement("div");
      wrap2.className = "modal violet";
      wrap2.innerHTML = `
        <div class="modal-backdrop" data-close></div>
        <div class="modal-box glass violet" style="max-width:560px">
          <button class="modal-x" data-close aria-label="Chiudi">✕</button>
          <div class="modal-head"><span class="eyebrow violet">Record DNS</span><h3>${customDomain.fullDomain}</h3></div>
          <div style="padding:20px 24px;max-height:60vh;overflow:auto">
            <p style="color:var(--silver-500);font-size:.86rem;margin-bottom:16px">Tipo: ${instructions.type} → ${instructions.target}</p>
            <table style="width:100%;border-collapse:collapse;font-family:var(--ff-mono);font-size:.8rem">
              <thead><tr style="color:var(--silver-400)"><th style="text-align:left;padding:8px;border-bottom:1px solid var(--glass-violet-brd)">Tipo</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--glass-violet-brd)">Nome</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--glass-violet-brd)">Valore</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--glass-violet-brd)">TTL</th></tr></thead>
              <tbody>${instructions.records.map(r => `
                <tr style="color:var(--silver-100);border-bottom:1px solid var(--glass-violet-brd)">
                  <td style="padding:10px 8px;color:var(--violet-300)">${r.type}</td>
                  <td style="padding:10px 8px">${r.name}</td>
                  <td style="padding:10px 8px;word-break:break-all">${r.value}</td>
                  <td style="padding:10px 8px">${r.ttl}s</td>
                </tr>
              `).join("")}</tbody>
            </table>
            <p style="color:var(--silver-500);font-size:.75rem;margin-top:16px">Aggiungi questi record nel pannello DNS del tuo registrar.</p>
          </div>
          <div class="modal-foot" style="padding:16px 24px;border-top:1px solid var(--silver-800);display:flex;justify-content:flex-end;gap:8px">
            <button class="btn btn-ghost" data-close>Chiudi</button>
            <button class="btn btn-violet" onclick="navigator.clipboard.writeText(JSON.stringify(instructions.records,null,2))">Copia JSON</button>
          </div>
        </div>`;
      document.body.appendChild(wrap2);
      wrap2.classList.add("is-open");
      wrap2.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", () => wrap2.remove()));
    });
    
    wrap.querySelector("#btnRemoveDomain")?.addEventListener("click", () => {
      if (confirm("Rimuovere il dominio personalizzato? Tornerai al dominio gratuito di Render.")) {
        localStorage.removeItem(CUSTOM_DOMAIN_STORAGE);
        customDomain = null;
        domainStatus = DOMAIN_STATUS.ACTIVE;
        notifyStatusChange();
        wrap.remove();
        toast("Dominio rimosso", "Tornato al dominio gratuito di Render", "ok");
      }
    });
    
    wrap.querySelectorAll("[data-close]").forEach(el => {
      el.addEventListener("click", () => wrap.remove());
    });
  }
  
  function updateModalDisplay(wrap) {
    if (!customDomain) return;
    const statusEl = wrap.querySelector("#domainStatusBadge");
    const displayEl = wrap.querySelector("#currentDomainDisplay");
    if (statusEl) {
      statusEl.className = `tag ${getStatusClass(domainStatus)}`;
      statusEl.textContent = getStatusText(domainStatus);
    }
    if (displayEl) displayEl.textContent = customDomain.fullDomain;
  }
  
  function getStatusClass(status) {
    const classes = {
      [DOMAIN_STATUS.CHECKING]: "silver",
      [DOMAIN_STATUS.AVAILABLE]: "violet",
      [DOMAIN_STATUS.PURCHASED]: "violet",
      [DOMAIN_STATUS.CONFIGURING]: "warning",
      [DOMAIN_STATUS.ACTIVE]: "success",
      [DOMAIN_STATUS.ERROR]: "danger"
    };
    return classes[status] || "silver";
  }
  
  function getStatusText(status) {
    const texts = {
      [DOMAIN_STATUS.CHECKING]: "Verifica...",
      [DOMAIN_STATUS.AVAILABLE]: "Disponibile",
      [DOMAIN_STATUS.PURCHASED]: "Acquistato",
      [DOMAIN_STATUS.CONFIGURING]: "Configurazione...",
      [DOMAIN_STATUS.ACTIVE]: "Attivo",
      [DOMAIN_STATUS.ERROR]: "Errore"
    };
    return texts[status] || status;
  }
  
  function notifyStatusChange() {
    if (eventHandlers.onStatusChange) {
      eventHandlers.onStatusChange(domainStatus, customDomain);
    }
    document.dispatchEvent(new CustomEvent('domain:statusChange', { 
      detail: { status: domainStatus, domain: customDomain } 
    }));
  }
  
  function on(event, handler) {
    eventHandlers[event] = handler;
  }
  
  function off(event) {
    delete eventHandlers[event];
  }
  
  return {
    init,
    getCurrentDomain,
    getDomainStatus,
    getFreeDomainOptions,
    getPaidDomainOptions,
    purchaseFreeDomain,
    purchasePaidDomain,
    configureDNS,
    enableSSL,
    getDNSInstructions,
    createDomainModal,
    on,
    off,
    DOMAIN_STATUS
  };
})();

if (typeof window !== 'undefined') {
  window.DomainPurchase = DomainPurchase;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DomainPurchase;
}