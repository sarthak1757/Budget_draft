import { m, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { DISTANCE, DURATION, EASE, SPRING, STAGGER } from "../../lib/motion";
import { ChromeBlob } from "./ChromeBlob";

const WORD_CLASS =
  "display-serif relative z-10 block text-[22vw] leading-[0.8] text-ivory [text-shadow:0_4px_28px_var(--color-ink-raised)] sm:text-[11rem]";

// The letters rise in only the first time the home page shows in a visit,
// not every time you come back to it.
let lettersHavePlayed = false;

// "Budget" / "Draft" split around a chrome blob. The blob sits BEHIND the
// letters (z-0) and peeks out to the right, so every letter stays readable.
export function HeroTitle() {
  const [riseIn] = useState(() => !lettersHavePlayed);
  useEffect(() => {
    lettersHavePlayed = true;
  }, []);

  return (
    <div className="relative">
      <ParallaxBlob />
      <h1>
        <span className="sr-only">Budget Draft</span>
        <span aria-hidden className={WORD_CLASS}>
          <Letters word="Budget" startAt={0} riseIn={riseIn} />
        </span>
        <span aria-hidden className={`${WORD_CLASS} pl-[18vw] sm:pl-56`}>
          <Letters word="Draft" startAt={6} riseIn={riseIn} />
        </span>
      </h1>
    </div>
  );
}

function Letters({ word, startAt, riseIn }: { word: string; startAt: number; riseIn: boolean }) {
  return (
    <>
      {word.split("").map((letter, index) => (
        <m.span
          key={index}
          className="inline-block"
          initial={riseIn ? { y: "0.35em", opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: DURATION.letterRise, ease: EASE.out, delay: (startAt + index) * STAGGER.letter }}
        >
          {letter}
        </m.span>
      ))}
    </>
  );
}

// Tilting a phone only works without a permission prompt (Android).
// iPhones ask for permission first, so they're skipped.
function canTiltWithoutAsking(): boolean {
  if (typeof DeviceOrientationEvent === "undefined") {
    return false;
  }
  return !("requestPermission" in DeviceOrientationEvent);
}

// The blob drifts a little toward the mouse on desktop, and leans with the
// phone where that needs no permission. Off with reduce motion.
function ParallaxBlob() {
  const reduce = useReducedMotion() === true;
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING.parallax);
  const y = useSpring(rawY, SPRING.parallax);

  useEffect(() => {
    if (reduce) {
      return;
    }
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    function onPointerMove(event: PointerEvent) {
      // -1..1 from the centre of the window.
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      rawX.set(nx * DISTANCE.parallax);
      rawY.set(ny * DISTANCE.parallax);
    }

    function onTilt(event: DeviceOrientationEvent) {
      if (event.gamma === null || event.beta === null) {
        return;
      }
      // gamma: left/right lean (-90..90). beta: front/back, about 45° when held.
      const nx = Math.max(-1, Math.min(1, event.gamma / 30));
      const ny = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
      rawX.set(nx * DISTANCE.parallax);
      rawY.set(ny * DISTANCE.parallax);
    }

    if (finePointer) {
      window.addEventListener("pointermove", onPointerMove);
      return () => window.removeEventListener("pointermove", onPointerMove);
    }
    if (canTiltWithoutAsking()) {
      window.addEventListener("deviceorientation", onTilt);
      return () => window.removeEventListener("deviceorientation", onTilt);
    }
    return;
  }, [reduce]);

  return (
    <m.div className="absolute top-[4%] left-[52%] z-0 w-[44vw] max-w-80 sm:left-[50%]" style={{ x, y }}>
      <ChromeBlob shape="pebble" className="w-full" />
    </m.div>
  );
}
