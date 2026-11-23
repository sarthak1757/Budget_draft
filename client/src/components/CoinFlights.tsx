import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicGameState } from "@budget-draft/shared";
import { eventsKey, findPurchase, slotIndexOf } from "../lib/boardMoments";
import { EASE, GAME_MOMENT } from "../lib/motion";

interface Flight {
  id: number;
  x: number; // start, viewport px (centre of the coin)
  y: number;
  dx: number; // distance to travel
  dy: number;
  price: number;
}

const COIN_SIZE = 36;
const ARC_HEIGHT = 40; // how far above the straight line the coin's path bows

// The centre of the first matching element that is actually on screen.
function centreOf(selector: string): { x: number; y: number } | null {
  for (const element of document.querySelectorAll(selector)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  return null;
}

// When someone buys, the price flies as a gold coin from their budget into
// the new slot. When that slot isn't on screen (a phone's collapsed team
// bar, an opponent's chip), it flies from the table to their budget instead.
// Purely decorative: it starts after the state has already changed.
export function CoinFlights({ state }: { state: PublicGameState }) {
  const reduce = useReducedMotion() === true;
  const [flights, setFlights] = useState<Flight[]>([]);
  const lastKey = useRef<string | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const key = eventsKey(state.roundNumber, state.lastEvents);
    const previous = lastKey.current;
    lastKey.current = key;
    // Not on the first render (page load or reconnect), and once per batch.
    if (previous === null || previous === key || reduce) {
      return;
    }
    const purchase = findPurchase(state.lastEvents);
    if (purchase === null) {
      return;
    }
    const buyer = state.players.find((player) => player.id === purchase.playerId);
    if (!buyer) {
      return;
    }
    const slot = slotIndexOf(buyer, purchase.itemId);
    let from = centreOf(`[data-budget-for="${buyer.id}"]`);
    let to = centreOf(`[data-slot-for="${buyer.id}:${slot}"]`);
    const tooClose = from !== null && to !== null && Math.hypot(to.x - from.x, to.y - from.y) < 60;
    if (from === null || to === null || tooClose) {
      from = centreOf("[data-card-stage]");
      to = centreOf(`[data-budget-for="${buyer.id}"]`);
    }
    if (from === null || to === null) {
      return;
    }
    const flight: Flight = { id: nextId.current, x: from.x, y: from.y, dx: to.x - from.x, dy: to.y - from.y, price: purchase.price };
    nextId.current += 1;
    setFlights((current) => [...current, flight]);
  }, [state.roundNumber, state.lastEvents]);

  if (flights.length === 0) {
    return null;
  }

  // In <body>, so no transformed parent shifts the fixed position.
  return createPortal(
    <>
      {flights.map((flight) => (
        <motion.div
          key={flight.id}
          aria-hidden
          className="display-serif pointer-events-none fixed z-50 grid place-items-center rounded-full bg-gold text-lg text-ink shadow-glow"
          style={{ left: flight.x - COIN_SIZE / 2, top: flight.y - COIN_SIZE / 2, width: COIN_SIZE, height: COIN_SIZE }}
          initial={{ x: 0, y: 0, scale: 0.6, opacity: 0 }}
          animate={{
            x: [0, flight.dx / 2, flight.dx],
            y: [0, flight.dy / 2 - ARC_HEIGHT, flight.dy],
            scale: [0.6, 1.1, 0.7],
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: GAME_MOMENT.coin, ease: EASE.inOut }}
          onAnimationComplete={() => setFlights((current) => current.filter((f) => f.id !== flight.id))}
        >
          ${flight.price}
        </motion.div>
      ))}
    </>,
    document.body,
  );
}
