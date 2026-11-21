import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AvatarId, RoomSnapshot } from "@budget-draft/shared";
import { readyAll, SocketTestHarness, type Client } from "../../test/socketTestUtils";

const harness = new SocketTestHarness();

beforeAll(() => harness.start());
afterEach(() => harness.disconnectAll());
afterAll(() => harness.stop());

async function joinWith(client: Client, code: string, playerName: string, avatar?: AvatarId) {
  const res = await client.emitWithAck("room:join", avatar === undefined ? { code, playerName } : { code, playerName, avatar });
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

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

describe("avatars online", () => {
  it("uses the avatar sent on join, or gives a free one", async () => {
    const code = await harness.createRoom();
    await joinWith(await harness.newClient(), code, "Asha", "crown");
    const ben = await joinWith(await harness.newClient(), code, "Ben");
    expect(ben.room.players.map((p) => p.avatar)).toEqual(["crown", "rocket"]);
  });

  it("refuses an avatar that isn't on the list", async () => {
    const code = await harness.createRoom();
    const client = await harness.newClient();
    const res = await client.emitWithAck("room:join", { code, playerName: "Asha", avatar: "unicorn" as AvatarId });
    expect(res.ok).toBe(false);
    await joinWith(client, code, "Asha");
    expect(await client.emitWithAck("room:avatar", { avatar: "unicorn" as AvatarId })).toEqual({
      ok: false,
      error: "Pick one of the avatars",
    });
  });

  it("can be changed in the lobby, is carried into the game, then locked", async () => {
    const code = await harness.createRoom();
    const host = await harness.newClient();
    const guest = await harness.newClient();
    await joinWith(host, code, "Asha", "crown");
    await joinWith(guest, code, "Ben", "dog");
    const update = nextRoomUpdate(host, (room) => room.players[1]?.avatar === "fish");
    expect(await guest.emitWithAck("room:avatar", { avatar: "fish" })).toEqual({ ok: true, data: null });
    await update;

    await readyAll([host, guest]);
    const started = nextRoomUpdate(host, (room) => room.game !== null);
    expect(await host.emitWithAck("game:start")).toEqual({ ok: true, data: null });
    const room = await started;
    expect(room.game?.players.map((p) => p.avatar)).toEqual(["crown", "fish"]);
    expect(await guest.emitWithAck("room:avatar", { avatar: "cat" })).toEqual({
      ok: false,
      error: "Avatars can only be changed in the lobby",
    });
  });
});
