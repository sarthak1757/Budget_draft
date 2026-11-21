import type { AvatarId } from "./avatars";
import type { Item } from "../types/item";
import type { GameMode, GameSettings, GameState, PlayerState } from "../types/game";
import { applyAuctionAction } from "./auction";
import { MAX_PLAYERS, MIN_PLAYERS, MYSTERY_CHANCE } from "./constants";
import { discountedPrice, getPowerUpBlockReason } from "./powerUps";
import { getRulesPreset } from "./presets";
import { pickRequiredRoles } from "./roles";
import { findFirstEmptySlot, getBuyBlockReason } from "./rules";
import { endRound, finishGame, makeTurnDeadline, startRound } from "./rounds";
import { shuffle } from "./shuffle";

// Every function here is pure: it takes a state and returns a NEW state.
// It never touches the network, the database, timers or the input object.
// That's what lets the same code run in the browser (pass-and-play, bot)
// and on the server (online rooms), and makes it easy to test.
//
// `now` (epoch ms) is passed in rather than read from Date.now() so tests
// can control time.

export interface NewPlayer {
  id: string;
  name: string;
  isBot: boolean;
  avatar?: AvatarId;
}

export interface CreateGameInput {
  mode: GameMode;
  settings: GameSettings;
  players: NewPlayer[];
  items: Item[];
  roles?: string[]; // the category's roles, for Balanced team
  now: number;
  random?: () => number;
}

// What a player can do on their turn. "buy" is Classic only, "bid" is Auction only.
// The UI and bots produce a TurnMove; the engine also needs to know who made it.
// Veto and Discount are power-ups that act on the current item.
export type TurnMove =
  | { type: "buy" }
  | { type: "pass" }
  | { type: "bid"; amount: number }
  | { type: "veto" }
  | { type: "discount" };

export type PlayerAction =
  | { type: "buy"; playerId: string }
  | { type: "bid"; playerId: string; amount: number }
  | { type: "veto"; playerId: string }
  | { type: "discount"; playerId: string }
  // auto = true when the server passes for a player whose timer ran out
  | { type: "pass"; playerId: string; auto?: boolean };

export type EngineResult = { ok: true; state: GameState } | { ok: false; error: string };

export function createGame(input: CreateGameInput): GameState {
  const { mode, settings, players, items, now } = input;

  // These are programmer errors (the caller should validate first), so we throw.
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`A game needs ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  }
  if (settings.startingBudget < settings.slotCount) {
    throw new Error("Starting budget must be at least $1 per slot");
  }
  const seenIds = new Set<string>();
  for (const player of players) {
    if (seenIds.has(player.id)) {
      throw new Error(`Duplicate player id: ${player.id}`);
    }
    seenIds.add(player.id);
  }

  const playerStates: PlayerState[] = [];
  for (const player of players) {
    const emptyTeam: null[] = [];
    for (let i = 0; i < settings.slotCount; i++) {
      emptyTeam.push(null);
    }
    const state: PlayerState = {
      id: player.id,
      name: player.name,
      isBot: player.isBot,
      isConnected: true,
      budget: settings.startingBudget,
      team: emptyTeam,
      usedPowerUps: [],
    };
    if (player.avatar !== undefined) {
      state.avatar = player.avatar;
    }
    playerStates.push(state);
  }

  // If Balanced team can't apply (no roles, or too few slots), switch it off,
  // so the stored settings say what was really played.
  const requiredRoles = pickRequiredRoles(settings.balancedTeam, input.roles ?? [], settings.slotCount);

  const state: GameState = {
    mode,
    phase: "drafting",
    settings: { ...settings, balancedTeam: requiredRoles.length > 0 },
    players: playerStates,
    itemPool: buildItemPool(items, settings.mysteryItems, input.random ?? Math.random),
    currentItem: null,
    roundNumber: 0,
    firstPlayerIndex: 0,
    turnQueue: [],
    cantAffordIds: [],
    auction: null,
    requiredRoles,
    rulesPreset: getRulesPreset(
      settings,
      pickRequiredRoles(true, input.roles ?? [], settings.slotCount).length > 0,
    ),
    turnDeadline: null,
    votes: {},
    voteDeadline: null,
    lastEvents: [],
  };

  startRound(state, now);
  return state;
}

// Works on both GameState and PublicGameState, so the UI can use it too.
export function getCurrentPlayerId(state: Pick<GameState, "phase" | "turnQueue">): string | null {
  if (state.phase !== "drafting") {
    return null;
  }
  return state.turnQueue[0] ?? null;
}

// Handles one action from the player whose turn it is.
export function applyAction(state: GameState, action: PlayerAction, now: number): EngineResult {
  if (state.phase !== "drafting") {
    return { ok: false, error: "The draft is over" };
  }
  const item = state.currentItem;
  if (item === null) {
    return { ok: false, error: "There is no item to act on" };
  }
  if (getCurrentPlayerId(state) !== action.playerId) {
    return { ok: false, error: "It's not your turn" };
  }

  // Work on a deep copy so the caller's state is never changed.
  const next = structuredClone(state);
  next.lastEvents = [];
  const player = next.players.find((p) => p.id === action.playerId);
  if (!player) {
    return { ok: false, error: "Unknown player" };
  }

  if (action.type === "veto" || action.type === "discount") {
    const blockReason = getPowerUpBlockReason(state, action.playerId, action.type, state.itemPool.length);
    if (blockReason !== null) {
      return { ok: false, error: blockReason };
    }
    applyPowerUp(next, player, action.type, now);
    return { ok: true, state: next };
  }

  if (next.settings.draftStyle === "auction") {
    return applyAuctionAction(next, player, item, action, now);
  }

  if (action.type === "bid") {
    return { ok: false, error: "Bidding is only for auction games" };
  }

  if (action.type === "buy") {
    // Checked again here even though the turn queue only holds players who
    // could afford the item: the server must never trust that assumption blindly.
    const blockReason = getBuyBlockReason(player, item);
    if (blockReason !== null) {
      return { ok: false, error: blockReason };
    }
    const slotIndex = findFirstEmptySlot(player);
    player.team[slotIndex] = { ...item, paidPrice: item.price };
    player.budget -= item.price;
    next.lastEvents.push({ type: "bought", playerId: player.id, item, price: item.price });
    endRound(next, now);
    return { ok: true, state: next };
  }

  // PASS: this player is done with the item, move to the next one in line.
  next.turnQueue.shift();
  next.lastEvents.push({ type: "passed", playerId: player.id, item, auto: action.auto === true });

  if (next.turnQueue.length === 0) {
    next.lastEvents.push({ type: "discarded", item });
    endRound(next, now);
  } else {
    // Each player gets a full timer for their own decision.
    next.turnDeadline = makeTurnDeadline(next, now);
  }
  return { ok: true, state: next };
}

export type PeekResult = { ok: true; state: GameState; nextItem: Item } | { ok: false; error: string };

// The Peek power-up. Returns the next item in the pile to the caller only:
// the new state just records that it was used (and a "peeked" event), so
// broadcasting the state never reveals what was seen. The turn doesn't move on.
export function peekNextItem(state: GameState, playerId: string): PeekResult {
  const blockReason = getPowerUpBlockReason(state, playerId, "peek", state.itemPool.length);
  if (blockReason !== null) {
    return { ok: false, error: blockReason };
  }
  const nextItem = state.itemPool[0];
  const next = structuredClone(state);
  const player = next.players.find((p) => p.id === playerId);
  if (nextItem === undefined || !player) {
    return { ok: false, error: "There are no more items to peek at" };
  }
  player.usedPowerUps.push("peek");
  next.lastEvents = [{ type: "peeked", playerId }];
  return { ok: true, state: next, nextItem };
}

export function castVote(state: GameState, voterId: string, targetId: string, now: number): EngineResult {
  if (state.phase !== "voting") {
    return { ok: false, error: "Voting is not open" };
  }
  if (state.voteDeadline !== null && now > state.voteDeadline) {
    return { ok: false, error: "Voting has closed" };
  }
  const voter = state.players.find((p) => p.id === voterId);
  if (!voter || voter.isBot) {
    return { ok: false, error: "Only players in this game can vote" };
  }
  const target = state.players.find((p) => p.id === targetId);
  if (!target) {
    return { ok: false, error: "That player isn't in this game" };
  }
  if (voterId === targetId) {
    return { ok: false, error: "You can't vote for yourself" };
  }

  const next = structuredClone(state);
  // Changing your mind before the deadline is allowed: the latest vote counts.
  next.votes[voterId] = targetId;

  if (everyHumanHasVoted(next)) {
    finishGame(next);
  }
  return { ok: true, state: next };
}

// Called when the vote timer runs out (online only).
export function endVoting(state: GameState): GameState {
  if (state.phase !== "voting") {
    return state;
  }
  const next = structuredClone(state);
  finishGame(next);
  return next;
}

// Marks a player as connected/disconnected. The game doesn't wait for anyone:
// a disconnected player's turn timer still runs and they get auto-passed.
export function setPlayerConnected(state: GameState, playerId: string, isConnected: boolean): GameState {
  const next = structuredClone(state);
  const player = next.players.find((p) => p.id === playerId);
  if (player) {
    player.isConnected = isConnected;
  }
  return next;
}

function everyHumanHasVoted(state: GameState): boolean {
  for (const player of state.players) {
    if (!player.isBot && state.votes[player.id] === undefined) {
      return false;
    }
  }
  return true;
}

// Shuffles the items and, with Mystery items on, marks about 1 in 6 of them.
// Each item rolls on its own, so the number of mysteries varies a little per game.
function buildItemPool(items: Item[], mysteryItems: boolean, random: () => number): Item[] {
  const shuffled = shuffle(items, random);
  if (!mysteryItems) {
    return shuffled;
  }
  const pool: Item[] = [];
  for (const item of shuffled) {
    if (random() < MYSTERY_CHANCE) {
      pool.push({ ...item, isMystery: true });
    } else {
      pool.push(item);
    }
  }
  return pool;
}

// Applies Veto or Discount on the private copy made in applyAction.
// The caller has already checked getPowerUpBlockReason.
function applyPowerUp(next: GameState, player: PlayerState, powerUp: "veto" | "discount", now: number): void {
  const item = next.currentItem;
  if (item === null) {
    return;
  }
  player.usedPowerUps.push(powerUp);

  if (powerUp === "veto") {
    next.lastEvents.push({ type: "vetoed", playerId: player.id, item });
    endRound(next, now);
    return;
  }

  const price = discountedPrice(item.price);
  player.team[findFirstEmptySlot(player)] = { ...item, paidPrice: price };
  player.budget -= price;
  next.lastEvents.push({ type: "bought", playerId: player.id, item, price });
  endRound(next, now);
}
