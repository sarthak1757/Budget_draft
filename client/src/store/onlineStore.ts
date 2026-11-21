import { create } from "zustand";
import type {
  AckResponse,
  AvatarId,
  GameSettings,
  Reaction,
  ReactionPayload,
  RoomSnapshot,
  TurnActionPayload,
  TurnMove,
} from "@budget-draft/shared";
import type { PeekedItem } from "../lib/peek";
import { rememberGame } from "../lib/matchHistory";
import { forgetRoom, getStoredAvatar, getStoredPlayerId, storeAvatar, storeName, storePlayerId } from "../lib/playerStorage";
import { socket } from "../lib/socket";
import { showToast } from "./toastStore";

// How long a reaction floats on screen before it's removed.
export const REACTION_SHOW_MS = 2500;

// After this long in the background (phone locked, another app), the board
// is probably out of date: cover it with "Reconnecting…" until we've caught up.
const STALE_AFTER_MS = 3000;
// How long a woken-up socket gets to answer before we assume it's dead.
const RESYNC_TIMEOUT_MS = 4000;

// True between losing the connection and getting it back, for the "Back online" toast.
let droppedConnection = false;
let hiddenAt: number | null = null;

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting";

interface OnlineStore {
  code: string | null;
  name: string;
  playerId: string | null;
  room: RoomSnapshot | null;
  connection: ConnectionStatus;
  joinError: string | null;
  actionError: string | null;
  busy: boolean;
  peeked: PeekedItem | null;
  reactions: Reaction[]; // currently floating on screen
  kicked: boolean; // the host removed this player from the lobby

  enterRoom: (code: string, name: string) => void;
  leaveRoom: () => Promise<void>;
  updateSettings: (settings: GameSettings) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  kick: (playerId: string) => Promise<void>;
  makeHost: (playerId: string) => Promise<void>;
  sendChat: (text: string) => Promise<boolean>; // true once the server accepted it
  setAvatar: (avatar: AvatarId) => Promise<void>;
  startGame: () => Promise<void>;
  rematch: () => Promise<void>;
  act: (move: TurnMove) => Promise<void>;
  peek: () => Promise<void>;
  vote: (targetPlayerId: string) => Promise<void>;
  react: (emoji: ReactionPayload["emoji"]) => void;
  clearActionError: () => void;
}

// The server owns the game. This store just mirrors the latest snapshot it
// sent and forwards the player's clicks; it never changes game state itself.
export const useOnlineStore = create<OnlineStore>()((set, get) => {
  // Joins (or re-joins) the room for the current code. Sent on every
  // (re)connect, because the server sees a reconnected socket as brand new.
  // Joining again on a live socket is harmless: the server just sends the
  // latest room, which is how a woken-up phone catches up.
  // With a timeout, it throws if the server doesn't answer in time.
  async function sendJoin(timeoutMs?: number): Promise<void> {
    const { code, name } = get();
    if (code === null) {
      return;
    }
    const playerId = getStoredPlayerId(code);
    const avatar = getStoredAvatar();
    const payload = {
      code,
      playerName: name,
      ...(playerId === undefined ? {} : { playerId }),
      ...(avatar === undefined ? {} : { avatar }),
    };
    const response =
      timeoutMs === undefined
        ? await socket.emitWithAck("room:join", payload)
        : await socket.timeout(timeoutMs).emitWithAck("room:join", payload);
    if (response.ok) {
      // Only announce it when coming back from a dropped connection, not on the first join.
      if (droppedConnection) {
        droppedConnection = false;
        showToast("Back online", "success");
      }
      storePlayerId(code, response.data.playerId);
      set({ playerId: response.data.playerId, room: response.data.room, joinError: null, connection: "connected" });
    } else {
      droppedConnection = false;
      set({ joinError: response.error, connection: "connected" });
    }
  }

  // Throws away the current connection and opens a new one right now,
  // instead of waiting out Socket.io's growing pause between retries.
  // The "connect" handler re-joins the room.
  function reconnectNow(): void {
    set({ connection: "reconnecting" });
    socket.disconnect();
    socket.connect();
  }

  // The tab is back in front. Phones freeze background tabs, so the socket
  // may have died without noticing, and the board may be minutes old.
  async function resync(stale: boolean): Promise<void> {
    if (get().code === null) {
      return;
    }
    if (!socket.connected) {
      reconnectNow();
      return;
    }
    if (stale) {
      set({ connection: "reconnecting" });
    }
    try {
      await sendJoin(RESYNC_TIMEOUT_MS);
    } catch {
      // No answer: the socket only looked connected.
      reconnectNow();
    }
  }

  // Guarded so the store can be imported where there's no page (tests).
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const awayMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      void resync(awayMs >= STALE_AFTER_MS);
    });
    // Wi-Fi or mobile data came back.
    window.addEventListener("online", () => void resync(false));
    // The browser restored the page from its back/forward cache.
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        void resync(true);
      }
    });
  }

  // Runs an action and shows its error (if any) without throwing.
  async function run(request: () => Promise<AckResponse<null>>): Promise<void> {
    set({ busy: true, actionError: null });
    try {
      const response = await request();
      if (!response.ok) {
        set({ actionError: response.error });
      }
    } catch {
      set({ actionError: "The server didn't answer. Check your connection." });
    } finally {
      set({ busy: false });
    }
  }

  socket.on("connect", () => {
    void sendJoin();
  });
  socket.on("disconnect", (reason) => {
    // "io client disconnect" means we closed it ourselves (Leave, or reconnectNow).
    // The room page covers the board with "Reconnecting…" while this lasts.
    if (get().code !== null && reason !== "io client disconnect") {
      droppedConnection = true;
      set({ connection: "reconnecting" });
    }
  });
  // The very first connection failed (server down, wrong URL): say so instead of spinning forever.
  // Socket.io keeps retrying in the background, and "connect" will join once it works.
  socket.on("connect_error", () => {
    if (get().connection === "connecting") {
      set({ joinError: "Can't reach the game server. Check your connection and try again." });
    }
  });
  socket.on("room:update", (room) => {
    // The finished game was saved: list it under "My games" (players only).
    const me = get().playerId;
    if (room.resultId !== null && room.game !== null && room.game.players.some((player) => player.id === me)) {
      rememberGame({ resultId: room.resultId, playerId: me });
    }
    // A new game (start or rematch) begins at round 1 again, so a Peek from
    // the last game could match a round number. Forget it.
    const oldGame = get().room?.game ?? null;
    const newGameStarted = room.game !== null && (oldGame === null || oldGame.phase === "finished");
    if (newGameStarted && room.game?.phase === "drafting") {
      set({ room, peeked: null });
    } else {
      set({ room });
    }
  });
  // The host removed us. The stored id stays, so the server keeps refusing it.
  socket.on("room:kicked", ({ code }) => {
    if (get().code === code) {
      set({ kicked: true, room: null, reactions: [] });
    }
  });
  socket.on("game:state", (game) => {
    const room = get().room;
    if (room) set({ room: { ...room, game } });
  });
  socket.on("item:reveal", ({ state }) => {
    const room = get().room;
    if (room) set({ room: { ...room, game: state } });
  });
  socket.on("reaction", (reaction) => {
    set({ reactions: [...get().reactions, reaction] });
    setTimeout(() => {
      set({ reactions: get().reactions.filter((shown) => shown.id !== reaction.id) });
    }, REACTION_SHOW_MS);
  });
  socket.on("game:end", ({ state, results }) => {
    const room = get().room;
    if (room) set({ room: { ...room, game: state, results } });
  });

  return {
    code: null,
    name: "",
    playerId: null,
    room: null,
    connection: "idle",
    joinError: null,
    actionError: null,
    busy: false,
    peeked: null,
    reactions: [],
    kicked: false,

    enterRoom: (code, name) => {
      const upper = code.toUpperCase();
      storeName(name);
      set({ code: upper, name, room: null, joinError: null, actionError: null, kicked: false, connection: "connecting" });
      if (socket.connected) {
        void sendJoin();
      } else {
        socket.connect(); // "connect" handler sends the join
      }
    },

    leaveRoom: async () => {
      const code = get().code;
      if (socket.connected) {
        await socket.emitWithAck("room:leave").catch(() => undefined);
      }
      if (code !== null) {
        forgetRoom(code);
      }
      socket.disconnect();
      droppedConnection = false;
      set({ code: null, playerId: null, room: null, connection: "idle", joinError: null, reactions: [], kicked: false });
    },

    updateSettings: (settings) => run(() => socket.emitWithAck("room:settings", settings)),
    setReady: (ready) => run(() => socket.emitWithAck("room:ready", { ready })),
    kick: (playerId) => run(() => socket.emitWithAck("room:kick", { playerId })),
    makeHost: (playerId) => run(() => socket.emitWithAck("room:makeHost", { playerId })),
    setAvatar: (avatar) => {
      storeAvatar(avatar);
      return run(() => socket.emitWithAck("room:avatar", { avatar }));
    },
    sendChat: async (text) => {
      set({ actionError: null });
      try {
        const response = await socket.emitWithAck("chat:send", { text });
        if (!response.ok) {
          set({ actionError: response.error });
        }
        return response.ok;
      } catch {
        set({ actionError: "The server didn't answer. Check your connection." });
        return false;
      }
    },
    startGame: () => run(() => socket.emitWithAck("game:start")),
    rematch: () => run(() => socket.emitWithAck("game:rematch")),
    act: (move) => {
      const roundNumber = get().room?.game?.roundNumber ?? 0;
      let payload: TurnActionPayload;
      if (move.type === "bid") {
        payload = { action: "bid", amount: move.amount, roundNumber };
      } else {
        payload = { action: move.type, roundNumber };
      }
      return run(() => socket.emitWithAck("turn:action", payload));
    },
    peek: async () => {
      const { room, playerId } = get();
      const roundNumber = room?.game?.roundNumber ?? 0;
      if (playerId === null) {
        return;
      }
      set({ busy: true, actionError: null });
      try {
        const response = await socket.emitWithAck("turn:peek", { roundNumber });
        if (response.ok) {
          set({ peeked: { item: response.data.item, playerId, roundNumber } });
        } else {
          set({ actionError: response.error });
        }
      } catch {
        set({ actionError: "The server didn't answer. Check your connection." });
      } finally {
        set({ busy: false });
      }
    },
    vote: (targetPlayerId) => run(() => socket.emitWithAck("vote:cast", { targetPlayerId })),
    // Fire and forget: a reaction refused by the rate limit isn't worth an error message.
    react: (emoji) => {
      socket.emit("reaction:send", { emoji }, () => undefined);
    },
    clearActionError: () => set({ actionError: null }),
  };
});
