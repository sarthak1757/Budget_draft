import { motion } from "motion/react";
import type { PublicItem } from "@budget-draft/shared";
import { GAME_MOMENT, gameTransition, SPRING } from "../lib/motion";
import { ChromeBlob } from "./brand/ChromeBlob";
import { Hairline, Label, PriceBadge, RatingBar } from "./brand/primitives";
import { Bump } from "./MotionBits";

interface ItemCardProps {
  item: PublicItem;
  roundNumber: number;
  itemsRemaining: number;
  isAuction?: boolean; // the listed price is only a guide: bids decide what's paid
  bumpKey?: number | null; // auction: the high bid. Each change bumps the price badge.
  discountedTo?: number | null; // Discount was used: strike the old price, show this one
}

// The reveal, the exits and the deck are drawn by CardStage around this card.
export function ItemCard({ item, roundNumber, itemsRemaining, isAuction = false, bumpKey = null, discountedTo = null }: ItemCardProps) {
  return (
    <article
      className="relative grid content-start gap-3 overflow-hidden rounded-[2rem] border border-mist/15 bg-ink-raised p-4 md:gap-5 md:p-5"
      aria-live="polite"
    >
      {/* The tag can be long ("Salesforce · Founder"), so it wraps rather than being cut off. */}
      <div className="flex items-start justify-between gap-3">
        <Label className="shrink-0">
          Item {roundNumber} · {itemsRemaining} left
        </Label>
        <Label className="min-w-0 text-right text-ivory">
          {item.emoji !== undefined && <span aria-hidden>{item.emoji} </span>}
          {item.tag}
        </Label>
      </div>

      {item.isMystery && (
        // A mystery item hides its rating: a big serif "?" floats over a chrome shape.
        // Not on phones, where the card has to fit above the buttons; the
        // gold note and the "?" rating say the same thing there.
        <div className="relative hidden h-28 place-items-center md:grid">
          <ChromeBlob shape="pebble" className="absolute w-28" />
          <span className="display-serif relative text-[6rem] text-ivory [-webkit-text-stroke:2px_var(--color-ink-raised)] [paint-order:stroke_fill] [text-shadow:0_2px_12px_var(--color-ink-raised)]">
            ?
          </span>
        </div>
      )}

      <h2 className="display-serif text-3xl text-ivory md:text-4xl">{item.name}</h2>
      {item.isMystery && <Label className="text-gold">Mystery · rating revealed at the end</Label>}

      <Hairline />
      <div className="flex items-end gap-5">
        <span className="relative" data-price-badge>
          <Bump trigger={bumpKey}>
            <PriceBadge price={item.price} label={isAuction ? "Guide price" : "Price"} size="fluid" />
          </Bump>
          {discountedTo !== null && <DiscountStrike price={discountedTo} />}
        </span>
        <RatingBar rating={item.rating} className="flex-1 pb-7" />
      </div>
    </article>
  );
}

// Discount: a line strikes through the old price and the new one pops in beside it.
function DiscountStrike({ price }: { price: number }) {
  return (
    <>
      <motion.span
        aria-hidden
        className="absolute top-8 -left-1 h-[3px] w-[calc(100%+0.5rem)] origin-left -rotate-12 rounded-full bg-ink md:top-10"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={gameTransition(GAME_MOMENT.bump)}
      />
      <motion.span
        className="display-serif absolute -top-2 -right-4 grid size-10 place-items-center rounded-full bg-ivory text-xl text-ink shadow-glow"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.pop}
      >
        ${price}
      </motion.span>
    </>
  );
}
