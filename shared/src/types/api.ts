import type { Phase } from "./game";

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
