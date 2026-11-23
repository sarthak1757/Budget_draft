import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DISTANCE, enterTransition, exitTransition } from "../lib/motion";
import { useToastStore, type ToastTone } from "../store/toastStore";
import { UrgentNote } from "./brand/primitives";

// One hairline pill for every tone. There is no warning colour in the palette,
// so a warning is gold text with a pulsing "!" instead.
const TONE_CLASSES: Record<ToastTone, string> = {
  info: "text-mist",
  success: "text-ivory",
  warning: "",
};

// Shows toasts at the top of the screen, away from the BUY/PASS buttons and other main actions.
export function Toaster() {
  const toasts = useToastStore((store) => store.toasts);
  const dismissToast = useToastStore((store) => store.dismissToast);
  const slide = useReducedMotion() === true ? 0 : -DISTANCE.banner; // reduce motion: fade only

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 pt-[env(safe-area-inset-top)]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            layout="position"
            initial={{ y: slide, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: enterTransition }}
            exit={{ y: slide, opacity: 0, transition: exitTransition }}
            onClick={() => dismissToast(toast.id)}
            className={`pointer-events-auto max-w-sm rounded-full bg-ink-raised px-5 py-3 text-left text-sm font-medium shadow-xl ring-1 ring-mist/15 ${TONE_CLASSES[toast.tone]}`}
        >
            {toast.tone === "warning" ? <UrgentNote>{toast.message}</UrgentNote> : toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
