import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { GameSettings, RoomSnapshot } from "@budget-draft/shared";
import { buyUntilDraftEnds, join, SocketTestHarness, readyAll, waitForState, type Client } from "../../test/socketTestUtils";

// The harness plays every game with 1-second timers (so tests are quick), but
// the lobby keeps and shows the host's choice. The timer itself firing at the
// chosen time is tested with fake timers in gameRunner.test.ts.
const harness = new SocketTestHarness();

beforeAll(() => harness.start());
afterEach(() => harness.disconnectAll());
afterAll(() => harness.stop());

// The next room update that passes `check` (earlier ones, like a join, are skipped).
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

async function lobbyOfTwo() {
  const code = await harness.createRoom();
  const host = await harness.newClient();
  const guest = await harness.newClient();
  const joined = await join(host, code, "Asha");
  const joinedGuest = await join(guest, code, "Ben");
  const clients = new Map<string, Client>([
    [joined.playerId, host],
    [joinedGuest.playerId, guest],
  ]);
  return { host, guest, clients, settings: joined.room.settings };
}

describe("online timers", () => {
  it("start at 15s per turn, 7s per bid and 30s to vote", async () => {
    const { settings } = await lobbyOfTwo();
    expect(settings).toMatchObject({ turnSeconds: 15, bidSeconds: 7, voteSeconds: 30 });
  });

  it("can be changed by the host in the lobby, and everyone sees the change", async () => {
    const { host, guest, settings } = await lobbyOfTwo();
    const update = nextRoomUpdate(guest, (room) => room.settings.turnSeconds === 45);
    const chosen: GameSettings = { ...settings, turnSeconds: 45, bidSeconds: 20, voteSeconds: 60 };
    expect(await host.emitWithAck("room:settings", chosen)).toEqual({ ok: true, data: null });
    expect((await update).settings).toMatchObject({ turnSeconds: 45, bidSeconds: 20, voteSeconds: 60 });
  });

  it("can't be changed by a guest", async () => {
    const { guest, settings } = await lobbyOfTwo();
    expect(await guest.emitWithAck("room:settings", { ...settings, turnSeconds: 60 })).toEqual({
      ok: false,
      error: "Only the host can change settings",
    });
  });

  it("only accepts the presets, even from a modified client", async () => {
    const { host, settings } = await lobbyOfTwo();
    const bad: Partial<GameSettings>[] = [
      { turnSeconds: 0 }, // no "off" online
      { turnSeconds: 12 },
      { bidSeconds: 3 },
      { bidSeconds: 60 },
      { voteSeconds: 0 },
      { voteSeconds: 45 },
    ];
    for (const change of bad) {
      const res = await host.emitWithAck("room:settings", { ...settings, ...change });
      expect(res.ok).toBe(false);
    }
    expect(await host.emitWithAck("room:settings", { ...settings, bidSeconds: 3 })).toEqual({
      ok: false,
      error: "Bid timer must be one of 5s, 7s, 10s, 15s, 20s",
    });
  });

  it("are locked once the game starts, and a rematch keeps them", async () => {
    const { host, guest, clients, settings } = await lobbyOfTwo();
    await host.emitWithAck("room:settings", { ...settings, slotCount: 3, turnSeconds: 10 });
    const firstReveal = waitForState(host, (state) => state.roundNumber === 1);
    await readyAll([host, guest]);
    expect(await host.emitWithAck("game:start")).toEqual({ ok: true, data: null });
    expect(await host.emitWithAck("room:settings", { ...settings, slotCount: 3, turnSeconds: 60 })).toEqual({
      ok: false,
      error: "Settings are locked once the game starts",
    });

    const end = waitForState(host, (state) => state.phase === "finished");
    await buyUntilDraftEnds(clients, host, await firstReveal);
    await end;
    const rematch = nextRoomUpdate(host, (room) => room.game?.phase === "drafting");
    expect(await host.emitWithAck("game:rematch")).toEqual({ ok: true, data: null });
    const room = await rematch;
    expect(room.game?.phase).toBe("drafting");
    expect(room.settings.turnSeconds).toBe(10);
  });
});
