import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import mongoose from "mongoose";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import type { RoomStore } from "./rooms/roomStore";
import { loadAllSeedFiles } from "./seed/loadSeedFiles";
import { adminRouter } from "./routes/admin";
import { categoriesRouter } from "./routes/categories";
import { dailyRouter } from "./routes/daily";
import { leaderboardRouter } from "./routes/leaderboard";
import { resultsRouter } from "./routes/results";
import { renderIndexHtml } from "./linkPreview";
import { applyRateLimits, securityHeaders, type SecurityLimits } from "./security";
import { roomsRouter } from "./routes/rooms";

export interface AppOptions {
  clientUrl: string;
  adminPassword: string;
  rooms: RoomStore;
  now?: () => Date; // tests pass a fixed clock; the daily depends on the date
  // Production only: the built React app (client/dist). The server then serves
  // the front-end too, so the API, Socket.io and the pages share one origin.
  clientDistDir?: string;
  // Rate limits for the REST API. index.ts passes PRODUCTION_LIMITS; most
  // tests leave them out so they can make as many requests as they like.
  limits?: SecurityLimits;
  // Behind a proxy (Render): use X-Forwarded-For for the visitor's IP.
  behindProxy?: boolean;
}

export type DatabaseStatus = "disconnected" | "connected" | "connecting" | "disconnecting";

// Mongoose's readyState as a word, for /api/health.
export function databaseStatus(): DatabaseStatus {
  const state = mongoose.connection.readyState;
  if (state === mongoose.ConnectionStates.connected) {
    return "connected";
  }
  if (state === mongoose.ConnectionStates.connecting) {
    return "connecting";
  }
  if (state === mongoose.ConnectionStates.disconnecting) {
    return "disconnecting";
  }
  return "disconnected";
}

// Builds the Express app without starting it, so tests can use it directly.
export function createApp(options: AppOptions): Express {
  const app = express();

  if (options.behindProxy === true) {
    app.set("trust proxy", 1);
  }
  app.use(securityHeaders(options.clientUrl));
  // Only our own front-end may call the API from a browser.
  app.use(cors({ origin: options.clientUrl }));
  // The biggest real request is a custom list of 150 items (~10 KB).
  app.use(express.json({ limit: "100kb" }));
  if (options.limits !== undefined) {
    applyRateLimits(app, options.limits);
  }

  // Render's health check. "ok" means the server is up; "db" says whether
  // MongoDB is reachable right now.
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, db: databaseStatus() });
  });
  app.use("/api/categories", categoriesRouter());
  app.use("/api/rooms", roomsRouter(options.rooms));
  app.use("/api/leaderboard", leaderboardRouter());
  app.use("/api/results", resultsRouter());
  app.use("/api/daily", dailyRouter(loadAllSeedFiles(), options.now ?? (() => new Date())));
  app.use("/api/admin", adminRouter(options.adminPassword));
  // Unknown API paths get a JSON 404, never the React page.
  app.use("/api", notFoundHandler);

  if (options.clientDistDir !== undefined) {
    serveClient(app, options.clientDistDir, options.clientUrl);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Serves the built React app. Files that exist (JS, CSS, fonts, icons) are sent
// as they are; any other page path gets index.html so React Router can show it.
function serveClient(app: Express, clientDistDir: string, publicOrigin: string): void {
  // Vite puts a content hash in every file name under /assets, so browsers
  // may cache those forever. index.html itself is never cached.
  app.use("/assets", express.static(join(clientDistDir, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(clientDistDir, { index: false }));

  // Read once, on the first page request (the build doesn't change while running).
  let template: string | null = null;
  app.get("/{*path}", (req, res, next) => {
    // A missing file like /logo.png should be a 404, not the React page.
    if (extname(req.path) !== "") {
      next();
      return;
    }
    template ??= readFileSync(join(clientDistDir, "index.html"), "utf8");
    res.setHeader("Cache-Control", "no-cache");
    // Link previews: absolute image URLs, and "Join my Budget Draft room" for invites.
    res.type("html").send(renderIndexHtml(template, publicOrigin, req.path));
  });
}
