import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Express } from "express";
import { createApp } from "./app";
import { RoomStore } from "./rooms/roomStore";
import { categoryExists, loadCategoryForGame } from "./services/catalog";
import { saveGameResult } from "./services/gameResults";
import { PlayerConnections, type SocketContext } from "./sockets/context";
import { registerGameHandlers } from "./sockets/gameHandlers";
import { GameRunner } from "./sockets/gameRunner";
import { registerRoomHandlers } from "./sockets/roomHandlers";
import type { GameServer } from "./sockets/types";
import { limitSocketsPerIp, type SecurityLimits } from "./security";

const CLEANUP_INTERVAL_MS = 60 * 1000;

export interface GameServerOptions {
  clientUrl: string;
  adminPassword: string;
  rooms?: RoomStore;
  clientDistDir?: string; // production: serve the built React app too
  limits?: SecurityLimits; // REST and socket limits (index.ts passes PRODUCTION_LIMITS)
  behindProxy?: boolean; // Render: the visitor's IP is in X-Forwarded-For
}

export interface RunningGameServer {
  app: Express;
  httpServer: HttpServer;
  io: GameServer;
  rooms: RoomStore;
  close: () => Promise<void>;
}

// Wires Express and Socket.io onto one HTTP server. Used by index.ts and the tests.
export function createGameServer(options: GameServerOptions): RunningGameServer {
  const rooms = options.rooms ?? new RoomStore();
  const app = createApp({
    clientUrl: options.clientUrl,
    adminPassword: options.adminPassword,
    rooms,
    clientDistDir: options.clientDistDir,
    limits: options.limits,
    behindProxy: options.behindProxy,
  });
  const httpServer = createServer(app);
  // Same CORS rule as the API. In production the pages come from this server,
  // so the socket connection is same-origin and CORS doesn't come into play.
  const io: GameServer = new Server(httpServer, {
    cors: { origin: options.clientUrl },
  });

  if (options.limits !== undefined) {
    limitSocketsPerIp(io, options.limits.socketsPerIp, options.behindProxy === true);
  }

  const runner = new GameRunner(io, {
    loadCategory: loadCategoryForGame,
    saveResult: saveGameResult,
    now: () => Date.now(),
  });
  const ctx: SocketContext = {
    io,
    rooms,
    runner,
    connections: new PlayerConnections(),
    now: () => Date.now(),
    categoryExists,
  };

  io.on("connection", (socket) => {
    registerRoomHandlers(socket, ctx);
    registerGameHandlers(socket, ctx);
  });

  // Rooms nobody has been connected to for 10 minutes are deleted.
  const cleanup = setInterval(() => {
    const removed = rooms.removeAbandoned(Date.now());
    for (const code of removed) {
      runner.clearTimers(code);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanup.unref(); // don't keep the process alive just for this

  async function close(): Promise<void> {
    clearInterval(cleanup);
    runner.clearAllTimers();
    await io.close(); // also closes the HTTP server
  }

  return { app, httpServer, io, rooms, close };
}
