import type { AvatarId } from "../game/avatars";
import type { DraftStyle, GameMode, Phase } from "./game";

// Response shapes for the REST API, shared so the client and server agree.

export interface ApiError {
  error: string;
}

export interface CreateRoomResponse {
  code: string;
}

export interface RoomInfo {
  code: string;
  categorySlug: string;
  phase: "lobby" | Phase;
  playerCount: number;
  maxPlayers: number;
  joinable: boolean; // false once the game has started or the room is full
  watchable: boolean; // the game has started and there's room to watch it
}

// A finished game as stored on the server, for "My games".
export interface SavedGamePlayer {
  playerId: string;
  name: string;
  isBot: boolean;
  avatar?: AvatarId;
  budgetLeft: number;
  team: { name: string; price: number; rating: number; tag: string; isBench: boolean }[];
  ratingTotal: number;
  leftoverBonus: number;
  total: number;
  votesReceived: number;
}

export interface SavedGame {
  id: string;
  mode: GameMode;
  categorySlug: string;
  draftStyle: DraftStyle;
  playedAt: string; // ISO date
  players: SavedGamePlayer[];
  statsWinnerIds: string[];
  voteWinnerIds: string[];
  votingHeld: boolean;
}

export interface SaveResultResponse {
  ok: true;
  id: string;
}

export interface LeaderboardEntry {
  name: string;
  wins: number;
  gamesPlayed: number;
  bestScore: number | null; // Classic games with no extras only; null if none played
}

export interface DailyResultResponse {
  total: number;
  rank: number; // 1 = best score so far today
  players: number; // how many have played this daily
}

export interface DailyLeaderboardEntry {
  name: string;
  total: number;
  beatBot: boolean;
}

export interface DailyLeaderboard {
  dateKey: string;
  number: number; // "Budget Draft #12"
  entries: DailyLeaderboardEntry[];
}
