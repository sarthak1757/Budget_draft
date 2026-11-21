import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@budget-draft/shared";
import { join, SocketTestHarness, type Client } from "../../test/socketTestUtils";

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

async function lobby(names: string[]) {
  const code = await harness.createRoom();
  const clients: Client[] = [];
  let settings = null;
  for (const name of names) {
    const client = await harness.newClient();
    const joined = await join(client, code, name);
    settings ??= joined.room.settings;
    clients.push(client);
  }
  if (settings === null) throw new Error("no settings");
  return { code, clients, settings };
}

function readyCount(room: RoomSnapshot): number {
  return room.players.filter((player) => player.isReady).length;
}

describe("ready check", () => {
  it("only lets the host start once everyone is ready", async () => {
    const { clients } = await lobby(["Asha", "Ben"]);
    const [host, guest] = clients;
    if (!host || !guest) throw new Error("missing clients");

    expect(await host.emitWithAck("room:ready", { ready: true })).toEqual({ ok: true, data: null });
    expect(await host.emitWithAck("game:start")).toEqual({ ok: false, error: "Wait until everyone is ready" });

    const update = nextRoomUpdate(host, (room) => readyCount(room) === 2);
    expect(await guest.emitWithAck("room:ready", { ready: true })).toEqual({ ok: true, data: null });
    await update;
    expect(await host.emitWithAck("game:start")).toEqual({ ok: true, data: null });
    expect(await guest.emitWithAck("room:ready", { ready: false })).toEqual({ ok: false, error: "The game has already started" });
  });

  it("lets a player take it back", async () => {
    const { clients } = await lobby(["Asha", "Ben"]);
    const [host, guest] = clients;
    if (!host || !guest) throw new Error("missing clients");
    await host.emitWithAck("room:ready", { ready: true });
    await guest.emitWithAck("room:ready", { ready: true });
    await guest.emitWithAck("room:ready", { ready: false });
    expect(await host.emitWithAck("game:start")).toEqual({ ok: false, error: "Wait until everyone is ready" });
  });

  it("resets everyone when the settings change", async () => {
    const { clients, settings } = await lobby(["Asha", "Ben"]);
    const [host, guest] = clients;
    if (!host || !guest) throw new Error("missing clients");
    await host.emitWithAck("room:ready", { ready: true });
    await guest.emitWithAck("room:ready", { ready: true });
    const update = nextRoomUpdate(guest, (room) => room.settings.slotCount === 4);
    await host.emitWithAck("room:settings", { ...settings, slotCount: 4 });
    expect(readyCount(await update)).toBe(0);
    expect(await host.emitWithAck("game:start")).toEqual({ ok: false, error: "Wait until everyone is ready" });
  });

  it("resets everyone when a new player joins", async () => {
    const { code, clients } = await lobby(["Asha", "Ben"]);
    for (const client of clients) await client.emitWithAck("room:ready", { ready: true });
    const joined = await join(await harness.newClient(), code, "Chen");
    expect(readyCount(joined.room)).toBe(0);
  });

  it("rejects a malformed ready message", async () => {
    const { clients } = await lobby(["Asha"]);
    const res = await clients[0]?.emitWithAck("room:ready", { ready: "yes" } as unknown as { ready: boolean });
    expect(res).toEqual({ ok: false, error: "Invalid ready message" });
  });
});
