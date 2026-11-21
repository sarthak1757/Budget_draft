import { expectedPrice } from "@budget-draft/shared";

// The fair-price rule itself lives in shared (the Bargain Hunter badge uses it too).
export { expectedPrice };

// How far from the fair price an item must be to count as a deliberate deal or rip-off.
export const PRICE_SURPRISE_GAP = 3;

export type PriceClass = "fair" | "bargain" | "overpriced";

export function classifyPrice(price: number, rating: number): PriceClass {
  const fair = expectedPrice(rating);
  if (price <= fair - PRICE_SURPRISE_GAP) {
    return "bargain";
  }
  if (price >= fair + PRICE_SURPRISE_GAP) {
    return "overpriced";
  }
  return "fair";
}
