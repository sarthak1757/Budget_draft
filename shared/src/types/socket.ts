import type { GameResults, GameSettings, PublicGameState } from "./game";
import type { PublicItem } from "./item";
import type {
  GameSettingsPayload,
  PeekPayload,
  ReactionPayload,
  RoomReadyPayload,
  RoomTargetPayload,
  RoomJoinPayload,
  TurnActionPayload,
  VoteCastPayload,
} from "../schemas";

export interface LobbyPlayer {
  id: string;
  name: string;
  isConnected: boolean;
  isHost: boolean;
  isReady: boolean; // tapped "Ready" in the lobby
}

// Someone who joined after the game started. They watch the same public
// board as the players (no pool, no hidden ratings) and get a seat on Rematch.
export interface Spectator {
  id: string;
  name: string;
  isConnected: boolean;
}

// Everything a client needs to draw the lobby or the game.
// `game` is PublicGameState, so a full GameState (with the pool) can't be put here.
export interface RoomSnapshot {
  code: string;
  hostId: string | null; // null mid-game if the host left (the game keeps running)
  players: LobbyPlayer[];
  spectators: Spectator[];
  settings: GameSettings;
  game: PublicGameState | null;
  results: GameResults | null;
  customItemCount: number | null; // set when the host pasted their own list
}

// Every client request gets a reply through a Socket.io acknowledgement callback.
export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (response: AckResponse<T>) => void;

export interface ClientToServerEvents {
  "room:join": (payload: RoomJoinPayload, ack: Ack<{ playerId: string; room: RoomSnapshot }>) => void;
  "room:leave": (ack: Ack<null>) => void;
  "room:settings": (payload: GameSettingsPayload, ack: Ack<null>) => void;
  // Lobby only: "I'm ready" (or not any more). The host can start once everyone is.
  "room:ready": (payload: RoomReadyPayload, ack: Ack<null>) => void;
  // Host only, lobby only.
  "room:kick": (payload: RoomTargetPayload, ack: Ack<null>) => void;
  "room:makeHost": (payload: RoomTargetPayload, ack: Ack<null>) => void;
  "game:start": (ack: Ack<null>) => void;
  // Host only, after the game ended: same room and players, new shuffle.
  "game:rematch": (ack: Ack<null>) => void;
  "turn:action": (payload: TurnActionPayload, ack: Ack<null>) => void;
  // Peek power-up: the next item comes back in the ack, to this player only.
  "turn:peek": (payload: PeekPayload, ack: Ack<{ item: PublicItem }>) => void;
  "vote:cast": (payload: VoteCastPayload, ack: Ack<null>) => void;
  "reaction:send": (payload: ReactionPayload, ack: Ack<null>) => void;
}

export interface Reaction {
  id: number; // unique per server, so the client can animate each one separately
  playerId: string;
  playerName: string;
  emoji: ReactionPayload["emoji"];
}

export interface ServerToClientEvents {
  "room:update": (room: RoomSnapshot) => void;
  // Sent only to a player the host removed from the lobby.
  "room:kicked": (payload: { code: string }) => void;
  "item:reveal": (payload: { item: PublicItem; state: PublicGameState }) => void;
  "game:state": (state: PublicGameState) => void;
  "game:end": (payload: { state: PublicGameState; results: GameResults }) => void;
  "server:error": (message: string) => void;
  "reaction": (reaction: Reaction) => void;
}
