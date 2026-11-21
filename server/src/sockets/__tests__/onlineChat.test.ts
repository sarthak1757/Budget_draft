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

async function lobbyOfTwo() {
  const code = await harness.createRoom();
  const host = await harness.newClient();
  const guest = await harness.newClient();
  await join(host, code, "Asha");
  await join(guest, code, "Ben");
  return { code, host, guest };
}

describe("lobby chat", () => {
  it("sends a message to everyone in the room, tidied up", async () => {
    const { host, guest } = await lobbyOfTwo();
    const update = nextRoomUpdate(guest, (room) => room.chat.length === 1);
    expect(await host.emitWithAck("chat:send", { text: "  hi\n\nall   👋 " })).toEqual({ ok: true, data: null });
    const [message] = (await update).chat;
    expect(message).toMatchObject({ playerName: "Asha", text: "hi all 👋" });
  });

  it("allows one message per second per player", async () => {
    const { host, guest } = await lobbyOfTwo();
    expect((await host.emitWithAck("chat:send", { text: "one" })).ok).toBe(true);
    expect(await host.emitWithAck("chat:send", { text: "two" })).toEqual({
      ok: false,
      error: "Slow down! One message per second.",
    });
    // Someone else isn't held up by it.
    expect((await guest.emitWithAck("chat:send", { text: "hey" })).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1050));
    expect((await host.emitWithAck("chat:send", { text: "three" })).ok).toBe(true);
  });

  it("rejects empty and over-long messages", async () => {
    const { host } = await lobbyOfTwo();
    expect(await host.emitWithAck("chat:send", { text: "   " })).toEqual({ ok: false, error: "Type a message first" });
    expect(await host.emitWithAck("chat:send", { text: "x".repeat(121) })).toEqual({
      ok: false,
      error: "Keep it under 120 characters",
    });
    expect((await host.emitWithAck("chat:send", { text: "x".repeat(120) })).ok).toBe(true);
    expect((await host.emitWithAck("chat:send", { text: 42 } as unknown as { text: string })).ok).toBe(false);
  });

  it("closes once the game starts, and clears the history", async () => {
    const { code, host, guest } = await lobbyOfTwo();
    await host.emitWithAck("chat:send", { text: "good luck" });
    await readyAll([host, guest]);
    expect(await host.emitWithAck("game:start")).toEqual({ ok: true, data: null });
    expect(await guest.emitWithAck("chat:send", { text: "too late" })).toEqual({
      ok: false,
      error: "Chat is only open in the lobby",
    });
    // A spectator arriving now sees no lobby chatter, and can't chat either.
    const watcher = await harness.newClient();
    const joined = await join(watcher, code, "Dev");
    expect(joined.room.chat).toEqual([]);
    expect((await watcher.emitWithAck("chat:send", { text: "hello" })).ok).toBe(false);
  });
});
