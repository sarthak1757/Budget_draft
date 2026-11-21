import type { AvatarId } from "../game/avatars";
import type { RulesPreset } from "../game/presets";
import type { CategorySlug, Item, PublicItem } from "./item";

export type GameMode = "local" | "online" | "bot";

// Lobby is handled by the room (online) or the setup screen (local),
// so a GameState only exists once the draft has started.
export type Phase = "drafting" | "voting" | "finished";

// Classic: BUY or PASS at the listed price. Auction: players bid, highest bid wins.
export type DraftStyle = "classic" | "auction";

// How well bots play (bot mode and the Daily Challenge).
export type BotDifficulty = "easy" | "medium" | "hard";

// Once-per-game abilities (when the Power-ups extra is on).
export type PowerUp = "veto" | "discount" | "peek";

export interface GameSettings {
  startingBudget: number; // default 20
  slotCount: number; // 3–7, default 5
  turnSeconds: number; // Classic: seconds per BUY/PASS. 0 means "no timer" (used for pass-and-play)
  bidSeconds: number; // Auction: seconds per bid or pass. 0 means "no timer"
  voteSeconds: number; // 0 means "no timer": on one shared device people vote one after another
  categorySlug: CategorySlug;
  draftStyle: DraftStyle;
  // Optional extras. All off = the original game.
  balancedTeam: boolean; // +bonus for covering every role the category defines
  mysteryItems: boolean; // ~1 in 6 items hide their rating until the draft ends
  powerUps: boolean; // Veto, Discount and Peek, once each per game
  botDifficulty: BotDifficulty; // ignored when there are no bots
}

// `I` is the item type: Item on the server (and in the local engine),
// PublicItem in anything sent to or shown to players.
export interface PlayerState<I extends PublicItem = Item> {
  id: string;
  name: string;
  isBot: boolean;
  isConnected: boolean;
  avatar?: AvatarId; // missing for bots and for games saved before avatars existed
  budget: number;
  team: (I | null)[]; // always slotCount long; null = empty slot
  usedPowerUps: PowerUp[]; // each power-up can be used once per game
}

// What happened during the last action. A single action can cause several
// events (e.g. a pass that ends the round discards the item), so the
// UI gets a list and can animate each one.
export type GameEvent<I extends PublicItem = Item> =
  | { type: "bought"; playerId: string; item: I; price: number } // price = what they actually paid
  | { type: "bid"; playerId: string; item: I; amount: number }
  | { type: "passed"; playerId: string; item: I; auto: boolean }
  | { type: "discarded"; item: I }
  | { type: "vetoed"; playerId: string; item: I }
  // Everyone learns that a player peeked, but not what they saw.
  | { type: "peeked"; playerId: string };

// The live auction for the current item (auction draft style only).
export interface AuctionState {
  highBid: number; // 0 until someone bids
  highBidderId: string | null;
}

export interface GameState {
  mode: GameMode;
  phase: Phase;
  settings: GameSettings;
  players: PlayerState[];
  itemPool: Item[]; // items not revealed yet. SECRET: never send to clients.
  currentItem: Item | null;
  roundNumber: number; // goes up by 1 every time an item is revealed
  firstPlayerIndex: number; // who acts first this round; rotates each round
  turnQueue: string[]; // player ids still to decide on the current item, in order
  cantAffordIds: string[]; // players skipped this round because of the budget rule
  auction: AuctionState | null; // null in Classic
  requiredRoles: string[]; // Balanced team: roles to cover for the bonus. Empty = off.
  rulesPreset: RulesPreset; // which extras were on, worked out once at the start
  turnDeadline: number | null; // epoch ms; null when there is no timer
  votes: Record<string, string>; // voterId -> votedForId
  voteDeadline: number | null; // epoch ms
  lastEvents: GameEvent[];
}

export type PublicPlayerState = PlayerState<PublicItem>;
export type PublicGameEvent = GameEvent<PublicItem>;

// The version of GameState that is safe to send to players.
// `itemPool?: never` is the important part: without it, TypeScript would
// happily accept a full GameState here (extra properties are allowed when
// assigning objects), and the hidden pool could leak to clients.
// Items are PublicItems, so mystery ratings can be hidden.
export type PublicGameState = Omit<GameState, "itemPool" | "players" | "currentItem" | "lastEvents"> & {
  itemPool?: never;
  itemsRemaining: number;
  players: PublicPlayerState[];
  currentItem: PublicItem | null;
  lastEvents: PublicGameEvent[];
};

export interface FinalScore {
  playerId: string;
  name: string;
  ratingTotal: number;
  leftoverBonus: number;
  roleBonus: number; // Balanced team bonus, 0 if not earned or not played
  total: number;
  votesReceived: number;
}

export interface GameResults {
  scores: FinalScore[]; // sorted, best total first
  statsWinnerIds: string[]; // more than one id means a tie
  voteWinnerIds: string[]; // empty if no vote was held or nobody voted
  votingHeld: boolean;
}
