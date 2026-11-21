import type { IncomingMessage } from "node:http";
import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import type { GameServer } from "./sockets/types";

// Limits that keep one visitor (or script) from hogging the server.
export interface SecurityLimits {
  apiPerMinute: number; // REST requests per IP per minute
  adminPerMinute: number; // stricter: password guesses
  socketsPerIp: number; // open Socket.io connections at once
}

// What the live site uses. A few phones on the same Wi-Fi share one IP, so
// these leave room for a whole room of players (4 players + spectators,
// each with a tab or two) while stopping floods.
export const PRODUCTION_LIMITS: SecurityLimits = {
  apiPerMinute: 100,
  adminPerMinute: 20,
  socketsPerIp: 10,
};

// Security headers. The CSP allows only our own scripts, styles, fonts and
// images, plus the Socket.io connection back to this server.
export function securityHeaders(clientUrl: string): RequestHandler {
  const socketOrigin = clientUrl.replace(/^http/, "ws");
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // React sets some inline styles (progress bars, grid columns).
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", clientUrl, socketOrigin],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // Render serves HTTPS already; upgrading would break a local http run.
        upgradeInsecureRequests: null,
      },
    },
    // Link previews (WhatsApp, X...) fetch og.png from their own servers.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

function tooManyRequests(message: string): RequestHandler {
  return (_req, res) => {
    res.status(429).json({ error: message });
  };
}

// Rate limits for the REST API. The health check is left out: Render calls it often.
export function applyRateLimits(app: Express, limits: SecurityLimits): void {
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: limits.apiPerMinute,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.path === "/health",
      handler: tooManyRequests("Too many requests. Wait a minute and try again."),
    }),
  );
  app.use(
    "/api/admin",
    rateLimit({
      windowMs: 60 * 1000,
      limit: limits.adminPerMinute,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: tooManyRequests("Too many admin requests. Wait a minute and try again."),
    }),
  );
}

// The visitor's IP for a socket. Behind Render's proxy the real address is
// the last entry in X-Forwarded-For (the one Render's proxy added), matching
// Express's "trust proxy" = 1.
export function socketClientIp(request: IncomingMessage, behindProxy: boolean): string {
  if (behindProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const header = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
    if (header) {
      const parts = header.split(",").map((part) => part.trim()).filter((part) => part !== "");
      const last = parts[parts.length - 1];
      if (last) {
        return last;
      }
    }
  }
  return request.socket.remoteAddress ?? "unknown";
}

// Refuses a new Socket.io connection when that IP already has too many open.
export function limitSocketsPerIp(io: GameServer, maxPerIp: number, behindProxy: boolean): void {
  const openByIp = new Map<string, number>();
  io.use((socket, next) => {
    const ip = socketClientIp(socket.request, behindProxy);
    const open = openByIp.get(ip) ?? 0;
    if (open >= maxPerIp) {
      next(new Error("Too many connections from your network. Close some tabs and try again."));
      return;
    }
    openByIp.set(ip, open + 1);
    socket.once("disconnect", () => {
      const now = (openByIp.get(ip) ?? 1) - 1;
      if (now <= 0) {
        openByIp.delete(ip);
      } else {
        openByIp.set(ip, now);
      }
    });
    next();
  });
}
