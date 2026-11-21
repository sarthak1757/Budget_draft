import { describe, expect, it } from "vitest";
import { createGame } from "@budget-draft/shared";
import { addChatMessage, addPlayer, createRoom, markPlayerConnected, recordReaction, removePlayer, toRoomInfo, toRoomSnapshot } from "../room";
import { RoomStore } from "../roomStore";

function lobbyWith(names: string[]) {
  const room = createRoom("ABCDEF", "football", 0);
  for (const name of names) {
    expect(addPlayer(room, { id: name.toLowerCase(), name }, 0)).toBeNull();
  }
  return room;
}

describe("room lobby", () => {
  it("makes the first player host", () => {
    const room = lobbyWith(["Asha", "Ben"]);
    expect(room.hostId).toBe("asha");
  });

  it("rejects duplicate names, a 5th player and joining mid-game", () => {
    const room = lobbyWith(["Asha", "Ben", "Chen", "Dev"]);
    expect(addPlayer(room, { id: "x", name: "eve" }, 0)).toBe("This room is full");
    const small = lobbyWith(["Asha"]);
    expect(addPlayer(small, { id: "x", name: "ASHA" }, 0)).toMatch(/already here/);
  });

  it("passes host to the next connected player when the host disconnects", () => {
    const room = lobbyWith(["Asha", "Ben", "Chen"]);
    markPlayerConnected(room, "ben", false, 0);
    markPlayerConnected(room, "asha", false, 0);
    expect(room.hostId).toBe("chen"); // Ben is offline, so it skips to Chen
  });

  it("passes host when the host leaves the lobby", () => {
    const room = lobbyWith(["Asha", "Ben"]);
    removePlayer(room, "asha", 0);
    expect(room.hostId).toBe("ben");
    expect(room.players.map((p) => p.id)).toEqual(["ben"]);
  });

  it("has no host when nobody is connected, and the next arrival takes it", () => {
    const room = lobbyWith(["Asha", "Ben"]);
    markPlayerConnected(room, "asha", false, 10);
    markPlayerConnected(room, "ben", false, 20);
    expect(room.hostId).toBeNull();
    expect(room.emptySince).toBe(20);
    markPlayerConnected(room, "ben", true, 30);
    expect(room.hostId).toBe("ben");
    expect(room.emptySince).toBeNull();
  });

  it("keeps the host mid-game even if they disconnect", () => {
    const room = lobbyWith(["Asha", "Ben"]);
    room.game = createGame({
      mode: "online",
      settings: room.settings,
      players: [
        { id: "asha", name: "Asha", isBot: false },
        { id: "ben", name: "Ben", isBot: false },
      ],
      items: [{ id: "i", name: "I", category: "football", price: 1, rating: 50, tag: "T" }],
      now: 0,
    });
    markPlayerConnected(room, "asha", false, 0);
    expect(room.hostId).toBe("asha");
    expect(room.game.players[0]?.isConnected).toBe(false);
  });
});

describe("snapshots", () => {
  it("never includes the item pool", () => {
    const room = lobbyWith(["Asha", "Ben"]);
    room.game = createGame({
      mode: "online",
      settings: room.settings,
      players: [
        { id: "asha", name: "Asha", isBot: false },
        { id: "ben", name: "Ben", isBot: false },
      ],
      items: [
        { id: "a", name: "A", category: "football", price: 1, rating: 50, tag: "T" },
        { id: "secret", name: "Secret", category: "football", price: 1, rating: 50, tag: "T" },
      ],
      now: 0,
      random: () => 0.999999,
    });
    const json = JSON.stringify(toRoomSnapshot(room));
    expect(json).not.toContain("itemPool");
    expect(json).not.toContain("Secret");
    expect(toRoomInfo(room)).toMatchObject({ phase: "drafting", joinable: false });
  });
});

describe("RoomStore", () => {
  it("creates rooms with unique codes and finds them case-insensitively", () => {
    const store = new RoomStore();
    const room = store.create("football", 0);
    expect(store.get(room.code.toLowerCase())).toBe(room);
  });

  it("removes rooms that have been empty for 10 minutes", () => {
    const store = new RoomStore();
    const empty = store.create("football", 0);
    const busy = store.create("football", 0);
    addPlayer(busy, { id: "a", name: "A" }, 0);
    expect(store.removeAbandoned(9 * 60_000)).toEqual([]);
    expect(store.removeAbandoned(10 * 60_000)).toEqual([empty.code]);
    expect(store.get(busy.code)).toBe(busy);
  });
});

describe("recordReaction", () => {
  it("allows one reaction per player per second", () => {
    const room = createRoom("ABC123", "nba", 0);
    addPlayer(room, { id: "player-a1", name: "Asha" }, 0);
    addPlayer(room, { id: "player-b1", name: "Ben" }, 0);
    expect(recordReaction(room, "player-a1", 1000)).toBeNull();
    expect(recordReaction(room, "player-a1", 1500)).toBe("Slow down! One reaction per second.");
    expect(recordReaction(room, "player-b1", 1500)).toBeNull(); // each player has their own limit
    expect(recordReaction(room, "player-a1", 2000)).toBeNull();
    expect(recordReaction(room, "stranger", 5000)).toBe("You're not in this room");
  });
});

describe("lobby chat", () => {
  it("keeps only the last 30 messages", () => {
    const room = lobbyWith(["Asha"]);
    for (let i = 0; i < 40; i++) {
      expect(addChatMessage(room, "asha", `msg ${i}`, i * 1000)).toBeNull();
    }
    expect(room.chat).toHaveLength(30);
    expect(room.chat[0]?.text).toBe("msg 10");
    expect(room.chat.at(-1)?.text).toBe("msg 39");
    expect(toRoomSnapshot(room).chat).toHaveLength(30);
  });

  it("limits each player to one message per second", () => {
    const room = lobbyWith(["Asha", "Ben"]);
    expect(addChatMessage(room, "asha", "hi", 0)).toBeNull();
    expect(addChatMessage(room, "asha", "again", 999)).toBe("Slow down! One message per second.");
    expect(addChatMessage(room, "ben", "hey", 500)).toBeNull();
    expect(addChatMessage(room, "asha", "now", 1000)).toBeNull();
    expect(addChatMessage(room, "stranger", "hi", 5000)).toBe("You're not in this room");
  });
});
