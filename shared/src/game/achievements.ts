import { MAX_PRICE } from "./constants";
import { findMissingRoles } from "./roles";
import { expectedPrice } from "./pricing";

// Small badges shown on the results screen. They don't change the score:
// they just point out how someone played.

export type AchievementId = "bargain-hunter" | "big-spender" | "penny-perfect" | "full-squad" | "sharp-eye" | "steal";

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
}

// A bargain: paid at least $2 less than the fair price for its rating.
export const BARGAIN_GAP = 2;
export const BARGAINS_NEEDED = 3;
export const SHARP_EYE_AVERAGE = 85;
export const STEAL_RATING = 75;

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  "bargain-hunter": { id: "bargain-hunter", name: "Bargain Hunter", description: `${BARGAINS_NEEDED}+ bargains` },
  "big-spender": { id: "big-spender", name: "Big Spender", description: `Paid $${MAX_PRICE}+ for one pick` },
  "penny-perfect": { id: "penny-perfect", name: "Penny Perfect", description: "Finished with $0 left" },
  "full-squad": { id: "full-squad", name: "Full Squad", description: "Covered every role" },
  "sharp-eye": { id: "sharp-eye", name: "Sharp Eye", description: `Team average rating ${SHARP_EYE_AVERAGE}+` },
  steal: { id: "steal", name: "Steal", description: `A ${STEAL_RATING}+ pick for $1` },
};

// What the achievements need from a team item. Works for full and public
// items (a public rating is only null while the draft is running).
export interface AchievementItem {
  price: number;
  paidPrice?: number | undefined;
  rating: number | null;
  tag: string;
  isBench?: boolean | undefined;
}

export interface AchievementPlayer {
  budget: number;
  team: readonly (AchievementItem | null)[];
}

function paid(item: AchievementItem): number {
  return item.paidPrice ?? item.price;
}

export function isBargain(item: AchievementItem): boolean {
  if (item.isBench || item.rating === null) {
    return false;
  }
  return expectedPrice(item.rating) - paid(item) >= BARGAIN_GAP;
}

// The badges a player earned, in a fixed order. requiredRoles is the game's
// Balanced team roles (empty when that extra was off, so no Full Squad).
export function achievementsFor(player: AchievementPlayer, requiredRoles: readonly string[]): AchievementId[] {
  let bargains = 0;
  let bigBuy = false;
  let steal = false;
  let ratingSum = 0;
  let ratedSlots = 0;
  for (const item of player.team) {
    if (item === null) {
      continue;
    }
    if (item.rating !== null) {
      ratingSum += item.rating;
      ratedSlots += 1;
    }
    if (item.isBench) {
      continue; // $0 fillers aren't purchases
    }
    if (isBargain(item)) {
      bargains += 1;
    }
    if (paid(item) >= MAX_PRICE) {
      bigBuy = true;
    }
    if (paid(item) <= 1 && item.rating !== null && item.rating >= STEAL_RATING) {
      steal = true;
    }
  }

  const earned: AchievementId[] = [];
  if (bargains >= BARGAINS_NEEDED) {
    earned.push("bargain-hunter");
  }
  if (bigBuy) {
    earned.push("big-spender");
  }
  if (player.budget === 0) {
    earned.push("penny-perfect");
  }
  if (requiredRoles.length > 0 && findMissingRoles(player.team, requiredRoles).length === 0) {
    earned.push("full-squad");
  }
  // Every slot counts, bench fillers too (at their low rating).
  if (player.team.length > 0 && ratedSlots === player.team.length && ratingSum / ratedSlots >= SHARP_EYE_AVERAGE) {
    earned.push("sharp-eye");
  }
  if (steal) {
    earned.push("steal");
  }
  return earned;
}
