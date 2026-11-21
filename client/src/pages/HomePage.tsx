import { Link } from "react-router";
import { HeroTitle } from "../components/brand/HeroTitle";
import { Hairline, Label, PillLink } from "../components/brand/primitives";
import { PageShell } from "../components/ui";

interface ModeOption {
  to: string;
  title: string;
  description: string;
  tag?: string; // a small highlighted label
}

const MODES: ModeOption[] = [
  {
    to: "/new/local",
    title: "Pass & Play",
    description: "2–4 players on one device. Hand it over when it's someone else's turn.",
  },
  {
    to: "/new/online",
    title: "Online Room",
    description: "Create a room and share the code. Everyone plays on their own phone.",
  },
  {
    to: "/new/bot",
    title: "Solo vs Bots",
    description: "Draft against 1–3 bots that hunt for value.",
  },
  {
    to: "/daily",
    title: "Daily Challenge",
    description: "Same items for everyone today. One try. Share your score.",
    tag: "Today",
  },
];

export function HomePage() {
  return (
    <PageShell>
      <section className="grid gap-8">
        <HeroTitle />
        <div className="flex items-center gap-4">
          <Label className="text-ivory">Build the best team with $20</Label>
          <Hairline className="flex-1" />
        </div>
        <p className="max-w-xl text-mist">
          Items are revealed one at a time. Buy or pass. Fill every slot without running out of money.
        </p>
      </section>

      <nav aria-label="Game modes" className="mt-14">
        <ul>
          {MODES.map((mode, index) => (
            <li key={mode.to} className="border-t border-mist/15 last:border-b">
              <Link
                to={mode.to}
                className="group -mx-3 grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 rounded-2xl px-3 py-6 transition hover:bg-ink-hover/40 sm:grid-cols-[4rem_1fr_auto]"
              >
                <Label className="text-mist/80">{String(index + 1).padStart(2, "0")}</Label>
                <span>
                  <span className="display-serif block text-4xl text-ivory sm:text-6xl">
                    {mode.title}
                    {mode.tag !== undefined && <Label className="ml-3 align-middle text-gold">{mode.tag}</Label>}
                  </span>
                  <span className="mt-2 block max-w-lg text-sm text-mist">{mode.description}</span>
                </span>
                <span
                  aria-hidden
                  className="grid size-11 place-items-center rounded-full text-mist ring-1 ring-mist/60 transition group-hover:bg-ivory group-hover:text-ink group-hover:ring-ivory"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 flex flex-wrap gap-3">
        <PillLink to="/join">Join with a code</PillLink>
        <PillLink to="/leaderboard">Leaderboard</PillLink>
        <PillLink to="/games">My games</PillLink>
      </div>
    </PageShell>
  );
}
