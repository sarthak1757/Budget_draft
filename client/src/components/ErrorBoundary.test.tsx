import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { NotFoundPage } from "../pages/NotFoundPage";
import { CrashScreen, ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("switches to the crash screen once something throws", () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it("shows its children while nothing is broken", () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(html).toBe("<p>All good</p>");
  });

  it("offers a reload and a way home without needing the router", () => {
    const html = renderToStaticMarkup(<CrashScreen />);
    expect(html).toContain("Something broke");
    expect(html).toContain(">Reload</button>");
    expect(html).toContain('href="/"');
  });
});

describe("NotFoundPage", () => {
  it("links home, to joining and to my games", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/nope"]}>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(html).toContain("Error 404");
    expect(html).toContain('href="/join"');
    expect(html).toContain('href="/games"');
  });
});
