import type { GameSettings } from "../types/game";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
// People watching an online game that started before they arrived.
export const MAX_SPECTATORS = 8;
export const MIN_SLOTS = 3;
export const MAX_SLOTS = 7;
export const MIN_PRICE = 1;
export const MAX_PRICE = 10;

// Online timers. The host picks one preset of each in the lobby. There is no
// "off" online: one idle player would freeze the game for everyone.
export const TURN_SECONDS_OPTIONS = [10, 15, 20, 30, 45, 60] as const; // Classic: one BUY/PASS
// Auction turns are shorter: a bid is a quick tap, and there are more turns per item.
export const BID_SECONDS_OPTIONS = [5, 7, 10, 15, 20] as const;
export const VOTE_SECONDS_OPTIONS = [15, 30, 60] as const;
export const ONLINE_TURN_SECONDS = 15;
export const ONLINE_BID_SECONDS = 7;
export const ONLINE_VOTE_SECONDS = 30;

// Voting with 2 players is pointless (each would just vote for the other),
// so we only hold a vote with at least this many humans.
export const MIN_HUMANS_FOR_VOTE = 3;

export const BENCH_RATING = 10;
export const LEFTOVER_POINTS_PER_DOLLAR = 1;
// Worth about one decent pick: enough to change a close game, not enough
// to make a weak team win.
export const BALANCED_TEAM_BONUS = 15;

// Mystery items: the chance that any one item hides its rating.
export const MYSTERY_CHANCE = 1 / 6;

// Discount power-up: dollars off the listed price (never below $1).
export const DISCOUNT_AMOUNT = 2;

export const DEFAULT_SETTINGS: GameSettings = {
  startingBudget: 20,
  slotCount: 5,
  turnSeconds: 0,
  bidSeconds: 0,
  voteSeconds: 0,
  categorySlug: "football",
  draftStyle: "classic",
  balancedTeam: false,
  mysteryItems: false,
  powerUps: false,
  botDifficulty: "easy",
};

// Custom categories: a list the host pastes when creating an online room.
// Used for that room only and never saved.
export const CUSTOM_CATEGORY_SLUG = "custom";
export const CUSTOM_MIN_ITEMS = 20;
export const CUSTOM_MAX_ITEMS = 150;

// Emoji reactions in online rooms: a fixed set (no free text to moderate),
// at most one per player per second.
export const REACTION_EMOJIS = ["👏", "😂", "😱", "🔥", "💸"] as const;
export const REACTION_COOLDOWN_MS = 1000;
