import type { z } from "zod";
import { DEFAULT_SETTINGS, type GameState, type Item, type PlayerState, type localResultSchema } from "@budget-draft/shared";

type LocalResult = z.output<typeof localResultSchema>;

// Rebuilds a finished GameState from a submitted local/bot result, so the
// server can score it with the same shared code as online games instead of
// trusting totals sent by the browser.
export function localResultToState(result: LocalResult): GameState {
  const players: PlayerState[] = [];
  const playerIds = new Set<string>();

  for (const submitted of result.players) {
    const team: Item[] = [];
    for (let i = 0; i < submitted.team.length; i++) {
      const item = submitted.team[i];
      if (!item) {
        continue;
      }
      team.push({
        id: `${submitted.id}-${i}`,
        name: item.name,
        category: result.categorySlug,
        price: item.price,
        rating: item.rating,
        tag: item.tag,
        isBench: item.isBench,
      });
    }
    players.push({
      id: submitted.id,
      name: submitted.name,
      isBot: submitted.isBot,
      ...(submitted.avatar === undefined ? {} : { avatar: submitted.avatar }),
      isConnected: true,
      budget: submitted.budgetLeft,
      team,
      usedPowerUps: [],
    });
    playerIds.add(submitted.id);
  }

  // Keep only votes between real players, and never a vote for yourself.
  const votes: Record<string, string> = {};
  for (const [voterId, targetId] of Object.entries(result.votes)) {
    if (playerIds.has(voterId) && playerIds.has(targetId) && voterId !== targetId) {
      votes[voterId] = targetId;
    }
  }

  return {
    mode: result.mode,
    phase: "finished",
    settings: {
      ...DEFAULT_SETTINGS,
      draftStyle: result.draftStyle,
      balancedTeam: result.requiredRoles.length > 0,
      startingBudget: result.startingBudget,
      slotCount: result.slotCount,
      turnSeconds: 0,
      voteSeconds: 0,
      categorySlug: result.categorySlug,
    },
    players,
    itemPool: [],
    currentItem: null,
    roundNumber: 0,
    firstPlayerIndex: 0,
    turnQueue: [],
    cantAffordIds: [],
    auction: null,
    requiredRoles: result.requiredRoles,
    rulesPreset: result.rulesPreset,
    turnDeadline: null,
    votes,
    voteDeadline: null,
    lastEvents: [],
  };
}
