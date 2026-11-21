import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router";
import { computeResults } from "@budget-draft/shared";
import { DailyResultPanel } from "../components/DailyResultPanel";
import { ResultsView } from "../components/ResultsView";
import { PillLink } from "../components/brand/primitives";
import { Button, PageShell } from "../components/ui";
import { submitLocalResult } from "../lib/localResults";
import { useLocalGameStore } from "../store/localGameStore";

export function LocalResultsPage() {
  const navigate = useNavigate();
  const game = useLocalGameStore((store) => store.game);
  const reset = useLocalGameStore((store) => store.reset);
  const resultSubmitted = useLocalGameStore((store) => store.resultSubmitted);
  const markResultSubmitted = useLocalGameStore((store) => store.markResultSubmitted);
  const daily = useLocalGameStore((store) => store.daily);

  // Store the finished game on the server once (it won't count for the leaderboard).
  // A daily is sent by DailyResultPanel instead.
  useEffect(() => {
    if (game !== null && game.phase === "finished" && !resultSubmitted && daily === null) {
      markResultSubmitted();
      void submitLocalResult(game);
    }
  }, [game, resultSubmitted, markResultSubmitted, daily]);

  if (!game) {
    return <Navigate to="/" replace />;
  }
  if (game.phase !== "finished") {
    return <Navigate to="/play" replace />;
  }

  const results = computeResults(game);
  const mode = game.mode;
  let humanTotal = 0;
  for (const score of results.scores) {
    const player = game.players.find((p) => p.id === score.playerId);
    if (player && !player.isBot) {
      humanTotal = score.total;
    }
  }
  const categorySlug = game.settings.categorySlug;

  function playAgain() {
    reset();
    navigate(`/new/${mode}/${categorySlug}`);
  }

  return (
    <PageShell title="Results">
      <ResultsView
        players={game.players}
        results={results}
        requiredRoles={game.requiredRoles}
        hideShare={daily !== null}
        actions={
          <>
            {daily === null && (
              <Button variant="secondary" onClick={playAgain}>
                Play again
              </Button>
            )}
            <PillLink to="/" variant="ghost">
              <span onClick={reset}>Home</span>
            </PillLink>
          </>
        }
      />
      {daily !== null && (
        <DailyResultPanel
          game={game}
          daily={daily}
          total={humanTotal}
          alreadySubmitted={resultSubmitted}
          onSubmitted={markResultSubmitted}
        />
      )}
    </PageShell>
  );
}
