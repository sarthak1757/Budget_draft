import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { getCurrentPlayerId, toPublicState, type PlayerState } from "@budget-draft/shared";
import { GameBoard } from "../components/GameBoard";
import { HandoffScreen } from "../components/HandoffScreen";
import { YourTurnBanner } from "../components/YourTurnBanner";
import { Sheet } from "../components/Sheet";
import { UrgentNote } from "../components/brand/primitives";
import { Button, PageShell } from "../components/ui";
import { VotePanel } from "../components/VotePanel";
import { describeEvent } from "../lib/describeEvents";
import { needsHandoff, whoNeedsDevice } from "../lib/handoff";
import { useBotTurns } from "../lib/useBotTurns";
import { useLocalGameStore } from "../store/localGameStore";

function findPlayer(players: PlayerState[], id: string | null): PlayerState | undefined {
  for (const player of players) {
    if (player.id === id) {
      return player;
    }
  }
  return undefined;
}

export function LocalGamePage() {
  const navigate = useNavigate();
  const game = useLocalGameStore((store) => store.game);
  const deviceHolderId = useLocalGameStore((store) => store.deviceHolderId);
  const error = useLocalGameStore((store) => store.error);
  const act = useLocalGameStore((store) => store.act);
  const peek = useLocalGameStore((store) => store.peek);
  const peeked = useLocalGameStore((store) => store.peeked);
  const vote = useLocalGameStore((store) => store.vote);
  const confirmHandoff = useLocalGameStore((store) => store.confirmHandoff);
  const reset = useLocalGameStore((store) => store.reset);
  const playBotTurn = useLocalGameStore((store) => store.playBotTurn);
  // Must run before any early return (React hooks always run in the same order).
  const botIsThinking = useBotTurns(game, playBotTurn);
  const [confirmingQuit, setConfirmingQuit] = useState(false);

  if (!game) {
    return <Navigate to="/" replace />;
  }
  if (game.phase === "finished") {
    return <Navigate to="/results" replace />;
  }

  function quit() {
    setConfirmingQuit(false);
    reset();
    navigate("/");
  }

  const quitButton = (
    <>
      <Button variant="ghost" className="py-2 text-sm" onClick={() => setConfirmingQuit(true)}>
        Quit game
      </Button>
      <Sheet open={confirmingQuit} onClose={() => setConfirmingQuit(false)} title="Quit game">
        <p className="display-serif text-4xl text-ivory">Quit this game?</p>
        <p className="text-mist">Progress will be lost.</p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirmingQuit(false)}>
            Keep playing
          </Button>
          <Button variant="danger" onClick={quit}>
            Quit
          </Button>
        </div>
      </Sheet>
    </>
  );

  const nextHolder = findPlayer(game.players, whoNeedsDevice(game));
  if (nextHolder && needsHandoff(game, deviceHolderId)) {
    const activity: string[] = [];
    for (const event of game.lastEvents) {
      activity.push(describeEvent(event, game.players));
    }
    return (
      <PageShell>
        <HandoffScreen
          playerName={nextHolder.name}
          purpose={game.phase === "voting" ? "vote" : "turn"}
          recentActivity={activity}
          onReady={confirmHandoff}
        />
        <div className="text-center">{quitButton}</div>
      </PageShell>
    );
  }

  if (game.phase === "voting") {
    const voter = findPlayer(game.players, whoNeedsDevice(game));
    if (!voter) {
      return <Navigate to="/results" replace />;
    }
    return (
      <PageShell>
        <VotePanel voterId={voter.id} voterName={voter.name} players={game.players} onVote={vote} />
        {error && (
          <p role="alert" className="mt-4 text-center">
            <UrgentNote>{error}</UrgentNote>
          </p>
        )}
      </PageShell>
    );
  }

  const currentPlayer = findPlayer(game.players, getCurrentPlayerId(game));
  let turnLabel = "";
  if (currentPlayer && botIsThinking) {
    turnLabel = `${currentPlayer.name} is thinking…`;
  } else if (currentPlayer && game.mode === "bot") {
    turnLabel = "It's your turn";
  } else if (currentPlayer) {
    turnLabel = `${currentPlayer.name}'s turn`;
  }

  // Solo vs bots: "Your turn" when the bots are done. Pass and play has
  // its own hand-off screen between turns instead.
  let humanCount = 0;
  for (const player of game.players) {
    if (!player.isBot) {
      humanCount += 1;
    }
  }
  const soloTurn = humanCount === 1 && currentPlayer !== undefined && !currentPlayer.isBot;

  return (
    <PageShell>
      <YourTurnBanner isMyTurn={soloTurn} />
      <GameBoard
        state={toPublicState(game)}
        viewerId={null}
        canAct={currentPlayer !== undefined && !currentPlayer.isBot}
        turnLabel={turnLabel}
        onMove={act}
        peeked={peeked}
        onPeek={peek}
      />
      {error && (
        <p role="alert" className="mt-4 text-center">
          <UrgentNote>{error}</UrgentNote>
        </p>
      )}
      <div className="mt-6 text-center">{quitButton}</div>
    </PageShell>
  );
}
