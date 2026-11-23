import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DISTANCE, DURATION, enterTransition, exitTransition } from "../lib/motion";
import { buzz } from "../store/soundStore";

// When your turn starts, a short "Your turn" banner slides down from the top
// and the phone buzzes gently (for when it's lying on the table). Not on the
// first render, so a reload or reconnect doesn't announce it again.
// It's decorative: the turn line on the board already says it for screen readers.
export function YourTurnBanner({ isMyTurn }: { isMyTurn: boolean }) {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const wasMyTurn = useRef(isMyTurn);
  const slide = useReducedMotion() === true ? 0 : -DISTANCE.banner; // reduce motion: fade only

  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) {
      buzz("turn");
      setShownAt(Date.now());
    }
    if (!isMyTurn) {
      setShownAt(null);
    }
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  useEffect(() => {
    if (shownAt === null) {
      return;
    }
    const timer = setTimeout(() => setShownAt(null), DURATION.banner * 1000);
    return () => clearTimeout(timer);
  }, [shownAt]);

  return (
    <AnimatePresence>
      {shownAt !== null && (
        <motion.div
          key={shownAt}
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 flex justify-center px-4"
          initial={{ y: slide, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: enterTransition }}
          exit={{ y: slide, opacity: 0, transition: exitTransition }}
        >
          <span className="display-serif rounded-full bg-gold px-7 py-2 text-3xl text-ink shadow-glow">Your turn</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
