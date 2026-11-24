import { lazy, type ComponentType, type LazyExoticComponent } from "react";

// React.lazy for a module's named export (our components aren't default exports).
// The type comes from the export itself, so the lazy component keeps its props.
export function lazyNamed<M, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
): LazyExoticComponent<M[K] & ComponentType<PropsOf<M[K]>>> {
  return lazy(async () => {
    const module = await load();
    return { default: module[name] as M[K] & ComponentType<PropsOf<M[K]>> };
  });
}

type PropsOf<C> = C extends ComponentType<infer P> ? P : never;
