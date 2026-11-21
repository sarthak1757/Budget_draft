import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { RoomStore } from "../../rooms/roomStore";
import { startMemoryMongo } from "../../test/memoryMongo";

// A tiny stand-in for client/dist.
const distDir = mkdtempSync(join(tmpdir(), "budget-draft-dist-"));
mkdirSync(join(distDir, "assets"));
writeFileSync(join(distDir, "index.html"), "<!doctype html><title>Budget Draft</title>");
writeFileSync(join(distDir, "assets", "index-abc123.js"), "console.log('app');");
writeFileSync(join(distDir, "favicon.svg"), "<svg></svg>");

const options = { clientUrl: "https://budget-draft.example.com", adminPassword: "test-admin-password" };
const app = createApp({ ...options, rooms: new RoomStore(), clientDistDir: distDir });

afterAll(() => {
  rmSync(distDir, { recursive: true, force: true });
});

describe("GET /api/health", () => {
  it("reports the server as up and the database as disconnected before connecting", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: "disconnected" });
  });

  describe("with a database", () => {
    let stopMongo: () => Promise<void>;
    beforeAll(async () => {
      stopMongo = await startMemoryMongo();
    });
    afterAll(async () => {
      await stopMongo();
    });

    it("reports the database as connected", async () => {
      const res = await request(app).get("/api/health");
      expect(res.body).toEqual({ ok: true, db: "connected" });
    });
  });
});

describe("serving the built client", () => {
  it("sends index.html for the home page and for React Router paths", async () => {
    for (const path of ["/", "/daily", "/new/online/cricket"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.headers["cache-control"]).toBe("no-cache");
      expect(res.text).toContain("<title>Budget Draft</title>");
    }
  });

  it("titles invite links for link previews", async () => {
    const res = await request(app).get("/join/ABC123");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Join my Budget Draft room</title>");
  });

  it("serves built files, and lets browsers cache hashed assets for a long time", async () => {
    const asset = await request(app).get("/assets/index-abc123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers["cache-control"]).toContain("immutable");

    const favicon = await request(app).get("/favicon.svg");
    expect(favicon.status).toBe(200);
  });

  it("404s for missing files instead of sending the page", async () => {
    expect((await request(app).get("/assets/missing.js")).status).toBe(404);
    expect((await request(app).get("/missing.png")).status).toBe(404);
  });

  it("keeps unknown API paths as JSON 404s", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("only allows CLIENT_URL as a cross-site origin", async () => {
    const allowed = await request(app).get("/api/health").set("Origin", options.clientUrl);
    expect(allowed.headers["access-control-allow-origin"]).toBe(options.clientUrl);

    const other = await request(app).get("/api/health").set("Origin", "https://evil.example.com");
    expect(other.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
  });
});

describe("without clientDistDir (development)", () => {
  const devApp = createApp({ ...options, rooms: new RoomStore() });

  it("does not serve pages; Vite does that", async () => {
    const res = await request(devApp).get("/room/ABC123");
    expect(res.status).toBe(404);
  });
});
