import { Schema, model } from "mongoose";
import { AVATAR_IDS, type AvatarId, type DraftStyle, type GameMode, type RulesPreset } from "@budget-draft/shared";

// A copy of each item as it was during the game. We store a snapshot instead of
// a reference so editing or deleting an item later doesn't rewrite history.
export interface TeamItemSnapshot {
  name: string;
  price: number;
  rating: number;
  tag: string;
  isBench: boolean;
}

export interface PlayerResult {
  playerId: string;
  name: string;
  isBot: boolean;
  avatar?: AvatarId;
  budgetLeft: number;
  team: TeamItemSnapshot[];
  ratingTotal: number;
  leftoverBonus: number;
  total: number;
  votesReceived: number;
}

export interface GameResultDoc {
  mode: GameMode;
  categorySlug: string;
  roomCode?: string;
  settings: { startingBudget: number; slotCount: number };
  // Results saved before these fields existed have neither; read them as Classic.
  draftStyle?: DraftStyle;
  preset?: RulesPreset;
  players: PlayerResult[];
  statsWinnerIds: string[]; // several ids = a tie
  voteWinnerIds: string[];
  votingHeld: boolean;
  // Only online games count: local and bot games are easy to farm
  // (one person can enter every name), so they're saved but not ranked.
  countsForLeaderboard: boolean;
  playedAt: Date;
}

const teamItemSchema = new Schema<TeamItemSnapshot>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    rating: { type: Number, required: true },
    tag: { type: String, required: true },
    isBench: { type: Boolean, default: false },
  },
  { _id: false },
);

const playerResultSchema = new Schema<PlayerResult>(
  {
    playerId: { type: String, required: true },
    name: { type: String, required: true },
    isBot: { type: Boolean, required: true },
    avatar: { type: String, enum: AVATAR_IDS },
    budgetLeft: { type: Number, required: true },
    team: { type: [teamItemSchema], required: true },
    ratingTotal: { type: Number, required: true },
    leftoverBonus: { type: Number, required: true },
    total: { type: Number, required: true },
    votesReceived: { type: Number, default: 0 },
  },
  { _id: false },
);

const gameResultSchema = new Schema<GameResultDoc>({
  mode: { type: String, enum: ["local", "online", "bot"], required: true },
  categorySlug: { type: String, required: true },
  roomCode: { type: String },
  settings: {
    startingBudget: { type: Number, required: true },
    slotCount: { type: Number, required: true },
  },
  draftStyle: { type: String, enum: ["classic", "auction"], default: "classic" },
  preset: { type: String, enum: ["classic", "custom", "chaos"], default: "classic" },
  players: { type: [playerResultSchema], required: true },
  statsWinnerIds: { type: [String], default: [] },
  voteWinnerIds: { type: [String], default: [] },
  votingHeld: { type: Boolean, default: false },
  countsForLeaderboard: { type: Boolean, required: true, index: true },
  playedAt: { type: Date, default: Date.now, index: true },
});

export const GameResultModel = model<GameResultDoc>("GameResult", gameResultSchema);
