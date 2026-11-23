import { AnimatePresence, motion, useAnimate, useIsPresent, usePresenceData, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useState, type Ref } from "react";
import { discountedPrice, type PublicItem } from "@budget-draft/shared";
import type { CardExit } from "../lib/boardMoments";
import { DISTANCE, EASE, GAME_MOMENT, gameTransition } from "../lib/motion";
import { ItemCard } from "./ItemCard";

interface CardStageProps {
  item: PublicItem | null;
  roundNumber: number;
  itemsRemaining: number;
  isAuction: boolean;
  highBid: number | null; // auction: bumps the price badge on each new high bid
  exit: CardExit; // how the current card leaves when the next item replaces it
  nudgeKey: string | null; // changes when someone passes and the item stays
}

// The table: a face-down deck, and the current item on top of it.
// A new item slides off the deck and turns over. The old one leaves the way
// its round ended: bought, Discount, Veto (cut in two) or nobody wanted it
// (drops off). None of this waits on the timer or blocks the buttons.
export function CardStage({ item, roundNumber, itemsRemaining, isAuction, highBid, exit, nudgeKey }: CardStageProps) {
  return (
    <div className="relative pb-2 md:pb-3" data-card-stage>
      {itemsRemaining > 0 && <Deck />}
      <AnimatePresence mode="popLayout" custom={exit}>
        {item && (
          <FlyingCard
            key={item.id}
            item={item}
            roundNumber={roundNumber}
            itemsRemaining={itemsRemaining}
            isAuction={isAuction}
            highBid={highBid}
            nudgeKey={nudgeKey}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Two card backs peeking out under the current card.
function Deck() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <CardBack seal={false} className="absolute inset-x-4 top-2 bottom-0 md:inset-x-5 md:top-3" />
      <CardBack seal={false} className="absolute inset-x-2 top-1 bottom-1 md:top-1.5 md:bottom-1.5" />
    </div>
  );
}

// The back of a card: ink with fine gold diagonals and a "$" seal.
// The deck's cards leave the seal out: it would show through a fading card.
function CardBack({ className = "", style, seal = true }: { className?: string; style?: React.CSSProperties; seal?: boolean }) {
  return (
    <div
      className={`grid place-items-center rounded-[2rem] border border-gold/30 bg-ink-raised bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_oklab,var(--color-gold)_9%,transparent)_10px_11px)] ${className}`}
      style={style}
    >
      {seal && <span className="display-serif grid size-14 place-items-center rounded-full text-3xl text-gold ring-1 ring-gold/50">$</span>}
    </div>
  );
}

// With reduce motion, every exit is a plain fade: motion would otherwise
// jump a moving exit straight to its end position before fading it.
const fadeOnlyVariants: Variants = {
  exit: { opacity: 0, transition: { duration: GAME_MOMENT.fade } },
};

const exitVariants: Variants = {
  exit: (kind: CardExit) => {
    if (kind === "bought") {
      return { y: -DISTANCE.deck, scale: 0.92, opacity: 0, transition: gameTransition(GAME_MOMENT.fade) };
    }
    if (kind === "discounted") {
      // Wait for the strike-through, then leave like a buy.
      return { y: -DISTANCE.deck, scale: 0.92, opacity: 0, transition: gameTransition(GAME_MOMENT.fade, GAME_MOMENT.bump) };
    }
    if (kind === "vetoed") {
      // The halves animate themselves; the card just waits for them.
      return { opacity: 0, transition: { duration: 0.05, delay: GAME_MOMENT.split - 0.05 } };
    }
    if (kind === "discarded") {
      return { y: DISTANCE.deck * 3, rotate: 7, opacity: 0, transition: { duration: GAME_MOMENT.split, ease: EASE.in } };
    }
    return { opacity: 0, transition: { duration: GAME_MOMENT.fade } };
  },
};

interface FlyingCardProps {
  item: PublicItem;
  roundNumber: number;
  itemsRemaining: number;
  isAuction: boolean;
  highBid: number | null;
  nudgeKey: string | null;
  ref?: Ref<HTMLDivElement>; // AnimatePresence's popLayout measures the leaving card
}

function FlyingCard({ item, roundNumber, itemsRemaining, isAuction, highBid, nudgeKey, ref }: FlyingCardProps) {
  const reduce = useReducedMotion() === true;
  const isPresent = useIsPresent();
  const exitKind = usePresenceData() as CardExit | undefined;
  const leaving = !isPresent;
  const [nudgeScope, animate] = useAnimate<HTMLDivElement>();
  // The face-down back only exists while the card turns over. Leaving it in
  // would let it show through whenever the card fades (pass, exits).
  const [turned, setTurned] = useState(reduce);

  // Someone passed and the item stays: it slides aside and fades a little,
  // then comes back for the next player.
  useEffect(() => {
    if (nudgeKey === null || reduce || nudgeScope.current === null) {
      return;
    }
    animate(nudgeScope.current, { x: [0, DISTANCE.deck, 0], opacity: [1, 0.65, 1] }, { duration: GAME_MOMENT.coin, ease: EASE.inOut });
  }, [nudgeKey]);

  const card = (
    <ItemCard
      item={item}
      roundNumber={roundNumber}
      itemsRemaining={itemsRemaining}
      isAuction={isAuction}
      bumpKey={highBid}
      discountedTo={leaving && exitKind === "discounted" ? discountedPrice(item.price) : null}
    />
  );

  let face;
  if (leaving && exitKind === "vetoed" && !reduce) {
    face = <VetoSplit>{card}</VetoSplit>;
  } else {
    // Face down first, then it turns over. A mystery item wobbles once it lands.
    face = (
      <motion.div
        className="relative"
        style={{ transformStyle: "preserve-3d", transformPerspective: 1000 }}
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={gameTransition(GAME_MOMENT.flip)}
        onAnimationComplete={() => setTurned(true)}
      >
        <motion.div
          style={{ backfaceVisibility: "hidden" }}
          animate={item.isMystery ? { x: [0, -5, 5, -4, 4, -2, 0] } : undefined}
          transition={{ duration: GAME_MOMENT.shake, delay: GAME_MOMENT.flip }}
        >
          {card}
        </motion.div>
        {!turned && (
          <CardBack
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={leaving ? "relative z-10" : "relative"}
      // Slides up off the deck. Opacity stays out of it (it would flatten the
      // 3D flip), except with reduce motion, where a fade is all there is.
      initial={reduce ? { opacity: 0 } : { y: DISTANCE.deck, scale: 0.94 }}
      animate={reduce ? { opacity: 1 } : { y: 0, scale: 1 }}
      transition={gameTransition(GAME_MOMENT.flip)}
      variants={reduce ? fadeOnlyVariants : exitVariants}
      exit="exit"
    >
      <div ref={nudgeScope}>{face}</div>
    </motion.div>
  );
}

// Veto: the card is cut along a slight diagonal and the halves fall apart.
// (The clip-path is fixed; only transform and opacity animate.)
function VetoSplit({ children }: { children: React.ReactNode }) {
  const fall = { duration: GAME_MOMENT.split, ease: EASE.in };
  return (
    <div className="relative" aria-hidden>
      <motion.div
        style={{ clipPath: "polygon(0 0, 56% 0, 44% 100%, 0 100%)" }}
        animate={{ x: -DISTANCE.deck, y: DISTANCE.deck, rotate: -6, opacity: 0 }}
        transition={fall}
      >
        {children}
      </motion.div>
      <motion.div
        className="absolute inset-0"
        style={{ clipPath: "polygon(56% 0, 100% 0, 100% 100%, 44% 100%)" }}
        animate={{ x: DISTANCE.deck, y: DISTANCE.deck, rotate: 6, opacity: 0 }}
        transition={fall}
      >
        {children}
      </motion.div>
    </div>
  );
}
