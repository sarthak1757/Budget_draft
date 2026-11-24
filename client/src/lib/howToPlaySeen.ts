// Whether this browser has seen the how-to-play cards. Separate from the
// cards themselves, so checking it doesn't load them.

const SEEN_KEY = "budget-draft:seen-how-to-play";

// `storage` is a parameter so tests can pass a fake one.
export function hasSeenHowToPlay(storage: Storage = localStorage): boolean {
  try {
    return storage.getItem(SEEN_KEY) === "true";
  } catch {
    return true; // storage blocked: don't pop up on every page load
  }
}

export function markHowToPlaySeen(storage: Storage = localStorage): void {
  try {
    storage.setItem(SEEN_KEY, "true");
  } catch {
    // ignore
  }
}
