import { AnimatePresence, motion } from "motion/react";
import { Route, Routes, useLocation } from "react-router";
import { HowToPlay } from "./components/HowToPlay";
import { DISTANCE, enterTransition, exitTransition } from "./lib/motion";
import { Toaster } from "./components/Toaster";
import { AdminPage } from "./pages/AdminPage";
import { CategoryPickerPage } from "./pages/CategoryPickerPage";
import { DailyPage } from "./pages/DailyPage";
import { HomePage } from "./pages/HomePage";
import { LocalGamePage } from "./pages/LocalGamePage";
import { LocalResultsPage } from "./pages/LocalResultsPage";
import { JoinPage } from "./pages/JoinPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { MyGamesPage } from "./pages/MyGamesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { NewGamePage } from "./pages/NewGamePage";
import { RoomPage } from "./pages/RoomPage";
import { StyleGuidePage } from "./pages/StyleGuidePage";

export function App() {
  const location = useLocation();
  return (
    <>
      <Toaster />
      <HowToPlay />
      {/* Pages fade and slide between routes. The old page leaves quickly
          before the new one arrives (mode="wait"), so they never overlap. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: DISTANCE.page }}
          animate={{ opacity: 1, y: 0, transition: enterTransition }}
          exit={{ opacity: 0, y: -DISTANCE.page / 2, transition: exitTransition }}
        >
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
        </motion.div>
      </AnimatePresence>
    </>
  );
}
