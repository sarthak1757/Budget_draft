import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Link } from "react-router";
import { HelpButton } from "./HowToPlay";
import { MuteButton } from "./MuteButton";
import { Hairline, Label, PILL_CLASSES, UrgentNote, type PillVariant } from "./brand/primitives";

// Small building blocks shared by every page, so buttons and cards look the same everywhere.
// They use the editorial theme tokens (see /style-guide).

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

// "danger" has no red to use: it's an outlined pill with a gold ring.
const DANGER_CLASSES =
  "ring-1 ring-gold text-ivory hover:bg-ink-hover disabled:text-mist/40 disabled:ring-mist/15";

function variantClasses(variant: ButtonVariant): string {
  if (variant === "danger") {
    return DANGER_CLASSES;
  }
  const pill: PillVariant = variant;
  return PILL_CLASSES[pill];
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  ref?: Ref<HTMLButtonElement>; // React 19 passes ref as a normal prop
}

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const classes = `min-h-11 rounded-full px-6 py-3 font-body font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses(variant)} ${className}`;
  return <button type="button" className={classes} {...rest} />;
}

export function PageShell({ title, children, backTo }: { title?: string; children: ReactNode; backTo?: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Padded by the notch / status bar height when installed full-screen. */}
      <header className="border-b border-mist/15 bg-ink-raised pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-1.5 sm:gap-5 sm:px-8 sm:py-2">
          {backTo !== undefined && (
            <Link to={backTo} className="label-caps -ml-2 inline-flex min-h-11 items-center px-2 text-mist hover:text-ivory">
              ← Back
            </Link>
          )}
          <Link to="/" className="display-serif inline-flex min-h-11 items-center text-2xl text-ivory">
            Budget Draft
          </Link>
          <nav className="ml-auto hidden items-center gap-6 sm:flex" aria-label="Main">
            <Link to="/" className="label-caps inline-flex min-h-11 min-w-11 items-center justify-center text-mist hover:text-ivory">
              Play
            </Link>
            <Link to="/daily" className="label-caps inline-flex min-h-11 min-w-11 items-center justify-center text-mist hover:text-ivory">
              Daily
            </Link>
            <Link to="/leaderboard" className="label-caps inline-flex min-h-11 min-w-11 items-center justify-center text-mist hover:text-ivory">
              Leaderboard
            </Link>
            <Link to="/games" className="label-caps inline-flex min-h-11 min-w-11 items-center justify-center text-mist hover:text-ivory">
              My games
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <MuteButton />
            <HelpButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 pb-16 sm:px-8 sm:pt-12">
        {title !== undefined && <h1 className="display-serif mb-10 text-5xl text-ivory sm:text-7xl">{title}</h1>}
        <main className="flex-1">{children}</main>
      </div>

      <footer className="border-t border-mist/15 bg-ink-raised">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
          <Label>Build the best team with $20</Label>
          <Label className="text-mist/70">No. 20</Label>
        </div>
      </footer>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`[&.grid]:grid-cols-[minmax(0,1fr)] rounded-[1.75rem] border border-mist/15 bg-ink-raised p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-mist">
      <span className="size-5 animate-spin rounded-full border border-mist/15 border-t-ivory" />
      <Label>{label}</Label>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-4 rounded-[1.75rem] bg-ink-raised p-5 ring-1 ring-gold">
      <UrgentNote>{message}</UrgentNote>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// A hairline-separated heading used inside cards ("Players", "Rules").
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3">
      <Label className="text-ivory">{children}</Label>
      <Hairline />
    </div>
  );
}
