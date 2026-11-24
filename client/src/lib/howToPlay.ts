import { Scale, ShoppingBag, Trophy, Wallet, type LucideIcon } from "lucide-react";
import { BENCH_RATING, DEFAULT_SETTINGS, LEFTOVER_POINTS_PER_DOLLAR, MAX_PRICE, MIN_PRICE } from "@budget-draft/shared";

export interface HelpCard {
  Icon: LucideIcon;
  title: string;
  text: string;
}

const budget = DEFAULT_SETTINGS.startingBudget;
const slots = DEFAULT_SETTINGS.slotCount;

// Built from the game's constants, so the help can't drift from the rules.
export const HOW_TO_PLAY_CARDS: HelpCard[] = [
  {
    Icon: Wallet,
    title: `$${budget} for ${slots} slots`,
    text: `Items are shown one at a time, each with a price ($${MIN_PRICE}–$${MAX_PRICE}) and a rating. Build the best team you can afford.`,
  },
  {
    Icon: ShoppingBag,
    title: "Buy or pass",
    text: "On your turn, BUY the item or PASS it to the next player. The first one to buy gets it. Nobody wants it? It's gone.",
  },
  {
    Icon: Scale,
    title: "Keep $1 per empty slot",
    text: "You must always be able to fill your team, so you can't spend the last $1 for each empty slot. The board shows how much you can spend.",
  },
  {
    Icon: Trophy,
    title: "Highest score wins",
    text: `Your score is the total rating of your team, plus ${LEFTOVER_POINTS_PER_DOLLAR} point per dollar left over. Slots still empty at the end get a bench player rated ${BENCH_RATING}.`,
  },
];

// Kept in a separate module (see howToPlaySeen.ts); re-exported for convenience.
export { hasSeenHowToPlay, markHowToPlaySeen } from "./howToPlaySeen";
