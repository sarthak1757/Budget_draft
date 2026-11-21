import type { RoomStore } from "../rooms/roomStore";
import type { GameRunner } from "./gameRunner";
import type { GameServer } from "./types";

// Tracks which sockets belong to which player. A player can briefly have two
// sockets (a refresh connects the new one before the old one times out), so
// we only mark them offline when their LAST socket goes away.
export class PlayerConnections {
  private socketsByPlayer = new Map<string, Set<string>>();

  add(playerId: string, socketId: string): void {
    let sockets = this.socketsByPlayer.get(playerId);
    if (!sockets) {
      sockets = new Set();
      this.socketsByPlayer.set(playerId, sockets);
    }
    sockets.add(socketId);
  }

  socketsOf(playerId: string): string[] {
    return [...(this.socketsByPlayer.get(playerId) ?? [])];
  }

  // Returns how many sockets the player still has open.
  remove(playerId: string, socketId: string): number {
    const sockets = this.socketsByPlayer.get(playerId);
    if (!sockets) {
      return 0;
    }
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.socketsByPlayer.delete(playerId);
      return 0;
    }
    return sockets.size;
  }
}

// Everything the socket handlers need, passed in so tests can build their own.
export interface SocketContext {
  io: GameServer;
  rooms: RoomStore;
  runner: GameRunner;
  connections: PlayerConnections;
  now: () => number;
  categoryExists: (slug: string) => Promise<boolean>;
}
