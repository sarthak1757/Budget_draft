import { describe, expect, it } from "vitest";
import { AVATAR_IDS, firstFreeAvatar, isAvatarId } from "../avatars";
import { createGame } from "../engine";
import { toPublicState } from "../publicState";
import { makeItems, makeSettings, NOW } from "./helpers";

describe("avatars", () => {
  it("has 12 different avatars", () => {
    expect(AVATAR_IDS).toHaveLength(12);
    expect(new Set(AVATAR_IDS).size).toBe(12);
  });

  it("recognises only real avatar ids", () => {
    expect(isAvatarId("crown")).toBe(true);
    expect(isAvatarId("Crown")).toBe(false);
    expect(isAvatarId(null)).toBe(false);
  });

  it("hands out the first avatar nobody has", () => {
    expect(firstFreeAvatar([])).toBe("crown");
    expect(firstFreeAvatar(["crown", "flame"])).toBe("rocket");
    expect(firstFreeAvatar([...AVATAR_IDS])).toBe("crown");
  });

  it("keeps each player's avatar through the game and into the public state", () => {
    const state = createGame({
      mode: "local",
      settings: makeSettings(),
      players: [
        { id: "p1", name: "Asha", isBot: false, avatar: "cat" },
        { id: "p2", name: "Bot", isBot: true },
      ],
      items: makeItems(10),
      now: NOW,
      random: () => 0,
    });
    expect(state.players[0]?.avatar).toBe("cat");
    expect(state.players[1]?.avatar).toBeUndefined();
    expect(toPublicState(state).players[0]?.avatar).toBe("cat");
  });
});
