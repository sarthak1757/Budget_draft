// Loaders for code that's split out of the main chunk but needed right after
// a game: calling them early (when a game starts) means the results show
// without a pause. The import() calls are shared, so it only downloads once.

export function loadLocalResultsPage() {
  return import("../pages/LocalResultsPage");
}

export function loadResultsView() {
  return import("../components/ResultsView");
}
