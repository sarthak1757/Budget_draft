import { randomUUID } from "node:crypto";
import { gameSettingsSchema, onlineTimersSchema, roomJoinSchema, roomReadySchema, type RoomSnapshot } from "@budget-draft/shared";
import {
  addPlayer,
  applyRoomSettings,
  findRoomPlayer,
  markPlayerConnected,
  removePlayer,
  toRoomSnapshot,
} from "../rooms/room";
import type { SocketContext } from "./context";
import { safeAck, type GameSocket } from "./types";

export function registerRoomHandlers(socket: GameSocket, ctx: SocketContext): void {
  socket.on("room:join", (payload, ack) => {
    const reply = safeAck<{ playerId: string; room: RoomSnapshot }>(ack);
    const parsed = roomJoinSchema.safeParse(payload);
    if (!parsed.success) {
      reply({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid join request" });
      return;
    }
    const { code, playerName, playerId } = parsed.data;
    const room = ctx.rooms.get(code);
    if (!room) {
      reply({ ok: false, error: "No room with that code. It may have expired." });
      return;
    }

    // Joining a different room means leaving the current one first.
    if (socket.data.roomCode !== undefined && socket.data.roomCode !== room.code) {
      leaveCurrentRoom(socket, ctx);
    }

    let joinedId: string;
    const returning = playerId === undefined ? undefined : findRoomPlayer(room, playerId);
    if (returning) {
      // Reconnect: same seat, same team. The stored id is the only "login" we have.
      joinedId = returning.id;
      markPlayerConnected(room, joinedId, true, ctx.now());
    } else {
      joinedId = randomUUID();
      const error = addPlayer(room, { id: joinedId, name: playerName }, ctx.now());
      if (error !== null) {
        reply({ ok: false, error });
        return;
      }
    }

    socket.data.roomCode = room.code;
    socket.data.playerId = joinedId;
    ctx.connections.add(joinedId, socket.id);
    void socket.join(room.code);

    reply({ ok: true, data: { playerId: joinedId, room: toRoomSnapshot(room) } });
    ctx.runner.broadcastRoom(room);
  });

  socket.on("room:leave", (ack) => {
    leaveCurrentRoom(socket, ctx);
    safeAck<null>(ack)({ ok: true, data: null });
  });

  socket.on("room:settings", async (payload, ack) => {
    const reply = safeAck<null>(ack);
    const room = socket.data.roomCode === undefined ? undefined : ctx.rooms.get(socket.data.roomCode);
    if (!room) {
      reply({ ok: false, error: "You're not in a room" });
      return;
    }
    if (room.hostId !== socket.data.playerId) {
      reply({ ok: false, error: "Only the host can change settings" });
      return;
    }
    if (room.game !== null) {
      reply({ ok: false, error: "Settings are locked once the game starts" });
      return;
    }
    const parsed = gameSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      reply({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" });
      return;
    }
    // Online timers must be one of the lobby's presets (no "off", no odd numbers).
    const timers = onlineTimersSchema.safeParse(payload);
    if (!timers.success) {
      reply({ ok: false, error: timers.error.issues[0]?.message ?? "Invalid timer" });
      return;
    }
    // A custom room ignores the category (applyRoomSettings keeps it "custom").
    if (room.customItems === null && !(await ctx.categoryExists(parsed.data.categorySlug))) {
      reply({ ok: false, error: "That category doesn't exist" });
      return;
    }
    applyRoomSettings(room, parsed.data, timers.data);
    reply({ ok: true, data: null });
    ctx.runner.broadcastRoom(room);
  });

  socket.on("room:ready", (payload, ack) => {
    const reply = safeAck<null>(ack);
    const parsed = roomReadySchema.safeParse(payload);
    if (!parsed.success) {
      reply({ ok: false, error: "Invalid ready message" });
      return;
    }
    const room = socket.data.roomCode === undefined ? undefined : ctx.rooms.get(socket.data.roomCode);
    const player = room && socket.data.playerId !== undefined ? findRoomPlayer(room, socket.data.playerId) : undefined;
    if (!room || !player) {
      reply({ ok: false, error: "You're not in a room" });
      return;
    }
    if (room.game !== null) {
      reply({ ok: false, error: "The game has already started" });
      return;
    }
    player.isReady = parsed.data.ready;
    reply({ ok: true, data: null });
    ctx.runner.broadcastRoom(room);
  });

  socket.on("disconnect", () => {
    const { roomCode, playerId } = socket.data;
    if (roomCode === undefined || playerId === undefined) {
      return;
    }
    const stillOpen = ctx.connections.remove(playerId, socket.id);
    if (stillOpen > 0) {
      return; // they have another tab or a fresh connection open
    }
    const room = ctx.rooms.get(roomCode);
    if (!room) {
      return;
    }
    // Keep their seat (lobby and game) so they can reconnect with their stored id.
    markPlayerConnected(room, playerId, false, ctx.now());
    ctx.runner.broadcastRoom(room);
  });
}

// Leaving on purpose: in the lobby the seat is freed; mid-game the player
// stays in the game (their team still counts) but is marked offline.
function leaveCurrentRoom(socket: GameSocket, ctx: SocketContext): void {
  const { roomCode, playerId } = socket.data;
  socket.data.roomCode = undefined;
  socket.data.playerId = undefined;
  if (roomCode === undefined || playerId === undefined) {
    return;
  }
  void socket.leave(roomCode);
  ctx.connections.remove(playerId, socket.id);

  const room = ctx.rooms.get(roomCode);
  if (!room) {
    return;
  }
  if (room.game === null) {
    removePlayer(room, playerId, ctx.now());
  } else {
    markPlayerConnected(room, playerId, false, ctx.now());
  }
  ctx.runner.broadcastRoom(room);
}
