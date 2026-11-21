import {
  CUSTOM_CATEGORY_SLUG,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MAX_SPECTATORS,
  ONLINE_BID_SECONDS,
  ONLINE_TURN_SECONDS,
  ONLINE_VOTE_SECONDS,
  REACTION_COOLDOWN_MS,
  setPlayerConnected,
  toPublicState,
  type GameResults,
  type GameSettings,
  type GameState,
  type Item,
  type LobbyPlayer,
  type OnlineTimers,
  type RoomInfo,
  type RoomSnapshot,
  type Spectator,
} from "@budget-draft/shared";

// One online room. Lives only in server memory (see README: lost on restart).
// The functions below change the room they're given; the socket handlers
// call them and then broadcast the new snapshot.

export interface RoomPlayer {
  id: string;
  name: string;
  isConnected: boolean;
  isReady: boolean; // lobby ready check
}

export interface Room {
  code: string;
  hostId: string | null;
  players: RoomPlayer[]; // in join order
  spectators: Spectator[]; // joined mid-game; seated on Rematch
  settings: GameSettings; // includes the host's timers (presets only, checked on the way in)
  // Players the host removed. Their stored id can't get back in.
  kickedIds: Set<string>;
  // Tests only: play every game with these short timers instead of the host's.
  timerOverride: OnlineTimers | null;
  // The host's own list (custom category), or null for a normal category.
  // Kept for this room only, never saved.
  customItems: Item[] | null;
  game: GameState | null; // null while in the lobby
  results: GameResults | null;
  resultSaved: boolean;
  lastReactionAt: Record<string, number>; // playerId -> when they last sent an emoji
  createdAt: number;
  emptySince: number | null; // when the last connected player left; used for cleanup
}

export function createRoom(
  code: string,
  categorySlug: string,
  now: number,
  timerOverride: OnlineTimers | null = null,
  customItems: Item[] | null = null,
): Room {
  return {
    code,
    hostId: null, // the first player to join becomes host
    players: [],
    spectators: [],
    settings: {
      ...DEFAULT_SETTINGS,
      categorySlug,
      turnSeconds: ONLINE_TURN_SECONDS,
      bidSeconds: ONLINE_BID_SECONDS,
      voteSeconds: ONLINE_VOTE_SECONDS,
    },
    timerOverride,
    kickedIds: new Set(),
    customItems,
    game: null,
    results: null,
    resultSaved: false,
    lastReactionAt: {},
    createdAt: now,
    emptySince: now, // nobody is connected yet
  };
}

// Stores the host's settings. The timers come separately, already checked
// against the presets, so whatever timer numbers the settings carried are ignored.
export function applyRoomSettings(room: Room, settings: GameSettings, timers: OnlineTimers): void {
  room.settings = {
    ...settings,
    // A custom room always plays its own list.
    categorySlug: room.customItems === null ? settings.categorySlug : CUSTOM_CATEGORY_SLUG,
    turnSeconds: timers.turnSeconds,
    bidSeconds: timers.bidSeconds,
    voteSeconds: timers.voteSeconds,
  };
  // New rules: everyone has to look again and say they're ready.
  resetReady(room);
}

// The settings a new game (or rematch) starts with.
export function settingsForGame(room: Room): GameSettings {
  if (room.timerOverride === null) {
    return room.settings;
  }
  return { ...room.settings, ...room.timerOverride };
}

// Ready check. Everyone has to tap Ready again after anything changes.
export function resetReady(room: Room): void {
  for (const player of room.players) {
    player.isReady = false;
  }
}

// True when every connected player is ready. (Players who dropped out of
// the lobby don't get a seat, so they don't hold the game up.)
export function everyoneReady(room: Room): boolean {
  for (const player of room.players) {
    if (player.isConnected && !player.isReady) {
      return false;
    }
  }
  return true;
}

export function findRoomPlayer(room: Room, playerId: string): RoomPlayer | undefined {
  for (const player of room.players) {
    if (player.id === playerId) {
      return player;
    }
  }
  return undefined;
}

// ---- Spectators ----

export function findSpectator(room: Room, id: string): Spectator | undefined {
  for (const spectator of room.spectators) {
    if (spectator.id === id) {
      return spectator;
    }
  }
  return undefined;
}

function nameTaken(room: Room, name: string): string | null {
  const lower = name.toLowerCase();
  for (const person of [...room.players, ...room.spectators]) {
    if (person.name.toLowerCase() === lower) {
      return person.name;
    }
  }
  return null;
}

// Someone arriving after the game started. Returns an error message, or null.
export function addSpectator(room: Room, spectator: { id: string; name: string }): string | null {
  if (room.spectators.length >= MAX_SPECTATORS) {
    return "This room is full";
  }
  const taken = nameTaken(room, spectator.name);
  if (taken !== null) {
    return `Someone called "${taken}" is already here. Pick another name.`;
  }
  room.spectators.push({ id: spectator.id, name: spectator.name, isConnected: true });
  return null;
}

export function setSpectatorConnected(room: Room, id: string, isConnected: boolean): void {
  const spectator = findSpectator(room, id);
  if (spectator) {
    spectator.isConnected = isConnected;
  }
}

export function removeSpectator(room: Room, id: string): void {
  room.spectators = room.spectators.filter((spectator) => spectator.id !== id);
}

// Before a rematch: connected spectators take the free seats, in the order
// they arrived. Whoever doesn't fit keeps watching.
export function seatSpectators(room: Room): void {
  let seats = MAX_PLAYERS - countConnected(room);
  const stillWatching: Spectator[] = [];
  for (const spectator of room.spectators) {
    if (spectator.isConnected && seats > 0) {
      room.players.push({ id: spectator.id, name: spectator.name, isConnected: true, isReady: false });
      seats -= 1;
    } else if (spectator.isConnected) {
      stillWatching.push(spectator);
    }
  }
  room.spectators = stillWatching;
}

export function countConnected(room: Room): number {
  let connected = 0;
  for (const player of room.players) {
    if (player.isConnected) {
      connected += 1;
    }
  }
  return connected;
}

export function roomPhase(room: Room): RoomInfo["phase"] {
  if (room.game === null) {
    return "lobby";
  }
  return room.game.phase;
}

// Adds a brand-new player in the lobby. Returns an error message, or null on success.
export function addPlayer(room: Room, player: { id: string; name: string }, now: number): string | null {
  if (room.game !== null) {
    return "This game has already started";
  }
  if (room.players.length >= MAX_PLAYERS) {
    return "This room is full";
  }
  const taken = nameTaken(room, player.name);
  if (taken !== null) {
    return `Someone called "${taken}" is already here. Pick another name.`;
  }
  room.players.push({ id: player.id, name: player.name, isConnected: true, isReady: false });
  // Someone new: everyone checks the room again before starting.
  resetReady(room);
  markConnectedChange(room, now);
  if (room.hostId === null) {
    room.hostId = player.id;
  }
  return null;
}

export function markPlayerConnected(room: Room, playerId: string, isConnected: boolean, now: number): void {
  const player = findRoomPlayer(room, playerId);
  if (!player) {
    return;
  }
  player.isConnected = isConnected;
  if (room.game !== null) {
    room.game = setPlayerConnected(room.game, playerId, isConnected);
  }
  markConnectedChange(room, now);
  passHostIfNeeded(room);
}

// Lobby only: the player leaves for good. (Mid-game we just mark them offline,
// because their team is part of the game.)
export function removePlayer(room: Room, playerId: string, now: number): void {
  const remaining: RoomPlayer[] = [];
  for (const player of room.players) {
    if (player.id !== playerId) {
      remaining.push(player);
    }
  }
  room.players = remaining;
  markConnectedChange(room, now);
  passHostIfNeeded(room);
}

// In the lobby (and on the results screen) the host must be someone who is
// actually here, otherwise nobody could press Start or Rematch. Mid-game the
// server runs everything, so the host doesn't matter and we leave it alone.
export function passHostIfNeeded(room: Room): void {
  if (room.game !== null && room.game.phase !== "finished") {
    return;
  }
  const host = room.hostId === null ? undefined : findRoomPlayer(room, room.hostId);
  if (host && host.isConnected) {
    return;
  }

  // Look for the next connected player after the old host, wrapping around.
  let startIndex = 0;
  if (host) {
    startIndex = room.players.indexOf(host) + 1;
  }
  for (let offset = 0; offset < room.players.length; offset++) {
    const candidate = room.players[(startIndex + offset) % room.players.length];
    if (candidate && candidate.isConnected) {
      room.hostId = candidate.id;
      return;
    }
  }
  // Nobody is connected: no host until someone comes back.
  room.hostId = null;
}

function markConnectedChange(room: Room, now: number): void {
  if (countConnected(room) === 0) {
    if (room.emptySince === null) {
      room.emptySince = now;
    }
  } else {
    room.emptySince = null;
  }
}

export function toRoomSnapshot(room: Room): RoomSnapshot {
  const players: LobbyPlayer[] = [];
  for (const player of room.players) {
    players.push({
      id: player.id,
      name: player.name,
      isConnected: player.isConnected,
      isHost: player.id === room.hostId,
      isReady: player.isReady,
    });
  }
  return {
    code: room.code,
    hostId: room.hostId,
    players,
    spectators: room.spectators.map((spectator) => ({ ...spectator })),
    settings: room.settings,
    // Always strip the pool. The RoomSnapshot type wouldn't accept the full state anyway.
    game: room.game === null ? null : toPublicState(room.game),
    results: room.results,
    customItemCount: room.customItems === null ? null : room.customItems.length,
  };
}

export function toRoomInfo(room: Room): RoomInfo {
  return {
    code: room.code,
    categorySlug: room.settings.categorySlug,
    phase: roomPhase(room),
    playerCount: room.players.length,
    maxPlayers: MAX_PLAYERS,
    joinable: room.game === null && room.players.length < MAX_PLAYERS,
    watchable: room.game !== null && room.spectators.length < MAX_SPECTATORS,
  };
}

// Emoji reactions: one per player per second, so nobody can flood the screen.
// Returns an error message, or null if the reaction may be sent (and records it).
export function recordReaction(room: Room, playerId: string, now: number): string | null {
  if (!findRoomPlayer(room, playerId)) {
    return "You're not in this room";
  }
  const last = room.lastReactionAt[playerId];
  if (last !== undefined && now - last < REACTION_COOLDOWN_MS) {
    return "Slow down! One reaction per second.";
  }
  room.lastReactionAt[playerId] = now;
  return null;
}
