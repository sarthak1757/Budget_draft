import { Avatar } from "./Avatar";
import { Award, Bot, Gem, Gift, Share2, Trophy, Vote } from "lucide-react";
import { ACHIEVEMENTS, achievementsFor, pricePaid, type GameResults, type PublicItem, type PublicPlayerState } from "@budget-draft/shared";
import { useEffect, type ReactNode } from "react";
import { buildResultsShareText } from "../lib/shareResults";
import { copyToClipboard } from "../lib/daily";
import { buzz, playSound } from "../store/soundStore";
import { showToast } from "../store/toastStore";
import { ChromeBlob } from "./brand/ChromeBlob";
import { ICON_STROKE, Label, PillButton } from "./brand/primitives";

interface ResultsViewProps {
  players: PublicPlayerState[];
  results: GameResults;
  // Buttons shown under the winner (Play again, Rematch, Home...). Share is always there.
  actions?: ReactNode;
  // A daily challenge has its own share line, so it hides the generic one.
  hideShare?: boolean;
  // Online: this device's player, so only the winner's phone buzzes.
  // Left out on a shared device, where it always buzzes.
  viewerId?: string | null;
  // The game's Balanced team roles, for the Full Squad badge. Empty when that extra was off.
  requiredRoles?: string[];
}

function namesFor(ids: string[], players: PublicPlayerState[]): string {
  const names: string[] = [];
  for (const id of ids) {
    for (const player of players) {
      if (player.id === id) {
        names.push(player.name);
      }
    }
  }
  return names.join(" & ");
}

// The item with the most rating per dollar paid: the smartest buy on a team.
export function findBestValue(team: (PublicItem | null)[]): PublicItem | null {
  let best: PublicItem | null = null;
  let bestRatio = 0;
  for (const item of team) {
    const paid = item === null ? 0 : pricePaid(item);
    if (item === null || item.isBench || paid <= 0 || item.rating === null) {
      continue;
    }
    const ratio = item.rating / paid;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = item;
    }
  }
  return best;
}

export function ResultsView({ players, results, actions, hideShare = false, viewerId, requiredRoles = [] }: ResultsViewProps) {
  // A short fanfare when the results first appear, and a buzz for the winner.
  const viewerWon = viewerId === undefined || (viewerId !== null && results.statsWinnerIds.includes(viewerId));
  useEffect(() => {
    playSound("win");
    if (viewerWon) {
      buzz("win");
    }
    // Only when the results first appear, not on every update.
  }, []);
  const statsTie = results.statsWinnerIds.length > 1;
  const voteTie = results.voteWinnerIds.length > 1;

  async function share() {
    const copied = await copyToClipboard(buildResultsShareText(players, results));
    showToast(copied ? "Copied! Paste it anywhere." : "Couldn't copy to the clipboard.", copied ? "success" : "warning");
  }

  return (
    <div className="grid gap-12">
      {/* The winner, huge, with a chrome shape behind the letters. */}
      <section className="relative isolate grid gap-4 overflow-hidden pb-2">
        {/* Smaller on phones so it stays behind the name, clear of the buttons. */}
        <ChromeBlob shape="ribbon" className="absolute -top-4 -right-8 -z-10 w-36 sm:-top-6 sm:right-[8%] sm:w-80" />
        <Label className="flex items-center gap-2 text-ivory">
          <Trophy size={14} strokeWidth={ICON_STROKE} aria-hidden />
          Stats winner{statsTie && " · tie"}
        </Label>
        <p className="display-serif text-6xl break-words text-ivory [text-shadow:0_4px_28px_var(--color-ink-raised)] sm:text-9xl">
          {namesFor(results.statsWinnerIds, players)}
        </p>
        {results.votingHeld && (
          <div className="grid gap-1">
            <Label className="flex items-center gap-2">
              <Vote size={14} strokeWidth={ICON_STROKE} aria-hidden />
              Vote winner{voteTie && " · tie"}
            </Label>
            <p className="display-serif text-4xl text-ivory sm:text-6xl">
              {results.voteWinnerIds.length > 0 ? namesFor(results.voteWinnerIds, players) : "No votes cast"}
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {!hideShare && (
            <PillButton onClick={() => void share()}>
              <Share2 size={16} strokeWidth={ICON_STROKE} aria-hidden />
              Share result
            </PillButton>
          )}
          {actions}
        </div>
      </section>

      <div className="grid gap-4">
        <Label className="flex items-center gap-2 text-mist/80">
          <Gem size={13} strokeWidth={ICON_STROKE} className="text-gold" aria-hidden />
          Best value pick · most rating per dollar
        </Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {results.scores.map((score, rank) => {
            const player = players.find((p) => p.id === score.playerId);
            if (!player) {
              return null;
            }
            const isWinner = results.statsWinnerIds.includes(score.playerId);
            const bestValue = findBestValue(player.team);
            // How much of the total came from ratings vs leftover money, for the line.
            const ratingShare = score.total > 0 ? (score.ratingTotal / score.total) * 100 : 0;
            return (
              <section
                key={score.playerId}
                className={`grid grid-cols-[minmax(0,1fr)] content-start gap-4 rounded-[1.75rem] bg-ink-raised p-5 ${isWinner ? "shadow-glow" : "ring-1 ring-mist/15"}`}
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="grid min-w-0 gap-1">
                    <Label className="flex items-center gap-2 text-mist/80">
                      {String(rank + 1).padStart(2, "0")}
                      {player.isBot && <Bot size={13} strokeWidth={ICON_STROKE} className="text-gold" aria-label="bot" />}
                    </Label>
                    <h2 className="display-serif flex min-w-0 items-center gap-3 text-3xl text-ivory">
                      {player.avatar && <Avatar name={player.name} avatar={player.avatar} size="md" />}
                      <span className="truncate">{player.name}</span>
                    </h2>
                  </div>
                  <span className="display-serif text-6xl text-ivory tabular-nums">{score.total}</span>
                </header>

                <div className="flex h-[2px] bg-mist/20" aria-hidden>
                  <div className="bg-mist" style={{ width: `${ratingShare}%` }} />
                  <div className="bg-gold" style={{ width: `${100 - ratingShare}%` }} />
                </div>
                <Badges player={player} requiredRoles={requiredRoles} />
                <dl className="grid gap-1.5">
                  <ScoreRow label="Rating" value={String(score.ratingTotal)} />
                  <ScoreRow label="Leftover" value={`+${score.leftoverBonus}`} />
                  {score.roleBonus > 0 && <ScoreRow label="Balanced team" value={`+${score.roleBonus}`} />}
                  {results.votingHeld && (
                    <ScoreRow label="Votes" value={String(score.votesReceived)} />
                  )}
                </dl>

                <ol className="grid grid-cols-[minmax(0,1fr)]">
                  {player.team.map((item, index) =>
                    item ? (
                      <li key={index} className="flex items-center gap-2 border-t border-mist/15 py-2 last:border-b">
                        <span className="min-w-0 flex-1">
                          <span className={`display-serif block truncate text-xl ${item.isBench ? "text-mist/70" : "text-ivory"}`}>
                            {item.name}
                          </span>
                          <Label className="text-mist/80">${pricePaid(item)}</Label>
                        </span>
                        {item.isMystery && (
                          <Gift size={15} strokeWidth={ICON_STROKE} className="shrink-0 text-gold" aria-label="Was a mystery item" />
                        )}
                        {/* Outside the truncated name so it's never cut off. */}
                        {item === bestValue && (
                          <Gem size={15} strokeWidth={ICON_STROKE} className="shrink-0 text-gold" aria-label="Best value" />
                        )}
                        <span className="display-serif w-9 text-right text-2xl text-ivory tabular-nums">{item.rating ?? "?"}</span>
                      </li>
                    ) : null,
                  )}
                </ol>
                <Label className="text-mist/80">${player.budget} left</Label>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt>
        <Label className="text-mist/80">{label}</Label>
      </dt>
      <dd className="text-mist tabular-nums">{value}</dd>
    </div>
  );
}


// The achievements a player earned this game, as small gold pills.
function Badges({ player, requiredRoles }: { player: PublicPlayerState; requiredRoles: string[] }) {
  const earned = achievementsFor(player, requiredRoles);
  if (earned.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Achievements">
      {earned.map((id) => {
        const achievement = ACHIEVEMENTS[id];
        return (
          <li key={id} className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 ring-1 ring-gold/40">
            <Award size={13} strokeWidth={ICON_STROKE} className="shrink-0 text-gold" aria-hidden />
            <span className="label-caps text-[11px] tracking-[0.1em] text-gold">{achievement.name}</span>
            <span className="text-xs text-mist">· {achievement.description}</span>
          </li>
        );
      })}
    </ul>
  );
}
