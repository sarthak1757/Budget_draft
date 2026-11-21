import { Route, Routes } from "react-router";
import { ArrowLink } from "./components/brand/primitives";
import { HowToPlay } from "./components/HowToPlay";
import { Toaster } from "./components/Toaster";
import { PageShell } from "./components/ui";
import { AdminPage } from "./pages/AdminPage";
import { CategoryPickerPage } from "./pages/CategoryPickerPage";
import { DailyPage } from "./pages/DailyPage";
import { HomePage } from "./pages/HomePage";
import { LocalGamePage } from "./pages/LocalGamePage";
import { LocalResultsPage } from "./pages/LocalResultsPage";
import { JoinPage } from "./pages/JoinPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { MyGamesPage } from "./pages/MyGamesPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { NewGamePage } from "./pages/NewGamePage";
import { RoomPage } from "./pages/RoomPage";
import { StyleGuidePage } from "./pages/StyleGuidePage";

export function App() {
  return (
    <>
      <Toaster />
      <HowToPlay />
      <Routes>
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
    </>
  );
}

function NotFoundPage() {
  return (
    <PageShell title="Page not found">
      <p className="mb-6 text-mist">That page doesn't exist.</p>
      <ArrowLink to="/">Go home</ArrowLink>
    </PageShell>
  );
}
