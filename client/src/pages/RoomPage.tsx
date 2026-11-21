import { Eye, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { getCurrentPlayerId, type PublicPlayerState, type RoomSnapshot } from "@budget-draft/shared";
import { ArrowLink, ICON_STROKE, Label, UrgentNote } from "../components/brand/primitives";
import { Countdown } from "../components/Countdown";
import { GameBoard } from "../components/GameBoard";
import { LobbyView } from "../components/LobbyView";
import { ReactionBar, ReactionLayer } from "../components/Reactions";
import { ResultsView } from "../components/ResultsView";
import { ReconnectingOverlay } from "../components/ReconnectingOverlay";
import { Button, ErrorBox, PageShell, Spinner } from "../components/ui";
import { VotePanel } from "../components/VotePanel";
import { fetchCategories } from "../lib/categories";
import { getStoredName } from "../lib/playerStorage";
import { useAsync } from "../lib/useAsync";
import { useOnlineStore } from "../store/onlineStore";
import { buzz } from "../store/soundStore";

export function RoomPage() {
  const code = (useParams().code ?? "").toUpperCase();
  const navigate = useNavigate();
  const name = getStoredName();
  const store = useOnlineStore();
  const categories = useAsync(fetchCategories, []);
  const enterRoom = store.enterRoom;
  const currentCode = store.code;

  // Connect and join when we arrive. We deliberately don't leave on unmount:
  // only the Leave button leaves, so an accidental back-swipe keeps your seat.
  useEffect(() => {
    if (name !== "" && currentCode !== code) {
      enterRoom(code, name);
    }
  }, [code, name, currentCode, enterRoom]);

  if (name === "") {
    // Opened a room link without a name yet: ask for one first.
    return <Navigate to={`/join/${code}`} replace />;
  }

  async function handleLeave() {
    await store.leaveRoom();
    navigate("/");
  }

  if (store.kicked) {
    return (
      <PageShell title="You were removed" backTo="/">
        <p className="text-mist">The host removed you from room {code}. You can start your own game or join another room.</p>
        <div className="mt-8 grid gap-3 sm:max-w-sm">
          <Button onClick={handleLeave}>Back to home</Button>
          <ArrowLink to="/join">Join another room</ArrowLink>
        </div>
      </PageShell>
    );
  }

  if (store.joinError !== null) {
    return (
      <PageShell title="Couldn't join" backTo="/">
        <ErrorBox message={store.joinError} />
        <ArrowLink to="/join" className="mt-6">
          Try another code
        </ArrowLink>
      </PageShell>
    );
  }

  const room = store.room;
  if (room === null || store.code !== code) {
    return (
      <PageShell>
        <Spinner label="Joining room…" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <RoomContent
        room={room}
        playerId={store.playerId}
        categories={categories.status === "ready" ? categories.data : []}
        busy={store.busy}
        onLeave={handleLeave}
      />
      {store.actionError && (
        <p role="alert" className="mt-4 text-center">
          <UrgentNote>{store.actionError}</UrgentNote>
        </p>
      )}
      {room.game !== null && !isSpectator(room, store.playerId) && (
        <div className="mt-6">
          <ReactionBar onReact={store.react} />
        </div>
      )}
      <ReactionLayer reactions={store.reactions} />
      {store.connection === "reconnecting" && <ReconnectingOverlay />}
    </PageShell>
  );
}

interface RoomContentProps {
  room: RoomSnapshot;
  playerId: string | null;
  categories: Awaited<ReturnType<typeof fetchCategories>>;
  busy: boolean;
  onLeave: () => void;
}

function RoomContent({ room, playerId, categories, busy, onLeave }: RoomContentProps) {
  const store = useOnlineStore();
  const game = room.game;

  if (game === null) {
    return (
      <LobbyView
        room={room}
        playerId={playerId}
        categories={categories}
        busy={busy}
        onChangeSettings={store.updateSettings}
        onReady={store.setReady}
        onKick={store.kick}
        onMakeHost={store.makeHost}
        onStart={store.startGame}
        onLeave={onLeave}
      />
    );
  }

  const me: PublicPlayerState | undefined = game.players.find((player) => player.id === playerId);
  const watching = isSpectator(room, playerId);

  if (game.phase === "finished") {
    const isHost = room.hostId === playerId;
    return (
      <>
        <h1 className="display-serif mb-10 text-5xl text-ivory sm:text-7xl">Results</h1>
        {room.results ? (
          <ResultsView
            players={game.players}
            viewerId={playerId}
            results={room.results}
            actions={
              <>
                {isHost && (
                  <Button variant="secondary" onClick={store.rematch} disabled={busy}>
                    <RotateCcw size={16} strokeWidth={ICON_STROKE} className="mr-2 inline" aria-hidden />
                    Rematch
                  </Button>
                )}
                <Button variant="ghost" onClick={onLeave}>
                  Back to home
                </Button>
              </>
            }
          />
        ) : (
          <Spinner />
        )}
        {!isHost && (
          <p className="mt-6 text-sm text-mist">
            {watching
              ? "You'll get a seat in the next game when the host starts a rematch."
              : "The host can start a rematch with everyone here."}
          </p>
        )}
      </>
    );
  }

  if (game.phase === "voting") {
    if (!me) {
      return (
        <p className="text-center">
          <Label>The players are voting…</Label>
        </p>
      );
    }
    return (
      <VotePanel
        voterId={me.id}
        voterName={me.name}
        players={game.players}
        selectedId={game.votes[me.id]}
        disabled={busy}
        timer={<Countdown deadline={game.voteDeadline} totalSeconds={game.settings.voteSeconds} label="Voting closes in" />}
        onVote={store.vote}
      />
    );
  }

  const currentId = getCurrentPlayerId(game);
  const current = game.players.find((player) => player.id === currentId);
  const isMyTurn = currentId !== null && currentId === playerId;
  let turnLabel = "";
  if (isMyTurn) {
    turnLabel = "It's your turn";
  } else if (current) {
    turnLabel = watching ? `${current.name}'s turn` : `Waiting for ${current.name}…`;
  }

  return (
    <>
      <TurnAlert isMyTurn={isMyTurn} />
      {watching && <WatchingBanner />}
      <GameBoard
        state={game}
        viewerId={playerId}
        canAct={isMyTurn}
        busy={busy}
        turnLabel={turnLabel}
        onMove={store.act}
        peeked={store.peeked}
        onPeek={store.peek}
      />
      <div className="mt-6 text-center">
        <Button variant="ghost" className="py-2 text-sm" onClick={onLeave}>
          {watching ? "Stop watching" : "Leave game"}
        </Button>
      </div>
    </>
  );
}

function isSpectator(room: RoomSnapshot, playerId: string | null): boolean {
  return playerId !== null && room.spectators.some((spectator) => spectator.id === playerId);
}

function WatchingBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-ink-raised px-4 py-3 ring-1 ring-mist/15" role="status">
      <Eye size={16} strokeWidth={ICON_STROKE} className="shrink-0 text-gold" aria-hidden />
      <p className="text-sm text-mist">
        <span className="text-ivory">You're watching.</span> You'll get a seat when the host starts a rematch.
      </p>
    </div>
  );
}

// Buzzes the phone when your turn starts, for when it's lying on the table.
// Renders nothing.
function TurnAlert({ isMyTurn }: { isMyTurn: boolean }) {
  const wasMyTurn = useRef(isMyTurn);
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) {
      buzz("turn");
    }
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn]);
  return null;
}
