import { useEffect, useRef, useState } from "react";
import { GAME_MOMENT } from "./motion";

// Smoothly counts from the previous value to the new one (e.g. $20 -> $11),
// so players can see money leave a budget instead of it just changing.
export function useAnimatedNumber(target: number, durationMs = GAME_MOMENT.coin * 1000): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) {
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      fromRef.current = target;
      setShown(target);
      return;
    }

    const start = performance.now();
    let frame = 0;
    function step(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out: fast first, then settles
      const value = Math.round(from + (target - from) * eased);
      setShown(value);
      fromRef.current = value;
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return shown;
}
