import { m } from "motion/react";
import { DURATION, EASE } from "../lib/motion";
import { Label } from "./brand/primitives";

// Covers the room while the connection is down or the phone has just woken
// up, so nobody taps BUY on a board that may be out of date. It goes away
// by itself as soon as the server has sent the latest state.
export function ReconnectingOverlay() {
  return (
    <m.div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/75 p-6 backdrop-blur-sm"
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.modal }}
    >
      <m.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DURATION.modal, ease: EASE.out }}
        className="grid justify-items-center gap-4 rounded-[1.75rem] bg-ink-raised px-8 py-7 text-center ring-1 ring-mist/15">
        <span className="size-7 animate-spin rounded-full border border-mist/15 border-t-gold" aria-hidden />
        <p className="display-serif text-3xl text-ivory">Reconnecting…</p>
        <Label className="text-mist/80">Catching up with the game</Label>
      </m.div>
    </m.div>
  );
}
