import { describe, expect, it } from "vitest";
import { addMyGame, MY_GAMES_LIMIT, parseMyGames, type MyGame } from "./matchHistory";

function id(n: number): string {
  return n.toString(16).padStart(24, "0");
}

describe("addMyGame", () => {
  it("puts the newest game first and drops duplicates", () => {
    let list: MyGame[] = [];
    list = addMyGame(list, { resultId: id(1), playerId: "a" });
    list = addMyGame(list, { resultId: id(2), playerId: null });
    list = addMyGame(list, { resultId: id(1), playerId: "a" });
    expect(list.map((game) => game.resultId)).toEqual([id(1), id(2)]);
  });

  it("keeps only the last 20", () => {
    let list: MyGame[] = [];
    for (let n = 1; n <= 25; n++) {
      list = addMyGame(list, { resultId: id(n), playerId: null });
    }
    expect(list).toHaveLength(MY_GAMES_LIMIT);
    expect(list[0]?.resultId).toBe(id(25));
    expect(list.at(-1)?.resultId).toBe(id(6));
  });
});

describe("parseMyGames", () => {
  it("reads what rememberGame writes", () => {
    const stored = JSON.stringify([{ resultId: id(3), playerId: "p1" }, { resultId: id(4), playerId: null }]);
    expect(parseMyGames(stored)).toEqual([
      { resultId: id(3), playerId: "p1" },
      { resultId: id(4), playerId: null },
    ]);
  });

  it("ignores junk instead of crashing", () => {
    expect(parseMyGames(null)).toEqual([]);
    expect(parseMyGames("not json")).toEqual([]);
    expect(parseMyGames('{"a":1}')).toEqual([]);
    expect(parseMyGames(JSON.stringify([{ resultId: "nope", playerId: null }, 5, null, { resultId: id(7), playerId: 3 }]))).toEqual([]);
  });
});
