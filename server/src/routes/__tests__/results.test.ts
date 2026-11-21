import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { RoomStore } from "../../rooms/roomStore";
import { startMemoryMongo } from "../../test/memoryMongo";

// "My games": a device keeps the ids of its saved games and reads them back.

let stopMongo: () => Promise<void>;
const app = createApp({ clientUrl: "http://localhost:5173", adminPassword: "test-admin-password", rooms: new RoomStore() });

beforeAll(async () => {
  stopMongo = await startMemoryMongo();
});
afterAll(async () => {
  await stopMongo();
});

const item = { name: "Item", price: 6, rating: 70, tag: "T", isBench: false };
function gameBody(name: string) {
  return {
    mode: "bot",
    categorySlug: "football",
    startingBudget: 20,
    slotCount: 3,
    players: [
      { id: "human-player", name, isBot: false, avatar: "cat", budgetLeft: 2, team: [item, item, item] },
      { id: "bot-player-1", name: "RoboScout", isBot: true, budgetLeft: 2, team: [item, item, item] },
    ],
  };
}

async function saveGame(name: string): Promise<string> {
  const res = await request(app).post("/api/results").send(gameBody(name));
  expect(res.body).toMatchObject({ ok: true });
  expect(res.status).toBe(201);
  expect(res.body.id).toMatch(/^[a-f0-9]{24}$/);
  return res.body.id as string;
}

describe("saved games", () => {
  it("returns each saved game with its final teams and avatars", async () => {
    const id = await saveGame("Sam");
    const res = await request(app).get(`/api/results/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, mode: "bot", categorySlug: "football", draftStyle: "classic" });
    expect(res.body.players[0]).toMatchObject({ name: "Sam", avatar: "cat", total: 212, team: [item, item, item] });
    expect(res.body.players[1].avatar).toBeUndefined();
    expect(Number.isNaN(Date.parse(res.body.playedAt))).toBe(false);
  });

  it("lists several games in the order asked, skipping unknown ids", async () => {
    const first = await saveGame("First");
    const second = await saveGame("Second");
    const unknown = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const res = await request(app).get(`/api/results?ids=${second},${unknown},${first}`);
    expect(res.status).toBe(200);
    expect(res.body.map((game: { players: { name: string }[] }) => game.players[0]?.name)).toEqual(["Second", "First"]);
  });

  it("rejects bad ids and too many at once", async () => {
    expect((await request(app).get("/api/results/not-an-id")).status).toBe(400);
    expect((await request(app).get("/api/results/aaaaaaaaaaaaaaaaaaaaaaaa")).status).toBe(404);
    expect((await request(app).get("/api/results")).status).toBe(400);
    const tooMany = Array.from({ length: 21 }, () => "aaaaaaaaaaaaaaaaaaaaaaaa").join(",");
    expect((await request(app).get(`/api/results?ids=${tooMany}`)).status).toBe(400);
    expect((await request(app).get("/api/results?ids=$where")).status).toBe(400);
  });
});
