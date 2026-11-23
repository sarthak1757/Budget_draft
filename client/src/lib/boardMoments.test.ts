import { describe, expect, it } from "vitest";
import type { PublicGameEvent, PublicItem, PublicPlayerState } from "@budget-draft/shared";
import { cardExitFor, eventsKey, findPurchase, isPassAlong, odometerDigits, slotIndexOf } from "./boardMoments";

const item: PublicItem = { id: "x", name: "Hot Dog", category: "fast-food", price: 6, rating: 76, tag: "Classic" };
const bought: PublicGameEvent = { type: "bought", playerId: "a", item, price: 6 };
const passed: PublicGameEvent = { type: "passed", playerId: "a", item, auto: false };

describe("cardExitFor", () => {
  it("picks the exit from what ended the round", () => {
    expect(cardExitFor([bought], false)).toBe("bought");
    expect(cardExitFor([{ type: "vetoed", playerId: "a", item }], false)).toBe("vetoed");
    expect(cardExitFor([passed, { type: "discarded", item }], false)).toBe("discarded");
    expect(cardExitFor([passed], false)).toBe("fade");
  });

  it("treats a cheaper Classic buy as a Discount, but not an auction win", () => {
    const cheap: PublicGameEvent = { type: "bought", playerId: "a", item, price: 4 };
    expect(cardExitFor([cheap], false)).toBe("discounted");
    expect(cardExitFor([cheap], true)).toBe("bought");
  });
});

describe("isPassAlong", () => {
  it("is true only when the item stays on the table", () => {
    expect(isPassAlong([passed])).toBe(true);
    expect(isPassAlong([passed, { type: "discarded", item }])).toBe(false);
    expect(isPassAlong([passed, bought])).toBe(false);
    expect(isPassAlong([])).toBe(false);
  });
});

describe("purchases", () => {
  it("finds the buyer and the slot the item landed in", () => {
    expect(findPurchase([passed, bought])).toEqual({ playerId: "a", itemId: "x", price: 6 });
    expect(findPurchase([passed])).toBeNull();
    const player: PublicPlayerState = { id: "a", name: "Asha", isBot: false, isConnected: true, budget: 14, team: [null, item, null], usedPowerUps: [] };
    expect(slotIndexOf(player, "x")).toBe(1);
    expect(slotIndexOf(player, "nope")).toBe(-1);
  });

  it("gives the same key for the same batch of events", () => {
    expect(eventsKey(3, [bought])).toBe(eventsKey(3, [bought]));
    expect(eventsKey(3, [bought])).not.toBe(eventsKey(4, [bought]));
  });
});

describe("odometerDigits", () => {
  it("keys digits by place, so only changed digits roll", () => {
    expect(odometerDigits(9)).toEqual([{ key: "0-9", digit: "9" }]);
    expect(odometerDigits(12)).toEqual([
      { key: "1-1", digit: "1" },
      { key: "0-2", digit: "2" },
    ]);
    // 12 -> 13: the tens key stays, the ones key changes.
    expect(odometerDigits(13)[0]?.key).toBe("1-1");
    expect(odometerDigits(13)[1]?.key).toBe("0-3");
  });
});
