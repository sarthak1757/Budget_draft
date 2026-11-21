import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PublicGameState, RoomInfo, RoomSnapshot } from "@budget-draft/shared";
import { buyUntilDraftEnds, join, SocketTestHarness, waitForState, type Client } from "../../test/socketTestUtils";

const harness = new SocketTestHarness();

beforeAll(() => harness.start());
afterEach(() => harness.disconnectAll());
afterAll(() => harness.stop());

function nextRoomUpdate(client: Client, check: (room: RoomSnapshot) => boolean) {
  return new Promise<RoomSnapshot>((resolve) => {
    const onUpdate = (room: RoomSnapshot) => {
      if (check(room)) {
        client.off("room:update", onUpdate);
        resolve(room);
      }
    };
    client.on("room:update", onUpdate);
  });
}

// Anything secret that could leak into what a spectator receives.
function expectNothingHidden(state: PublicGameState) {
  expect("itemPool" in state).toBe(false);
  const shown = [state.currentItem, ...state.players.flatMap((player) => player.team)];
  for (const item of shown) {
    if (item && item.isMystery) {
      expect(item.rating).toBeNull();
    }
  }
}

describe("spectators", () => {
  it("watch a running game read-only and never see hidden info", async () => {
    const game = await harness.startGame(["Asha", "Ben"], 7, { mysteryItems: true });
    const info = (await (await fetch(`${harness.url}/api/rooms/${game.code}`)).json()) as RoomInfo;
    expect(info).toMatchObject({ joinable: false, watchable: true });

    const watcher = await harness.newClient();
    const joined = await join(watcher, game.code, "Dev");
    expect(joined.room.spectators).toEqual([{ id: joined.playerId, name: "Dev", isConnected: true }]);
    expect(joined.room.game?.players.some((p) => p.id === joined.playerId)).toBe(false);
    if (joined.room.game) expectNothingHidden(joined.room.game);

    // Everything the spectator receives while the draft runs stays public.
    const received: PublicGameState[] = [];
    watcher.on("game:state", (state) => received.push(state));
    watcher.on("item:reveal", ({ state }) => received.push(state));

    // Can't play, peek or react.
    const round = game.state.roundNumber;
    expect((await watcher.emitWithAck("turn:action", { action: "buy", roundNumber: round })).ok).toBe(false);
    expect((await watcher.emitWithAck("turn:peek", { roundNumber: round })).ok).toBe(false);
    expect((await watcher.emitWithAck("reaction:send", { emoji: "🔥" })).ok).toBe(false);
    // ...or ready up / change settings.
    expect((await watcher.emitWithAck("room:ready", { ready: true })).ok).toBe(false);

    const end = waitForState(watcher, (state) => state.phase === "finished");
    await buyUntilDraftEnds(game.clients, game.host, game.state);
    await end;
    expect(received.length).toBeGreaterThan(0);
    for (const state of received.filter((s) => s.phase === "drafting")) {
      expectNothingHidden(state);
    }
  });

  it("join as players on Rematch, up to the 4-seat limit", async () => {
    const game = await harness.startGame(["Asha", "Ben", "Chen"], 3);
    const watchers: Client[] = [];
    for (const name of ["Dev", "Esha"]) {
      const client = await harness.newClient();
      await join(client, game.code, name);
      watchers.push(client);
    }
    // A spectator can't take a name that's already in the room.
    expect(await (await harness.newClient()).emitWithAck("room:join", { code: game.code, playerName: "asha" })).toEqual({
      ok: false,
      error: 'Someone called "Asha" is already here. Pick another name.',
    });

    const end = waitForState(game.host, (state) => state.phase === "finished" || state.phase === "voting");
    await buyUntilDraftEnds(game.clients, game.host, game.state);
    const after = await end;
    if (after.phase === "voting") {
      // 3 humans vote; let the 1-second test timer close it.
      await waitForState(game.host, (state) => state.phase === "finished");
    }

    const rematch = nextRoomUpdate(game.host, (room) => room.game?.phase === "drafting");
    expect(await game.host.emitWithAck("game:rematch")).toEqual({ ok: true, data: null });
    const room = await rematch;
    expect(room.game?.players.map((p) => p.name)).toEqual(["Asha", "Ben", "Chen", "Dev"]);
    expect(room.spectators.map((s) => s.name)).toEqual(["Esha"]);
  });

  it("leaving removes a spectator", async () => {
    const game = await harness.startGame(["Asha", "Ben"]);
    const watcher = await harness.newClient();
    await join(watcher, game.code, "Dev");
    const update = nextRoomUpdate(game.host, (room) => room.spectators.length === 0);
    await watcher.emitWithAck("room:leave");
    expect((await update).spectators).toEqual([]);
  });
});
