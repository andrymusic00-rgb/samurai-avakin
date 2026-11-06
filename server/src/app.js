import express from "express";
import cookieParser from "cookie-parser";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./lib/config.js";
import { sendError } from "./lib/http.js";
import { attachUser } from "./middleware/auth.js";
import { apiLimiter, idempotencyGuard } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { accountRouter } from "./routes/account.js";
import { clanRouter } from "./routes/clan.js";
import { adminRouter } from "./routes/admin.js";
import { notifyRouter } from "./routes/notify.js";
import { cmsRouter } from "./routes/cms.js";
import { chatRouter } from "./routes/chat.js";
import { pushRouter } from "./routes/push.js";
import { creativeRouter } from "./routes/creative.js";
import { videoRouter } from "./routes/video.js";
import { publicRouter } from "./routes/public.js";
import { i18nMiddleware } from "./middleware/i18n.js";
import { dbName } from "../db/index.js";

export function createApp() {
  mkdirSync(config.uploadDir, { recursive: true });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    if (config.isProd) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.use(cookieParser());
  app.use(attachUser);
  app.use(i18nMiddleware);

  if (config.corsOrigins.length) {
    app.use((req, res, next) => {
      const origin = req.get("origin");
      if (origin && config.corsOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        if (req.method === "OPTIONS") return res.status(204).end();
      }
      next();
    });
  }

  app.use("/api", apiLimiter, idempotencyGuard);
  app.use("/api/auth", authRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/clan", clanRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/notifications", notifyRouter);
  
  // Nuove route
  app.use("/api/cms", cmsRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/creative", creativeRouter);
  app.use("/api/video", videoRouter);
  app.use("/api/public", publicRouter);

  app.get("/api/meta", (_req, res) => {
    res.json({
      ok: true,
      env: config.env,
      db: dbName(),
      auth: { cookie: config.cookieName, accessTtl: config.accessTtl, refreshDays: config.refreshDays, socialDev: config.socialDevMode },
      upload: { maxBytes: config.uploadMaxBytes, dir: "/uploads" }
    });
  });

  const publicOrigin = process.env.PUBLIC_ORIGIN || `http://${config.host}:${config.port}`;

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
      ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /uploads/", "", `Sitemap: ${publicOrigin}/sitemap.xml`, ""].join("\n")
    );
  });

  app.get("/sitemap.xml", (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const pages = [
      { loc: "/", pri: "1.0", freq: "daily" },
      { loc: "/#/chi-siamo", pri: "0.8", freq: "monthly" },
      { loc: "/#/gallery", pri: "0.7", freq: "weekly" },
      { loc: "/#/video", pri: "0.7", freq: "weekly" },
      { loc: "/#/eventi", pri: "0.7", freq: "weekly" },
      { loc: "/#/classifica", pri: "0.6", freq: "daily" },
      { loc: "/#/account", pri: "0.3", freq: "monthly" }
    ];
    const urls = pages
      .map(
        (p) =>
          `  <url><loc>${publicOrigin}${p.loc.replace("/#", "/#")}</loc><lastmod>${today}</lastmod>` +
          `<changefreq>${p.freq}</changefreq><priority>${p.pri}</priority></url>`
      )
      .join("\n");
    res
      .type("application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  app.get("/manifest.webmanifest", (_req, res) => {
    res.type("application/manifest+json").json({
      name: "Samurai di Avakin",
      short_name: "Samurai",
      description: "Il clan Samurai di Avakin: home, gallery, video, eventi e area account.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#01030a",
      theme_color: "#03060f",
      lang: "it",
      dir: "ltr",
      categories: ["games", "social"],
      icons: [
        { src: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/assets/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ],
      shortcuts: [
        { name: "Galleria", url: "/#/gallery" },
        { name: "Eventi", url: "/#/eventi" },
        { name: "Classifica", url: "/#/classifica" },
        { name: "Il tuo account", url: "/#/account" }
      ]
    });
  });

  app.use("/uploads", express.static(config.uploadDir, { maxAge: "7d", fallthrough: true, index: false }));

  app.get("/offline.html", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(join(config.root, "offline.html"));
  });

  app.get("/sw.js", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Service-Worker-Allowed", "/");
    res.type("application/javascript").sendFile(join(config.root, "assets", "sw.js"));
  });

  app.use("/assets", express.static(config.assetsDir, { maxAge: config.isProd ? "7d" : 0, index: false }));
  app.get("/", (_req, res) => res.sendFile(config.publicDir));

  app.use("/api", (_req, res) => res.status(404).json({ ok: false, error: { code: "not_found", message: "Endpoint inesistente" } }));
  app.use((req, res) => {
    if (req.method === "GET" && !req.path.includes(".")) return res.sendFile(config.publicDir);
    res.status(404).send("404");
  });

  app.use((err, _req, res, _next) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ ok: false, error: { code: "file_too_large", message: "File troppo grande" } });
    }
    if (err?.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({ ok: false, error: { code: "too_many_files", message: "Troppi file" } });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ ok: false, error: { code: "payload_too_large", message: "Richiesta troppo grande" } });
    }
    sendError(res, err);
  });

  if (!existsSync(config.publicDir)) {
    throw new Error(`index.html non trovato in ${config.publicDir}`);
  }

  return app;
}
