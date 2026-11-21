import { Bot, Trophy } from "lucide-react";
import { Link } from "react-router";
import type { Category, SavedGame } from "@budget-draft/shared";
import { Avatar } from "../components/Avatar";
import { ArrowLink, ICON_STROKE, Label } from "../components/brand/primitives";
import { ErrorBox, PageShell, Spinner } from "../components/ui";
import { apiRequest } from "../lib/api";
import { fetchCategories } from "../lib/categories";
import { getMyGames, type MyGame } from "../lib/matchHistory";
import { useAsync } from "../lib/useAsync";

interface MyGamesData {
  games: { saved: SavedGame; mine: MyGame }[];
  categories: Category[];
}

async function loadMyGames(): Promise<MyGamesData> {
  const mine = getMyGames();
  if (mine.length === 0) {
    return { games: [], categories: [] };
  }
  const ids = mine.map((game) => game.resultId).join(",");
  const [saved, categories] = await Promise.all([
    apiRequest<SavedGame[]>(`/api/results?ids=${ids}`),
    fetchCategories().catch(() => []),
  ]);
  const games: MyGamesData["games"] = [];
  for (const game of saved) {
    const entry = mine.find((m) => m.resultId === game.id);
    if (entry) {
      games.push({ saved: game, mine: entry });
    }
  }
  return { games, categories };
}

export function categoryLabel(slug: string, categories: Category[]): string {
  if (slug === "custom") {
    return "Custom list";
  }
  const category = categories.find((c) => c.slug === slug);
  return category ? `${category.emoji} ${category.name}` : slug;
}

const MODE_LABELS: Record<SavedGame["mode"], string> = {
  local: "Pass & play",
  bot: "Solo vs bots",
  online: "Online",
};

export function formatPlayedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// "My games": the last 20 games played on this device.
export function MyGamesPage() {
  const data = useAsync(loadMyGames, []);

  return (
    <PageShell title="My games" backTo="/">
      <p className="mb-8 max-w-2xl text-mist">The last 20 games finished on this device. Tap one to see the final teams.</p>
      {data.status === "loading" && <Spinner label="Loading your games…" />}
      {data.status === "error" && <ErrorBox message={data.message} onRetry={data.retry} />}
      {data.status === "ready" && data.data.games.length === 0 && (
        <div className="grid justify-items-start gap-5 border-y border-mist/15 py-10">
          <p className="display-serif text-5xl text-ivory">No games yet.</p>
          <ArrowLink to="/">Play your first draft</ArrowLink>
        </div>
      )}
      {data.status === "ready" && data.data.games.length > 0 && (
        <ul className="grid gap-3">
          {data.data.games.map(({ saved, mine }) => (
            <li key={saved.id}>
              <GameRow game={saved} mine={mine} categories={data.data.categories} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function GameRow({ game, mine, categories }: { game: SavedGame; mine: MyGame; categories: Category[] }) {
  const ranked = [...game.players].sort((a, b) => b.total - a.total);
  const me = mine.playerId === null ? undefined : game.players.find((p) => p.playerId === mine.playerId);
  let outcome = "";
  if (me) {
    outcome = game.statsWinnerIds.includes(me.playerId) ? "You won" : `You scored ${me.total}`;
  }

  return (
    <Link
      to={`/games/${game.id}`}
      className="grid gap-3 rounded-[1.5rem] bg-ink-raised p-4 ring-1 ring-mist/15 transition hover:bg-ink-hover sm:p-5"
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="display-serif text-2xl text-ivory">{categoryLabel(game.categorySlug, categories)}</span>
        <Label className="text-mist/80">{formatPlayedAt(game.playedAt)}</Label>
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Label>
          {MODE_LABELS[game.mode]} · {game.draftStyle === "auction" ? "Auction" : "Classic"}
        </Label>
        {outcome !== "" && (
          <Label className="flex items-center gap-1 text-gold">
            {outcome === "You won" && <Trophy size={13} strokeWidth={ICON_STROKE} aria-hidden />}
            {outcome}
          </Label>
        )}
      </span>
      <span className="flex flex-wrap gap-x-4 gap-y-2">
        {ranked.map((player) => (
          <span key={player.playerId} className="flex min-w-0 items-center gap-2">
            {player.isBot ? (
              <Bot size={16} strokeWidth={ICON_STROKE} className="text-gold" aria-label="bot" />
            ) : (
              <Avatar name={player.name} avatar={player.avatar} size="xs" />
            )}
            <span className="truncate text-sm text-ivory">{player.name}</span>
            <span className="text-sm text-mist tabular-nums">{player.total}</span>
          </span>
        ))}
      </span>
    </Link>
  );
}
