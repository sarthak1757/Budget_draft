import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Link } from "react-router";

// The building blocks of the editorial theme. Every colour is a theme token
// (ink, ivory, mist, ...): no raw hex here or in any component.

// ---- Text ----

// Tiny uppercase letter-spaced label ("SLOT 1", "ROOM CODE", prices, timer).
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`label-caps text-mist ${className}`}>{children}</span>;
}

// Small vertical label running up the side of a section, used sparingly.
export function SideLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={`label-caps side-label text-mist/70 ${className}`}>
      {children}
    </span>
  );
}

// A 1px mist line at 30% opacity.
export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`h-px border-0 bg-mist/15 ${className}`} />;
}

// ---- Buttons and links ----

export type PillVariant = "primary" | "secondary" | "ghost";

export const PILL_CLASSES: Record<PillVariant, string> = {
  // ivory fill + ink text (5.77:1), mist on hover (5.86:1).
  primary:
    "bg-gold text-ink hover:bg-ivory disabled:bg-transparent disabled:text-mist/50 disabled:ring-1 disabled:ring-mist/15",
  // 1px mist outline.
  secondary: "ring-1 ring-mist text-mist hover:bg-ink-hover disabled:text-mist/40 disabled:ring-mist/15",
  ghost: "text-mist hover:bg-ink-hover disabled:text-mist/40",
};

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant;
  ref?: Ref<HTMLButtonElement>;
}

export function PillButton({ variant = "primary", className = "", ...rest }: PillButtonProps) {
  const classes = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 font-body font-medium transition active:scale-[0.96] enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:active:scale-100 ${PILL_CLASSES[variant]} ${className}`;
  return <button type="button" className={classes} {...rest} />;
}

// A link that looks like a pill button.
export function PillLink({
  to,
  variant = "secondary",
  children,
  className = "",
}: {
  to: string;
  variant?: PillVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 font-body font-medium transition hover:-translate-y-0.5 active:scale-[0.96] ${PILL_CLASSES[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

// Text fields are just a hairline underline under ivory text.
// text-lg (18px): anything under 16px makes iPhones zoom in when you tap the field.
export const INPUT_CLASS =
  "w-full border-b border-mist/60 bg-transparent py-2 font-body text-lg text-ivory outline-none placeholder:text-mist/50 focus:border-ivory disabled:opacity-50";

// "→ EXPLORE": an arrow in a thin circle next to a small uppercase label.
function ArrowContent({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-full ring-1 ring-mist/60 transition group-hover:bg-ivory group-hover:text-ink group-hover:ring-ivory"
      >
        →
      </span>
      <span className="label-caps">{children}</span>
    </>
  );
}

const ARROW_CLASSES = "group inline-flex min-h-11 items-center gap-3 text-mist hover:text-ivory";

export function ArrowLink({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`${ARROW_CLASSES} ${className}`}>
      <ArrowContent>{children}</ArrowContent>
    </Link>
  );
}

export function ArrowButton({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`${ARROW_CLASSES} ${className}`}>
      <ArrowContent>{children}</ArrowContent>
    </button>
  );
}

// ---- Surfaces ----

// The card surface: ink-raised with a thin mist border.
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`[&.grid]:grid-cols-[minmax(0,1fr)] rounded-[1.75rem] border border-mist/15 bg-ink-raised p-6 ${className}`}>{children}</div>;
}

// ---- Game pieces ----

// The price in a ivory circle.
// "fluid" is 64px on phones and 80px from the md breakpoint up.
const BADGE_SIZES = {
  sm: "size-12 text-2xl",
  lg: "size-20 text-4xl",
  fluid: "size-16 text-3xl md:size-20 md:text-4xl",
};

export function PriceBadge({ price, label = "Price", size = "lg" }: { price: number; label?: string; size?: keyof typeof BADGE_SIZES }) {
  const circle = BADGE_SIZES[size];
  return (
    <span className="inline-flex flex-col items-center gap-1.5">
      <span className={`display-serif grid place-items-center rounded-full bg-gold text-ink ${circle}`}>
        <span className="sr-only">{label}: </span>${price}
      </span>
      <Label>{label}</Label>
    </span>
  );
}

// Rating as a thin mist bar. null = a mystery item (hidden rating).
export function RatingBar({ rating, className = "" }: { rating: number | null; className?: string }) {
  const percent = rating === null ? 0 : Math.max(0, Math.min(100, rating));
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <Label>Rating</Label>
        <span className="display-serif text-2xl text-ivory">{rating === null ? "?" : rating}</span>
      </div>
      <div
        className="h-[2px] w-full bg-mist/20"
        role="meter"
        aria-label="Rating"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rating ?? undefined}
        aria-valuetext={rating === null ? "hidden until the draft ends" : `${rating} out of 100`}
      >
        <div className="h-full bg-mist" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// Urgency without a warning colour: a pulsing gold "!" icon next to
// ivory text. The words stay ivory (not gold) so they keep AA
// contrast on every background: gold small text is only 3.44:1 on ink.
export function UrgentNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-body text-sm font-medium text-ivory ${className}`}>
      <span
        aria-hidden
        className="animate-urgent grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-gold ring-1 ring-gold"
      >
        !
      </span>
      {children}
    </span>
  );
}

// Thin-line icons (lucide) share one stroke weight so they read as a set.
export const ICON_STROKE = 1.25;
