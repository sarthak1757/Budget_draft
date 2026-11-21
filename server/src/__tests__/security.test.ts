import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { RoomStore } from "../rooms/roomStore";
import { PRODUCTION_LIMITS, socketClientIp, type SecurityLimits } from "../security";
import { createGameServer, type RunningGameServer } from "../server";

const CLIENT_URL = "https://budget-draft.example.com";
const tight: SecurityLimits = { apiPerMinute: 3, adminPerMinute: 2, socketsPerIp: 2 };

function appWith(limits?: SecurityLimits) {
  return createApp({ clientUrl: CLIENT_URL, adminPassword: "test-admin-password", rooms: new RoomStore(), limits });
}

describe("security headers", () => {
  it("sends helmet's headers with a CSP that allows our socket connection", async () => {
    const res = await request(appWith()).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    const csp = res.headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://budget-draft.example.com wss://budget-draft.example.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("REST rate limits", () => {
  it("allows the per-minute limit, then answers 429", async () => {
    const app = appWith(tight);
    for (let i = 0; i < tight.apiPerMinute; i++) {
      expect((await request(app).get("/api/nothing-here")).status).toBe(404);
    }
    const blocked = await request(app).get("/api/nothing-here");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests. Wait a minute and try again." });
    expect(blocked.headers["ratelimit-policy"]).toBeDefined();
  });

  it("never limits the health check", async () => {
    const app = appWith(tight);
    for (let i = 0; i < 10; i++) {
      expect((await request(app).get("/api/health")).status).toBe(200);
    }
  });

  it("is stricter on the admin API", async () => {
    const app = appWith(tight);
    for (let i = 0; i < tight.adminPerMinute; i++) {
      expect((await request(app).get("/api/admin/categories")).status).toBe(401);
    }
    const blocked = await request(app).get("/api/admin/categories");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many admin requests/);
  });

  it("uses the production numbers from the README", () => {
    expect(PRODUCTION_LIMITS).toEqual({ apiPerMinute: 100, adminPerMinute: 20, socketsPerIp: 10 });
  });
});

describe("request body size", () => {
  it("refuses JSON bodies over 100 KB", async () => {
    const res = await request(appWith())
      .post("/api/results")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ padding: "x".repeat(120 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Request is too big" });
  });
});

describe("socket connections per IP", () => {
  let server: RunningGameServer;
  let url = "";
  const sockets: Socket[] = [];

  beforeAll(async () => {
    server = createGameServer({ clientUrl: "http://localhost:5173", adminPassword: "x", limits: tight });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await server.close();
  });

  function open(): Promise<{ socket: Socket; error: string | null }> {
    const socket = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false });
    sockets.push(socket);
    return new Promise((resolve) => {
      socket.on("connect", () => resolve({ socket, error: null }));
      socket.on("connect_error", (error) => resolve({ socket, error: error.message }));
    });
  }

  it("refuses a connection over the limit, and allows one again after a disconnect", async () => {
    const first = await open();
    const second = await open();
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    const third = await open();
    expect(third.error).toMatch(/Too many connections/);

    first.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await open()).error).toBeNull();
  });
});

describe("socketClientIp", () => {
  function fakeRequest(forwarded: string | undefined, remoteAddress: string): IncomingMessage {
    return { headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded }, socket: { remoteAddress } } as unknown as IncomingMessage;
  }

  it("uses the address the proxy saw, not what the visitor claims", () => {
    // A visitor can put anything first; Render's proxy appends the real address last.
    expect(socketClientIp(fakeRequest("1.1.1.1, 203.0.113.9", "10.0.0.1"), true)).toBe("203.0.113.9");
    expect(socketClientIp(fakeRequest(undefined, "10.0.0.1"), true)).toBe("10.0.0.1");
  });

  it("ignores the header when not behind a proxy", () => {
    expect(socketClientIp(fakeRequest("1.1.1.1", "127.0.0.1"), false)).toBe("127.0.0.1");
  });
});
