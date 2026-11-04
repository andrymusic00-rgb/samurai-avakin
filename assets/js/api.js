const API = (() => {
  const listeners = { auth: [], error: [] };
  let available = null;
  let refreshing = null;
  let lastAuthEvent = 0;
  const AUTH_EVENT_COOLDOWN = 10000;

  const emit = (evt, payload) => {
    if (evt === 'auth') {
      const now = Date.now();
      if (lastAuthEvent && (now - lastAuthEvent) < AUTH_EVENT_COOLDOWN) {
        return; // throttle auth events
      }
      lastAuthEvent = now;
    }
    listeners[evt].forEach((fn) => { try { fn(payload); } catch {} });
  };

  class ApiError extends Error {
    constructor(status, code, message, details) {
      super(message || code || "Errore di rete");
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  async function probe() {
    if (available != null && available.on === true) return available;
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const r = await fetch("/api/meta", { credentials: "same-origin", cache: "no-cache", signal: ctrl.signal });
        clearTimeout(t);
        last = r;
        if (r.ok) {
          const meta = await r.json().catch(() => ({}));
          available = { on: true, ...meta };
          return available;
        }
      } catch {
        last = null;
      }
      await new Promise((res) => setTimeout(res, 300));
    }
    available = last && last.ok ? { on: true } : { on: false };
    return available;
  }

  function online() {
    return available && available.on === true;
  }

  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (!r.ok) throw new ApiError(r.status, "session_expired", "Sessione scaduta");
      return r.json();
    })().finally(() => (refreshing = null));
    return refreshing;
  }

  async function call(method, path, body, opts = {}) {
    const init = {
      method,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      ...opts
    };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(path, init);
    } catch {
      throw new ApiError(0, "offline", "Server non raggiungibile: modalità locale attiva.");
    }

    if (res.status === 401 && !opts.noRetry && path !== "/api/auth/refresh" && path !== "/api/auth/login") {
      try {
        await refresh();
        res = await fetch(path, init);
      } catch {
        emit("auth", { authenticated: false, reason: "expired" });
      }
    }

    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      const e = payload?.error || {};
      if (res.status === 401 && !opts.noRetry) emit("auth", { authenticated: false, reason: e.code || "unauthorized" });
      throw new ApiError(res.status, e.code, e.message, e.details);
    }
    return payload;
  }

  return {
    probe, online, refresh, emit, ApiError,
    on(evt, fn) { listeners[evt].push(fn); },
    get: (p, o) => call("GET", p, undefined, o),
    post: (p, b, o) => call("POST", p, b, o),
    patch: (p, b, o) => call("PATCH", p, b, o),
    del: (p, b, o) => call("DELETE", p, b, o),
    upload: (p, formData) => call("POST", p, formData),
    get meta() { return available; }
  };
})();
