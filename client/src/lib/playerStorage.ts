// Remembers things between visits in localStorage:
// - the player id for each room, so a refresh or dropped connection puts you back in your seat
// - the last name you used, so you don't have to type it every time
// localStorage can throw (private mode, storage full), so every call is wrapped.
import { isAvatarId, type AvatarId } from "@budget-draft/shared";

const NAME_KEY = "budget-draft:name";

function roomKey(code: string): string {
  return `budget-draft:room:${code.toUpperCase()}`;
}

export function getStoredPlayerId(code: string): string | undefined {
  try {
    return localStorage.getItem(roomKey(code)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storePlayerId(code: string, playerId: string): void {
  try {
    localStorage.setItem(roomKey(code), playerId);
  } catch {
    // Not fatal: reconnecting just won't work after a full page reload.
  }
}

export function forgetRoom(code: string): void {
  try {
    localStorage.removeItem(roomKey(code));
  } catch {
    // ignore
  }
}

export function getStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

const AVATAR_KEY = "budget-draft:avatar";

// The avatar this device last picked, sent along when joining a room.
export function getStoredAvatar(): AvatarId | undefined {
  try {
    const stored = localStorage.getItem(AVATAR_KEY);
    return isAvatarId(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function storeAvatar(avatar: AvatarId): void {
  try {
    localStorage.setItem(AVATAR_KEY, avatar);
  } catch {
    // ignore
  }
}
