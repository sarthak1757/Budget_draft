import type { FeatureBundle } from "motion/react";
import { useSyncExternalStore } from "react";

// Every `m` component runs on motion's small domAnimation features (main.tsx).
// Layout animations (the `layout` prop: lobby rows and toasts sliding into a
// gap) need the bigger domMax, which downloads on demand: the room page asks
// for it as it opens, the toaster with its first toast. Once it has arrived,
// main.tsx hands it to LazyMotion, and `layout` works on every element that
// mounts from then on. Elements already on screen don't pick it up, which is
// why the lobby remounts its rows (invisibly) once it's ready.

let features: FeatureBundle | null = null;
let requested = false;
const listeners = new Set<() => void>();

export function loadLayoutAnimations(): void {
  if (requested) {
    return;
  }
  requested = true;
  void import("./motionMax").then((module) => {
    features = module.default;
    for (const listener of listeners) {
      listener();
    }
  });
}

// domMax once it has downloaded, null until then.
export function useLayoutAnimations(): FeatureBundle | null {
  return useSyncExternalStore(subscribe, getFeatures);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getFeatures() {
  return features;
}
