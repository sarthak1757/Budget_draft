import { StrictMode, type ReactNode } from "react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useLayoutAnimations } from "./lib/layoutAnimations";
// Self-hosted fonts (Latin only, to keep the download small).
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <Motion>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Motion>
    </ErrorBoundary>
  </StrictMode>,
);

// Animations, exits and hover/tap for every `m` component, plus layout
// animations once they've been downloaded (lib/layoutAnimations.ts).
// `strict` throws on a full `motion` component, which would bring back the
// code this leaves out.
function Motion({ children }: { children: ReactNode }) {
  const layoutFeatures = useLayoutAnimations();
  return (
    <LazyMotion features={layoutFeatures ?? domAnimation} strict>
      {/* "user": with reduce motion on, movement is skipped and fades stay. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
