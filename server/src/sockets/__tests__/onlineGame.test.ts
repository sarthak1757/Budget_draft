import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getCurrentPlayerId, type GameResults, type PublicGameState, type RoomSnapshot } from "@budget-draft/shared";
import { GameResultModel } from "../../models/GameResult";
import { buyUntilDraftEnds, join, SocketTestHarness, waitForState } from "../../test/socketTestUtils";

const harness = new SocketTestHarness();

beforeAll(() => harness.start());
afterEach(() => harness.disconnectAll());
afterAll(() => harness.stop());

describe("online game over Socket.io", () => {
  it("plays a full game between two clients and saves the result", async () => {
    await GameResultModel.deleteMany({});
    const { code, clients, host, state } = await harness.startGame(["Asha", "Ben"]);
    expect("itemPool" in state).toBe(false); // the pool never reaches clients

    const gameEnd = new Promise<{ state: PublicGameState; results: GameResults }>((resolve) => {
      host.on("game:end", resolve);
    });
    await buyUntilDraftEnds(clients, host, state);

    const end = await gameEnd;
    expect(end.state.phase).toBe("finished"); // 2 players: no vote
    expect(end.results.votingHeld).toBe(false);
    for (const player of end.state.players) {
      expect(player.team.every((slot) => slot !== null)).toBe(true);
    }

    // Saving happens right after game:end; give it a moment.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const saved = await GameResultModel.find({ roomCode: code }).lean();
    expect(saved.length).toBe(1);
    expect(saved[0]?.countsForLeaderboard).toBe(true);
    expect(saved[0]?.players.map((p) => p.name).sort()).toEqual(["Asha", "Ben"]);
  });

  it("rejects bad payloads, out-of-turn actions and stale clicks", async () => {
    const { clients, ids, state } = await harness.startGame(["Asha", "Ben"]);
    const currentId = getCurrentPlayerId(state);
    const otherId = ids.find((id) => id !== currentId) ?? "";
    const acting = clients.get(currentId ?? "");
    const waiting = clients.get(otherId);
    if (!acting || !waiting) throw new Error("missing clients");

    const bad = await acting.emitWithAck("turn:action", { action: "steal", roundNumber: 1 } as never);
    expect(bad.ok).toBe(false);
    const outOfTurn = await waiting.emitWithAck("turn:action", { action: "buy", roundNumber: state.roundNumber });
    expect(outOfTurn).toEqual({ ok: false, error: "It's not your turn" });
    const stale = await acting.emitWithAck("turn:action", { action: "buy", roundNumber: state.roundNumber + 5 });
    expect(stale).toEqual({ ok: false, error: "That item is gone. Too slow!" });
    const notHost = await clients.get(ids[1] ?? "")?.emitWithAck("game:start");
    expect(notHost?.ok).toBe(false);
  });

  it("auto-passes when the turn timer runs out", async () => {
    const { host, state } = await harness.startGame(["Asha", "Ben"]);
    const firstPlayer = getCurrentPlayerId(state);
    const afterTimeout = await waitForState(host, (s) =>
      s.lastEvents.some((e) => e.type === "passed" && e.auto && e.playerId === firstPlayer),
    );
    expect(getCurrentPlayerId(afterTimeout)).not.toBe(firstPlayer);
  });

  it("lets a player reconnect to their seat with the stored id", async () => {
    const { code, clients, ids } = await harness.startGame(["Asha", "Ben"]);
    const benId = ids[1] ?? "";
    clients.get(benId)?.disconnect();
    const benAgain = await harness.newClient();
    const rejoin = await join(benAgain, code, "Ben", benId);
    expect(rejoin.playerId).toBe(benId);
    expect(rejoin.room.game?.phase).toBe("drafting");
    const benInGame = rejoin.room.game?.players.find((p) => p.id === benId);
    expect(benInGame?.isConnected).toBe(true);
  });

  it("seats nobody new once the game has started (they watch instead)", async () => {
    const { code } = await harness.startGame(["Asha", "Ben"]);
    const late = await harness.newClient();
    const res = await late.emitWithAck("room:join", { code, playerName: "Late" });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.room.game?.players.map((p) => p.name)).toEqual(["Asha", "Ben"]);
    expect(res.data.room.spectators.map((s) => s.name)).toEqual(["Late"]);
  });

  it("passes host to the next player when the host leaves the lobby", async () => {
    const code = await harness.createRoom();
    const asha = await harness.newClient();
    const ben = await harness.newClient();
    await join(asha, code, "Asha");
    const benJoin = await join(ben, code, "Ben");

    const update = new Promise<RoomSnapshot>((resolve) => {
      ben.on("room:update", (room) => {
        if (room.players.some((p) => !p.isConnected)) resolve(room);
      });
    });
    asha.disconnect();
    const room = await update;
    expect(room.hostId).toBe(benJoin.playerId);
  });
});
