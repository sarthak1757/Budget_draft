import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@budget-draft/shared";
import { join, readyAll, SocketTestHarness, type Client } from "../../test/socketTestUtils";

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

async function lobbyOfThree() {
  const code = await harness.createRoom();
  const clients: Client[] = [];
  const ids: string[] = [];
  for (const name of ["Asha", "Ben", "Chen"]) {
    const client = await harness.newClient();
    const joined = await join(client, code, name);
    clients.push(client);
    ids.push(joined.playerId);
  }
  const [host, ben, chen] = clients;
  const [hostId, benId, chenId] = ids;
  if (!host || !ben || !chen || !hostId || !benId || !chenId) throw new Error("missing players");
  return { code, host, ben, chen, hostId, benId, chenId };
}

describe("kicking a player", () => {
  it("removes them, tells them, and keeps their id out", async () => {
    const { code, host, ben, chen, benId } = await lobbyOfThree();
    const kicked = new Promise<{ code: string }>((resolve) => ben.once("room:kicked", resolve));
    const update = nextRoomUpdate(chen, (room) => room.players.length === 2);

    expect(await host.emitWithAck("room:kick", { playerId: benId })).toEqual({ ok: true, data: null });
    expect(await kicked).toEqual({ code });
    expect((await update).players.map((p) => p.name)).toEqual(["Asha", "Chen"]);

    // Ben's socket is out of the room: he can't change anything...
    expect((await ben.emitWithAck("room:ready", { ready: true })).ok).toBe(false);
    // ...and his stored id can't rejoin.
    expect(await ben.emitWithAck("room:join", { code, playerName: "Ben", playerId: benId })).toEqual({
      ok: false,
      error: "The host removed you from this room",
    });
  });

  it("is host only and lobby only", async () => {
    const { host, ben, chen, hostId, chenId, benId } = await lobbyOfThree();
    expect(await ben.emitWithAck("room:kick", { playerId: chenId })).toEqual({ ok: false, error: "Only the host can do that" });
    expect(await host.emitWithAck("room:kick", { playerId: hostId })).toEqual({
      ok: false,
      error: "You can't remove yourself. Use Leave room.",
    });
    expect(await host.emitWithAck("room:kick", { playerId: "not-a-real-player" })).toEqual({
      ok: false,
      error: "That player isn't in this room",
    });

    await readyAll([host, ben, chen]);
    expect(await host.emitWithAck("game:start")).toEqual({ ok: true, data: null });
    expect(await host.emitWithAck("room:kick", { playerId: benId })).toEqual({ ok: false, error: "Only in the lobby" });
  });
});

describe("handing over host", () => {
  it("makes someone else the host", async () => {
    const { host, ben, benId } = await lobbyOfThree();
    const update = nextRoomUpdate(ben, (room) => room.hostId === benId);
    expect(await host.emitWithAck("room:makeHost", { playerId: benId })).toEqual({ ok: true, data: null });
    expect((await update).players.find((p) => p.isHost)?.name).toBe("Ben");
    // The old host lost their powers.
    expect((await host.emitWithAck("game:start")).ok).toBe(false);
    expect(await host.emitWithAck("room:makeHost", { playerId: benId })).toEqual({ ok: false, error: "Only the host can do that" });
  });

  it("can't go to someone who is offline", async () => {
    const { host, chen, chenId } = await lobbyOfThree();
    const update = nextRoomUpdate(host, (room) => room.players.some((p) => !p.isConnected));
    chen.disconnect();
    await update;
    expect(await host.emitWithAck("room:makeHost", { playerId: chenId })).toEqual({ ok: false, error: "They're offline right now" });
  });
});
