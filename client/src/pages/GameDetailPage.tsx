import { Bot } from "lucide-react";
import { useParams } from "react-router";
import type { Category, SavedGame } from "@budget-draft/shared";
import { Avatar } from "../components/Avatar";
import { ICON_STROKE, Label } from "../components/brand/primitives";
import { ErrorBox, PageShell, Spinner } from "../components/ui";
import { apiRequest } from "../lib/api";
import { fetchCategories } from "../lib/categories";
import { useAsync } from "../lib/useAsync";
import { categoryLabel, formatPlayedAt } from "./MyGamesPage";

// One saved game: every player's final team and score.
export function GameDetailPage() {
  const id = useParams().id ?? "";
  const data = useAsync(
    async (): Promise<{ game: SavedGame; categories: Category[] }> => {
      const [game, categories] = await Promise.all([
        apiRequest<SavedGame>(`/api/results/${encodeURIComponent(id)}`),
        fetchCategories().catch(() => []),
      ]);
      return { game, categories };
    },
    [id],
  );

  return (
    <PageShell title="Final teams" backTo="/games">
      {data.status === "loading" && <Spinner label="Loading the game…" />}
      {data.status === "error" && <ErrorBox message={data.message} onRetry={data.retry} />}
      {data.status === "ready" && <GameDetail game={data.data.game} categories={data.data.categories} />}
    </PageShell>
  );
}

function GameDetail({ game, categories }: { game: SavedGame; categories: Category[] }) {
  const ranked = [...game.players].sort((a, b) => b.total - a.total);
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <p className="display-serif text-4xl text-ivory">{categoryLabel(game.categorySlug, categories)}</p>
        <Label className="text-mist/80">
          {formatPlayedAt(game.playedAt)} · {game.draftStyle === "auction" ? "Auction" : "Classic"}
        </Label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map((player, rank) => {
          const isWinner = game.statsWinnerIds.includes(player.playerId);
          return (
            <section
              key={player.playerId}
              aria-label={`${player.name}'s team`}
              className={`grid grid-cols-[minmax(0,1fr)] content-start gap-4 rounded-[1.75rem] bg-ink-raised p-5 ${isWinner ? "shadow-glow" : "ring-1 ring-mist/15"}`}
            >
              <header className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  {player.isBot ? (
                    <Bot size={20} strokeWidth={ICON_STROKE} className="text-gold" aria-label="bot" />
                  ) : (
                    <Avatar name={player.name} avatar={player.avatar} />
                  )}
                  <span className="grid min-w-0">
                    <Label className="text-mist/80">
                      {String(rank + 1).padStart(2, "0")}
                      {isWinner && " · winner"}
                    </Label>
                    <span className="display-serif truncate text-3xl text-ivory">{player.name}</span>
                  </span>
                </span>
                <span className="display-serif text-5xl text-ivory tabular-nums">{player.total}</span>
              </header>
              <ul className="grid gap-2">
                {player.team.map((item, index) => (
                  <li key={index} className="flex items-baseline justify-between gap-3 border-t border-mist/15 pt-2">
                    <span className="grid min-w-0">
                      <span className="truncate text-ivory">{item.name}</span>
                      <Label className="truncate text-mist/70">{item.tag}</Label>
                    </span>
                    <span className="shrink-0 text-sm text-mist tabular-nums">
                      ${item.price} · {item.rating}
                    </span>
                  </li>
                ))}
              </ul>
              <Label className="text-mist/80">
                ${player.budgetLeft} left · +{player.leftoverBonus} leftover
                {game.votingHeld && ` · ${player.votesReceived} votes`}
              </Label>
            </section>
          );
        })}
      </div>
    </div>
  );
}
