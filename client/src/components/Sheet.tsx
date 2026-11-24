import { X } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { DURATION, EASE, SPRING } from "../lib/motion";
import { useIsPhone } from "../lib/useMediaQuery";
import { ICON_STROKE, Label } from "./brand/primitives";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string; // shown as a small label, and names the dialog for screen readers
  children: ReactNode;
  className?: string; // extra classes for the panel
}

// A bottom sheet on phones, a centred dialog on wider screens.
// Built on <dialog>.showModal(), so the browser handles the focus trap,
// Esc to close, and makes the page behind it inert.
export function Sheet({ open, onClose, title, children, className = "" }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isPhone = useIsPhone();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Tapping the dimmed area outside the panel closes it. The dialog element
  // covers the whole screen, so a click on the dialog itself (not its
  // content) is a click on the backdrop.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }

  // md:open:grid, not md:grid: a plain display class would show a closed dialog.
  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={onClose}
      onClick={handleClick}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-mist backdrop:bg-ink/80 md:open:grid md:place-items-center"
    >
      {open && (
        // Phones: slides up from the bottom edge on a spring.
        // Wider screens: a centred dialog that scales in from 96%.
        <m.div
          initial={isPhone ? { y: "100%", opacity: 0 } : { scale: 0.96, opacity: 0 }}
          animate={isPhone ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={isPhone ? { y: SPRING.sheet, opacity: { duration: DURATION.exit } } : { duration: DURATION.modal, ease: EASE.out }}
          className={`absolute inset-x-0 bottom-0 grid max-h-[88dvh] grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto rounded-t-[2rem] bg-ink-raised px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-mist/15 md:static md:w-full md:max-w-md md:rounded-[2rem] md:p-7 ${className}`}
        >
          {/* The grab handle: tells phone users this slid up from the bottom. */}
          <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-mist/30 md:hidden" />
          <div className="flex items-center justify-between gap-4">
            <Label>{title}</Label>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-mist hover:bg-ink-hover"
            >
              <X size={18} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </div>
          {children}
        </m.div>
      )}
    </dialog>
  );
}
