import type confetti from "canvas-confetti";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONFETTI_MS } from "../lib/motion";
import { PALETTE } from "../lib/palette";

const FRAMES_PER_SECOND = 60; // canvas-confetti's lifetime is counted in frames ("ticks")

// One burst of confetti in the theme colours, from both sides, for about 1.5s.
// canvas-confetti itself is downloaded only when this first mounts.
// It draws on its own canvas without a Web Worker: our CSP doesn't allow
// the blob: worker that canvas-confetti would otherwise start.
// Skipped entirely with reduce motion.
export function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion() === true;
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (reduce || canvas === null) {
      return;
    }
    let cancelled = false;
    let fire: confetti.CreateTypes | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) {
        return;
      }
      fire = confetti.create(canvas, { resize: true, useWorker: false });
      burst(fire);
      // Remove the canvas once the burst is over.
      timer = setTimeout(() => setFinished(true), CONFETTI_MS + 200);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      fire?.reset();
    };
  }, []);

  if (reduce || finished) {
    return null;
  }
  return createPortal(<canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-50 size-full" />, document.body);
}

function burst(fire: confetti.CreateTypes) {
  const shared = {
    particleCount: 70,
    spread: 65,
    startVelocity: 48,
    ticks: Math.round((CONFETTI_MS / 1000) * FRAMES_PER_SECOND),
    colors: [PALETTE.gold, PALETTE.ivory, PALETTE.mist],
    scalar: 0.9,
  };
  void fire({ ...shared, angle: 60, origin: { x: 0.1, y: 0.45 } });
  void fire({ ...shared, angle: 120, origin: { x: 0.9, y: 0.45 } });
}
