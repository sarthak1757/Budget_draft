import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementsFor, isBargain, type AchievementItem, type AchievementPlayer } from "../achievements";
import { expectedPrice } from "../pricing";

function item(price: number, rating: number | null, extra: Partial<AchievementItem> = {}): AchievementItem {
  return { price, rating, tag: "Striker", ...extra };
}

function player(team: (AchievementItem | null)[], budget = 3): AchievementPlayer {
  return { budget, team };
}

// A plain team that earns nothing: fair prices, average ratings, money left.
const plain = [item(5, 70), item(5, 70), item(5, 70)];

describe("expectedPrice", () => {
  it("follows the seed's fair-price table", () => {
    expect(expectedPrice(97)).toBe(10);
    expect(expectedPrice(80)).toBe(7);
    expect(expectedPrice(54)).toBe(1);
  });
});

describe("isBargain", () => {
  it("means paying at least $2 under the fair price", () => {
    expect(isBargain(item(5, 80))).toBe(true); // fair $7
    expect(isBargain(item(6, 80))).toBe(false);
    expect(isBargain(item(9, 80, { paidPrice: 4 }))).toBe(true); // an auction win counts what was paid
    expect(isBargain(item(0, 10, { isBench: true }))).toBe(false);
    expect(isBargain(item(3, null))).toBe(false); // rating still hidden
  });
});

describe("achievementsFor", () => {
  it("gives nothing for an ordinary team", () => {
    expect(achievementsFor(player(plain), [])).toEqual([]);
  });

  it("Bargain Hunter: 3 or more bargains", () => {
    expect(achievementsFor(player([item(5, 80), item(5, 80), item(5, 70)]), [])).toEqual([]);
    expect(achievementsFor(player([item(5, 80), item(5, 80), item(4, 75)]), [])).toEqual(["bargain-hunter"]);
  });

  it("Big Spender: paid $10 or more for one pick", () => {
    expect(achievementsFor(player([item(10, 96), item(5, 70), item(5, 70)]), [])).toContain("big-spender");
    expect(achievementsFor(player([item(6, 70, { paidPrice: 12 }), item(5, 70), item(5, 70)]), [])).toContain("big-spender");
    expect(achievementsFor(player([item(10, 96, { paidPrice: 8 }), item(5, 70), item(5, 70)]), [])).not.toContain("big-spender");
  });

  it("Penny Perfect: finished with $0", () => {
    expect(achievementsFor(player(plain, 0), [])).toEqual(["penny-perfect"]);
  });

  it("Full Squad: every required role covered (Balanced team on only)", () => {
    const team = [item(5, 70, { tag: "Goalkeeper" }), item(5, 70, { tag: "Defender" }), item(5, 70, { tag: "Forward" })];
    expect(achievementsFor(player(team), ["Goalkeeper", "Defender", "Forward"])).toEqual(["full-squad"]);
    expect(achievementsFor(player(team), ["Goalkeeper", "Midfielder"])).toEqual([]);
    expect(achievementsFor(player(team), [])).toEqual([]);
  });

  it("Sharp Eye: every slot averages 85+, bench fillers included", () => {
    expect(achievementsFor(player([item(8, 86), item(8, 85), item(8, 90)]), [])).toEqual(["sharp-eye"]);
    expect(achievementsFor(player([item(8, 90), item(8, 90), item(0, 10, { isBench: true })]), [])).toEqual([]);
    expect(achievementsFor(player([item(8, 90), item(8, 90), null]), [])).toEqual([]);
  });

  it("Steal: a 75+ pick for $1", () => {
    expect(achievementsFor(player([item(1, 75), item(5, 70), item(5, 70)]), [])).toEqual(["steal"]);
    expect(achievementsFor(player([item(4, 80, { paidPrice: 1 }), item(5, 70), item(5, 70)]), [])).toContain("steal");
    expect(achievementsFor(player([item(1, 74), item(5, 70), item(5, 70)]), [])).toEqual([]);
  });

  it("can earn several at once, in a fixed order", () => {
    const team = [item(1, 90, { tag: "A" }), item(1, 88, { tag: "B" }), item(10, 99, { tag: "C" }), item(2, 90, { tag: "A" })];
    expect(achievementsFor(player(team, 0), ["A", "B", "C"])).toEqual([
      "bargain-hunter",
      "big-spender",
      "penny-perfect",
      "full-squad",
      "sharp-eye",
      "steal",
    ]);
  });

  it("has a name and description for every badge", () => {
    expect(Object.keys(ACHIEVEMENTS)).toHaveLength(6);
    for (const achievement of Object.values(ACHIEVEMENTS)) {
      expect(achievement.name.length).toBeGreaterThan(0);
      expect(achievement.description.length).toBeGreaterThan(0);
    }
  });
});
