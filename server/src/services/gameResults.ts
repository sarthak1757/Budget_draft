import { CUSTOM_CATEGORY_SLUG, pricePaid, type GameResults, type GameState, type LeaderboardEntry } from "@budget-draft/shared";
import { GameResultModel, type PlayerResult, type TeamItemSnapshot } from "../models/GameResult";

// Turns a finished game into a GameResult document and saves it.
export async function saveGameResult(state: GameState, results: GameResults, roomCode?: string): Promise<void> {
  const players: PlayerResult[] = [];
  for (const player of state.players) {
    const team: TeamItemSnapshot[] = [];
    for (const item of player.team) {
      if (item !== null) {
        team.push({
          name: item.name,
          price: pricePaid(item), // what was paid, so price + money left adds up

          rating: item.rating,
          tag: item.tag,
          isBench: item.isBench === true,
        });
      }
    }
    const score = results.scores.find((entry) => entry.playerId === player.id);
    players.push({
      playerId: player.id,
      name: player.name,
      isBot: player.isBot,
      ...(player.avatar === undefined ? {} : { avatar: player.avatar }),
      budgetLeft: player.budget,
      team,
      ratingTotal: score?.ratingTotal ?? 0,
      leftoverBonus: score?.leftoverBonus ?? 0,
      total: score?.total ?? 0,
      votesReceived: score?.votesReceived ?? 0,
    });
  }

  await GameResultModel.create({
    mode: state.mode,
    categorySlug: state.settings.categorySlug,
    roomCode,
    settings: { startingBudget: state.settings.startingBudget, slotCount: state.settings.slotCount },
    draftStyle: state.settings.draftStyle,
    preset: state.rulesPreset,
    players,
    statsWinnerIds: results.statsWinnerIds,
    voteWinnerIds: results.voteWinnerIds,
    votingHeld: results.votingHeld,
    // Only online games are ranked: in local/bot games one person controls every name.
    // Custom lists aren't either: the host could paste a list of easy 100s.
    countsForLeaderboard: state.mode === "online" && state.settings.categorySlug !== CUSTOM_CATEGORY_SLUG,
    playedAt: new Date(),
  });
}

// Only these games set a "best score": auctions, power-ups and the bonus all
// change what a score means, so comparing across them wouldn't be fair.
// Old results have no draftStyle/preset fields, and count as Classic.
const IS_PLAIN_CLASSIC = {
  $and: [
    { $eq: [{ $ifNull: ["$draftStyle", "classic"] }, "classic"] },
    { $eq: [{ $ifNull: ["$preset", "classic"] }, "classic"] },
  ],
};

// Wins = times a player was the stats winner (a shared win in a tie still counts),
// across every draft style and preset.
// Players are grouped by name, case-insensitive, since there are no accounts.
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  return GameResultModel.aggregate<LeaderboardEntry>([
    { $match: { countsForLeaderboard: true } },
    { $unwind: "$players" },
    { $match: { "players.isBot": false } },
    {
      $group: {
        _id: { $toLower: "$players.name" },
        name: { $first: "$players.name" },
        gamesPlayed: { $sum: 1 },
        wins: { $sum: { $cond: [{ $in: ["$players.playerId", "$statsWinnerIds"] }, 1, 0] } },
        // $max skips nulls, so non-Classic games simply don't take part.
        bestScore: { $max: { $cond: [IS_PLAIN_CLASSIC, "$players.total", null] } },
      },
    },
    { $sort: { wins: -1, bestScore: -1, gamesPlayed: 1, name: 1 } },
    { $limit: limit },
    { $project: { _id: 0, name: 1, wins: 1, gamesPlayed: 1, bestScore: 1 } },
  ]);
}
