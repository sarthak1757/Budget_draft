import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Suspense, useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { lazyNamed } from "./lib/lazyNamed";
import { DISTANCE, enterTransition, exitTransition } from "./lib/motion";
import { useHelpStore } from "./store/helpStore";
import { loadLocalResultsPage } from "./lib/lazyPages";
import { Toaster } from "./components/Toaster";
import { CategoryPickerPage } from "./pages/CategoryPickerPage";
import { HomePage } from "./pages/HomePage";
import { LocalGamePage } from "./pages/LocalGamePage";
import { JoinPage } from "./pages/JoinPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { NewGamePage } from "./pages/NewGamePage";
import { RoomPage } from "./pages/RoomPage";

// Loaded only when opened, to keep the first download small.
const AdminPage = lazyNamed(() => import("./pages/AdminPage"), "AdminPage");
const DailyPage = lazyNamed(() => import("./pages/DailyPage"), "DailyPage");
const GameDetailPage = lazyNamed(() => import("./pages/GameDetailPage"), "GameDetailPage");
const LeaderboardPage = lazyNamed(() => import("./pages/LeaderboardPage"), "LeaderboardPage");
const LocalResultsPage = lazyNamed(loadLocalResultsPage, "LocalResultsPage");
const MyGamesPage = lazyNamed(() => import("./pages/MyGamesPage"), "MyGamesPage");
const StyleGuidePage = lazyNamed(() => import("./pages/StyleGuidePage"), "StyleGuidePage");
const HowToPlay = lazyNamed(() => import("./components/HowToPlay"), "HowToPlay");

export function App() {
  const location = useLocation();
  const leaveBy = useReducedMotion() === true ? 0 : -DISTANCE.page / 2; // reduce motion: fade only
  return (
    <>
      <Toaster />
      <LazyHowToPlay />
      {/* Pages fade and slide between routes. The old page leaves quickly
          before the new one arrives (mode="wait"), so they never overlap. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: DISTANCE.page }}
          animate={{ opacity: 1, y: 0, transition: enterTransition }}
          exit={{ opacity: 0, y: leaveBy, transition: exitTransition }}
        >
          {/* While a page's code downloads: an empty page the same height, no flash. */}
          <Suspense fallback={<div className="min-h-dvh" />}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/new/:mode" element={<CategoryPickerPage />} />
              <Route path="/new/:mode/:categorySlug" element={<NewGamePage />} />
              <Route path="/play" element={<LocalGamePage />} />
              <Route path="/results" element={<LocalResultsPage />} />
              <Route path="/join" element={<JoinPage />} />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route path="/room/:code" element={<RoomPage />} />
              <Route path="/daily" element={<DailyPage />} />
              <Route path="/style-guide" element={<StyleGuidePage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/games" element={<MyGamesPage />} />
              <Route path="/games/:id" element={<GameDetailPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// The how-to-play cards download the first time they open (on a first visit,
// or from the "?" button), then stay mounted.
function LazyHowToPlay() {
  const open = useHelpStore((store) => store.open);
  const [everOpened, setEverOpened] = useState(open);
  if (open && !everOpened) {
    setEverOpened(true);
  }
  if (!everOpened) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <HowToPlay />
    </Suspense>
  );
}
