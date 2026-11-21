// "My games": the ids of the last games played on this device, newest first.
// The results themselves live on the server (GameResult); only ids are kept here.

export interface MyGame {
  resultId: string;
  // Which player was this device, when we know (online, solo vs bots).
  // Null for pass-and-play, where everyone shared the phone.
  playerId: string | null;
}

export const MY_GAMES_KEY = "budget-draft:my-games";
export const MY_GAMES_LIMIT = 20;

// Adds a game to the front, without duplicates, keeping the newest 20.
export function addMyGame(list: MyGame[], game: MyGame): MyGame[] {
  const next: MyGame[] = [game];
  for (const existing of list) {
    if (existing.resultId !== game.resultId && next.length < MY_GAMES_LIMIT) {
      next.push(existing);
    }
  }
  return next;
}

// Reads the stored list, ignoring anything that doesn't look right
// (an older format, or someone editing localStorage by hand).
export function parseMyGames(raw: string | null): MyGame[] {
  if (raw === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const games: MyGame[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const resultId: unknown = (entry as Record<string, unknown>).resultId;
    const playerId: unknown = (entry as Record<string, unknown>).playerId;
    if (typeof resultId === "string" && /^[a-f0-9]{24}$/.test(resultId) && (typeof playerId === "string" || playerId === null)) {
      games.push({ resultId, playerId });
    }
  }
  return games.slice(0, MY_GAMES_LIMIT);
}

export function getMyGames(): MyGame[] {
  try {
    return parseMyGames(localStorage.getItem(MY_GAMES_KEY));
  } catch {
    return [];
  }
}

export function rememberGame(game: MyGame): void {
  try {
    localStorage.setItem(MY_GAMES_KEY, JSON.stringify(addMyGame(getMyGames(), game)));
  } catch {
    // Private mode or storage full: the game just won't be listed.
  }
}
