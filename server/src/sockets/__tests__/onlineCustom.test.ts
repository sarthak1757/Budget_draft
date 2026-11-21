import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CustomItem } from "@budget-draft/shared";
import { GameResultModel } from "../../models/GameResult";
import { buyUntilDraftEnds, join, SocketTestHarness, readyAll, waitForState, type Client } from "../../test/socketTestUtils";

const harness = new SocketTestHarness();

beforeAll(() => harness.start());
afterEach(() => harness.disconnectAll());
afterAll(() => harness.stop());

function customList(count: number): CustomItem[] {
  const items: CustomItem[] = [];
  for (let i = 1; i <= count; i++) {
    items.push({ name: `Snack ${i}`, price: (i % 5) + 1, rating: 40 + i, tag: "Snack" });
  }
  return items;
}

async function postRoom(body: unknown) {
  const res = await fetch(`${harness.url}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { code?: string; error?: string } };
}

describe("custom category rooms", () => {
  it("plays a whole game with the host's own list, and doesn't rank it", async () => {
    const created = await postRoom({ categorySlug: "football", customItems: customList(30) });
    expect(created.status).toBe(201);
    const code = created.body.code ?? "";

    const host = await harness.newClient();
    const guest = await harness.newClient();
    const hostSeat = await join(host, code, "Asha");
    const guestSeat = await join(guest, code, "Ben");
    expect(hostSeat.room.settings.categorySlug).toBe("custom");
    expect(guestSeat.room.customItemCount).toBe(30);

    // Trying to switch category keeps the room on its own list.
    const settings = { ...hostSeat.room.settings, categorySlug: "nba", slotCount: 3, balancedTeam: true };
    expect(await host.emitWithAck("room:settings", settings)).toEqual({ ok: true, data: null });

    const firstReveal = waitForState(host, (state) => state.roundNumber === 1);
    await readyAll([host, guest]);
    expect(await host.emitWithAck("game:start")).toEqual({ ok: true, data: null });
    const state = await firstReveal;
    expect(state.settings.categorySlug).toBe("custom");
    expect(state.settings.balancedTeam).toBe(false); // a custom list has no roles
    expect(state.currentItem?.name).toMatch(/^Snack \d+$/);

    const clients = new Map<string, Client>([
      [hostSeat.playerId, host],
      [guestSeat.playerId, guest],
    ]);
    const end = waitForState(host, (s) => s.phase === "finished");
    await buyUntilDraftEnds(clients, host, state);
    await end;

    // Saving happens just after game:end; give it a moment.
    let saved = null;
    for (let i = 0; i < 20 && saved === null; i++) {
      saved = await GameResultModel.findOne({ roomCode: code }).lean();
      if (saved === null) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(saved?.categorySlug).toBe("custom");
    expect(saved?.countsForLeaderboard).toBe(false);
  });

  it("rejects a bad list with a clear message", async () => {
    const tooShort = await postRoom({ categorySlug: "football", customItems: customList(5) });
    expect(tooShort).toEqual({ status: 400, body: { error: "customItems: Add at least 20 items" } });

    const twice = [...customList(20), { name: "snack 3", price: 2, rating: 50, tag: "Snack" }];
    expect((await postRoom({ categorySlug: "football", customItems: twice })).status).toBe(400);

    const badPrice = customList(20).map((item, i) => (i === 0 ? { ...item, price: 50 } : item));
    expect((await postRoom({ categorySlug: "football", customItems: badPrice })).status).toBe(400);
  });

  it("doesn't let a normal room switch to the custom slug", async () => {
    const code = await harness.createRoom("nba");
    const client = await harness.newClient();
    const seat = await join(client, code, "Cy");
    const res = await client.emitWithAck("room:settings", { ...seat.room.settings, categorySlug: "custom" });
    expect(res).toEqual({ ok: false, error: "That category doesn't exist" });
  });
});
