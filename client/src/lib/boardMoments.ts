import type { GameEvent, PublicItem, PublicPlayerState } from "@budget-draft/shared";

// Pure helpers that decide which board animation to play for the latest
// events. Kept out of the components so they can be unit tested.

type Events = GameEvent<PublicItem>[];

// How the current card leaves the table when the next item replaces it.
export type CardExit = "bought" | "discounted" | "vetoed" | "discarded" | "fade";

export function cardExitFor(events: Events, isAuction: boolean): CardExit {
  for (const event of events) {
    if (event.type === "vetoed") {
      return "vetoed";
    }
    if (event.type === "bought") {
      // Discount only exists in Classic: there the price paid is below the listed price.
      if (!isAuction && event.price < event.item.price) {
        return "discounted";
      }
      return "bought";
    }
    if (event.type === "discarded") {
      return "discarded";
    }
  }
  return "fade";
}

// True when someone passed and the same item stays on the table
// (the next player gets asked), so the card only nudges aside.
export function isPassAlong(events: Events): boolean {
  let passed = false;
  for (const event of events) {
    if (event.type === "bought" || event.type === "discarded" || event.type === "vetoed") {
      return false;
    }
    if (event.type === "passed") {
      passed = true;
    }
  }
  return passed;
}

// The purchase in these events, if any: who bought what, and for how much.
export interface Purchase {
  playerId: string;
  itemId: string;
  price: number;
}

export function findPurchase(events: Events): Purchase | null {
  for (const event of events) {
    if (event.type === "bought") {
      return { playerId: event.playerId, itemId: event.item.id, price: event.price };
    }
  }
  return null;
}

// Which slot a bought item landed in, or -1.
export function slotIndexOf(player: PublicPlayerState, itemId: string): number {
  for (let index = 0; index < player.team.length; index++) {
    if (player.team[index]?.id === itemId) {
      return index;
    }
  }
  return -1;
}

// A stable id for one batch of events, so an animation plays once per batch
// (a reconnect resends the same state and must not replay it).
export function eventsKey(roundNumber: number, events: Events): string {
  return `${roundNumber}:${JSON.stringify(events)}`;
}

// The digits of a number for the odometer, each with a key that only
// changes when that digit changes. Keys count from the right, so going
// from $9 to $10 rolls the ones digit and adds a tens digit.
export function odometerDigits(value: number): { key: string; digit: string }[] {
  const text = String(value);
  const digits: { key: string; digit: string }[] = [];
  for (let index = 0; index < text.length; index++) {
    const place = text.length - 1 - index;
    const digit = text[index] ?? "0";
    digits.push({ key: `${place}-${digit}`, digit });
  }
  return digits;
}
