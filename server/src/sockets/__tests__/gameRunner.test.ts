import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, getCurrentPlayerId, onlineTimersSchema, type Item, type OnlineTimers } from "@budget-draft/shared";
import { addPlayer, applyRoomSettings, createRoom, type Room } from "../../rooms/room";
import { GameRunner } from "../gameRunner";
import type { GameServer } from "../types";

// The turn timer, driven by fake timers: no sockets, no database.

const START = 1_000_000;

function makeItems(count: number): Item[] {
  const items: Item[] = [];
  for (let i = 1; i <= count; i++) {
    items.push({ id: `i${i}`, name: `Item ${i}`, category: "test", price: 2, rating: 50, tag: "Test" });
  }
  return items;
}

// Broadcasts go nowhere; the test reads the room directly.
const silentIo = { to: () => ({ emit: () => true }) } as unknown as GameServer;

async function startRoom(timers: Partial<OnlineTimers>, draftStyle: "classic" | "auction" = "classic"): Promise<{ room: Room; runner: GameRunner }> {
  const runner = new GameRunner(silentIo, {
    loadCategory: async () => ({ items: makeItems(20), roles: [] }),
    saveResult: async () => "0123456789abcdef01234567",
    now: () => Date.now(),
  });
  const room = createRoom("ABCDEF", "test", Date.now());
  addPlayer(room, { id: "asha", name: "Asha" }, Date.now());
  addPlayer(room, { id: "ben", name: "Ben" }, Date.now());
  applyRoomSettings(room, { ...DEFAULT_SETTINGS, categorySlug: "test", slotCount: 3, draftStyle }, onlineTimersSchema.parse(timers));
  const result = await runner.startGame(room);
  if (!result.ok) throw new Error(result.error);
  return { room, runner };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => vi.useRealTimers());

describe("the online turn timer", () => {
  it("auto-passes after the host's chosen turn time, not before", async () => {
    const { room } = await startRoom({ turnSeconds: 10 });
    const game = room.game;
    if (game === null) throw new Error("no game");
    expect(game.turnDeadline).toBe(START + 10_000);
    const first = getCurrentPlayerId(game);

    vi.advanceTimersByTime(9_999);
    expect(getCurrentPlayerId(room.game ?? game)).toBe(first);
    expect(room.game?.lastEvents).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(room.game?.lastEvents[0]).toMatchObject({ type: "passed", playerId: first, auto: true });
    expect(getCurrentPlayerId(room.game ?? game)).not.toBe(first);
    // The next player gets a fresh 10 seconds.
    expect(room.game?.turnDeadline).toBe(START + 20_000);
  });

  it("uses the bid timer in an auction", async () => {
    const { room } = await startRoom({ turnSeconds: 60, bidSeconds: 5 }, "auction");
    const first = room.game === null ? null : getCurrentPlayerId(room.game);
    vi.advanceTimersByTime(4_999);
    expect(room.game?.lastEvents).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(room.game?.lastEvents[0]).toMatchObject({ type: "passed", playerId: first, auto: true });
  });
});
