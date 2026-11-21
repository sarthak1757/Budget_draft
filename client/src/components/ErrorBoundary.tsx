import { Component, type ErrorInfo, type ReactNode } from "react";
import { ChromeBlob } from "./brand/ChromeBlob";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// Catches a crash anywhere in the page and shows a calm "reload" screen
// instead of a blank one. (React only supports this as a class component.)
// An online game lives on the server, so reloading puts the player back in
// their seat; a local game is saved in this browser.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("The page crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <CrashScreen />;
    }
    return this.props.children;
  }
}

// Plain links and buttons only: the router itself may be what broke.
export function CrashScreen() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16 text-center" role="alert">
      <div className="grid max-w-md justify-items-center gap-6">
        <ChromeBlob shape="ring" className="w-32" float={false} />
        <p className="label-caps text-mist">Something broke</p>
        <h1 className="display-serif text-5xl text-ivory sm:text-6xl">Sorry, that wasn't meant to happen.</h1>
        <p className="text-mist">
          Reload the page to carry on. Online games keep your seat, and local games are saved in this browser.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-full bg-gold px-7 py-3 font-medium text-ink transition hover:bg-ivory"
          >
            Reload
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-full px-7 py-3 font-medium text-ivory ring-1 ring-mist/50 transition hover:bg-ink-hover"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
