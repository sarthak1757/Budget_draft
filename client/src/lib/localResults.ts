import { pricePaid, type GameState, type LocalResultPayload } from "@budget-draft/shared";
import { apiRequest } from "./api";

// Shapes a finished local/bot game the way POST /api/results expects.
export function buildLocalResultPayload(game: GameState): LocalResultPayload | null {
  if (game.mode === "online" || game.phase !== "finished") {
    return null;
  }
  const players: LocalResultPayload["players"] = [];
  for (const player of game.players) {
    const team: LocalResultPayload["players"][number]["team"] = [];
    for (const item of player.team) {
      if (item !== null) {
        team.push({
          name: item.name,
          // What was paid: the server checks paid + money left = starting budget.
          price: pricePaid(item),
          rating: item.rating,
          tag: item.tag,
          isBench: item.isBench === true,
        });
      }
    }
    players.push({
      id: player.id,
      name: player.name,
      isBot: player.isBot,
      ...(player.avatar === undefined ? {} : { avatar: player.avatar }),
      budgetLeft: player.budget,
      team,
    });
  }
  return {
    mode: game.mode,
    categorySlug: game.settings.categorySlug,
    draftStyle: game.settings.draftStyle,
    rulesPreset: game.rulesPreset,
    requiredRoles: game.requiredRoles,
    startingBudget: game.settings.startingBudget,
    slotCount: game.settings.slotCount,
    players,
    votes: game.votes,
  };
}

// Best effort: if the server is down, the game still ends normally. These
// results don't count for the leaderboard, so losing one isn't a big deal.
export async function submitLocalResult(game: GameState): Promise<void> {
  const payload = buildLocalResultPayload(game);
  if (payload === null) {
    return;
  }
  try {
    await apiRequest("/api/results", { method: "POST", body: payload, timeoutMs: 5000 });
  } catch (error) {
    console.info("Result not saved:", error instanceof Error ? error.message : error);
  }
}
