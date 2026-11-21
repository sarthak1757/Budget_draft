import {
  applyAction,
  castVote,
  computeResults,
  createGame,
  endVoting,
  getCurrentPlayerId,
  peekNextItem,
  toPublicItem,
  toPublicState,
  type GameResults,
  type GameState,
  type Item,
  type NewPlayer,
  type PlayerAction,
  type PublicItem,
  type TurnActionPayload,
} from "@budget-draft/shared";
import { seatSpectators, settingsForGame, toRoomSnapshot, type Room } from "../rooms/room";
import type { GameServer } from "./types";

export interface GameRunnerDeps {
  loadCategory: (categorySlug: string) => Promise<{ items: Item[]; roles: string[] } | null>;
  saveResult: (state: GameState, results: GameResults, roomCode: string) => Promise<void>;
  now: () => number;
}

export type RunnerResult = { ok: true } | { ok: false; error: string };

interface RoomTimers {
  turn: NodeJS.Timeout | null;
  vote: NodeJS.Timeout | null;
}

// Runs online games: applies player actions with the shared engine, sends
// updates to everyone in the room, and owns the turn and vote timers.
// The server is the only place the real GameState lives; clients just get copies.
export class GameRunner {
  private timers = new Map<string, RoomTimers>();

  constructor(
    private readonly io: GameServer,
    private readonly deps: GameRunnerDeps,
  ) {}

  broadcastRoom(room: Room): void {
    this.io.to(room.code).emit("room:update", toRoomSnapshot(room));
  }

  async startGame(room: Room): Promise<RunnerResult> {
    if (room.game !== null) {
      return { ok: false, error: "The game has already started" };
    }

    // Players who dropped out of the lobby don't get a seat.
    const seated: NewPlayer[] = [];
    for (const player of room.players) {
      if (player.isConnected) {
        seated.push({ id: player.id, name: player.name, isBot: false, avatar: player.avatar });
      }
    }
    if (seated.length < 2) {
      return { ok: false, error: "You need at least 2 players to start" };
    }

    // A custom list has no roles, so Balanced team is switched off for it.
    const category =
      room.customItems !== null
        ? { items: room.customItems, roles: [] }
        : await this.deps.loadCategory(room.settings.categorySlug);
    if (category === null || category.items.length === 0) {
      return { ok: false, error: "That category has no items" };
    }
    // Something else may have started the game while we were loading items.
    if (room.game !== null) {
      return { ok: false, error: "The game has already started" };
    }

    room.players = room.players.filter((player) => player.isConnected);
    // Chat is for the lobby; nobody needs it during the game.
    room.chat = [];
    room.game = createGame({
      mode: "online",
      settings: settingsForGame(room),
      players: seated,
      items: category.items,
      roles: category.roles,
      now: this.deps.now(),
    });
    this.broadcastRoom(room);
    this.afterChange(room, 0);
    return { ok: true };
  }

  // Same room, same (connected) players, same settings, new shuffle.
  // If the new game can't start, the old results stay on screen.
  async rematch(room: Room): Promise<RunnerResult> {
    const oldGame = room.game;
    if (oldGame === null || oldGame.phase !== "finished") {
      return { ok: false, error: "You can only rematch after the game ends" };
    }
    const oldResults = room.results;
    const oldResultSaved = room.resultSaved;
    const oldPlayers = room.players;
    const oldSpectators = room.spectators;
    // People who watched this game get a seat in the next one.
    room.players = [...room.players];
    seatSpectators(room);
    room.game = null;
    room.results = null;
    room.resultSaved = false;
    const result = await this.startGame(room);
    if (!result.ok) {
      room.game = oldGame;
      room.players = oldPlayers;
      room.spectators = oldSpectators;
      room.results = oldResults;
      room.resultSaved = oldResultSaved;
    }
    return result;
  }

  handleAction(room: Room, playerId: string, payload: TurnActionPayload): RunnerResult {
    const game = room.game;
    if (game === null) {
      return { ok: false, error: "The game hasn't started" };
    }
    // A click from an earlier round (e.g. a slow network) must not act on the new item.
    if (payload.roundNumber !== game.roundNumber) {
      return { ok: false, error: "That item is gone. Too slow!" };
    }
    const result = applyAction(game, toPlayerAction(payload, playerId), this.deps.now());
    if (!result.ok) {
      return result;
    }
    room.game = result.state;
    this.afterChange(room, game.roundNumber);
    return { ok: true };
  }

  // Peek power-up: the item goes back to this player only (in the socket ack).
  // Everyone else just gets a state where the peek is marked as used.
  handlePeek(room: Room, playerId: string, roundNumber: number): { ok: true; item: PublicItem } | { ok: false; error: string } {
    const game = room.game;
    if (game === null) {
      return { ok: false, error: "The game hasn't started" };
    }
    if (roundNumber !== game.roundNumber) {
      return { ok: false, error: "That item is gone. Too slow!" };
    }
    const result = peekNextItem(game, playerId);
    if (!result.ok) {
      return result;
    }
    room.game = result.state;
    this.afterChange(room, game.roundNumber);
    // Still drafting, so a mystery item's rating stays hidden even from the peeker.
    return { ok: true, item: toPublicItem(result.nextItem, true) };
  }

  handleVote(room: Room, voterId: string, targetId: string): RunnerResult {
    if (room.game === null) {
      return { ok: false, error: "The game hasn't started" };
    }
    const result = castVote(room.game, voterId, targetId, this.deps.now());
    if (!result.ok) {
      return result;
    }
    const previousRound = room.game.roundNumber;
    room.game = result.state;
    this.afterChange(room, previousRound);
    return { ok: true };
  }

  clearTimers(code: string): void {
    const timers = this.timers.get(code);
    if (timers) {
      if (timers.turn) clearTimeout(timers.turn);
      if (timers.vote) clearTimeout(timers.vote);
    }
    this.timers.delete(code);
  }

  clearAllTimers(): void {
    for (const code of [...this.timers.keys()]) {
      this.clearTimers(code);
    }
  }

  // Called after every change to a room's game: tells clients and resets timers.
  private afterChange(room: Room, previousRound: number): void {
    const game = room.game;
    if (game === null) {
      return;
    }

    if (game.phase === "finished") {
      this.finish(room, game);
      return;
    }

    const publicState = toPublicState(game);
    // Send the public copy of the item, never game.currentItem: a mystery item's rating must stay hidden.
    if (publicState.currentItem !== null && game.roundNumber !== previousRound) {
      this.io.to(room.code).emit("item:reveal", { item: publicState.currentItem, state: publicState });
    } else {
      this.io.to(room.code).emit("game:state", publicState);
    }
    this.scheduleTimers(room);
  }

  private finish(room: Room, game: GameState): void {
    this.clearTimers(room.code);
    const results = computeResults(game);
    room.results = results;
    this.io.to(room.code).emit("game:end", { state: toPublicState(game), results });

    // Save once, even if something calls finish twice.
    if (!room.resultSaved) {
      room.resultSaved = true;
      this.deps.saveResult(game, results, room.code).catch((error: unknown) => {
        // The players already saw their results; a failed save only affects the leaderboard.
        console.error(`Could not save result for room ${room.code}:`, error);
      });
    }
  }

  private scheduleTimers(room: Room): void {
    this.clearTimers(room.code);
    const game = room.game;
    if (game === null) {
      return;
    }
    const timers: RoomTimers = { turn: null, vote: null };
    const now = this.deps.now();

    if (game.phase === "drafting" && game.turnDeadline !== null) {
      const deadline = game.turnDeadline;
      const playerId = getCurrentPlayerId(game);
      timers.turn = setTimeout(() => this.onTurnTimeout(room, deadline, playerId), Math.max(0, deadline - now));
    }
    if (game.phase === "voting" && game.voteDeadline !== null) {
      timers.vote = setTimeout(() => this.onVoteTimeout(room), Math.max(0, game.voteDeadline - now));
    }
    this.timers.set(room.code, timers);
  }

  private onTurnTimeout(room: Room, deadline: number, playerId: string | null): void {
    const game = room.game;
    // Only act if nothing happened since this timer was set.
    if (game === null || playerId === null || game.turnDeadline !== deadline) {
      return;
    }
    const result = applyAction(game, { type: "pass", playerId, auto: true }, this.deps.now());
    if (result.ok) {
      room.game = result.state;
      this.afterChange(room, game.roundNumber);
    }
  }

  private onVoteTimeout(room: Room): void {
    if (room.game === null || room.game.phase !== "voting") {
      return;
    }
    const previousRound = room.game.roundNumber;
    room.game = endVoting(room.game);
    this.afterChange(room, previousRound);
  }
}

// The socket payload says what the player wants; the player id comes from
// the socket (never the payload), so it's added here.
function toPlayerAction(payload: TurnActionPayload, playerId: string): PlayerAction {
  if (payload.action === "bid") {
    return { type: "bid", playerId, amount: payload.amount };
  }
  return { type: payload.action, playerId };
}
