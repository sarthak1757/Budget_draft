import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import {
  getCurrentPlayerId,
  type ClientToServerEvents,
  type GameSettings,
  type PublicGameState,
  type ServerToClientEvents,
} from "@budget-draft/shared";
import { RoomStore } from "../rooms/roomStore";
import { loadAllSeedFiles } from "../seed/loadSeedFiles";
import { seedDatabase } from "../seed/seedDatabase";
import { createGameServer, type RunningGameServer } from "../server";
import { startMemoryMongo } from "./memoryMongo";

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

// A real server on a random port with a seeded in-memory MongoDB and short timers.
export class SocketTestHarness {
  server!: RunningGameServer;
  url = "";
  private stopMongo: () => Promise<void> = async () => undefined;
  private clients: Client[] = [];

  async start(): Promise<void> {
    this.stopMongo = await startMemoryMongo();
    await seedDatabase(loadAllSeedFiles());
    this.server = createGameServer({
      clientUrl: "http://localhost:5173",
      adminPassword: "test-admin-password",
      rooms: new RoomStore({ turnSeconds: 1, bidSeconds: 1, voteSeconds: 1 }),
    });
    await new Promise<void>((resolve) => this.server.httpServer.listen(0, resolve));
    const { port } = this.server.httpServer.address() as AddressInfo;
    this.url = `http://localhost:${port}`;
  }

  async stop(): Promise<void> {
    this.disconnectAll();
    await this.server.close();
    await this.stopMongo();
  }

  disconnectAll(): void {
    for (const client of this.clients.splice(0)) {
      client.disconnect();
    }
  }

  async newClient(): Promise<Client> {
    const client: Client = connect(this.url, { transports: ["websocket"], forceNew: true, reconnection: false });
    this.clients.push(client);
    await new Promise<void>((resolve) => client.on("connect", () => resolve()));
    return client;
  }

  async createRoom(categorySlug = "football"): Promise<string> {
    const res = await fetch(`${this.url}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug }),
    });
    const body = (await res.json()) as { code: string };
    return body.code;
  }

  // Creates a room, joins every name, sets the slot count (and any other
  // settings) and starts the game.
  async startGame(names: string[], slotCount = 3, overrides: Partial<GameSettings> = {}) {
    const code = await this.createRoom();
    const clients = new Map<string, Client>();
    const ids: string[] = [];
    let settings = null;
    for (const name of names) {
      const client = await this.newClient();
      const joined = await join(client, code, name);
      clients.set(joined.playerId, client);
      ids.push(joined.playerId);
      settings ??= joined.room.settings;
    }
    const host = clients.get(ids[0] ?? "");
    if (!host || !settings) throw new Error("No host");
    const ok = await host.emitWithAck("room:settings", { ...settings, ...overrides, slotCount });
    if (!ok.ok) throw new Error(ok.error);
    await readyAll([...clients.values()]);
    const firstReveal = waitForState(host, (state) => state.roundNumber === 1);
    const started = await host.emitWithAck("game:start");
    if (!started.ok) throw new Error(started.error);
    return { code, clients, ids, host, state: await firstReveal };
  }
}

// Everyone taps Ready (needed before the host can start).
export async function readyAll(clients: Client[]): Promise<void> {
  for (const client of clients) {
    const res = await client.emitWithAck("room:ready", { ready: true });
    if (!res.ok) throw new Error(res.error);
  }
}

export async function join(client: Client, code: string, playerName: string, playerId?: string) {
  const payload = playerId === undefined ? { code, playerName } : { code, playerName, playerId };
  const res = await client.emitWithAck("room:join", payload);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

// Resolves with the next state a client receives that matches `check`.
export function waitForState(client: Client, check: (state: PublicGameState) => boolean, timeoutMs = 5000) {
  return new Promise<PublicGameState>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for state"));
    }, timeoutMs);
    const onState = (state: PublicGameState) => {
      if (check(state)) {
        clearTimeout(timer);
        cleanup();
        resolve(state);
      }
    };
    const onReveal = (payload: { state: PublicGameState }) => onState(payload.state);
    const onEnd = (payload: { state: PublicGameState }) => onState(payload.state);
    function cleanup() {
      client.off("game:state", onState);
      client.off("item:reveal", onReveal);
      client.off("game:end", onEnd);
    }
    client.on("game:state", onState);
    client.on("item:reveal", onReveal);
    client.on("game:end", onEnd);
  });
}

// Has whoever's turn it is BUY until the draft is over. Returns the last state.
export async function buyUntilDraftEnds(
  clients: Map<string, Client>,
  watcher: Client,
  firstState: PublicGameState,
): Promise<PublicGameState> {
  let state = firstState;
  while (state.phase === "drafting") {
    const currentId = getCurrentPlayerId(state);
    const client = currentId === null ? undefined : clients.get(currentId);
    if (!client) throw new Error("No current player");
    const round = state.roundNumber;
    const next = waitForState(watcher, (s) => s.roundNumber > round || s.phase !== "drafting");
    const res = await client.emitWithAck("turn:action", { action: "buy", roundNumber: round });
    if (!res.ok) throw new Error(res.error);
    state = await next;
  }
  return state;
}
