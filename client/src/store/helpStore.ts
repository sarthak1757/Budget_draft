import { create } from "zustand";
import { hasSeenHowToPlay, markHowToPlaySeen } from "../lib/howToPlaySeen";

interface HelpStore {
  open: boolean;
  show: () => void;
  hide: () => void;
}

// Whether the how-to-play cards are open. They open by themselves on the
// first visit; the "?" button in the header opens them again.
export const useHelpStore = create<HelpStore>()((set) => ({
  open: !hasSeenHowToPlay(),
  show: () => set({ open: true }),
  hide: () => {
    markHowToPlaySeen();
    set({ open: false });
  },
}));
