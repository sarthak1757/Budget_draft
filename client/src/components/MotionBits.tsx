import { AnimatePresence, m, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { odometerDigits } from "../lib/boardMoments";
import { DURATION, EASE, GAME_MOMENT, gameTransition, SPRING } from "../lib/motion";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";

// Small reusable animations for the game board.

// Scales its content up and back whenever `trigger` changes (not on the
// first render). Used for the price badge on each new high bid.
export function Bump({ trigger, children, className = "" }: { trigger: number | string | null; children: ReactNode; className?: string }) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reduce = useReducedMotion();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce === true || scope.current === null) {
      return;
    }
    animate(scope.current, { scale: [1, 1.15, 1] }, { duration: GAME_MOMENT.bump, ease: EASE.out });
  }, [trigger]);

  return (
    <span ref={scope} className={`inline-block ${className}`}>
      {children}
    </span>
  );
}

// A number whose changed digits roll up like an odometer.
// Screen readers get the plain number.
export function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      <span className="sr-only">{value}</span>
      <AnimatePresence initial={false} mode="popLayout">
        {odometerDigits(value).map(({ key, digit }) => (
          <m.span
            key={key}
            aria-hidden
            className="inline-block"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={gameTransition(GAME_MOMENT.bump)}
          >
            {digit}
          </m.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

// A soft gold glow that breathes behind the auction's leading player.
export function LeaderGlow({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center">
      <AnimatePresence>
        {active && (
          <m.span
            aria-hidden
            className="absolute -inset-1.5 rounded-full bg-gold/60 blur-md"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0.45, 1, 0.45], scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: DURATION.glowPulse, repeat: Infinity, ease: "easeInOut" },
              scale: SPRING.pop,
            }}
          />
        )}
      </AnimatePresence>
      <span className="relative inline-grid">{children}</span>
    </span>
  );
}

// A number that counts up from 0 when it first appears (results scores).
// Screen readers get the final number straight away.
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const shown = useAnimatedNumber(value, DURATION.countUp * 1000, 0);
  return (
    <span className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden>{shown}</span>
    </span>
  );
}
