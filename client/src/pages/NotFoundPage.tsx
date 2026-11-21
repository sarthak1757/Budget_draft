import { ChromeBlob } from "../components/brand/ChromeBlob";
import { ArrowLink, Label, PillLink } from "../components/brand/primitives";
import { PageShell } from "../components/ui";

// Any address the app doesn't know (a mistyped link, an old bookmark).
export function NotFoundPage() {
  return (
    <PageShell>
      <section className="relative grid gap-6 py-6 sm:py-12" aria-labelledby="not-found-title">
        <ChromeBlob shape="ribbon" className="pointer-events-none absolute -top-4 right-0 w-28 opacity-90 sm:w-44" />
        <Label>Error 404</Label>
        <h1 id="not-found-title" className="display-serif max-w-xl text-6xl text-ivory sm:text-8xl">
          This page went <span className="text-gold">unsold</span>.
        </h1>
        <p className="max-w-md text-mist">
          Nobody bid on this address. Check the link, or head back and start a draft.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <PillLink to="/" variant="primary">
            Go home
          </PillLink>
          <PillLink to="/join">
            Join a room
          </PillLink>
        </div>
        <ArrowLink to="/games">See my games</ArrowLink>
      </section>
    </PageShell>
  );
}
