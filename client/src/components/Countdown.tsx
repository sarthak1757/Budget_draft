import { motion, MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { playSound } from "../store/soundStore";
import { Label, UrgentNote } from "./brand/primitives";

interface CountdownProps {
  deadline: number | null; // epoch ms from the server
  totalSeconds: number;
  label: string;
  // full: label, big number and a line underneath. compact: just the number,
  // for the phone's bottom bar. Both also draw a thin bar across the top of the screen.
  variant?: "full" | "compact";
}

// Shows the seconds left on a server timer as a thin shrinking line.
// Phone clocks are often a few seconds off from the server, so we never show
// more than the full timer length: the server decides when time is up anyway.
export function Countdown({ deadline, totalSeconds, label, variant = "full" }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const [localEnd, setLocalEnd] = useState<number | null>(null);

  useEffect(() => {
    if (deadline === null) {
      setLocalEnd(null);
      return;
    }
    const remaining = Math.min(deadline - Date.now(), totalSeconds * 1000);
    setLocalEnd(Date.now() + Math.max(0, remaining));
  }, [deadline, totalSeconds]);

  useEffect(() => {
    if (localEnd === null) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [localEnd]);

  const running = localEnd !== null && totalSeconds > 0;
  const msLeft = localEnd === null ? 0 : Math.max(0, localEnd - now);
  const secondsLeft = Math.ceil(msLeft / 1000);

  // Tick once per second during the last 5 seconds.
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (running && secondsLeft > 0 && secondsLeft <= 5 && lastTick.current !== secondsLeft) {
      playSound("tick");
    }
    lastTick.current = secondsLeft;
  }, [running, secondsLeft]);

  if (!running) {
    return null;
  }
  // No red in the palette: urgency is a pulsing gold number and an icon.
  const urgent = secondsLeft <= 5;

  const barColour = urgent ? "bg-gold" : "bg-mist";
  const totalMs = totalSeconds * 1000;

  // Pinned to the top edge (below the notch), so the time left is always in
  // view even when the number has scrolled away.
  const topBar = (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-40 h-1 bg-mist/15">
      <TimerBar end={localEnd} totalMs={totalMs} className={barColour} />
    </div>
  );

  if (variant === "compact") {
    return (
      <>
        {topBar}
        <span
          role="timer"
          aria-label={`${label}: ${secondsLeft} seconds left`}
          className={`display-serif inline-block origin-right text-2xl tabular-nums ${urgent ? "animate-urgent text-gold" : "text-ivory"}`}
        >
          {secondsLeft}s
        </span>
      </>
    );
  }

  return (
    <div role="timer" aria-label={`${label}: ${secondsLeft} seconds left`} className="grid gap-2">
      {topBar}
      <div className="flex items-baseline justify-between">
        {urgent ? <UrgentNote>Hurry</UrgentNote> : <Label>{label}</Label>}
        <span
          className={`display-serif origin-right text-3xl tabular-nums ${urgent ? "animate-urgent text-gold" : "text-ivory"}`}
        >
          {secondsLeft}s
        </span>
      </div>
      <div className="h-[2px] bg-mist/20">
        <TimerBar end={localEnd} totalMs={totalMs} className={barColour} />
      </div>
    </div>
  );
}

// The time left as a bar that shrinks smoothly to nothing at the deadline:
// one linear transform animation per turn, not a re-render per tick.
// It carries information, so it keeps moving with reduce motion on.
function TimerBar({ end, totalMs, className }: { end: number; totalMs: number; className: string }) {
  const remaining = Math.max(0, end - Date.now());
  return (
    <MotionConfig reducedMotion="never">
      <motion.div
        key={end}
        className={`h-full origin-left ${className}`}
        initial={{ scaleX: Math.min(1, remaining / totalMs) }}
        animate={{ scaleX: 0 }}
        transition={{ duration: remaining / 1000, ease: "linear" }}
      />
    </MotionConfig>
  );
}
