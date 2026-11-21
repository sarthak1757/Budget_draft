import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, computeResults, createGame, type GameMode, type GameState, type Item } from "@budget-draft/shared";
import { createApp } from "../../app";
import { GameResultModel } from "../../models/GameResult";
import { RoomStore } from "../../rooms/roomStore";
import { loadAllSeedFiles } from "../../seed/loadSeedFiles";
import { seedDatabase } from "../../seed/seedDatabase";
import { saveGameResult } from "../../services/gameResults";
import { startMemoryMongo } from "../../test/memoryMongo";

let stopMongo: () => Promise<void>;
const rooms = new RoomStore();
const app = createApp({ clientUrl: "http://localhost:5173", adminPassword: "test-admin-password", rooms });

beforeAll(async () => {
  stopMongo = await startMemoryMongo();
  await seedDatabase(loadAllSeedFiles());
});

afterAll(async () => {
  await stopMongo();
});

describe("GET /api/categories", () => {
  it("lists every seeded category with item counts", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(12);
    const football = res.body.find((c: { slug: string }) => c.slug === "football");
    expect(football.itemCount).toBeGreaterThanOrEqual(40);
  });
});

describe("GET /api/categories/:slug/items", () => {
  it("returns items with string ids", async () => {
    const res = await request(app).get("/api/categories/cricket/items");
    expect(res.status).toBe(200);
    expect(typeof res.body[0].id).toBe("string");
    expect(res.body[0].category).toBe("cricket");
  });

  it("404s for an unknown category and 400s for a bad slug", async () => {
    expect((await request(app).get("/api/categories/nope/items")).status).toBe(404);
    expect((await request(app).get("/api/categories/Bad%20Slug/items")).status).toBe(400);
  });
});

describe("rooms", () => {
  it("creates a room and looks it up by code", async () => {
    const created = await request(app).post("/api/rooms").send({ categorySlug: "nba" });
    expect(created.status).toBe(201);
    expect(created.body.code).toMatch(/^[A-Z0-9]{6}$/);

    const info = await request(app).get(`/api/rooms/${created.body.code.toLowerCase()}`);
    expect(info.status).toBe(200);
    expect(info.body).toMatchObject({ categorySlug: "nba", phase: "lobby", playerCount: 0, joinable: true });
  });

  it("rejects bad input with a helpful message", async () => {
    const res = await request(app).post("/api/rooms").send({ categorySlug: "unknown-thing" });
    expect(res.status).toBe(404);
    expect((await request(app).post("/api/rooms").send({})).status).toBe(400);
    expect((await request(app).get("/api/rooms/ZZZZZZ")).status).toBe(404);
    expect((await request(app).get("/api/rooms/abc")).status).toBe(400);
  });

  it("answers malformed JSON with 400, not 500", async () => {
    const res = await request(app).post("/api/rooms").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/leaderboard", () => {
  beforeEach(async () => {
    await GameResultModel.deleteMany({});
  });

  function finishedGame(mode: GameMode, names: string[], ratings: number[]): GameState {
    const items: Item[] = [];
    for (let i = 0; i < ratings.length; i++) {
      items.push({ id: `i${i}`, name: `Item ${i}`, category: "t", price: 1, rating: ratings[i] ?? 1, tag: "T" });
    }
    const players = names.map((name) => ({ id: `${mode}-${name}`, name, isBot: false }));
    let state = createGame({
      mode,
      settings: { ...DEFAULT_SETTINGS, startingBudget: 3, slotCount: 3, turnSeconds: 0, voteSeconds: 0, categorySlug: "t" },
      players,
      items,
      now: 0,
      random: () => 0.999999,
    });
    // One item, then the pool runs out and everyone gets bench players.
    state = { ...state, phase: "finished" };
    const first = state.players[0];
    if (first) {
      first.team = [items[0] ?? null, null, null];
    }
    return state;
  }

  it("counts online games only and ranks by wins", async () => {
    const online = finishedGame("online", ["Asha", "Ben"], [90]);
    await saveGameResult(online, computeResults(online), "ABCDEF");
    const local = finishedGame("local", ["Ben", "Chen"], [90]);
    await saveGameResult(local, computeResults(local));

    const res = await request(app).get("/api/leaderboard");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { name: "Asha", wins: 1, gamesPlayed: 1, bestScore: 93 },
      { name: "Ben", wins: 0, gamesPlayed: 1, bestScore: 3 },
    ]);
    // The local game is stored, just not ranked.
    expect(await GameResultModel.countDocuments({ countsForLeaderboard: false })).toBe(1);
  });

  it("counts wins in every mode but best score only in Classic with no extras", async () => {
    const classic = finishedGame("online", ["Asha", "Ben"], [60]);
    await saveGameResult(classic, computeResults(classic), "AAAAAA");
    const auction = finishedGame("online", ["Asha", "Ben"], [99]);
    auction.settings = { ...auction.settings, draftStyle: "auction" };
    await saveGameResult(auction, computeResults(auction), "BBBBBB");
    const chaos = finishedGame("online", ["Asha", "Ben"], [95]);
    chaos.rulesPreset = "chaos";
    await saveGameResult(chaos, computeResults(chaos), "CCCCCC");

    const saved = await GameResultModel.findOne({ roomCode: "BBBBBB" }).lean();
    expect(saved?.draftStyle).toBe("auction");
    expect(saved?.preset).toBe("classic");

    const res = await request(app).get("/api/leaderboard");
    const asha = res.body.find((entry: { name: string }) => entry.name === "Asha");
    expect(asha).toEqual({ name: "Asha", wins: 3, gamesPlayed: 3, bestScore: 63 });
  });

  it("reads old results without the new fields as Classic", async () => {
    const game = finishedGame("online", ["Asha", "Ben"], [70]);
    await saveGameResult(game, computeResults(game), "OLDOLD");
    // Simulate a result saved before draftStyle and preset existed.
    await GameResultModel.collection.updateOne({ roomCode: "OLDOLD" }, { $unset: { draftStyle: "", preset: "" } });

    const res = await request(app).get("/api/leaderboard");
    expect(res.body[0]).toEqual({ name: "Asha", wins: 1, gamesPlayed: 1, bestScore: 73 });
  });

  it("shows no best score for a player with no plain Classic games", async () => {
    const auction = finishedGame("online", ["Asha", "Ben"], [80]);
    auction.settings = { ...auction.settings, draftStyle: "auction" };
    await saveGameResult(auction, computeResults(auction), "DDDDDD");
    const res = await request(app).get("/api/leaderboard");
    expect(res.body[0]).toEqual({ name: "Asha", wins: 1, gamesPlayed: 1, bestScore: null });
  });
});

describe("POST /api/results", () => {
  const item = { name: "Item", price: 6, rating: 70, tag: "T", isBench: false };
  const bench = { name: "Bench Player", price: 0, rating: 10, tag: "Bench", isBench: true };
  const body = {
    mode: "bot",
    categorySlug: "football",
    startingBudget: 20,
    slotCount: 3,
    players: [
      { id: "human-player", name: "Sam", isBot: false, budgetLeft: 8, team: [item, item, bench] },
      { id: "bot-player-1", name: "RoboScout", isBot: true, budgetLeft: 2, team: [item, item, item] },
    ],
  };

  it("stores a bot game with server-computed scores, excluded from the leaderboard", async () => {
    await GameResultModel.deleteMany({});
    const res = await request(app).post("/api/results").send(body);
    expect(res.status).toBe(201);
    const saved = await GameResultModel.findOne({ mode: "bot" }).lean();
    expect(saved?.countsForLeaderboard).toBe(false);
    expect(saved?.statsWinnerIds).toEqual(["bot-player-1"]);
    expect(saved?.players[1]?.total).toBe(212); // 3 x 70 + $2 left
    expect((await request(app).get("/api/leaderboard")).body).toEqual([]);
  });

  it("rejects online mode and inconsistent budgets", async () => {
    expect((await request(app).post("/api/results").send({ ...body, mode: "online" })).status).toBe(400);
    const broken = structuredClone(body);
    const first = broken.players[0];
    if (first) first.budgetLeft = 19;
    expect((await request(app).post("/api/results").send(broken)).status).toBe(400);
  });
});
